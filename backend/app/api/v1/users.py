# backend/app/api/v1/users.py

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel.ext.asyncio.session import AsyncSession
from app.core.db import get_session
from app.core.security import get_current_user
from app.models.user import User
from pydantic import BaseModel
from typing import Optional

router = APIRouter(prefix="/users", tags=["Users"])

# [新增] 定義更新用的 Schema
class UserUpdate(BaseModel):
    nickname: Optional[str] = None
    bg_left: Optional[str] = None
    bg_middle: Optional[str] = None
    bg_right: Optional[str] = None

@router.get("/me", response_model=User)
async def read_users_me(current_user: User = Depends(get_current_user)):
    return current_user

# [新增] 更新個人資料
@router.patch("/me", response_model=User)
async def update_user_me(
    user_in: UserUpdate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    # 更新欄位
    if user_in.nickname is not None:
        current_user.nickname = user_in.nickname
    if user_in.bg_left is not None:
        current_user.bg_left = user_in.bg_left
    if user_in.bg_middle is not None:
        current_user.bg_middle = user_in.bg_middle
    if user_in.bg_right is not None:
        current_user.bg_right = user_in.bg_right
        
    session.add(current_user)
    await session.commit()
    await session.refresh(current_user)
    return current_user