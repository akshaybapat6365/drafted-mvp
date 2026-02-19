from __future__ import annotations

import datetime as dt
import hashlib
import json
import mimetypes
import zipfile
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ...config import settings
from ...logging import get_request_id, log_event
from ...models import Artifact, HouseSpec as HouseSpecRow, Job, Session as SessionRow, User
from ...schemas import ArtifactsOut, ArtifactOut, JobCreateIn, JobOut, JobRegenerateIn
from ..deps import get_current_user, get_db


router = APIRouter(prefix="/jobs", tags=["jobs"])


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


def _job_out(job: Job) -> JobOut:
    return JobOut(
        id=job.id,
        session_id=job.session_id,
        prompt=job.prompt,
        bedrooms=job.bedrooms,
        bathrooms=job.bathrooms,
        style=job.style,
        status=job.status,
        stage=job.stage,
        error=job.error,
        failure_code=job.failure_code,
        retry_count=job.retry_count,
        provider_meta=_json_obj(job.provider_meta_json),
        stage_timestamps=_json_obj(job.stage_timestamps_json),
        warnings=_json_arr(job.warnings_json),
        created_at=job.created_at,
        updated_at=job.updated_at,
    )


def _assert_job_owner(db: Session, user: User, job_id: str) -> Job:
    job = db.get(Job, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    sess = db.get(SessionRow, job.session_id)
    if not sess or sess.user_id != user.id:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


def _request_hash(session_id: str, payload: JobCreateIn) -> str:
    normalized = {
        "session_id": session_id,
        "prompt": payload.prompt.strip(),
        "bedrooms": payload.bedrooms,
        "bathrooms": payload.bathrooms,
        "style": payload.style,
        "want_exterior_image": bool(payload.want_exterior_image),
        "priority": payload.priority,
    }
    data = json.dumps(normalized, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(data.encode("utf-8")).hexdigest()


def _retryable_from_code(code: str | None) -> bool:
    return code in {"provider_transient"}


@router.get("", response_model=list[JobOut])
def list_jobs(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    rows = (
        db.query(Job)
        .join(SessionRow, Job.session_id == SessionRow.id)
        .filter(SessionRow.user_id == user.id)
        .order_by(Job.created_at.desc())
        .limit(50)
        .all()
    )
    return [_job_out(j) for j in rows]


@router.get("/sessions/{session_id}", response_model=list[JobOut])
def list_jobs_for_session(
    session_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    sess = db.get(SessionRow, session_id)
    if not sess or sess.user_id != user.id:
        raise HTTPException(status_code=404, detail="Session not found")
    rows = db.query(Job).filter(Job.session_id == session_id).order_by(Job.created_at.desc()).all()
    return [_job_out(j) for j in rows]


@router.post("/sessions/{session_id}", response_model=JobOut)
def create_job(
    session_id: str, payload: JobCreateIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    sess = db.get(SessionRow, session_id)
    if not sess or sess.user_id != user.id:
        raise HTTPException(status_code=404, detail="Session not found")

    req_hash = _request_hash(session_id, payload)
    existing: Job | None = None
    if payload.idempotency_key:
        existing = (
            db.query(Job)
            .filter(
                Job.session_id == session_id,
                Job.idempotency_key == payload.idempotency_key,
            )
            .order_by(Job.created_at.desc())
            .first()
        )
    else:
        cutoff = dt.datetime.now(dt.UTC) - dt.timedelta(seconds=settings.idempotency_window_seconds)
        existing = (
            db.query(Job)
            .filter(
                Job.session_id == session_id,
                Job.request_hash == req_hash,
                Job.created_at >= cutoff,
                Job.status.in_(["queued", "running", "succeeded"]),
            )
            .order_by(Job.created_at.desc())
            .first()
        )
    if existing:
        return _job_out(existing)

    now = dt.datetime.now(dt.UTC).isoformat()
    job = Job(
        session_id=session_id,
        prompt=payload.prompt,
        bedrooms=payload.bedrooms,
        bathrooms=payload.bathrooms,
        style=payload.style,
        want_exterior_image=1 if payload.want_exterior_image else 0,
        idempotency_key=payload.idempotency_key,
        request_hash=req_hash,
        priority=payload.priority,
        stage_timestamps_json=json.dumps({"queued": now}),
    )
    db.add(job)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        if payload.idempotency_key:
            dedup = (
                db.query(Job)
                .filter(
                    Job.session_id == session_id,
                    Job.idempotency_key == payload.idempotency_key,
                )
                .order_by(Job.created_at.desc())
                .first()
            )
            if dedup:
                return _job_out(dedup)
        raise HTTPException(
            status_code=409,
            detail={
                "code": "idempotency_conflict",
                "message": "Conflicting concurrent request detected",
                "retryable": False,
                "details": {"request_id": get_request_id()},
            },
        )
    db.refresh(job)
    return _job_out(job)


@router.post("/{job_id}/regenerate", response_model=JobOut)
def regenerate_job(
    job_id: str, payload: JobRegenerateIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    job = _assert_job_owner(db, user, job_id)
    next_prompt = payload.prompt if payload.prompt is not None else job.prompt
    next_bedrooms = payload.bedrooms if payload.bedrooms is not None else job.bedrooms
    next_bathrooms = payload.bathrooms if payload.bathrooms is not None else job.bathrooms
    next_style = payload.style if payload.style is not None else job.style
    next_want_exterior = (
        payload.want_exterior_image if payload.want_exterior_image is not None else bool(job.want_exterior_image)
    )
    reuse_spec = bool(payload.reuse_spec) if payload.reuse_spec is not None else False

    if reuse_spec:
        parent_spec = db.execute(select(HouseSpecRow).where(HouseSpecRow.job_id == job.id)).scalars().first()
        if not parent_spec:
            raise HTTPException(
                status_code=409,
                detail={
                    "code": "reuse_spec_unavailable",
                    "message": "Cannot reuse spec because parent job has no saved spec",
                    "retryable": False,
                },
            )

    create_payload = JobCreateIn(
        prompt=next_prompt,
        bedrooms=next_bedrooms,
        bathrooms=next_bathrooms,
        style=next_style,
        want_exterior_image=next_want_exterior,
        priority=job.priority,
    )
    req_hash = _request_hash(job.session_id, create_payload)
    now = dt.datetime.now(dt.UTC).isoformat()

    provider_meta = {
        "reuse_spec": reuse_spec,
        "regenerated_from_job_id": job.id,
    }
    new_job = Job(
        session_id=job.session_id,
        parent_job_id=job.id,
        prompt=next_prompt,
        bedrooms=next_bedrooms,
        bathrooms=next_bathrooms,
        style=next_style,
        want_exterior_image=1 if next_want_exterior else 0,
        request_hash=req_hash,
        priority=job.priority,
        status="queued",
        stage="init",
        provider_meta_json=json.dumps(provider_meta),
        stage_timestamps_json=json.dumps({"queued": now}),
    )
    db.add(new_job)
    db.commit()
    db.refresh(new_job)
    return _job_out(new_job)


@router.post("/{job_id}/export")
def export_job(
    job_id: str,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _assert_job_owner(db, user, job_id)
    rows = db.query(Artifact).filter(Artifact.job_id == job_id).order_by(Artifact.created_at.asc()).all()
    if not rows:
        raise HTTPException(
            status_code=409,
            detail={"code": "no_artifacts", "message": "No artifacts to export yet", "retryable": False},
        )

    missing: list[str] = []
    for a in rows:
        if not Path(a.path).exists():
            missing.append(a.path)
    if missing:
        raise HTTPException(
            status_code=409,
            detail={
                "code": "artifact_missing",
                "message": "Some artifacts are missing on disk",
                "details": {"missing": missing},
                "retryable": False,
            },
        )

    exp_dir = settings.var_dir / "exports" / job_id
    exp_dir.mkdir(parents=True, exist_ok=True)
    zip_path = exp_dir / f"drafted_export_{job_id}.zip"

    manifest_items = []
    with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED) as z:
        for a in rows:
            p = Path(a.path)
            z.write(p, arcname=p.name)
            manifest_items.append(
                {
                    "id": a.id,
                    "type": a.type,
                    "filename": p.name,
                    "mime": a.mime_type,
                    "checksum_sha256": a.checksum_sha256,
                    "size_bytes": a.size_bytes,
                }
            )
        manifest = {
            "job_id": job_id,
            "created_at": dt.datetime.now(dt.UTC).isoformat(),
            "artifact_count": len(rows),
            "artifacts": manifest_items,
        }
        z.writestr("manifest.json", json.dumps(manifest, indent=2))

    log_event(
        "api",
        "artifacts_exported",
        job_id=job_id,
        user_id=user.id,
        artifact_count=len(rows),
        zip_path=str(zip_path),
    )
    return FileResponse(
        zip_path,
        media_type="application/zip",
        filename=zip_path.name,
        headers={
            "x-export-artifact-count": str(len(rows)),
            "x-request-id": request.headers.get("x-request-id")
            or request.headers.get("x-trace-id")
            or get_request_id(),
        },
    )


@router.get("/{job_id}", response_model=JobOut)
def get_job(job_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    job = _assert_job_owner(db, user, job_id)
    return _job_out(job)


@router.get("/{job_id}/artifacts", response_model=ArtifactsOut)
def list_artifacts(job_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    _assert_job_owner(db, user, job_id)
    rows = db.query(Artifact).filter(Artifact.job_id == job_id).order_by(Artifact.created_at.asc()).all()
    items = [
        ArtifactOut(
            id=a.id,
            type=a.type,
            mime_type=a.mime_type,
            checksum_sha256=a.checksum_sha256,
            size_bytes=a.size_bytes,
            url=f"/api/v1/jobs/{job_id}/artifacts/{a.id}/download",
            created_at=a.created_at,
        )
        for a in rows
    ]
    log_event("api", "artifacts_listed", job_id=job_id, count=len(items), user_id=user.id)
    return ArtifactsOut(job_id=job_id, items=items)


@router.get("/{job_id}/artifacts/{artifact_id}/download")
def download_artifact(
    job_id: str, artifact_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    _assert_job_owner(db, user, job_id)
    art = db.get(Artifact, artifact_id)
    if not art or art.job_id != job_id:
        raise HTTPException(status_code=404, detail="Artifact not found")
    path = Path(art.path)
    if not path.exists():
        raise HTTPException(
            status_code=404,
            detail={"code": "artifact_missing", "message": "Artifact missing on disk", "retryable": False},
        )
    media_type = art.mime_type or (mimetypes.guess_type(str(path))[0] or "application/octet-stream")
    log_event(
        "api",
        "artifact_downloaded",
        user_id=user.id,
        job_id=job_id,
        artifact_id=artifact_id,
        mime_type=media_type,
    )
    return FileResponse(path, media_type=media_type, filename=path.name)
