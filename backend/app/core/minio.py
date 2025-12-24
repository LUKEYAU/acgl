# backend/app/core/minio.py

from minio import Minio
from app.core.config import settings


class MinioHandler:
    def __init__(self):
        self.client = Minio(
            "localhost:9000", # 注意：如果在 WSL 內跑 FastAPI 但 MinIO 在 Docker，可能要用 localhost
            access_key="minioadmin",
            secret_key="minioadmin",
            secure=False # 本機開發通常不用 SSL
        )
        self.bucket_name = "acg-images"
        self._check_bucket()

    def _check_bucket(self):
        if not self.client.bucket_exists(self.bucket_name):
            self.client.make_bucket(self.bucket_name)
            # 設定為公開讀取 (這很重要，不然前端讀不到圖)
            policy = """
            {
              "Version": "2012-10-17",
              "Statement": [
                {
                  "Effect": "Allow",
                  "Principal": {"AWS": "*"},
                  "Action": "s3:GetObject",
                  "Resource": "arn:aws:s3:::acg-images/*"
                }
              ]
            }
            """
            self.client.set_bucket_policy(self.bucket_name, policy)

    def upload_file(self, file_data, file_name, content_type):
        self.client.put_object(
            self.bucket_name,
            file_name,
            file_data,
            length=-1,
            part_size=10*1024*1024,
            content_type=content_type
        )
        # 回傳可訪問的 URL
        return f"http://localhost:9000/{self.bucket_name}/{file_name}"

minio_handler = MinioHandler()