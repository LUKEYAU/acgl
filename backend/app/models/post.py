# app/models/post.py (新增檔案)

from typing import Optional, List
from sqlmodel import Field, SQLModel, Relationship
from datetime import datetime


class Post(SQLModel, table=True):
    __tablename__ = "posts"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    title: str
    content: str # 內容
    
    # 關聯欄位 (ForeignKey)
    owner_id: int = Field(foreign_key="users.id") # 作者 ID
    board_id: int = Field(foreign_key="boards.id") # 看板 ID
    
    # 狀態
    is_sticky: bool = Field(default=False) # 置頂文章
    is_elite: bool = Field(default=False)  # 精華文章
    
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    
    # 關係屬性 (Relationship, 不會寫入資料庫，用於 ORM 查詢)
    owner: "User" = Relationship(back_populates="posts")
    board: "Board" = Relationship(back_populates="posts")
    