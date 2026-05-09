from __future__ import annotations
import logging
from datetime import datetime

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.lottery_record import LotteryRecord
from app.services import prize_service

logger = logging.getLogger("exam_system")


async def create_record(db: AsyncSession, exam_id: int, user_name: str, prize_name: str, prize_emoji: str) -> LotteryRecord:
    record = LotteryRecord(
        exam_id=exam_id,
        user_name=user_name,
        prize_name=prize_name,
        prize_emoji=prize_emoji,
        is_redeemed=False,
    )
    db.add(record)
    await db.commit()
    await db.refresh(record)
    logger.info(f"创建抽奖记录: 用户={user_name}, 奖项={prize_name}")
    return record


async def find_by_user(db: AsyncSession, user_name: str) -> list[dict]:
    sql = text(
        "SELECT lr.*, er.total_score, er.grade_id, g.name as grade_name "
        "FROM lottery_records lr LEFT JOIN exam_records er ON lr.exam_id = er.id "
        "LEFT JOIN grades g ON er.grade_id = g.id "
        "WHERE lr.user_name = :uname ORDER BY lr.created_at DESC"
    )
    result = await db.execute(sql, {"uname": user_name})
    return [dict(row) for row in result.mappings().all()]


async def find_by_exam(db: AsyncSession, exam_id: int) -> list[LotteryRecord]:
    result = await db.execute(select(LotteryRecord).where(LotteryRecord.exam_id == exam_id))
    return list(result.scalars().all())


async def find_all(db: AsyncSession) -> list[dict]:
    sql = text(
        "SELECT lr.*, er.total_score, er.grade_id, g.name as grade_name, er.user_name as exam_user_name "
        "FROM lottery_records lr LEFT JOIN exam_records er ON lr.exam_id = er.id "
        "LEFT JOIN grades g ON er.grade_id = g.id ORDER BY lr.created_at DESC"
    )
    result = await db.execute(sql)
    return [dict(row) for row in result.mappings().all()]


async def find_by_id(db: AsyncSession, record_id: int) -> LotteryRecord | None:
    return await db.get(LotteryRecord, record_id)


async def update_redeem_status(db: AsyncSession, record_id: int, is_redeemed: bool) -> LotteryRecord | None:
    record = await db.get(LotteryRecord, record_id)
    if not record:
        return None
    record.is_redeemed = is_redeemed
    record.redeemed_at = datetime.now() if is_redeemed else None
    await db.commit()
    await db.refresh(record)
    return record


async def check_can_draw(db: AsyncSession, user_name: str, grade_id: int) -> bool:
    sql = text(
        "SELECT COUNT(*) as count FROM lottery_records lr "
        "JOIN exam_records er ON lr.exam_id = er.id "
        "WHERE lr.user_name = :uname AND er.grade_id = :gid"
    )
    result = await db.execute(sql, {"uname": user_name, "gid": grade_id})
    count = result.scalar()
    return count == 0
