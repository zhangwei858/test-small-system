from __future__ import annotations
import logging
import asyncpg

logger = logging.getLogger("exam_system")


async def get_all_grades(db: asyncpg.Connection) -> list[dict]:
    rows = await db.fetch(
        "SELECT g.*, COALESCE(SUM(ep.question_count), 0) as total_questions "
        "FROM grades g LEFT JOIN exam_papers ep ON g.id = ep.grade_id "
        "GROUP BY g.id ORDER BY g.id"
    )
    return [dict(r) for r in rows]


async def find_by_id(db: asyncpg.Connection, grade_id: int) -> dict | None:
    row = await db.fetchrow("SELECT * FROM grades WHERE id = $1", grade_id)
    return dict(row) if row else None