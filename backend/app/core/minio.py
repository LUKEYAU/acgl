from minio import Minio
import os

class MinioHandler:
    def __init__(self):
        self.minio_url = os.getenv("MINIO_URL", "minio:9000")
        self.access_key = os.getenv("MINIO_ROOT_USER", "minioadmin")
        self.secret_key = os.getenv("MINIO_ROOT_PASSWORD", "minioadmin")
        self.bucket_name = "acg-images"
        self.client = None 

    def get_client(self):
        if self.client is None:
            try:
                print(f"正在嘗試連線 MinIO: {self.minio_url}...")
                self.client = Minio(
                    self.minio_url,
                    access_key=self.access_key,
                    secret_key=self.secret_key,
                    secure=False
                )
                self._check_bucket()
                print("MinIO 連線成功！")
            except Exception as e:
                print(f"MinIO 連線失敗: {e}")
                return None
        return self.client

    def _check_bucket(self):
        if not self.client.bucket_exists(self.bucket_name):
            self.client.make_bucket(self.bucket_name)
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
        client = self.get_client()
        if not client:
            raise Exception("MinIO 服務無法連線，請檢查 Docker logs")
            
        client.put_object(
            self.bucket_name,
            file_name,
            file_data,
            length=-1,
            part_size=10*1024*1024,
            content_type=content_type
        )
        
        return f"/acg-images/{file_name}"

minio_handler = MinioHandler()