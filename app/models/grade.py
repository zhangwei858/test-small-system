from __future__ import annotations
from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from app.config.database import Base


class Grade(Base):
    __tablename__ = "grades"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    level: Mapped[str] = mapped_column(String(10), nullable=False)
