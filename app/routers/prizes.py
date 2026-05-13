from __future__ import annotations
import logging

from fastapi import APIRouter, Depends

from app.dependencies import get_db
from app.schemas.prize import PrizeCreate, PrizeUpdate
from app.schemas.common import ApiResponse
from app.services import prize_service

logger = logging.getLogger("exam_system")
router = APIRouter(prefix="/api/prizes", tags=["奖项管理"])


@router.get("")
async def get_prizes(db = Depends(get_db)):
    prizes = await prize_service.get_all_prizes(db)
    total_prob = await prize_service.get_total_probability(db)
    return ApiResponse(data={
        "prizes": [
            {
                "id": p["id"],
                "name": p["name"],
                "emoji": p["emoji"],
                "color": p["color"],
                "base_probability": float(p["base_probability"]),
                "is_default": p["is_default"],
                "updated_at": p["updated_at"].isoformat() if p.get("updated_at") else None,
            }
            for p in prizes
        ],
        "totalProbability": f"{total_prob:.2f}",
    })


@router.get("/{prize_id}")
async def get_prize(prize_id: int, db = Depends(get_db)):
    p = await prize_service.find_by_id(db, prize_id)
    if not p:
        return ApiResponse(code=404, message="奖项不存在")
    return ApiResponse(data={
        "id": p["id"], "name": p["name"], "emoji": p["emoji"], "color": p["color"],
        "base_probability": float(p["base_probability"]), "is_default": p["is_default"],
    })


@router.post("")
async def create_prize(data: PrizeCreate, db = Depends(get_db)):
    if data.base_probability < 0 or data.base_probability > 100:
        return ApiResponse(code=400, message="概率值必须在0-100之间")
    total_prob = await prize_service.get_total_probability(db)
    if total_prob + data.base_probability > 100:
        return ApiResponse(code=400, message=f"概率总和超过100%，当前总和: {total_prob:.2f}%")
    p = await prize_service.create_prize(db, data)
    return ApiResponse(message="奖项创建成功", data={
        "id": p["id"], "name": p["name"], "emoji": p["emoji"], "color": p["color"],
        "base_probability": float(p["base_probability"]), "is_default": p["is_default"],
    })


@router.put("/{prize_id}")
async def update_prize(prize_id: int, data: PrizeUpdate, db = Depends(get_db)):
    existing = await prize_service.find_by_id(db, prize_id)
    if not existing:
        return ApiResponse(code=404, message="奖项不存在")
    if data.base_probability is not None:
        if data.base_probability < 0 or data.base_probability > 100:
            return ApiResponse(code=400, message="概率值必须在0-100之间")
        total_prob = await prize_service.get_total_probability(db)
        diff = data.base_probability - float(existing["base_probability"])
        if total_prob + diff > 100:
            return ApiResponse(code=400, message="概率总和超过100%")
    p = await prize_service.update_prize(db, prize_id, data)
    return ApiResponse(message="奖项更新成功", data={
        "id": p["id"], "name": p["name"], "emoji": p["emoji"], "color": p["color"],
        "base_probability": float(p["base_probability"]),
    })


@router.delete("/{prize_id}")
async def delete_prize(prize_id: int, db = Depends(get_db)):
    p = await prize_service.delete_prize(db, prize_id)
    if not p:
        return ApiResponse(code=400, message="无法删除默认奖项或奖项不存在")
    return ApiResponse(message="奖项删除成功")


@router.get("/dynamic")
async def get_dynamic_probabilities(question_count: int = 10, db = Depends(get_db)):
    prizes = await prize_service.calculate_dynamic_probabilities(db, question_count)
    return ApiResponse(data=prizes)