from __future__ import annotations
import logging

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db
from app.schemas.common import ApiResponse
from app.services import paper_service

logger = logging.getLogger("exam_system")
router = APIRouter(prefix="/api/papers", tags=["试卷管理"])


@router.get("")
async def get_papers(user_name: str = None, db: AsyncSession = Depends(get_db)):
    papers = await paper_service.get_all_papers(db, user_name)
    return ApiResponse(data=papers)


@router.get("/{paper_id}")
async def get_paper(paper_id: int, db: AsyncSession = Depends(get_db)):
    paper = await paper_service.find_by_id(db, paper_id)
    if not paper:
        return ApiResponse(code=404, message="试卷不存在")
    return ApiResponse(data={
        "id": paper.id,
        "name": paper.name,
        "grade_id": paper.grade_id,
        "source_file": paper.source_file,
        "question_count": paper.question_count,
        "created_at": paper.created_at.isoformat() if paper.created_at else None,
    })
