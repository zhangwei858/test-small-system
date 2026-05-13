from __future__ import annotations
import logging

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.dependencies import get_db
from app.schemas.common import ApiResponse
from app.services import wrong_answer_service

logger = logging.getLogger("exam_system")
router = APIRouter(prefix="/api/wrong-answers", tags=["错题本"])


class PracticeRequest(BaseModel):
    userName: str
    questionIds: list[int]


@router.get("/user/{user_name}")
async def get_wrong_answers(user_name: str, page: int = 1, limit: int = 10, db = Depends(get_db)):
    result = await wrong_answer_service.get_wrong_answers(db, user_name, page, limit)
    return ApiResponse(data=result["data"])


@router.get("/user/{user_name}/count")
async def get_wrong_answer_count(user_name: str, db = Depends(get_db)):
    count = await wrong_answer_service.get_wrong_answer_count(db, user_name)
    return ApiResponse(data={"count": count})


@router.delete("/{answer_id}")
async def delete_wrong_answer(answer_id: int, db = Depends(get_db)):
    success = await wrong_answer_service.delete_wrong_answer(db, answer_id)
    if not success:
        return ApiResponse(code=404, message="错题记录不存在")
    return ApiResponse(message="删除成功")


@router.delete("/user/{user_name}")
async def clear_wrong_answers(user_name: str, db = Depends(get_db)):
    await wrong_answer_service.clear_wrong_answers(db, user_name)
    return ApiResponse(message="清空错题本成功")


@router.post("/practice")
async def practice_wrong_answers(data: PracticeRequest, db = Depends(get_db)):
    if not data.questionIds:
        return ApiResponse(code=400, message="请选择要练习的题目")
    questions = await wrong_answer_service.get_practice_questions(db, data.questionIds)
    return ApiResponse(data={"questions": questions, "total_questions": len(questions)})