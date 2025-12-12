# app/core/security.py

from datetime import datetime, timedelta
from typing import Optional
from jose import jwt, JWTError
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from app.core.config import settings
from app.core.db import AsyncSession, get_session
from app.models.user import User
from sqlmodel import select

# OAuth2PasswordBearer 是 FastAPI 內建的工具，用來從 Header 提取 Token
# tokenUrl 指向登入的 API，這裡我們用 Google 登入，所以可以指向一個虛擬的 endpoint
oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_STR}/auth/google/callback") 

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    # 此函式已在 app/api/v1/auth.py 中定義，這裡可以選擇匯入或保留在 auth.py 
    # 為了保持 security 模組的完整性，我們再定義一次 (或確保共用)
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt

async def get_current_user(
    token: str = Depends(oauth2_scheme), 
    session: AsyncSession = Depends(get_session)
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        # 解碼 JWT
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    # 從資料庫獲取使用者
    statement = select(User).where(User.id == int(user_id))
    result = await session.exec(statement)
    user = result.first()
    
    if user is None:
        raise credentials_exception
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Inactive user")
        
    return user