from __future__ import annotations
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy import Column, Integer, DateTime
from datetime import datetime


class Base(DeclarativeBase):
    pass


class TimestampMixin:
    created_at = Column(DateTime, default=datetime.now, nullable=False)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now, nullable=False)
