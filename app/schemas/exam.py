from __future__ import annotations
from datetime import datetime

from pydantic import BaseModel


class ExamStart(BaseModel):
    grade_id: int
    user_name: str = "匿名用户"
    paper_id: int | None = None
    type_ids: list[int] | None = None


class AnswerSubmit(BaseModel):
    question_id: int
    user_answer: str


class AllAnswersSubmit(BaseModel):
    answers: list[AnswerSubmit]


class ExamRecordResponse(BaseModel):
    id: int
    user_name: str
    grade_id: int
    total_score: int = 0
    total_questions: int
    correct_count: int = 0
    start_time: datetime | None = None
    end_time: datetime | None = None
    status: str = "ongoing"
    grade_name: str | None = None
    accuracy: int | None = None

    class Config:
        from_attributes = True


class ExamResultData(BaseModel):
    exam: ExamRecordResponse | None = None
    total_score: int = 0
    correct_count: int = 0
    accuracy: int = 0
    celebration: bool = False
    grade_name: str | None = None
    wrong_answers: list | None = None
