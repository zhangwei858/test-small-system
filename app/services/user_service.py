from __future__ import annotations
import json
import logging
import asyncpg

logger = logging.getLogger("exam_system")


async def find_by_username(db: asyncpg.Connection, username: str) -> dict | None:
    row = await db.fetchrow("SELECT * FROM users WHERE username = $1", username)
    return dict(row) if row else None


async def create_user(db: asyncpg.Connection, data) -> dict:
    allowed_grades = json.dumps(data.allowedGrades or ["low", "middle", "high"])
    row = await db.fetchrow(
        "INSERT INTO users (username, role, allowed_grades) VALUES ($1, $2, $3) RETURNING *",
        data.username, "examiner", allowed_grades,
    )
    logger.info(f"创建用户: {row['username']}, 角色: {row['role']}")
    return dict(row)


async def get_all_users(db: asyncpg.Connection) -> list[dict]:
    rows = await db.fetch("SELECT * FROM users ORDER BY created_at DESC")
    return [dict(r) for r in rows]


async def update_user(db: asyncpg.Connection, user_id: int, data) -> dict | None:
    existing = await db.fetchrow("SELECT * FROM users WHERE id = $1", user_id)
    if not existing:
        return None

    role = data.role if data.role is not None else existing["role"]
    allowed_grades = json.dumps(data.allowedGrades) if data.allowedGrades is not None else existing["allowed_grades"]

    row = await db.fetchrow(
        "UPDATE users SET role = $1, allowed_grades = $2 WHERE id = $3 RETURNING *",
        role, allowed_grades, user_id,
    )
    logger.info(f"更新用户: {row['username']}, 角色: {row['role']}")
    return dict(row)


async def delete_user(db: asyncpg.Connection, user_id: int) -> dict | None:
    row = await db.fetchrow(
        "DELETE FROM users WHERE id = $1 RETURNING *", user_id
    )
    if row:
        logger.info(f"删除用户: {row['username']}")
        return dict(row)
    return None


async def is_admin(db: asyncpg.Connection, username: str) -> bool:
    user = await find_by_username(db, username)
    return user is not None and user.get("role") == "admin"


async def get_allowed_grades(db: asyncpg.Connection, username: str) -> list[str]:
    user = await find_by_username(db, username)
    if not user:
        return ["low", "middle", "high"]
    grades = user.get("allowed_grades")
    if isinstance(grades, str):
        try:
            grades = json.loads(grades)
        except (json.JSONDecodeError, TypeError):
            return ["low", "middle", "high"]
    return grades or ["low", "middle", "high"]