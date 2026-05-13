from __future__ import annotations
from typing import AsyncGenerator
import asyncpg

from app.core.database import get_pool


async def get_db() -> AsyncGenerator[asyncpg.Connection, None]:
    pool = get_pool()
    async with pool.acquire() as conn:
        try:
            yield conn
        finally:
            await conn.close()