// frontend/src/features/AuthCallback.tsx
import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

export default function AuthCallback() {
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const token = searchParams.get('token');

    if (token) {
      // 1. 存入 Token
      localStorage.setItem('token', token);
      
      // 2. 【關鍵修正】強制瀏覽器跳轉回首頁 (會觸發頁面重整)
      // 這能確保 App.tsx 重新讀取 localStorage 並更新使用者狀態
      window.location.href = '/'; 
    } else {
      // 失敗則導回首頁
      window.location.href = '/';
    }
  }, [searchParams]);

  return (
    <div className="flex flex-col justify-center items-center h-screen bg-slate-50">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4"></div>
      <div className="text-lg font-medium text-gray-600">
        正在驗證身分，請稍候...
      </div>
    </div>
  );
}