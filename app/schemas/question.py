from __future__ import annotations
from datetime import datetime

from pydantic import BaseModel


class QuestionCreate(BaseModel):
    grade_id: int
    type_id: int
    content: str
    options: list | None = None
    answer: str
    points: int = 10
    paper_id: int | None = None
    reading_content: str | None = None
    reading_title: str | None = None


class QuestionUpdate(BaseModel):
    grade_id: int | None = None
    type_id: int | None = None
    content: str | None = None
    options: list | None = None
    answer: str | None = None
    points: int | None = None
    reading_content: str | None = None
    reading_title: str | None = None


class QuestionResponse(BaseModel):
    id: int
    grade_id: int
    type_id: int
    content: str
    options: list | None = None
    answer: str
    points: int = 10
    paper_id: int | None = None
    reading_content: str | None = None
    reading_title: str | None = None
    created_at: datetime | None = None
    grade_name: str | None = None
    type_name: str | None = None
    paper_name: str | None = None

    class Config:
        from_attributes = True
