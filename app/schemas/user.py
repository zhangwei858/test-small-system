from __future__ import annotations
from datetime import datetime

from pydantic import BaseModel


class UserLogin(BaseModel):
    username: str


class UserCreate(BaseModel):
    username: str
    allowedGrades: list[str] | None = ["low", "middle", "high"]


class UserUpdate(BaseModel):
    role: str | None = None
    allowedGrades: list[str] | None = None


class UserResponse(BaseModel):
    id: int
    username: str
    role: str
    allowed_grades: list | None = None
    created_at: datetime | None = None

    class Config:
        from_attributes = True
