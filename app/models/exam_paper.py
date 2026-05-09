from __future__ import annotations
from datetime import datetime
from typing import Optional

from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.config.database import Base


class ExamPaper(Base):
    __tablename__ = "exam_papers"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    grade_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("grades.id", ondelete="CASCADE"))
    source_file: Mapped[Optional[str]] = mapped_column(String(255), unique=True)
    question_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(default=datetime.now)
