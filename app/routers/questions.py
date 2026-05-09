from __future__ import annotations
import os
import logging

from fastapi import APIRouter, Depends, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db
from app.schemas.question import QuestionCreate, QuestionUpdate
from app.schemas.common import ApiResponse, PaginationInfo
from app.services import question_service

logger = logging.getLogger("exam_system")
router = APIRouter(prefix="/api/questions", tags=["题目管理"])


@router.get("")
async def get_questions(
    grade_id: int | None = None,
    type_id: int | None = None,
    page: int = 1,
    limit: int = 10,
    db: AsyncSession = Depends(get_db),
):
    offset = (page - 1) * limit
    filters = {"limit": limit, "offset": offset}
    if grade_id:
        filters["grade_id"] = grade_id
    if type_id:
        filters["type_id"] = type_id

    questions = await question_service.find_all(db, filters)
    return ApiResponse(data=questions)


@router.get("/{question_id}")
async def get_question(question_id: int, db: AsyncSession = Depends(get_db)):
    q = await question_service.find_by_id(db, question_id)
    if not q:
        return ApiResponse(code=404, message="题目不存在")
    return ApiResponse(data=q)


@router.post("")
async def create_question(data: QuestionCreate, db: AsyncSession = Depends(get_db)):
    if not data.grade_id or not data.type_id or not data.content or not data.answer:
        return ApiResponse(code=400, message="缺少必填字段")
    q = await question_service.create_question(db, data)
    return ApiResponse(code=201, message="题目创建成功", data={"id": q.id, "content": q.content})


@router.put("/{question_id}")
async def update_question(question_id: int, data: QuestionUpdate, db: AsyncSession = Depends(get_db)):
    q = await question_service.update_question(db, question_id, data)
    if not q:
        return ApiResponse(code=404, message="题目不存在")
    return ApiResponse(message="题目更新成功", data={"id": q.id})


@router.delete("/{question_id}")
async def delete_question(question_id: int, db: AsyncSession = Depends(get_db)):
    q = await question_service.delete_question(db, question_id)
    if not q:
        return ApiResponse(code=404, message="题目不存在")
    return ApiResponse(message="题目删除成功")


@router.post("/import")
async def import_questions(
    grade_id: int = Form(...),
    type_id: int | None = Form(None),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    if not file.filename.endswith(".txt"):
        return ApiResponse(code=400, message="只支持TXT文件")

    bank_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "题库")
    os.makedirs(bank_dir, exist_ok=True)

    file_path = os.path.join(bank_dir, file.filename)
    content = await file.read()
    with open(file_path, "wb") as f:
        f.write(content)

    try:
        result = await question_service.import_from_file(db, file_path, grade_id, type_id, file.filename)
    except Exception as e:
        logger.error(f"导入题目失败: {e}")
        return ApiResponse(code=500, message="导入题目失败", data={"error": str(e)})

    return ApiResponse(message="导入完成", data=result)


@router.post("/scan-bank")
async def scan_bank(db: AsyncSession = Depends(get_db)):
    result = await question_service.scan_question_bank(db)
    if result is None:
        return ApiResponse(code=400, message="题库文件夹不存在")
    return ApiResponse(message="题库扫描导入完成", data=result)


@router.post("/clear")
async def clear_bank(db: AsyncSession = Depends(get_db)):
    await question_service.clear_question_bank(db)
    return ApiResponse(message="题库清空成功")


@router.post("/reset")
async def reset_bank(db: AsyncSession = Depends(get_db)):
    result = await question_service.reset_and_rescan(db)
    return ApiResponse(message="题库重置并重扫完成", data=result)
