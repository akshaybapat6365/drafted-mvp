from __future__ import annotations

import contextvars
import datetime as dt
import json
import logging
from typing import Any


_request_id_ctx: contextvars.ContextVar[str] = contextvars.ContextVar(
    "request_id", default="-"
)

_logger = logging.getLogger("drafted")


def configure_logging() -> None:
    if _logger.handlers:
        return
    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter("%(message)s"))
    _logger.addHandler(handler)
    _logger.setLevel(logging.INFO)
    _logger.propagate = False


def set_request_id(request_id: str):
    return _request_id_ctx.set(request_id)


def reset_request_id(token) -> None:
    _request_id_ctx.reset(token)


def get_request_id() -> str:
    return _request_id_ctx.get()


def log_event(component: str, event: str, **fields: Any) -> None:
    configure_logging()
    payload: dict[str, Any] = {
        "at": dt.datetime.now(dt.UTC).isoformat(),
        "component": component,
        "event": event,
        "request_id": get_request_id(),
    }
    payload.update(_sanitize(fields))
    _logger.info(json.dumps(payload, separators=(",", ":"), sort_keys=True))


def _sanitize(value: Any) -> Any:
    if value is None:
        return None
    if isinstance(value, (str, int, float, bool)):
        return value
    if isinstance(value, dt.datetime):
        return value.isoformat()
    if isinstance(value, dict):
        return {str(k): _sanitize(v) for k, v in value.items()}
    if isinstance(value, (list, tuple, set)):
        return [_sanitize(v) for v in value]
    return str(value)
