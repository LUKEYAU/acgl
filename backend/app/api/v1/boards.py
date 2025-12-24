from typing import List
from fastapi import APIRouter, Depends
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession
from app.core.db import get_session
from app.models.board import Board

# 這一行非常重要，main.py 就是在找這個變數！
router = APIRouter(prefix="/boards", tags=["Boards"])

@router.get("/", response_model=List[Board])
async def read_boards(session: AsyncSession = Depends(get_session)):
    """
    取得所有看板列表
    """
    statement = select(Board).order_by(Board.id)
    result = await session.exec(statement)
    return result.all()