from __future__ import annotations
import logging

from fastapi import APIRouter, Depends

from app.dependencies import get_db
from app.schemas.exam import ExamStart, AnswerSubmit, AllAnswersSubmit
from app.schemas.common import ApiResponse
from app.services import exam_service

logger = logging.getLogger("exam_system")
router = APIRouter(prefix="/api/exams", tags=["考试管理"])


@router.get("/check-paper-perfect")
async def check_paper_perfect(user_name: str, paper_id: int, db = Depends(get_db)):
    if not user_name or not paper_id:
        return ApiResponse(code=400, message="请提供用户名和试卷ID")
    result = await exam_service.check_paper_already_perfect(db, user_name, paper_id)
    return ApiResponse(data=result)


@router.get("/history")
async def get_exam_history(user_name: str, db = Depends(get_db)):
    if not user_name:
        return ApiResponse(code=400, message="请提供用户名")
    exams = await exam_service.get_exam_history(db, user_name)
    return ApiResponse(data=exams)


@router.get("/history/all")
async def get_all_exam_history(user_name: str = None, db = Depends(get_db)):
    if user_name and user_name != "张伟":
        exams = await exam_service.get_exam_history(db, user_name)
    else:
        exams = await exam_service.get_all_exam_history(db)
    return ApiResponse(data=exams)


@router.post("/start")
async def start_exam(data: ExamStart, db = Depends(get_db)):
    if not data.grade_id:
        return ApiResponse(code=400, message="请选择年级")
    result = await exam_service.start_exam(db, data)
    if result is None:
        return ApiResponse(code=400, message="该年级暂无符合条件的题目，请先导入题目")
    return ApiResponse(message="考试开始成功", data=result)


@router.get("/{exam_id}")
async def get_exam_status(exam_id: int, db = Depends(get_db)):
    result = await exam_service.get_exam_status(db, exam_id)
    if not result:
        return ApiResponse(code=404, message="考试不存在")
    return ApiResponse(data=result)


@router.post("/{exam_id}/submit")
async def submit_answer(exam_id: int, data: AnswerSubmit, db = Depends(get_db)):
    if not data.question_id or data.user_answer is None:
        return ApiResponse(code=400, message="缺少必要参数")
    result = await exam_service.submit_answer(db, exam_id, data.question_id, data.user_answer)
    if result is None:
        return ApiResponse(code=404, message="题目不存在")
    return ApiResponse(message="答案提交成功", data=result)


@router.post("/{exam_id}/submit-all")
async def submit_all_answers(exam_id: int, data: AllAnswersSubmit, db = Depends(get_db)):
    if not data.answers:
        return ApiResponse(code=400, message="缺少答案数据")
    result = await exam_service.submit_all_answers(db, exam_id, data.answers)
    if result is None:
        return ApiResponse(code=404, message="考试不存在")
    return ApiResponse(message="答案提交成功", data=result)


@router.get("/{exam_id}/result")
async def get_exam_result(exam_id: int, db = Depends(get_db)):
    result = await exam_service.complete_exam(db, exam_id)
    if not result:
        return ApiResponse(code=404, message="考试不存在")
    return ApiResponse(message="考试完成", data=result)


@router.get("/{exam_id}/answer/{question_id}")
async def get_answer(exam_id: int, question_id: int, db = Depends(get_db)):
    q = await exam_service.get_exam_status(db, exam_id)
    if not q:
        return ApiResponse(code=404, message="考试不存在")
    question = await exam_service._find_exam_by_id(db, exam_id)
    from app.services import question_service as qs
    q_detail = await qs.find_by_id(db, question_id)
    if not q_detail:
        return ApiResponse(code=404, message="题目不存在")
    answers = q.get("answers", [])
    user_answer = next((a for a in answers if a.get("question_id") == question_id), None)
    return ApiResponse(data={
        "question": q_detail,
        "user_answer": user_answer.get("user_answer") if user_answer else None,
        "is_correct": user_answer.get("is_correct") if user_answer else None,
        "points_earned": user_answer.get("points_earned", 0) if user_answer else 0,
    })


@router.get("/{exam_id}/details")
async def get_exam_details(exam_id: int, db = Depends(get_db)):
    result = await exam_service.get_exam_details(db, exam_id)
    if not result:
        return ApiResponse(code=404, message="考试记录不存在")
    return ApiResponse(data=result)