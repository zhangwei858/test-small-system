from __future__ import annotations
import logging

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db
from app.schemas.user import UserLogin, UserCreate, UserUpdate, UserResponse
from app.schemas.common import ApiResponse
from app.services import user_service

logger = logging.getLogger("exam_system")
router = APIRouter(prefix="/api/users", tags=["用户管理"])


@router.post("/login")
async def login(data: UserLogin, db: AsyncSession = Depends(get_db)):
    user = await user_service.find_by_username(db, data.username)
    if not user:
        from app.schemas.user import UserCreate as UC
        user = await user_service.create_user(db, UC(username=data.username))
    return ApiResponse(
        message="登录成功",
        data={
            "id": user.id,
            "username": user.username,
            "role": user.role,
            "allowed_grades": user.allowed_grades,
        },
    )


@router.post("")
async def register(data: UserCreate, db: AsyncSession = Depends(get_db)):
    existing = await user_service.find_by_username(db, data.username)
    if existing:
        return ApiResponse(code=400, message="用户名已存在")
    user = await user_service.create_user(db, data)
    return ApiResponse(code=201, message="注册成功", data=UserResponse.model_validate(user).model_dump())


@router.get("")
async def get_users(db: AsyncSession = Depends(get_db)):
    users = await user_service.get_all_users(db)
    return ApiResponse(data=[UserResponse.model_validate(u).model_dump() for u in users])


@router.get("/{username}")
async def get_user(username: str, db: AsyncSession = Depends(get_db)):
    user = await user_service.find_by_username(db, username)
    if not user:
        return ApiResponse(code=404, message="用户不存在")
    return ApiResponse(data=UserResponse.model_validate(user).model_dump())


@router.put("/{user_id}")
async def update_user(user_id: int, data: UserUpdate, db: AsyncSession = Depends(get_db)):
    user = await user_service.update_user(db, user_id, data)
    if not user:
        return ApiResponse(code=404, message="用户不存在")
    return ApiResponse(message="更新成功", data=UserResponse.model_validate(user).model_dump())


@router.delete("/{user_id}")
async def delete_user(user_id: int, db: AsyncSession = Depends(get_db)):
    user = await user_service.delete_user(db, user_id)
    if not user:
        return ApiResponse(code=404, message="用户不存在")
    return ApiResponse(message="删除成功", data=UserResponse.model_validate(user).model_dump())
