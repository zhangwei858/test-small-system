from __future__ import annotations
from datetime import datetime

from pydantic import BaseModel


class LotteryDraw(BaseModel):
    exam_id: int
    user_name: str


class LotteryDemo(BaseModel):
    user_name: str


class RedeemUpdate(BaseModel):
    id: int
    is_redeemed: bool


class LotteryRecordResponse(BaseModel):
    id: int
    exam_id: int
    user_name: str
    prize_name: str
    prize_emoji: str | None = None
    is_redeemed: bool = False
    redeemed_at: datetime | None = None
    created_at: datetime | None = None
    total_score: int | None = None
    grade_id: int | None = None
    grade_name: str | None = None
    exam_user_name: str | None = None

    class Config:
        from_attributes = True
