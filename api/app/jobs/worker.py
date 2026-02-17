from __future__ import annotations

import datetime as dt
import hashlib
import json
import threading
import time
from pathlib import Path

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import settings
from ..db import SessionLocal
from ..models import (
    Artifact,
    HouseSpec as HouseSpecRow,
    Job,
    PlanGraph as PlanGraphRow,
    Session as SessionRow,
    UsageEvent,
)
from ..plan.geometry import generate_plan_graph
from ..plan.render import render_plan_svg
from ..providers.gemini import GeminiProvider
from ..providers.mock import MockProvider
from ..schemas import HouseSpec as HouseSpecSchema


def _provider():
    if settings.gemini_api_key:
        return GeminiProvider()
    return MockProvider()


def _job_art_dir(job_id: str) -> Path:
    d = settings.var_dir / "artifacts" / job_id
    d.mkdir(parents=True, exist_ok=True)
    return d


def _heartbeat_path() -> Path:
    return settings.var_dir / "worker_heartbeat.json"


def _now() -> dt.datetime:
    return dt.datetime.now(dt.UTC)


def _write_worker_heartbeat(
    *,
    state: str,
    job_id: str | None = None,
    retry_count: int | None = None,
    error: str | None = None,
) -> None:
    payload: dict[str, object] = {
        "timestamp": _now().isoformat(),
        "state": state,
    }
    if job_id:
        payload["job_id"] = job_id
    if retry_count is not None:
        payload["retry_count"] = retry_count
    if error:
        payload["error"] = error

    p = _heartbeat_path()
    tmp = p.with_suffix(".tmp")
    tmp.write_text(json.dumps(payload), encoding="utf-8")
    tmp.replace(p)


def _json_obj(raw: str | None) -> dict:
    if not raw:
        return {}
    try:
        val = json.loads(raw)
    except Exception:
        return {}
    return val if isinstance(val, dict) else {}


def _json_arr(raw: str | None) -> list:
    if not raw:
        return []
    try:
        val = json.loads(raw)
    except Exception:
        return []
    return val if isinstance(val, list) else []


def _set_stage(job: Job, stage: str) -> None:
    stamps = _json_obj(job.stage_timestamps_json)
    stamps[stage] = _now().isoformat()
    job.stage_timestamps_json = json.dumps(stamps)
    job.stage = stage
    job.updated_at = _now()


def _append_provider_meta(job: Job, meta: dict) -> None:
    cur = _json_obj(job.provider_meta_json)
    calls = cur.get("calls", [])
    if not isinstance(calls, list):
        calls = []
    calls.append(meta)
    cur["calls"] = calls[-20:]
    job.provider_meta_json = json.dumps(cur)


def _set_warnings(job: Job, warnings: list[str]) -> None:
    job.warnings_json = json.dumps(warnings)


def _classify_failure(exc: Exception) -> tuple[str, bool]:
    if isinstance(exc, (httpx.TimeoutException, httpx.ConnectError)):
        return ("provider_transient", True)
    if isinstance(exc, httpx.HTTPStatusError):
        status = exc.response.status_code
        if status in {408, 409, 425, 429, 500, 502, 503, 504}:
            return ("provider_transient", True)
        return ("provider_permanent", False)
    if isinstance(exc, ValueError):
        return ("validation", False)
    return ("system", False)


def _validate_spec(job: Job, spec: HouseSpecSchema) -> None:
    beds = sum(1 for r in spec.rooms if r.type == "bedroom")
    baths = sum(1 for r in spec.rooms if r.type == "bathroom")
    if beds < job.bedrooms:
        raise ValueError(f"Spec has {beds} bedrooms, expected at least {job.bedrooms}")
    if baths < job.bathrooms:
        raise ValueError(f"Spec has {baths} bathrooms, expected at least {job.bathrooms}")
    for r in spec.rooms:
        if r.area_ft2 <= 0:
            raise ValueError(f"Room {r.name} has non-positive area")


def _artifact_meta(path: Path) -> tuple[str, int]:
    b = path.read_bytes()
    return hashlib.sha256(b).hexdigest(), len(b)


