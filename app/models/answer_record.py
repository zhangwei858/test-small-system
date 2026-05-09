from __future__ import annotations
from typing import Optional

from sqlalchemy import Boolean, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.config.database import Base


class AnswerRecord(Base):
    __tablename__ = "answer_records"

    id: Mapped[int] = mapped_column(primary_key=True)
    exam_id: Mapped[int] = mapped_column(Integer, ForeignKey("exam_records.id", ondelete="CASCADE"), nullable=False)
    question_id: Mapped[int] = mapped_column(Integer, ForeignKey("questions.id", ondelete="CASCADE"), nullable=False)
    user_answer: Mapped[Optional[str]] = mapped_column(String(500))
    is_correct: Mapped[bool] = mapped_column(Boolean, nullable=False)
    points_earned: Mapped[int] = mapped_column(Integer, nullable=False)
