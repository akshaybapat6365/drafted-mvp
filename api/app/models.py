from __future__ import annotations

import datetime as dt
import uuid

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


def _uuid() -> str:
    return str(uuid.uuid4())


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(Text)
    plan_tier: Mapped[str] = mapped_column(String(32), default="free")
    credits: Mapped[int] = mapped_column(Integer, default=50)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime, default=lambda: dt.datetime.now(dt.UTC))

    sessions: Mapped[list["Session"]] = relationship(back_populates="user")


class Session(Base):
    __tablename__ = "sessions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), index=True)
    title: Mapped[str] = mapped_column(String(200), default="Untitled session")
    status: Mapped[str] = mapped_column(String(32), default="active")
    created_at: Mapped[dt.datetime] = mapped_column(DateTime, default=lambda: dt.datetime.now(dt.UTC))

    user: Mapped["User"] = relationship(back_populates="sessions")
    jobs: Mapped[list["Job"]] = relationship(back_populates="session")


class Job(Base):
    __tablename__ = "jobs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    session_id: Mapped[str] = mapped_column(String(36), ForeignKey("sessions.id"), index=True)
    parent_job_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)

    prompt: Mapped[str] = mapped_column(Text)
    bedrooms: Mapped[int] = mapped_column(Integer, default=3)
    bathrooms: Mapped[int] = mapped_column(Integer, default=2)
    style: Mapped[str] = mapped_column(String(64), default="contemporary")
    want_exterior_image: Mapped[int] = mapped_column(Integer, default=1)
    idempotency_key: Mapped[str | None] = mapped_column(String(80), nullable=True, index=True)
    request_hash: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    priority: Mapped[str] = mapped_column(String(16), default="normal")

    status: Mapped[str] = mapped_column(String(32), default="queued")  # queued|running|succeeded|failed
    stage: Mapped[str] = mapped_column(String(32), default="init")  # init|spec|plan|render|image|retry_wait|done
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    failure_code: Mapped[str | None] = mapped_column(String(64), nullable=True)
    retry_count: Mapped[int] = mapped_column(Integer, default=0)
    provider_meta_json: Mapped[str] = mapped_column(Text, default="{}")
    stage_timestamps_json: Mapped[str] = mapped_column(Text, default="{}")
    warnings_json: Mapped[str] = mapped_column(Text, default="[]")

    cost_usd: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime, default=lambda: dt.datetime.now(dt.UTC))
    updated_at: Mapped[dt.datetime] = mapped_column(DateTime, default=lambda: dt.datetime.now(dt.UTC))

    session: Mapped["Session"] = relationship(back_populates="jobs")
    house_spec: Mapped["HouseSpec"] = relationship(back_populates="job", uselist=False)
    plan_graph: Mapped["PlanGraph"] = relationship(back_populates="job", uselist=False)
    artifacts: Mapped[list["Artifact"]] = relationship(back_populates="job")
    usage_events: Mapped[list["UsageEvent"]] = relationship(back_populates="job")


class HouseSpec(Base):
    __tablename__ = "house_specs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    job_id: Mapped[str] = mapped_column(String(36), ForeignKey("jobs.id"), unique=True, index=True)
    json_text: Mapped[str] = mapped_column(Text)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime, default=lambda: dt.datetime.now(dt.UTC))

    job: Mapped["Job"] = relationship(back_populates="house_spec")


class PlanGraph(Base):
    __tablename__ = "plan_graphs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    job_id: Mapped[str] = mapped_column(String(36), ForeignKey("jobs.id"), unique=True, index=True)
    json_text: Mapped[str] = mapped_column(Text)
    canonical_hash: Mapped[str] = mapped_column(String(64), index=True)
    validation_result: Mapped[str] = mapped_column(String(32), default="ok")  # ok|warn|fail
    created_at: Mapped[dt.datetime] = mapped_column(DateTime, default=lambda: dt.datetime.now(dt.UTC))

    job: Mapped["Job"] = relationship(back_populates="plan_graph")


class Artifact(Base):
    __tablename__ = "artifacts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    job_id: Mapped[str] = mapped_column(String(36), ForeignKey("jobs.id"), index=True)
    type: Mapped[str] = mapped_column(String(32))  # plan_svg|spec_json|exterior_png|...
    path: Mapped[str] = mapped_column(Text)  # local filesystem path under var_dir
    mime_type: Mapped[str] = mapped_column(String(100))
    checksum_sha256: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    size_bytes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    meta_json: Mapped[str] = mapped_column(Text, default="{}")
    created_at: Mapped[dt.datetime] = mapped_column(DateTime, default=lambda: dt.datetime.now(dt.UTC))

    job: Mapped["Job"] = relationship(back_populates="artifacts")


class UsageEvent(Base):
    __tablename__ = "usage_events"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id"), nullable=True, index=True)
    job_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("jobs.id"), nullable=True, index=True)
    event_type: Mapped[str] = mapped_column(String(64), index=True)
    provider_model: Mapped[str | None] = mapped_column(String(128), nullable=True)
    input_tokens: Mapped[int | None] = mapped_column(Integer, nullable=True)
    output_tokens: Mapped[int | None] = mapped_column(Integer, nullable=True)
    image_tokens: Mapped[int | None] = mapped_column(Integer, nullable=True)
    latency_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    cost_microusd: Mapped[int | None] = mapped_column(Integer, nullable=True)
    provider_request_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    retryable: Mapped[int] = mapped_column(Integer, default=0)
    meta_json: Mapped[str] = mapped_column(Text, default="{}")
    created_at: Mapped[dt.datetime] = mapped_column(DateTime, default=lambda: dt.datetime.now(dt.UTC))

    job: Mapped["Job"] = relationship(back_populates="usage_events")
