from __future__ import annotations
import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.question_type import QuestionType

logger = logging.getLogger("exam_system")


async def get_all_types(db: AsyncSession) -> list[QuestionType]:
    result = await db.execute(select(QuestionType).order_by(QuestionType.id))
    return list(result.scalars().all())


async def find_by_id(db: AsyncSession, type_id: int) -> QuestionType | None:
    return await db.get(QuestionType, type_id)
