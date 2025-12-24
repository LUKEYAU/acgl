from typing import Optional, List
from sqlmodel import Field, SQLModel, Relationship
from datetime import datetime

from app.models.user import User 

class Post(SQLModel, table=True):
    __tablename__ = "posts"
    __table_args__ = {"extend_existing": True}
    id: Optional[int] = Field(default=None, primary_key=True)
    title: str
    content: str
    owner_id: int = Field(foreign_key="users.id")
    owner: "User" = Relationship(back_populates="posts")
    board_id: int = Field(foreign_key="boards.id")
    is_spoiler: bool = Field(default=False) # 防雷標記
    
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    owner: "User" = Relationship(back_populates="posts")
    board: "Board" = Relationship(back_populates="posts")

# --- 新增：投票模型 ---
class Vote(SQLModel, table=True):
    __tablename__ = "votes"
    __table_args__ = {"extend_existing": True}
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id")
    post_id: int = Field(foreign_key="posts.id")
    dir: int = Field(description="1 for like, -1 for dislike") # 1=讚, -1=倒讚

# --- 新增：留言模型 ---
class Comment(SQLModel, table=True):
    __tablename__ = "comments"
    __table_args__ = {"extend_existing": True}
    id: Optional[int] = Field(default=None, primary_key=True)
    content: str
    user_id: int = Field(foreign_key="users.id")
    user: "User" = Relationship() 
    post_id: int = Field(foreign_key="posts.id")
    is_spoiler: bool = Field(default=False)
    created_at: datetime = Field(default_factory=datetime.utcnow)