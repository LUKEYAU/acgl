from sqlalchemy.ext.asyncio import create_async_engine
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlalchemy.orm import sessionmaker
from app.core.config import settings

# 建立非同步引擎
engine = create_async_engine(settings.DATABASE_URL, echo=True, future=True)

# 建立 Session 工廠
async_session = sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)

# Dependency (依賴注入): 給每一個 Request 一個獨立的 DB Session
async def get_session() -> AsyncSession:
    async with async_session() as session:
        yield session