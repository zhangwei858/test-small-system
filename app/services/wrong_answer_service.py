from __future__ import annotations
import logging

from sqlalchemy import text, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.wrong_answer import WrongAnswer

logger = logging.getLogger("exam_system")


async def get_wrong_answers(db: AsyncSession, user_name: str, page: int = 1, limit: int = 10) -> dict:
    offset = (page - 1) * limit
    sql = text(
        "SELECT wa.id, q.content, q.options, q.answer as correct_answer, wa.user_answer, "
        "qt.name as type_name, q.points, wa.created_at "
        "FROM wrong_answers wa JOIN questions q ON wa.question_id = q.id "
        "LEFT JOIN question_types qt ON q.type_id = qt.id "
        "WHERE wa.user_name = :uname ORDER BY wa.created_at DESC LIMIT :lim OFFSET :off"
    )
    result = await db.execute(sql, {"uname": user_name, "lim": limit, "off": offset})
    rows = [dict(row) for row in result.mappings().all()]

    count_sql = text("SELECT COUNT(*) FROM wrong_answers WHERE user_name = :uname")
    count_result = await db.execute(count_sql, {"uname": user_name})
    total = count_result.scalar()

    return {"data": rows, "total": total, "page": page, "limit": limit}


async def get_wrong_answer_count(db: AsyncSession, user_name: str) -> int:
    sql = text("SELECT COUNT(*) FROM wrong_answers WHERE user_name = :uname")
    result = await db.execute(sql, {"uname": user_name})
    return result.scalar()


async def delete_wrong_answer(db: AsyncSession, answer_id: int) -> bool:
    wa = await db.get(WrongAnswer, answer_id)
    if not wa:
        return False
    await db.delete(wa)
    await db.commit()
    return True


async def clear_wrong_answers(db: AsyncSession, user_name: str):
    await db.execute(delete(WrongAnswer).where(WrongAnswer.user_name == user_name))
    await db.commit()
    logger.info(f"清空错题本: {user_name}")


async def get_practice_questions(db: AsyncSession, question_ids: list[int]) -> list[dict]:
    if not question_ids:
        return []
    placeholders = ",".join([f":id{i}" for i in range(len(question_ids))])
    params = {f"id{i}": qid for i, qid in enumerate(question_ids)}
    sql = text(
        f"SELECT q.id, q.grade_id, q.type_id, q.content, q.options, q.answer, q.points, "
        f"gt.name as grade_name, qt.name as type_name "
        f"FROM questions q JOIN grades gt ON q.grade_id = gt.id "
        f"JOIN question_types qt ON q.type_id = qt.id "
        f"WHERE q.id IN ({placeholders}) ORDER BY RANDOM()"
    )
    result = await db.execute(sql, params)
    return [dict(row) for row in result.mappings().all()]
