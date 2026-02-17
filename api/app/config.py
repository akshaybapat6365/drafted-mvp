from __future__ import annotations

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "Drafted MVP API"
    app_env: str = "development"
    api_prefix: str = "/api/v1"
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"

    # Security
    jwt_secret: str = "dev-only-secret-change-me-please-use-at-least-32-bytes"
    jwt_issuer: str = "drafted-mvp"
    jwt_ttl_seconds: int = 60 * 60 * 24 * 7  # 7 days

    # Storage/DB
    var_dir: Path = Path(__file__).resolve().parents[2] / "var"
    database_url: str | None = None  # if unset, default to sqlite file under var_dir
    redis_url: str | None = None

    # Gemini (optional)
    gemini_api_key: str | None = None
    gemini_base_url: str = "https://generativelanguage.googleapis.com/v1beta"
    gemini_text_model: str = "gemini-2.5-flash"
    gemini_image_model_preview: str = "gemini-3-pro-image-preview"
    gemini_image_model_final: str = "gemini-3-pro-image-preview"

    # Budget guards (basic)
    max_jobs_per_user_per_day: int = 50
    max_images_per_job: int = 2
    job_max_retries: int = 2
    idempotency_window_seconds: int = 60 * 60 * 24
    transient_stub_enabled: bool = False
    transient_stub_fail_first_n: int = 0
    transient_stub_fail_every_n: int = 0
    transient_stub_http_code: int = 503
    transient_stub_scope: str = "spec"  # spec|image|both
    run_inprocess_worker: bool = True
    worker_poll_interval_seconds: float = 1.0
    worker_heartbeat_ttl_seconds: int = 120

    def resolved_database_url(self) -> str:
        if self.database_url:
            return self.database_url
        db_path = self.var_dir / "drafted.db"
        return f"sqlite:///{db_path}"


settings = Settings()
