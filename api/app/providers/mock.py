from __future__ import annotations

import re
import uuid
from threading import Lock

import httpx

from ..config import settings
from ..schemas import HouseSpec, HouseSpecRoom
from .base import Provider, ProviderImageResult, ProviderMeta, ProviderSpecResult


_counter_lock = Lock()
_spec_calls = 0
_image_calls = 0


def _next_call_index(scope: str) -> int:
    global _spec_calls, _image_calls
    with _counter_lock:
        if scope == "spec":
            _spec_calls += 1
            return _spec_calls
        _image_calls += 1
        return _image_calls


def _scope_enabled(scope: str) -> bool:
    configured = settings.transient_stub_scope.strip().lower()
    if configured not in {"spec", "image", "both"}:
        configured = "spec"
    return configured == scope or configured == "both"


def _should_inject(scope: str, call_index: int) -> bool:
    if not settings.transient_stub_enabled:
        return False
    if not _scope_enabled(scope):
        return False
    first_n = max(0, settings.transient_stub_fail_first_n)
    every_n = max(0, settings.transient_stub_fail_every_n)
    if first_n > 0 and call_index <= first_n:
        return True
    if every_n > 0 and call_index % every_n == 0:
        return True
    return False


def _raise_transient(scope: str, call_index: int) -> None:
    status = int(settings.transient_stub_http_code)
    if status not in {408, 409, 425, 429, 500, 502, 503, 504}:
        status = 503
    request = httpx.Request("POST", f"https://transient-stub.local/{scope}")
    response = httpx.Response(status_code=status, request=request)
    raise httpx.HTTPStatusError(
        f"Injected transient stub failure scope={scope} call={call_index} status={status}",
        request=request,
        response=response,
    )


class MockProvider(Provider):
    def generate_house_spec(
        self, *, prompt: str, bedrooms: int, bathrooms: int, style: str
    ) -> ProviderSpecResult:
        call_index = _next_call_index("spec")
        if _should_inject("spec", call_index):
            _raise_transient("spec", call_index)

        # Light prompt parsing so users see some "AI-like" behavior without any API keys.
        p = prompt.lower()
        if re.search(r"farmhouse|modern farmhouse", p):
            style = "modern_farmhouse"
        elif re.search(r"hill country", p):
            style = "hill_country"
        elif re.search(r"midcentury|mid-century", p):
            style = "midcentury_modern"

        rooms: list[HouseSpecRoom] = []
        rooms.append(HouseSpecRoom(id=str(uuid.uuid4()), type="living", name="Great Room", area_ft2=320))
        rooms.append(HouseSpecRoom(id=str(uuid.uuid4()), type="kitchen", name="Kitchen", area_ft2=220))
        rooms.append(HouseSpecRoom(id=str(uuid.uuid4()), type="dining", name="Dining", area_ft2=160))
        rooms.append(HouseSpecRoom(id=str(uuid.uuid4()), type="laundry", name="Laundry", area_ft2=70))

        rooms.append(HouseSpecRoom(id=str(uuid.uuid4()), type="bedroom", name="Primary Bedroom", area_ft2=240))
        for i in range(max(0, bedrooms - 1)):
            rooms.append(HouseSpecRoom(id=str(uuid.uuid4()), type="bedroom", name=f"Bedroom {i+2}", area_ft2=150))

        for i in range(bathrooms):
            rooms.append(HouseSpecRoom(id=str(uuid.uuid4()), type="bathroom", name=f"Bathroom {i+1}", area_ft2=70))

        notes = [
            "Mock provider: set GEMINI_API_KEY to enable real model-driven specs and exterior images.",
            "This spec is authoritative; images (when enabled) are presentation-only.",
        ]
        spec = HouseSpec(style=style, bedrooms=bedrooms, bathrooms=bathrooms, rooms=rooms, notes=notes)
        meta = ProviderMeta(
            provider="mock",
            model="mock-house-spec",
            request_id=f"mock-{uuid.uuid4()}",
            latency_ms=1,
            raw={
                "call_index": call_index,
                "transient_stub_enabled": bool(settings.transient_stub_enabled),
            },
        )
        return ProviderSpecResult(spec=spec, meta=meta)

    def maybe_generate_exterior_image(self, *, prompt: str, style: str) -> ProviderImageResult | None:
        call_index = _next_call_index("image")
        if _should_inject("image", call_index):
            _raise_transient("image", call_index)
        return None
