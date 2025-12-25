# app/api/v1/auth.py (新增檔案)

from typing import Optional 
from datetime import timedelta
import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import RedirectResponse
from app.core.config import settings
from app.core.db import get_session
from app.models.user import User 
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlmodel import select
from datetime import datetime, timedelta
from jose import jwt

router = APIRouter(prefix="/auth", tags=["Auth"])

# Google API URLs
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v1/userinfo?alt=json"
# GOOGLE_AUTH_URL = ... (前端會發起這個 URL)

# ----------------- JWT TOKEN GENERATION -----------------

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt

# ----------------- GOOGLE CALLBACK -----------------

@router.get("/google/callback")
async def google_callback(code: str, session: AsyncSession = Depends(get_session)):
    
    # 1. 向 Google 請求 Access Token
    async with httpx.AsyncClient() as client:
        token_data = {
            "client_id": settings.GOOGLE_CLIENT_ID,
            "client_secret": settings.GOOGLE_CLIENT_SECRET,
            "code": code,
            "redirect_uri": settings.GOOGLE_REDIRECT_URI, # 必須與 Console 設定的 Redirect URI 一致
            "grant_type": "authorization_code",
        }
        
        response = await client.post(GOOGLE_TOKEN_URL, data=token_data)
        if response.status_code != 200:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Google Token Exchange Failed")
            
        token_info = response.json()
        access_token = token_info.get("access_token")

    # 2. 使用 Access Token 取得使用者資訊
    async with httpx.AsyncClient() as client:
        userinfo_response = await client.get(
            GOOGLE_USERINFO_URL, 
            headers={"Authorization": f"Bearer {access_token}"}
        )
        if userinfo_response.status_code != 200:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Google User Info Fetch Failed")
            
        user_info = userinfo_response.json()
        google_email = user_info.get("email")
        google_name = user_info.get("name")
        
    # 3. 處理資料庫 (登入/註冊)
    
    # 檢查使用者是否已存在
    user_stmt = select(User).where(User.email == google_email)
    result = await session.exec(user_stmt)
    user = result.first()
    
    if not user:
        # 如果不存在，則建立新帳號 (自動註冊)
        new_user = User(
            email=google_email, 
            username=google_name, 
            # Google 登入不需要密碼，但 Model 需要，我們用一個 placeholder 或特殊標記
            hashed_password="OAUTH_GOOGLE_ONLY",
            is_active=True,
            is_superuser=False
        )
        session.add(new_user)
        await session.commit()
        await session.refresh(new_user)
        user = new_user
        
    # 4. 簽發 JWT
    jwt_data = {"sub": str(user.id), "email": user.email}
    jwt_token = create_access_token(jwt_data)

    frontend_url = f"http://localhost/auth/callback?token={jwt_token}"
    return RedirectResponse(url=frontend_url)