from __future__ import annotations

from fastapi import APIRouter, Depends

from ...models import User
from ...schemas import LimitsOut
from ..deps import get_current_user


router = APIRouter(prefix="/me", tags=["me"])


@router.get("/limits", response_model=LimitsOut)
def limits(user: User = Depends(get_current_user)):
    return LimitsOut(credits=user.credits, plan_tier=user.plan_tier)
