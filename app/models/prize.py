from __future__ import annotations
from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.config.database import Base


class Prize(Base):
    __tablename__ = "prizes"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    emoji: Mapped[Optional[str]] = mapped_column(String(10))
    color: Mapped[Optional[str]] = mapped_column(String(20))
    base_probability: Mapped[float] = mapped_column(Numeric(5, 2), default=0)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)
    updated_at: Mapped[Optional[datetime]] = mapped_column(default=datetime.now)
