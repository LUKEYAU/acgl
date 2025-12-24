# backend/app/api/v1/upload.py

from fastapi import APIRouter, UploadFile, File, HTTPException
from app.core.minio import minio_handler
import uuid

router = APIRouter(prefix="/upload", tags=["Upload"])

@router.post("/image")
async def upload_image(file: UploadFile = File(...)):
    # 驗證檔案類型
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="只允許上傳圖片")
    
    # 產生唯一檔名，避免重複
    file_extension = file.filename.split(".")[-1]
    file_name = f"{uuid.uuid4()}.{file_extension}"
    
    try:
        # 讀取檔案並上傳
        url = minio_handler.upload_file(file.file, file_name, file.content_type)
        return {"url": url}
    except Exception as e:
        print(f"Upload error: {e}")
        raise HTTPException(status_code=500, detail="圖片上傳失敗")