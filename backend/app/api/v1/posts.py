from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Optional
from sqlmodel import select
from sqlalchemy.orm import selectinload
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.db import get_session
from app.core.security import get_current_user
from app.models.post import Post, Vote, Comment
from app.models.user import User
# 記得匯入 PostCreate
from app.schemas.post import PostRead, CommentRead, PostCreate 

router = APIRouter(prefix="/posts", tags=["Posts"])

# --- 1. 刪除文章 ---
@router.delete("/{post_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_post(
    post_id: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    post = await session.get(Post, post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    if post.owner_id != current_user.id and not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Not authorized to delete this post")
        
    await session.delete(post)
    await session.commit()
    return None

# --- 2. 投票功能 ---
@router.post("/{post_id}/vote")
async def vote_post(
    post_id: int,
    dir: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    statement = select(Vote).where(Vote.user_id == current_user.id, Vote.post_id == post_id)
    result = await session.exec(statement)
    existing_vote = result.first()

    if existing_vote:
        if existing_vote.dir == dir:
            await session.delete(existing_vote)
        else:
            existing_vote.dir = dir
            session.add(existing_vote)
    else:
        new_vote = Vote(user_id=current_user.id, post_id=post_id, dir=dir)
        session.add(new_vote)
    
    await session.commit()
    return {"message": "Vote updated"}

# --- 3. 取得留言 (修正回傳模型) ---
@router.get("/{post_id}/comments", response_model=List[CommentRead]) # [修正] 使用 CommentRead
async def read_comments(
    post_id: int,
    session: AsyncSession = Depends(get_session)
):
    # 使用 selectinload 預先加載 user 資訊
    statement = select(Comment).where(Comment.post_id == post_id).options(selectinload(Comment.user)).order_by(Comment.created_at)
    result = await session.exec(statement)
    return result.all()

# --- 4. 新增留言 (修正回傳模型與填充 User) ---
@router.post("/{post_id}/comments", response_model=CommentRead) # [修正] 使用 CommentRead
async def create_comment(
    post_id: int,
    content: str, 
    is_spoiler: bool = False,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    comment = Comment(
        content=content, 
        user_id=current_user.id, 
        post_id=post_id,
        is_spoiler=is_spoiler
    )    
    session.add(comment)
    await session.commit()
    await session.refresh(comment)
    comment.user = current_user 
    
    return comment

# --- 5. 建立文章 (修正輸入/輸出模型) ---
@router.post("/", response_model=PostRead, status_code=status.HTTP_201_CREATED) # [修正] 回傳 PostRead
async def create_post(
    post_in: PostCreate, 
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """
    建立新的討論文章
    """
    db_post = Post(
        **post_in.model_dump(), 
        owner_id=current_user.id
    )
    
    session.add(db_post)
    await session.commit()
    await session.refresh(db_post)
    
    # [關鍵] 手動填充 owner 屬性，讓前端發完文能馬上顯示作者名
    db_post.owner = current_user
    
    return db_post

# --- 6. 讀取文章列表 (修正回傳模型) ---
@router.get("/", response_model=List[PostRead]) # [修正] 回傳 List[PostRead]
async def read_posts(
    board_id: Optional[int] = None,
    user_id: Optional[int] = None,
    skip: int = 0,
    limit: int = 100,
    session: AsyncSession = Depends(get_session)
):
    statement = select(Post).options(selectinload(Post.owner))
    
    if board_id:
        statement = statement.where(Post.board_id == board_id)
    
    if user_id:
        statement = statement.where(Post.owner_id == user_id)
        
    statement = statement.offset(skip).limit(limit).order_by(Post.created_at.desc())
    
    result = await session.exec(statement)
    return result.all()