from __future__ import annotations
from datetime import datetime

from pydantic import BaseModel


class PrizeCreate(BaseModel):
    name: str
    emoji: str
    color: str
    base_probability: float


class PrizeUpdate(BaseModel):
    name: str | None = None
    emoji: str | None = None
    color: str | None = None
    base_probability: float | None = None


class PrizeResponse(BaseModel):
    id: int
    name: str
    emoji: str | None = None
    color: str | None = None
    base_probability: float = 0
    is_default: bool = False
    updated_at: datetime | None = None
    dynamic_probability: float | None = None

    class Config:
        from_attributes = True
