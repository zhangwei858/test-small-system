from __future__ import annotations
import logging

from fastapi import APIRouter, Depends

from app.dependencies import get_db
from app.schemas.lottery import LotteryDraw, LotteryDemo, RedeemUpdate
from app.schemas.common import ApiResponse
from app.services import lottery_service, prize_service
from app.services.exam_service import _find_exam_by_id, check_paper_already_perfect

logger = logging.getLogger("exam_system")
router = APIRouter(prefix="/api/lottery", tags=["抽奖系统"])


@router.get("/prizes")
async def get_lottery_prizes(db = Depends(get_db)):
    prizes = await prize_service.get_all_prizes(db)
    return ApiResponse(data={
        "prizes": [
            {
                "id": p["id"],
                "name": p["name"],
                "emoji": p["emoji"],
                "color": p["color"],
                "base_probability": float(p["base_probability"]),
                "is_default": p["is_default"],
            }
            for p in prizes
        ],
    })


@router.post("/draw")
async def draw_lottery(data: LotteryDraw, db = Depends(get_db)):
    if not data.exam_id or not data.user_name:
        return ApiResponse(code=400, message="缺少必要参数")

    exam = await _find_exam_by_id(db, data.exam_id)
    if not exam:
        return ApiResponse(code=404, message="考试不存在")
    if exam["total_score"] < 100:
        return ApiResponse(code=400, message="只有满分考试才能抽奖")

    existing = await lottery_service.find_by_exam(db, data.exam_id)
    if existing:
        return ApiResponse(code=400, message="该考试已经抽过奖了")

    can_draw = await lottery_service.check_can_draw(db, data.user_name, exam["grade_id"])
    if not can_draw:
        return ApiResponse(code=400, message="您在此年级已经抽过奖了，每种题型只能抽取一次")

    if exam.get("paper_id"):
        paper_check = await check_paper_already_perfect(db, data.user_name, exam["paper_id"])
        if paper_check["already_perfect"]:
            return ApiResponse(code=400, message="该试卷之前已考过100分，不能重复抽奖")

    question_count = exam.get("total_questions", 10)
    prize = await prize_service.draw(db, question_count)
    if not prize:
        return ApiResponse(code=500, message="抽奖失败，无可用奖项")

    record = await lottery_service.create_record(db, data.exam_id, data.user_name, prize["name"], prize.get("emoji"))

    return ApiResponse(message="抽奖成功", data={
        "prize": {"name": prize["name"], "emoji": prize.get("emoji"), "color": prize.get("color")},
        "record": {
            "id": record["id"],
            "exam_id": record["exam_id"],
            "user_name": record["user_name"],
            "prize_name": record["prize_name"],
            "prize_emoji": record["prize_emoji"],
            "is_redeemed": record["is_redeemed"],
        },
        "questionCount": question_count,
    })


@router.get("/records")
async def get_user_records(user_name: str, db = Depends(get_db)):
    if not user_name:
        return ApiResponse(code=400, message="请提供用户名")
    records = await lottery_service.find_by_user(db, user_name)
    return ApiResponse(data=records)


@router.get("/records/all")
async def get_all_records(db = Depends(get_db)):
    records = await lottery_service.find_all(db)
    return ApiResponse(data=records)


@router.put("/redeem")
async def update_redeem_status(data: RedeemUpdate, db = Depends(get_db)):
    if not data.id or data.is_redeemed is None:
        return ApiResponse(code=400, message="缺少必要参数")
    record = await lottery_service.find_by_id(db, data.id)
    if not record:
        return ApiResponse(code=404, message="抽奖记录不存在")
    updated = await lottery_service.update_redeem_status(db, data.id, data.is_redeemed)
    return ApiResponse(message="兑现状态更新成功", data={
        "id": updated["id"],
        "is_redeemed": updated["is_redeemed"],
        "redeemed_at": updated["redeemed_at"].isoformat() if updated.get("redeemed_at") else None,
    })


@router.post("/demo")
async def demo_draw(data: LotteryDemo, db = Depends(get_db)):
    if data.user_name != "张伟":
        return ApiResponse(code=403, message="只有管理员张伟可以使用演示功能")
    prize = await prize_service.draw(db, 10)
    if not prize:
        return ApiResponse(code=500, message="演示抽奖失败")
    return ApiResponse(message="演示抽奖成功", data={
        "prize": {"name": prize["name"], "emoji": prize.get("emoji"), "color": prize.get("color")},
        "is_demo": True,
    })