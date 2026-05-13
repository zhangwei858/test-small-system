from __future__ import annotations
import logging
import asyncpg

logger = logging.getLogger("exam_system")


async def create_record(
    db: asyncpg.Connection, exam_id: int, user_name: str, prize_name: str, prize_emoji: str
) -> dict:
    row = await db.fetchrow(
        "INSERT INTO lottery_records (exam_id, user_name, prize_name, prize_emoji, is_redeemed) "
        "VALUES ($1, $2, $3, $4, $5) RETURNING *",
        exam_id, user_name, prize_name, prize_emoji, False,
    )
    logger.info(f"创建抽奖记录: 用户={user_name}, 奖项={prize_name}")
    return dict(row)


async def find_by_user(db: asyncpg.Connection, user_name: str) -> list[dict]:
    rows = await db.fetch(
        "SELECT lr.*, er.total_score, er.grade_id, g.name as grade_name "
        "FROM lottery_records lr LEFT JOIN exam_records er ON lr.exam_id = er.id "
        "LEFT JOIN grades g ON er.grade_id = g.id "
        "WHERE lr.user_name = $1 ORDER BY lr.created_at DESC",
        user_name,
    )
    return [dict(r) for r in rows]


async def find_by_exam(db: asyncpg.Connection, exam_id: int) -> list[dict]:
    rows = await db.fetch("SELECT * FROM lottery_records WHERE exam_id = $1", exam_id)
    return [dict(r) for r in rows]


async def find_all(db: asyncpg.Connection) -> list[dict]:
    rows = await db.fetch(
        "SELECT lr.*, er.total_score, er.grade_id, g.name as grade_name, er.user_name as exam_user_name "
        "FROM lottery_records lr LEFT JOIN exam_records er ON lr.exam_id = er.id "
        "LEFT JOIN grades g ON er.grade_id = g.id ORDER BY lr.created_at DESC"
    )
    return [dict(r) for r in rows]


async def find_by_id(db: asyncpg.Connection, record_id: int) -> dict | None:
    row = await db.fetchrow("SELECT * FROM lottery_records WHERE id = $1", record_id)
    return dict(row) if row else None


async def update_redeem_status(db: asyncpg.Connection, record_id: int, is_redeemed: bool) -> dict | None:
    import datetime

    redeemed_at = datetime.datetime.now() if is_redeemed else None
    row = await db.fetchrow(
        "UPDATE lottery_records SET is_redeemed = $1, redeemed_at = $2 WHERE id = $3 RETURNING *",
        is_redeemed, redeemed_at, record_id,
    )
    return dict(row) if row else None


async def check_can_draw(db: asyncpg.Connection, user_name: str, grade_id: int) -> bool:
    row = await db.fetchrow(
        "SELECT COUNT(*) as count FROM lottery_records lr "
        "JOIN exam_records er ON lr.exam_id = er.id "
        "WHERE lr.user_name = $1 AND er.grade_id = $2",
        user_name, grade_id,
    )
    return row["count"] == 0