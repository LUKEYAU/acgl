from fastapi import FastAPI
from contextlib import asynccontextmanager
from sqlmodel import SQLModel, select # 記得匯入 select
from sqlmodel.ext.asyncio.session import AsyncSession # 匯入 AsyncSession
from app.core.config import settings
from app.core.db import engine

# 匯入 Models
from app.models.user import User
from app.models.post import Post
from app.models.board import Board

# 匯入 Routers
from app.api.v1.auth import router as auth_router
from app.api.v1.posts import router as posts_router
from app.api.v1.users import router as users_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    # 1. 建立資料表結構
    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)
    
    # 2. 初始化預設資料 (新增這段)
    async with AsyncSession(engine) as session:
        # 檢查是否已存在 ID=1 的看板
        statement = select(Board).where(Board.id == 1)
        result = await session.exec(statement)
        board = result.first()
        
        if not board:
            print("正在初始化預設看板...")
            default_board = Board(
                id=1, 
                name="綜合討論", 
                description="動漫遊戲相關話題皆可在此討論"
            )
            session.add(default_board)
            await session.commit()
            print("預設看板建立完成！")
            
    yield

app = FastAPI(
    title=settings.PROJECT_NAME,
    lifespan=lifespan
)

app.include_router(auth_router, prefix=settings.API_V1_STR)
app.include_router(posts_router, prefix=settings.API_V1_STR)
app.include_router(users_router, prefix=settings.API_V1_STR)