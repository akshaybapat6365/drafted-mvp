from __future__ import annotations

import json
import time
from typing import Any

import httpx

from ..config import settings
from ..schemas import HouseSpec
from .base import Provider, ProviderImageResult, ProviderMeta, ProviderSpecResult


def _house_spec_json_schema() -> dict[str, Any]:
    # This is passed to Gemini as responseJsonSchema. Keep it minimal and strict.
    return {
        "type": "object",
        "required": ["version", "style", "bedrooms", "bathrooms", "rooms"],
        "properties": {
            "version": {"type": "string"},
            "style": {"type": "string"},
            "bedrooms": {"type": "integer", "minimum": 1, "maximum": 10},
            "bathrooms": {"type": "integer", "minimum": 1, "maximum": 10},
            "rooms": {
                "type": "array",
                "items": {
                    "type": "object",
                    "required": ["id", "type", "name", "area_ft2"],
                    "properties": {
                        "id": {"type": "string"},
                        "type": {"type": "string"},
                        "name": {"type": "string"},
                        "area_ft2": {"type": "number", "minimum": 20, "maximum": 2000},
                    },
                },
            },
            "notes": {"type": "array", "items": {"type": "string"}},
        },
    }


class GeminiProvider(Provider):
    def __init__(self) -> None:
        if not settings.gemini_api_key:
            raise RuntimeError("GEMINI_API_KEY is not set")

    def _generate_content(self, *, model: str, body: dict[str, Any]) -> tuple[dict[str, Any], ProviderMeta]:
        url = f"{settings.gemini_base_url}/models/{model}:generateContent"
        params = {"key": settings.gemini_api_key}
        t0 = time.perf_counter()
        with httpx.Client(timeout=60) as client:
            r = client.post(url, params=params, json=body)
            r.raise_for_status()
            data = r.json()
            usage = data.get("usageMetadata", {})
            req_id = r.headers.get("x-goog-request-id") or r.headers.get("x-request-id")
            meta = ProviderMeta(
                provider="gemini",
                model=model,
                request_id=req_id,
                latency_ms=int((time.perf_counter() - t0) * 1000),
                input_tokens=usage.get("promptTokenCount"),
                output_tokens=usage.get("candidatesTokenCount"),
                total_tokens=usage.get("totalTokenCount"),
                image_tokens=usage.get("imageTokenCount"),
                raw={"usageMetadata": usage},
            )
            return data, meta

    def generate_house_spec(
        self, *, prompt: str, bedrooms: int, bathrooms: int, style: str
    ) -> ProviderSpecResult:
        system = (
            "You are an architecture drafting assistant. "
            "Return ONLY valid JSON matching the provided schema. "
            "Use unique stable room ids (uuid strings) and realistic areas in ft^2."
        )
        user = (
            f"User prompt: {prompt}\n"
            f"Constraints: bedrooms={bedrooms}, bathrooms={bathrooms}, style={style}\n"
            "Include core public rooms (living, kitchen, dining) and the requested bedrooms/bathrooms.\n"
        )
        body = {
            "contents": [
                {"role": "user", "parts": [{"text": system}]},
                {"role": "user", "parts": [{"text": user}]},
            ],
            "generationConfig": {
                "temperature": 0.2,
                "responseMimeType": "application/json",
                "responseJsonSchema": _house_spec_json_schema(),
            },
        }
        data, meta = self._generate_content(model=settings.gemini_text_model, body=body)
        txt = (
            data.get("candidates", [{}])[0]
            .get("content", {})
            .get("parts", [{}])[0]
            .get("text", "{}")
        )
        try:
            obj = json.loads(txt)
        except json.JSONDecodeError as e:
            raise RuntimeError(f"Gemini returned non-JSON: {e}: {txt[:200]}") from e
        return ProviderSpecResult(spec=HouseSpec.model_validate(obj), meta=meta)

    def maybe_generate_exterior_image(self, *, prompt: str, style: str) -> ProviderImageResult | None:
        # Optional. We keep this conservative because many environments won't have API keys.
        # When enabled, we request IMAGE output and accept common image payload keys.
        body = {
            "contents": [
                {
                    "role": "user",
                    "parts": [
                        {
                            "text": (
                                "Generate a photorealistic exterior rendering for a single-family home. "
                                f"Style: {style}. "
                                f"Brief: {prompt}. "
                                "No text or watermark. Daylight. 3/4 front view."
                            )
                        }
                    ],
                }
            ],
            "generationConfig": {
                "responseModalities": ["IMAGE"],
                # Official docs commonly use imageSize as "1K" / "2K" / "4K" (model dependent).
                "imageConfig": {"aspectRatio": "16:9", "imageSize": "1K"},
            },
        }
        data, meta = self._generate_content(model=settings.gemini_image_model_preview, body=body)
        parts = data.get("candidates", [{}])[0].get("content", {}).get("parts", [])
        for part in parts:
            inline = part.get("inlineData") or part.get("inline_data")
            if inline and "data" in inline:
                import base64

                mime = inline.get("mimeType") or inline.get("mime_type") or "image/png"
                return ProviderImageResult(
                    image_bytes=base64.b64decode(inline["data"]),
                    mime_type=mime,
                    meta=meta,
                )
        return None
