from __future__ import annotations
import logging

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db
from app.schemas.common import ApiResponse
from app.services import type_service

logger = logging.getLogger("exam_system")
router = APIRouter(prefix="/api/types", tags=["题型管理"])


@router.get("")
async def get_types(db: AsyncSession = Depends(get_db)):
    types = await type_service.get_all_types(db)
    return ApiResponse(data=[{"id": t.id, "name": t.name, "description": t.description} for t in types])


@router.get("/{type_id}")
async def get_type(type_id: int, db: AsyncSession = Depends(get_db)):
    t = await type_service.find_by_id(db, type_id)
    if not t:
        return ApiResponse(code=404, message="题型不存在")
    return ApiResponse(data={"id": t.id, "name": t.name, "description": t.description})
