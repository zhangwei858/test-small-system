from __future__ import annotations
import logging

from fastapi import APIRouter, Depends

from app.dependencies import get_db
from app.schemas.user import UserLogin, UserCreate, UserUpdate
from app.schemas.common import ApiResponse
from app.services import user_service

logger = logging.getLogger("exam_system")
router = APIRouter(prefix="/api/users", tags=["用户管理"])


@router.post("/login")
async def login(data: UserLogin, db = Depends(get_db)):
    user = await user_service.find_by_username(db, data.username)
    if not user:
        user = await user_service.create_user(db, UserCreate(username=data.username))
    return ApiResponse(
        message="登录成功",
        data={
            "id": user["id"],
            "username": user["username"],
            "role": user["role"],
            "allowed_grades": user["allowed_grades"],
        },
    )


@router.post("")
async def register(data: UserCreate, db = Depends(get_db)):
    existing = await user_service.find_by_username(db, data.username)
    if existing:
        return ApiResponse(code=400, message="用户名已存在")
    user = await user_service.create_user(db, data)
    return ApiResponse(code=201, message="注册成功", data={
        "id": user["id"],
        "username": user["username"],
        "role": user["role"],
        "allowed_grades": user["allowed_grades"],
        "created_at": user["created_at"].isoformat() if user.get("created_at") else None,
    })


@router.get("")
async def get_users(db = Depends(get_db)):
    users = await user_service.get_all_users(db)
    return ApiResponse(data=[{
        "id": u["id"],
        "username": u["username"],
        "role": u["role"],
        "allowed_grades": u["allowed_grades"],
        "created_at": u["created_at"].isoformat() if u.get("created_at") else None,
    } for u in users])


@router.get("/{username}")
async def get_user(username: str, db = Depends(get_db)):
    user = await user_service.find_by_username(db, username)
    if not user:
        return ApiResponse(code=404, message="用户不存在")
    return ApiResponse(data={
        "id": user["id"],
        "username": user["username"],
        "role": user["role"],
        "allowed_grades": user["allowed_grades"],
        "created_at": user["created_at"].isoformat() if user.get("created_at") else None,
    })


@router.put("/{user_id}")
async def update_user(user_id: int, data: UserUpdate, db = Depends(get_db)):
    user = await user_service.update_user(db, user_id, data)
    if not user:
        return ApiResponse(code=404, message="用户不存在")
    return ApiResponse(message="更新成功", data={
        "id": user["id"],
        "username": user["username"],
        "role": user["role"],
        "allowed_grades": user["allowed_grades"],
    })


@router.delete("/{user_id}")
async def delete_user(user_id: int, db = Depends(get_db)):
    user = await user_service.delete_user(db, user_id)
    if not user:
        return ApiResponse(code=404, message="用户不存在")
    return ApiResponse(message="删除成功", data={
        "id": user["id"],
        "username": user["username"],
        "role": user["role"],
    })