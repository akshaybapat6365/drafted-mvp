from __future__ import annotations

import datetime as dt
from typing import Any
from typing import Literal

from pydantic import BaseModel, Field


class AuthSignupIn(BaseModel):
    email: str
    password: str = Field(min_length=8, max_length=128)


class AuthLoginIn(BaseModel):
    email: str
    password: str


class AuthTokenOut(BaseModel):
    access_token: str
    token_type: Literal["bearer"] = "bearer"


class MeOut(BaseModel):
    id: str
    email: str
    plan_tier: str
    credits: int


class SessionCreateIn(BaseModel):
    title: str = "Untitled session"


class SessionOut(BaseModel):
    id: str
    title: str
    status: str
    created_at: dt.datetime


class JobCreateIn(BaseModel):
    prompt: str
    bedrooms: int = Field(default=3, ge=1, le=10)
    bathrooms: int = Field(default=2, ge=1, le=10)
    style: str = Field(default="contemporary", max_length=64)
    want_exterior_image: bool = True
    idempotency_key: str | None = Field(default=None, max_length=80)
    priority: Literal["normal", "high"] = "normal"


class JobRegenerateIn(BaseModel):
    prompt: str | None = None
    bedrooms: int | None = Field(default=None, ge=1, le=10)
    bathrooms: int | None = Field(default=None, ge=1, le=10)
    style: str | None = Field(default=None, max_length=64)
    want_exterior_image: bool | None = None
    reuse_spec: bool | None = None


class LimitsOut(BaseModel):
    credits: int
    plan_tier: str


class JobOut(BaseModel):
    id: str
    session_id: str
    prompt: str
    bedrooms: int
    bathrooms: int
    style: str
    status: str
    stage: str
    error: str | None
    failure_code: str | None
    retry_count: int
    provider_meta: dict[str, Any] = {}
    stage_timestamps: dict[str, str] = {}
    warnings: list[str] = []
    created_at: dt.datetime
    updated_at: dt.datetime


class ArtifactOut(BaseModel):
    id: str
    type: str
    mime_type: str
    checksum_sha256: str | None
    size_bytes: int | None
    url: str
    created_at: dt.datetime


class ArtifactsOut(BaseModel):
    job_id: str
    items: list[ArtifactOut]


class HouseSpecRoom(BaseModel):
    id: str
    type: str
    name: str
    area_ft2: float


class HouseSpec(BaseModel):
    version: str = "1.0"
    style: str
    bedrooms: int
    bathrooms: int
    rooms: list[HouseSpecRoom]
    notes: list[str] = []


class Rect(BaseModel):
    x: float
    y: float
    w: float
    h: float


class PlanRoom(BaseModel):
    id: str
    name: str
    type: str
    area_ft2: float
    rect_ft: Rect


class PlanEdge(BaseModel):
    a: str
    b: str
    kind: str = "adjacent"


class PlanGraph(BaseModel):
    version: str = "1.0"
    outline_ft: Rect
    rooms: list[PlanRoom]
    edges: list[PlanEdge]
    warnings: list[str] = []


class ApiErrorOut(BaseModel):
    code: str
    message: str
    details: dict[str, Any] | None = None
    retryable: bool = False


class FrontendEventIn(BaseModel):
    event_name: str = Field(min_length=2, max_length=120)
    page: str = Field(min_length=1, max_length=240)
    status: str | None = Field(default=None, max_length=64)
    metadata: dict[str, Any] | None = None
    at: dt.datetime | None = None