def _add_artifact(db: Session, *, job_id: str, typ: str, path: Path, mime: str, meta: dict) -> None:
    if not path.exists():
        raise RuntimeError(f"artifact_missing:{path}")
    checksum, size = _artifact_meta(path)
    db.add(
        Artifact(
            job_id=job_id,
            type=typ,
            path=str(path),
            mime_type=mime,
            checksum_sha256=checksum,
            size_bytes=size,
            meta_json=json.dumps(meta),
        )
    )


def _log_usage(
    db: Session,
    *,
    user_id: str | None,
    job_id: str,
    event_type: str,
    meta: dict,
    retryable: bool = False,
) -> None:
    db.add(
        UsageEvent(
            user_id=user_id,
            job_id=job_id,
            event_type=event_type,
            provider_model=meta.get("model"),
            input_tokens=meta.get("input_tokens"),
            output_tokens=meta.get("output_tokens"),
            image_tokens=meta.get("image_tokens"),
            latency_ms=meta.get("latency_ms"),
            provider_request_id=meta.get("request_id"),
            retryable=1 if retryable else 0,
            meta_json=json.dumps(meta),
        )
    )


def _reuse_parent_spec_if_requested(db: Session, job: Job) -> HouseSpecSchema | None:
    meta = _json_obj(job.provider_meta_json)
    if not meta.get("reuse_spec"):
        return None
    if not job.parent_job_id:
        return None
    parent = db.execute(select(HouseSpecRow).where(HouseSpecRow.job_id == job.parent_job_id)).scalars().first()
    if not parent:
        return None
    raw = json.loads(parent.json_text)
    return HouseSpecSchema.model_validate(raw)


def process_job(db: Session, job: Job) -> None:
    if job.status == "succeeded":
        return
    if job.status == "failed":
        return
    if job.status != "running":
        job.status = "running"
    _set_stage(job, "spec")
    job.failure_code = None
    job.error = None
    db.commit()

    user_id = None
    sess = db.get(SessionRow, job.session_id)
    if sess:
        user_id = sess.user_id

    provider = _provider()
    spec = _reuse_parent_spec_if_requested(db, job)
    if spec is None:
        spec_result = provider.generate_house_spec(
            prompt=job.prompt, bedrooms=job.bedrooms, bathrooms=job.bathrooms, style=job.style
        )
        spec = spec_result.spec
        spec_meta = {
            "provider": spec_result.meta.provider,
            "model": spec_result.meta.model,
            "request_id": spec_result.meta.request_id,
            "latency_ms": spec_result.meta.latency_ms,
            "input_tokens": spec_result.meta.input_tokens,
            "output_tokens": spec_result.meta.output_tokens,
            "total_tokens": spec_result.meta.total_tokens,
            "image_tokens": spec_result.meta.image_tokens,
        }
        _append_provider_meta(job, spec_meta)
        _log_usage(db, user_id=user_id, job_id=job.id, event_type="house_spec", meta=spec_meta)
    else:
        _append_provider_meta(
            job,
            {"provider": "reuse", "model": "parent_house_spec", "request_id": job.parent_job_id},
        )

    _validate_spec(job, spec)

    db.merge(HouseSpecRow(job_id=job.id, json_text=spec.model_dump_json(indent=2)))
    _set_stage(job, "plan")
    db.commit()

    plan = generate_plan_graph(spec)
    canonical_hash = hashlib.sha256(plan.model_dump_json().encode("utf-8")).hexdigest()
    db.merge(
        PlanGraphRow(
            job_id=job.id,
            json_text=plan.model_dump_json(indent=2),
            canonical_hash=canonical_hash,
            validation_result="ok" if not plan.warnings else "warn",
        )
    )
    _set_warnings(job, plan.warnings)

    _set_stage(job, "render")
    db.commit()

    art_dir = _job_art_dir(job.id)

    # spec.json artifact
    spec_path = art_dir / "spec.json"
    spec_path.write_text(spec.model_dump_json(indent=2), encoding="utf-8")
    _add_artifact(
        db,
        job_id=job.id,
        typ="spec_json",
        path=spec_path,
        mime="application/json",
        meta={"provider": type(provider).__name__},
    )

    # plan.svg artifact (deterministic, not AI-generated)
    svg = render_plan_svg(plan)
    svg_path = art_dir / "plan.svg"
    svg_path.write_text(svg, encoding="utf-8")
    _add_artifact(
        db,
        job_id=job.id,
        typ="plan_svg",
        path=svg_path,
        mime="image/svg+xml",
        meta={"px_per_ft": 12},
    )

    # Optional exterior image (API-based). If disabled/unavailable, skip.
    if bool(job.want_exterior_image):
        _set_stage(job, "image")
        db.commit()

        img_result = provider.maybe_generate_exterior_image(prompt=job.prompt, style=job.style)
        if img_result:
            ext = "png" if img_result.mime_type.endswith("png") else "jpg"
            img_path = art_dir / f"exterior.{ext}"
            img_path.write_bytes(img_result.image_bytes)
            _add_artifact(
                db,
                job_id=job.id,
                typ="exterior_image",
                path=img_path,
                mime=img_result.mime_type,
                meta={"model": settings.gemini_image_model_preview},
            )
            img_meta = {
                "provider": img_result.meta.provider,
                "model": img_result.meta.model,
                "request_id": img_result.meta.request_id,
                "latency_ms": img_result.meta.latency_ms,
                "input_tokens": img_result.meta.input_tokens,
                "output_tokens": img_result.meta.output_tokens,
                "total_tokens": img_result.meta.total_tokens,
                "image_tokens": img_result.meta.image_tokens,
            }
            _append_provider_meta(job, img_meta)
            _log_usage(db, user_id=user_id, job_id=job.id, event_type="exterior_image", meta=img_meta)

    db.flush()
    artifacts = db.execute(select(Artifact).where(Artifact.job_id == job.id)).scalars().all()
    for art in artifacts:
        if not Path(art.path).exists():
            raise RuntimeError(f"artifact_missing:{art.path}")

    job.status = "succeeded"
    _set_stage(job, "done")
    db.commit()


