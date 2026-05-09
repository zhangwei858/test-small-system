from __future__ import annotations
from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.config.database import Base


class LotteryRecord(Base):
    __tablename__ = "lottery_records"

    id: Mapped[int] = mapped_column(primary_key=True)
    exam_id: Mapped[int] = mapped_column(Integer, ForeignKey("exam_records.id", ondelete="CASCADE"), nullable=False)
    user_name: Mapped[str] = mapped_column(String(100), nullable=False)
    prize_name: Mapped[str] = mapped_column(String(100), nullable=False)
    prize_emoji: Mapped[Optional[str]] = mapped_column(String(10))
    is_redeemed: Mapped[bool] = mapped_column(Boolean, default=False)
    redeemed_at: Mapped[Optional[datetime]] = mapped_column()
    created_at: Mapped[datetime] = mapped_column(default=datetime.now)
