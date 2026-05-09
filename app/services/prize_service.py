from __future__ import annotations
import logging
import random

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.prize import Prize
from app.schemas.prize import PrizeCreate, PrizeUpdate

logger = logging.getLogger("exam_system")


async def get_all_prizes(db: AsyncSession) -> list[Prize]:
    result = await db.execute(select(Prize).order_by(Prize.id))
    return list(result.scalars().all())


async def find_by_id(db: AsyncSession, prize_id: int) -> Prize | None:
    return await db.get(Prize, prize_id)


async def create_prize(db: AsyncSession, data: PrizeCreate) -> Prize:
    prize = Prize(
        name=data.name,
        emoji=data.emoji,
        color=data.color,
        base_probability=data.base_probability,
        is_default=False,
    )
    db.add(prize)
    await db.commit()
    await db.refresh(prize)
    logger.info(f"创建奖项: {prize.name}, 概率: {prize.base_probability}")
    return prize


async def update_prize(db: AsyncSession, prize_id: int, data: PrizeUpdate) -> Prize | None:
    prize = await db.get(Prize, prize_id)
    if not prize:
        return None
    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(prize, key, value)
    prize.updated_at = __import__("datetime").datetime.now()
    await db.commit()
    await db.refresh(prize)
    return prize


async def delete_prize(db: AsyncSession, prize_id: int) -> Prize | None:
    prize = await db.get(Prize, prize_id)
    if not prize or prize.is_default:
        return None
    await db.delete(prize)
    await db.commit()
    return prize


async def get_total_probability(db: AsyncSession) -> float:
    result = await db.execute(select(func.sum(Prize.base_probability)))
    total = result.scalar()
    return float(total) if total else 0


async def calculate_dynamic_probabilities(db: AsyncSession, question_count: int = 10) -> list[dict]:
    prizes = await get_all_prizes(db)

    default_prize = next((p for p in prizes if p.is_default), None)

    bonus_probability = 0
    if question_count < 10:
        bonus_probability = min((10 - question_count) * 5, 30)

    adjusted = []
    for p in prizes:
        if p.is_default:
            dynamic = min(float(p.base_probability) + bonus_probability, 95)
            adjusted.append({
                "id": p.id,
                "name": p.name,
                "emoji": p.emoji,
                "color": p.color,
                "base_probability": float(p.base_probability),
                "is_default": p.is_default,
                "dynamic_probability": dynamic,
            })
        else:
            adjusted.append({
                "id": p.id,
                "name": p.name,
                "emoji": p.emoji,
                "color": p.color,
                "base_probability": float(p.base_probability),
                "is_default": p.is_default,
                "dynamic_probability": float(p.base_probability),
            })

    total_without_default = sum(p["dynamic_probability"] for p in adjusted if not p["is_default"])
    remaining = 100 - total_without_default
    for p in adjusted:
        if p["is_default"]:
            p["dynamic_probability"] = max(remaining, 0)

    return adjusted


async def draw(db: AsyncSession, question_count: int = 10) -> dict | None:
    prizes = await calculate_dynamic_probabilities(db, question_count)

    rand = random.random() * 100
    cumulative = 0

    for prize in prizes:
        cumulative += prize.get("dynamic_probability", prize["base_probability"])
        if rand <= cumulative:
            return prize

    return prizes[-1] if prizes else None
