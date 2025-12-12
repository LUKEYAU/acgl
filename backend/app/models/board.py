# app/models/board.py (新增檔案)

from typing import Optional, List
from sqlmodel import Field, SQLModel, Relationship

class Board(SQLModel, table=True):
    __tablename__ = "boards"

    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(index=True, unique=True) # 看板名稱
    description: Optional[str] = None
    
    # 看板管理者 ID
    manager_id: Optional[int] = Field(default=None, foreign_key="users.id")
    
    # 關係屬性
    posts: List["Post"] = Relationship(back_populates="board")
    manager: Optional["User"] = Relationship(back_populates="managed_boards")
