from __future__ import annotations
import logging
import asyncpg

logger = logging.getLogger("exam_system")


async def get_all_prizes(db: asyncpg.Connection) -> list[dict]:
    rows = await db.fetch("SELECT * FROM prizes ORDER BY id")
    return [dict(r) for r in rows]


async def find_by_id(db: asyncpg.Connection, prize_id: int) -> dict | None:
    row = await db.fetchrow("SELECT * FROM prizes WHERE id = $1", prize_id)
    return dict(row) if row else None


async def create_prize(db: asyncpg.Connection, data) -> dict:
    row = await db.fetchrow(
        "INSERT INTO prizes (name, emoji, color, base_probability, is_default) "
        "VALUES ($1, $2, $3, $4, $5) RETURNING *",
        data.name, data.emoji, data.color, data.base_probability, False,
    )
    logger.info(f"创建奖项: {row['name']}, 概率: {row['base_probability']}")
    return dict(row)


async def update_prize(db: asyncpg.Connection, prize_id: int, data) -> dict | None:
    import datetime

    existing = await find_by_id(db, prize_id)
    if not existing:
        return None

    name = data.name if data.name is not None else existing["name"]
    emoji = data.emoji if data.emoji is not None else existing["emoji"]
    color = data.color if data.color is not None else existing["color"]
    base_probability = data.base_probability if data.base_probability is not None else float(existing["base_probability"])

    row = await db.fetchrow(
        "UPDATE prizes SET name = $1, emoji = $2, color = $3, base_probability = $4, updated_at = $5 "
        "WHERE id = $6 RETURNING *",
        name, emoji, color, base_probability, datetime.datetime.now(), prize_id,
    )
    return dict(row)


async def delete_prize(db: asyncpg.Connection, prize_id: int) -> dict | None:
    existing = await find_by_id(db, prize_id)
    if not existing or existing.get("is_default"):
        return None
    row = await db.fetchrow("DELETE FROM prizes WHERE id = $1 RETURNING *", prize_id)
    return dict(row) if row else None


async def get_total_probability(db: asyncpg.Connection) -> float:
    row = await db.fetchrow("SELECT COALESCE(SUM(base_probability), 0) as total FROM prizes")
    return float(row["total"])


async def calculate_dynamic_probabilities(db: asyncpg.Connection, question_count: int = 10) -> list[dict]:
    prizes = await get_all_prizes(db)

    bonus_probability = 0
    if question_count < 10:
        bonus_probability = min((10 - question_count) * 5, 30)

    adjusted = []
    for p in prizes:
        if p["is_default"]:
            dynamic = min(float(p["base_probability"]) + bonus_probability, 95)
        else:
            dynamic = float(p["base_probability"])
        adjusted.append({
            "id": p["id"],
            "name": p["name"],
            "emoji": p["emoji"],
            "color": p["color"],
            "base_probability": float(p["base_probability"]),
            "is_default": p["is_default"],
            "dynamic_probability": dynamic,
        })

    total_without_default = sum(p["dynamic_probability"] for p in adjusted if not p["is_default"])
    remaining = 100 - total_without_default
    for p in adjusted:
        if p["is_default"]:
            p["dynamic_probability"] = max(remaining, 0)

    return adjusted


async def draw(db: asyncpg.Connection, question_count: int = 10) -> dict | None:
    import random

    prizes = await calculate_dynamic_probabilities(db, question_count)

    rand = random.random() * 100
    cumulative = 0

    for prize in prizes:
        cumulative += prize.get("dynamic_probability", prize["base_probability"])
        if rand <= cumulative:
            return prize

    return prizes[-1] if prizes else None