from __future__ import annotations
import logging

from fastapi import APIRouter, Depends

from app.dependencies import get_db
from app.schemas.common import ApiResponse
from app.services import grade_service

logger = logging.getLogger("exam_system")
router = APIRouter(prefix="/api/grades", tags=["年级管理"])


@router.get("")
async def get_grades(db = Depends(get_db)):
    grades = await grade_service.get_all_grades(db)
    return ApiResponse(data=grades)


@router.get("/{grade_id}")
async def get_grade(grade_id: int, db = Depends(get_db)):
    grade = await grade_service.find_by_id(db, grade_id)
    if not grade:
        return ApiResponse(code=404, message="年级不存在")
    return ApiResponse(data={"id": grade["id"], "name": grade["name"], "level": grade["level"]})