from typing import Optional, List, TYPE_CHECKING
from sqlmodel import Field, SQLModel, Relationship
from datetime import datetime

if TYPE_CHECKING:
    from .post import Post
    from .board import Board

class User(SQLModel, table=True):
    __tablename__ = "users"

    id: Optional[int] = Field(default=None, primary_key=True)
    username: str = Field(index=True, unique=True)
    email: str = Field(index=True, unique=True)
    nickname: Optional[str] = Field(default=None) # 顯示名稱
    bg_left: Optional[str] = Field(default=None)   # 左欄背景
    bg_middle: Optional[str] = Field(default=None) # 中欄背景
    bg_right: Optional[str] = Field(default=None)  # 右欄背景
    hashed_password: str
    is_active: bool = Field(default=True)
    is_superuser: bool = Field(default=False)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    posts: List["Post"] = Relationship(back_populates="owner")
    managed_boards: List["Board"] = Relationship(back_populates="manager")

class UserPublic(SQLModel):
    id: int
    username: str
    nickname: Optional[str] = None