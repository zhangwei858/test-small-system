from __future__ import annotations
from datetime import datetime
from typing import Optional

from sqlalchemy import JSON, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.config.database import Base


class Question(Base):
    __tablename__ = "questions"

    id: Mapped[int] = mapped_column(primary_key=True)
    grade_id: Mapped[int] = mapped_column(Integer, ForeignKey("grades.id", ondelete="CASCADE"), nullable=False)
    type_id: Mapped[int] = mapped_column(Integer, ForeignKey("question_types.id", ondelete="CASCADE"), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    options: Mapped[Optional[dict]] = mapped_column(JSON)
    answer: Mapped[str] = mapped_column(String(500), nullable=False)
    points: Mapped[int] = mapped_column(Integer, default=10)
    paper_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("exam_papers.id"), nullable=True)
    reading_content: Mapped[Optional[str]] = mapped_column(Text)
    reading_title: Mapped[Optional[str]] = mapped_column(String(200))
    passage: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(default=datetime.now)
