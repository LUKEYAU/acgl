# backend/app/api/v1/users.py

from fastapi import APIRouter, Depends
from app.models.user import User
from app.core.security import get_current_user

# 定義路由，前綴為 /users
router = APIRouter(prefix="/users", tags=["Users"])

@router.get("/me", response_model=User)
async def read_users_me(current_user: User = Depends(get_current_user)):
    return current_user