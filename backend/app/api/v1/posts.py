# app/api/v1/posts.py (新增檔案)

from fastapi import APIRouter, Depends, HTTPException, status
from app.schemas.post import PostCreate, PostResponse
from app.models.post import Post
from app.models.user import User
from app.core.security import get_current_user
from app.core.db import AsyncSession, get_session
from sqlmodel import select
from typing import List

router = APIRouter(prefix="/posts", tags=["Posts"])

@router.post("/", response_model=PostResponse, status_code=status.HTTP_201_CREATED)
async def create_post(
    post_in: PostCreate,
    current_user: User = Depends(get_current_user), # JWT 驗證
    session: AsyncSession = Depends(get_session)
):
    """
    建立新的討論文章，需要登入 (JWT) 才能操作。
    """
    
    # 1. 檢查看板是否存在 (可選，但建議避免孤兒數據)
    # 這裡我們假設 Board ID 1 永遠存在
    # TODO: 實作 Board 檢查邏輯
    
    # 2. 建立 Post 實例
    db_post = Post(
        **post_in.model_dump(), 
        owner_id=current_user.id # 寫入 JWT 驗證過的使用者 ID
    )
    
    # 3. 儲存到資料庫
    session.add(db_post)
    await session.commit()
    await session.refresh(db_post)
    
    return db_post

@router.get("/", response_model=List[PostResponse])
async def read_posts(
    skip: int = 0,
    limit: int = 100,
    session: AsyncSession = Depends(get_session)
):
    """
    取得文章列表 (公開，不需要登入)
    """
    statement = select(Post).offset(skip).limit(limit).order_by(Post.created_at.desc())
    result = await session.exec(statement)
    posts = result.all()
    return posts