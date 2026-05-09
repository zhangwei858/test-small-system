from __future__ import annotations
from datetime import datetime
from typing import Optional

from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.config.database import Base


class ExamRecord(Base):
    __tablename__ = "exam_records"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_name: Mapped[str] = mapped_column(String(100), nullable=False)
    grade_id: Mapped[int] = mapped_column(Integer, ForeignKey("grades.id", ondelete="CASCADE"), nullable=False)
    paper_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    total_score: Mapped[int] = mapped_column(Integer, default=0)
    total_questions: Mapped[int] = mapped_column(Integer, nullable=False)
    correct_count: Mapped[int] = mapped_column(Integer, default=0)
    start_time: Mapped[datetime] = mapped_column(default=datetime.now)
    end_time: Mapped[Optional[datetime]] = mapped_column()
    status: Mapped[str] = mapped_column(String(20), default="ongoing")
