from __future__ import annotations
import logging

from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.schemas.user import UserCreate, UserUpdate

logger = logging.getLogger("exam_system")


async def find_by_username(db: AsyncSession, username: str) -> User | None:
    result = await db.execute(select(User).where(User.username == username))
    return result.scalars().first()


async def create_user(db: AsyncSession, data: UserCreate) -> User:
    user = User(
        username=data.username,
        role="examiner",
        allowed_grades=data.allowedGrades or ["low", "middle", "high"],
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    logger.info(f"创建用户: {user.username}, 角色: {user.role}")
    return user


async def get_all_users(db: AsyncSession) -> list[User]:
    result = await db.execute(select(User).order_by(User.created_at.desc()))
    return list(result.scalars().all())


async def update_user(db: AsyncSession, user_id: int, data: UserUpdate) -> User | None:
    user = await db.get(User, user_id)
    if not user:
        return None
    if data.role is not None:
        user.role = data.role
    if data.allowedGrades is not None:
        user.allowed_grades = data.allowedGrades
    await db.commit()
    await db.refresh(user)
    logger.info(f"更新用户: {user.username}, 角色: {user.role}")
    return user


async def delete_user(db: AsyncSession, user_id: int) -> User | None:
    user = await db.get(User, user_id)
    if not user:
        return None
    await db.delete(user)
    await db.commit()
    logger.info(f"删除用户: {user.username}")
    return user


async def is_admin(db: AsyncSession, username: str) -> bool:
    user = await find_by_username(db, username)
    return user is not None and user.role == "admin"


async def get_allowed_grades(db: AsyncSession, username: str) -> list[str]:
    user = await find_by_username(db, username)
    if not user:
        return ["low", "middle", "high"]
    return user.allowed_grades or ["low", "middle", "high"]
