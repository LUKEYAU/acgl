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
    hashed_password: str
    is_active: bool = Field(default=True)
    is_superuser: bool = Field(default=False)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    # 注意：這裡使用字串 "Post" 和 "Board" 來參照模型
    # 這是 SQLAlchemy/SQLModel 處理延遲載入的標準做法
    posts: List["Post"] = Relationship(back_populates="owner")
    managed_boards: List["Board"] = Relationship(back_populates="manager")