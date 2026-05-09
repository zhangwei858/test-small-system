from __future__ import annotations
from datetime import datetime

from sqlalchemy import JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.config.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    role: Mapped[str] = mapped_column(String(20), nullable=False, default="examiner")
    allowed_grades: Mapped[dict] = mapped_column(JSON, default=lambda: ["low", "middle", "high"])
    created_at: Mapped[datetime] = mapped_column(default=datetime.now)
