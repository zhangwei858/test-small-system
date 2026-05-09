from __future__ import annotations
import logging

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.grade import Grade

logger = logging.getLogger("exam_system")


async def get_all_grades(db: AsyncSession) -> list[dict]:
    sql = text(
        "SELECT g.*, COALESCE(SUM(ep.question_count), 0) as total_questions "
        "FROM grades g LEFT JOIN exam_papers ep ON g.id = ep.grade_id "
        "GROUP BY g.id ORDER BY g.id"
    )
    result = await db.execute(sql)
    rows = result.mappings().all()
    return [dict(row) for row in rows]


async def find_by_id(db: AsyncSession, grade_id: int) -> Grade | None:
    return await db.get(Grade, grade_id)
