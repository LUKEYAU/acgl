# backend/app/schemas/post.py

from datetime import datetime
from sqlmodel import SQLModel
from typing import Optional
from app.models.user import UserPublic  
# --- Post 相關 ---

class PostCreate(SQLModel):
    title: str
    content: str
    board_id: int
    is_spoiler: bool = False 

class PostRead(SQLModel):
    id: int
    title: str
    content: str
    owner_id: int
    board_id: int
    created_at: datetime
    is_spoiler: bool
    owner: Optional[UserPublic] = None 


class CommentCreate(SQLModel):
    content: str
    is_spoiler: bool = False

class CommentRead(SQLModel):
    id: int
    content: str
    user_id: int
    post_id: int
    created_at: datetime
    is_spoiler: bool
    
    user: Optional[UserPublic] = None