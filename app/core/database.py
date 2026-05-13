from __future__ import annotations
import asyncpg
from app.config.settings import settings
from app.config.logger import logger

_pool: asyncpg.Pool | None = None


async def create_pool() -> asyncpg.Pool:
    global _pool
    _pool = await asyncpg.create_pool(
        host=settings.DB_HOST,
        port=settings.DB_PORT,
        database=settings.DB_NAME,
        user=settings.DB_USER,
        password=settings.DB_PASSWORD,
        min_size=5,
        max_size=20,
        command_timeout=60,
    )
    logger.info(f"数据库连接池已创建: {settings.DB_HOST}:{settings.DB_PORT}/{settings.DB_NAME}, 池大小: 5~20")
    return _pool


async def close_pool() -> None:
    global _pool
    if _pool:
        await _pool.close()
        logger.info("数据库连接池已关闭")


def get_pool() -> asyncpg.Pool:
    if _pool is None:
        raise RuntimeError("数据库连接池未初始化，请先调用 create_pool()")
    return _pool