def _claim_next_job(db: Session) -> Job | None:
    job = db.execute(select(Job).where(Job.status == "queued").order_by(Job.created_at.asc())).scalars().first()
    if not job:
        return None
    job.status = "running"
    _set_stage(job, "init")
    db.commit()
    db.refresh(job)
    return job


def worker_loop(*, poll_interval_s: float = 1.0, stop_event: threading.Event | None = None) -> None:
    settings.var_dir.mkdir(parents=True, exist_ok=True)
    (settings.var_dir / "artifacts").mkdir(parents=True, exist_ok=True)
    _write_worker_heartbeat(state="starting")

    while True:
        if stop_event and stop_event.is_set():
            _write_worker_heartbeat(state="stopping")
            return
        with SessionLocal() as db:
            job = _claim_next_job(db)
            if not job:
                _write_worker_heartbeat(state="idle")
                time.sleep(poll_interval_s)
                continue
            _write_worker_heartbeat(state="running", job_id=job.id, retry_count=job.retry_count)
            try:
                process_job(db, job)
                _write_worker_heartbeat(state="idle")
            except Exception as e:
                code, retryable = _classify_failure(e)
                job.failure_code = code
                job.error = str(e)[:4000]
                _append_provider_meta(
                    job,
                    {
                        "provider": "system",
                        "model": "worker",
                        "request_id": None,
                        "last_error": {"type": type(e).__name__, "message": str(e)[:500]},
                    },
                )
                if retryable and job.retry_count < settings.job_max_retries:
                    job.retry_count += 1
                    job.status = "queued"
                    _set_stage(job, "retry_wait")
                else:
                    job.status = "failed"
                    _set_stage(job, "done")
                db.commit()
                _write_worker_heartbeat(
                    state="error",
                    job_id=job.id,
                    retry_count=job.retry_count,
                    error=f"{type(e).__name__}: {str(e)[:200]}",
                )


_thread: threading.Thread | None = None


def start_inprocess_worker() -> None:
    global _thread
    if _thread and _thread.is_alive():
        return
    stop_event = threading.Event()
    t = threading.Thread(
        target=worker_loop,
        kwargs={"poll_interval_s": settings.worker_poll_interval_seconds, "stop_event": stop_event},
        daemon=True,
    )
    t.start()
    _thread = t
