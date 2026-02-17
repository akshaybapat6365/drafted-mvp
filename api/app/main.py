from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .api.router import api_router
from .config import settings
from .db import init_db
from .jobs.worker import start_inprocess_worker


def _split_csv(raw: str) -> list[str]:
    return [item.strip() for item in raw.split(",") if item.strip()]


def create_app() -> FastAPI:
    @asynccontextmanager
    async def lifespan(_app: FastAPI):
        init_db()
        if settings.run_inprocess_worker:
            start_inprocess_worker()
        yield

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

    def _error_payload(
        *, code: str, message: str, details: dict | None = None, retryable: bool = False
    ) -> dict:
        return {"code": code, "message": message, "details": details, "retryable": retryable}

    @app.exception_handler(HTTPException)
    async def _http_error_handler(_request: Request, exc: HTTPException):
        detail = exc.detail
        if isinstance(detail, dict):
            payload = _error_payload(
                code=detail.get("code", f"http_{exc.status_code}"),
                message=detail.get("message") or detail.get("detail") or "Request failed",
                details=detail.get("details"),
                retryable=bool(detail.get("retryable", False)),
            )
        else:
            payload = _error_payload(
                code=f"http_{exc.status_code}",
                message=str(detail) if detail else "Request failed",
                details=None,
                retryable=False,
            )
        return JSONResponse(status_code=exc.status_code, content=payload)

    @app.exception_handler(Exception)
    async def _unhandled_error_handler(_request: Request, _exc: Exception):
        payload = _error_payload(
            code="internal_error",
            message="An unexpected error occurred",
            details=None,
            retryable=False,
        )
        return JSONResponse(status_code=500, content=payload)

    @app.get("/healthz")
    def healthz():
        return {"ok": True, "provider_mode": "gemini" if settings.gemini_api_key else "mock"}

    return app


app = create_app()
