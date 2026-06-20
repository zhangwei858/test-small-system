from __future__ import annotations
import logging
import asyncpg

logger = logging.getLogger("exam_system")


async def get_wrong_answers(db: asyncpg.Connection, user_name: str, page: int = 1, limit: int = 10) -> dict:
    offset = (page - 1) * limit
    rows = await db.fetch(
        "SELECT wa.id, wa.question_id, q.content, q.options, q.answer as correct_answer, wa.user_answer, "
        "qt.name as type_name, q.points, wa.created_at "
        "FROM wrong_answers wa JOIN questions q ON wa.question_id = q.id "
        "LEFT JOIN question_types qt ON q.type_id = qt.id "
        "WHERE wa.user_name = $1 ORDER BY wa.created_at DESC LIMIT $2 OFFSET $3",
        user_name, limit, offset,
    )
    data_rows = [dict(r) for r in rows]

    count_row = await db.fetchrow(
        "SELECT COUNT(*) as total FROM wrong_answers WHERE user_name = $1", user_name
    )
    total = count_row["total"]

    return {"data": data_rows, "total": total, "page": page, "limit": limit}


async def get_wrong_answer_count(db: asyncpg.Connection, user_name: str) -> int:
    row = await db.fetchrow(
        "SELECT COUNT(*) as cnt FROM wrong_answers WHERE user_name = $1", user_name
    )
    return row["cnt"]


async def delete_wrong_answer(db: asyncpg.Connection, answer_id: int) -> bool:
    result = await db.execute("DELETE FROM wrong_answers WHERE id = $1", answer_id)
    parts = result.split()
    deleted_count = int(parts[-1]) if parts and parts[-1].isdigit() else 0
    return deleted_count > 0


async def clear_wrong_answers(db: asyncpg.Connection, user_name: str) -> None:
    await db.execute("DELETE FROM wrong_answers WHERE user_name = $1", user_name)
    logger.info(f"清空错题本: {user_name}")


async def get_practice_questions(db: asyncpg.Connection, question_ids: list[int]) -> list[dict]:
    if not question_ids:
        return []
    placeholders = ",".join([f"${i + 1}" for i in range(len(question_ids))])
    rows = await db.fetch(
        f"SELECT q.id, q.grade_id, q.type_id, q.content, q.options, q.answer, q.points, "
        f"gt.name as grade_name, qt.name as type_name "
        f"FROM questions q JOIN grades gt ON q.grade_id = gt.id "
        f"JOIN question_types qt ON q.type_id = qt.id "
        f"WHERE q.id IN ({placeholders}) ORDER BY RANDOM()",
        *question_ids,
    )
    return [dict(r) for r in rows]