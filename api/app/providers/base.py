from __future__ import annotations

from dataclasses import dataclass, field
from abc import ABC, abstractmethod
from typing import Any

from ..schemas import HouseSpec


@dataclass
class ProviderMeta:
    provider: str
    model: str | None = None
    request_id: str | None = None
    latency_ms: int | None = None
    input_tokens: int | None = None
    output_tokens: int | None = None
    total_tokens: int | None = None
    image_tokens: int | None = None
    raw: dict[str, Any] = field(default_factory=dict)


@dataclass
class ProviderSpecResult:
    spec: HouseSpec
    meta: ProviderMeta


@dataclass
class ProviderImageResult:
    image_bytes: bytes
    mime_type: str
    meta: ProviderMeta


class Provider(ABC):
    @abstractmethod
    def generate_house_spec(
        self, *, prompt: str, bedrooms: int, bathrooms: int, style: str
    ) -> ProviderSpecResult: ...

    @abstractmethod
    def maybe_generate_exterior_image(self, *, prompt: str, style: str) -> ProviderImageResult | None:
        """
        Returns an image payload or None if not available.
        """
