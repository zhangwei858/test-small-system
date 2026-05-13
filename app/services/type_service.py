from __future__ import annotations
import logging
import asyncpg

logger = logging.getLogger("exam_system")


async def get_all_types(db: asyncpg.Connection) -> list[dict]:
    rows = await db.fetch("SELECT * FROM question_types ORDER BY id")
    return [dict(r) for r in rows]


async def find_by_id(db: asyncpg.Connection, type_id: int) -> dict | None:
    row = await db.fetchrow("SELECT * FROM question_types WHERE id = $1", type_id)
    return dict(row) if row else None