from fastapi import FastAPI
from contextlib import asynccontextmanager
from sqlmodel import SQLModel, select 
from sqlmodel.ext.asyncio.session import AsyncSession 
from app.core.config import settings
from app.core.db import engine
from app.api.v1.boards import router as boards_router
from app.api.v1.upload import router as upload_router

# 匯入 Models
from app.models.user import User
# [修正] 必須匯入 Vote 和 Comment，這樣資料庫才會建立對應的表
from app.models.post import Post, Vote, Comment 
from app.models.board import Board

# 匯入 Routers
from app.api.v1.auth import router as auth_router
from app.api.v1.posts import router as posts_router
from app.api.v1.users import router as users_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    # 1. 建立資料表結構 (這一步會掃描所有已匯入的 SQLModel)
    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)
    
    # 2. 初始化預設看板
    async with AsyncSession(engine) as session:
        default_boards = [
            {"id": 1, "name": "綜合討論", "desc": "動漫遊戲相關話題皆可在此討論"},
            {"id": 2, "name": "Fate 系列", "desc": "聖杯戰爭、FGO 與型月世界觀討論"},
            {"id": 3, "name": "原神 Genshin", "desc": "提瓦特大陸冒險指南"},
            {"id": 4, "name": "任天堂", "desc": "Switch、薩爾達、瑪利歐"},
        ]
        
        for board_data in default_boards:
            stmt = select(Board).where(Board.id == board_data["id"])
            result = await session.exec(stmt)
            if not result.first():
                print(f"建立看板: {board_data['name']}")
                new_board = Board(
                    id=board_data["id"],
                    name=board_data["name"],
                    description=board_data["desc"]
                )
                session.add(new_board)
        
        await session.commit()
    yield

app = FastAPI(
    title=settings.PROJECT_NAME,
    lifespan=lifespan
)

app.include_router(auth_router, prefix=settings.API_V1_STR)
app.include_router(posts_router, prefix=settings.API_V1_STR)
app.include_router(users_router, prefix=settings.API_V1_STR)
app.include_router(boards_router, prefix=settings.API_V1_STR)
app.include_router(upload_router, prefix=settings.API_V1_STR)

@app.get("/")
async def root():
    return {"message": "ACG Forum API is running!", "docs": "/docs"}