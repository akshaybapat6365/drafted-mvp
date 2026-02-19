from __future__ import annotations

from contextlib import asynccontextmanager
import time
import uuid

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .api.router import api_router
from .config import settings
from .db import init_db
from .jobs.worker import start_inprocess_worker
from .logging import (
    configure_logging,
    get_request_id,
    log_event,
    reset_request_id,
    set_request_id,
)


def _split_csv(raw: str) -> list[str]:
    return [item.strip() for item in raw.split(",") if item.strip()]


def create_app() -> FastAPI:
    @asynccontextmanager
    async def lifespan(_app: FastAPI):
        configure_logging()
        log_event("api", "lifespan_start")
        init_db()
        if settings.run_inprocess_worker:
            start_inprocess_worker()
        yield
        log_event("api", "lifespan_stop")

    app = FastAPI(title=settings.app_name, lifespan=lifespan)

    # CORS (explicitly configured via CORS_ORIGINS, CSV)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=_split_csv(settings.cors_origins),
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(api_router, prefix=settings.api_prefix)

    @app.middleware("http")
    async def _request_context_middleware(request: Request, call_next):
        request_id = (
            request.headers.get("x-trace-id")
            or request.headers.get("x-request-id")
            or uuid.uuid4().hex
        )
        token = set_request_id(request_id)
        started = time.perf_counter()
        try:
            response = await call_next(request)
        except Exception:
            elapsed_ms = int((time.perf_counter() - started) * 1000)
            log_event(
                "api",
                "request_exception",
                method=request.method,
                path=request.url.path,
                latency_ms=elapsed_ms,
            )
            reset_request_id(token)
            raise
        elapsed_ms = int((time.perf_counter() - started) * 1000)
        response.headers["x-request-id"] = request_id
        response.headers["x-content-type-options"] = "nosniff"
        response.headers["x-frame-options"] = "DENY"
        response.headers["referrer-policy"] = "same-origin"
        log_event(
            "api",
            "request_complete",
            method=request.method,
            path=request.url.path,
            status_code=response.status_code,
            latency_ms=elapsed_ms,
        )
        reset_request_id(token)
        return response

    def _error_payload(
        *,
        code: str,
        message: str,
        details: dict | None = None,
        retryable: bool = False,
        request_id: str,
    ) -> dict:
        error = {
            "code": code,
            "message": message,
            "details": details,
            "retryable": retryable,
            "request_id": request_id,
        }
        # Keep backward compatibility for old clients that read top-level keys.
        return {"error": error, **error}

    @app.exception_handler(HTTPException)
    async def _http_error_handler(request: Request, exc: HTTPException):
        request_id = (
            request.headers.get("x-trace-id")
            or request.headers.get("x-request-id")
            or get_request_id()
            or uuid.uuid4().hex
        )
        detail = exc.detail
        if isinstance(detail, dict):
            payload = _error_payload(
                code=detail.get("code", f"http_{exc.status_code}"),
                message=detail.get("message") or detail.get("detail") or "Request failed",
                details=detail.get("details"),
                retryable=bool(detail.get("retryable", False)),
                request_id=request_id,
            )
        else:
            payload = _error_payload(
                code=f"http_{exc.status_code}",
                message=str(detail) if detail else "Request failed",
                details=None,
                retryable=False,
                request_id=request_id,
            )
        response = JSONResponse(status_code=exc.status_code, content=payload)
        response.headers["x-request-id"] = request_id
        log_event(
            "api",
            "http_exception",
            path=request.url.path,
            method=request.method,
            status_code=exc.status_code,
            code=payload["error"]["code"],
        )
        return response

    @app.exception_handler(Exception)
    async def _unhandled_error_handler(request: Request, exc: Exception):
        request_id = (
            request.headers.get("x-trace-id")
            or request.headers.get("x-request-id")
            or get_request_id()
            or uuid.uuid4().hex
        )
        payload = _error_payload(
            code="internal_error",
            message="An unexpected error occurred",
            details=None,
            retryable=False,
            request_id=request_id,
        )
        response = JSONResponse(status_code=500, content=payload)
        response.headers["x-request-id"] = request_id
        log_event(
            "api",
            "unhandled_exception",
            path=request.url.path,
            method=request.method,
            code="internal_error",
            error_type=type(exc).__name__,
        )
        return response

    @app.get("/healthz")
    def healthz():
        return {"ok": True, "provider_mode": "gemini" if settings.gemini_api_key else "mock"}

    return app


app = create_app()
