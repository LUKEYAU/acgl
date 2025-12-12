# app/schemas/post.py 
from datetime import datetime
from sqlmodel import SQLModel

class PostCreate(SQLModel):
    title: str
    content: str
    board_id: int # 指定發到哪個看板
    
class PostResponse(SQLModel):
    id: int
    title: str
    content: str
    owner_id: int
    board_id: int
    created_at: datetime