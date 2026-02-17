from __future__ import annotations

from fastapi import APIRouter

from .routes import auth, jobs, me, sessions, system


api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(me.router)
api_router.include_router(sessions.router)
api_router.include_router(jobs.router)
api_router.include_router(system.router)
