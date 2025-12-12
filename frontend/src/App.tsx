// frontend/src/App.tsx
import { useEffect, useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import api from './services/api';
import AuthCallback from './features/AuthCallback';
import { MessageSquare, LogIn, LogOut, User as UserIcon, Loader2, X, PenLine } from 'lucide-react';

// --- 型別定義 ---
interface Post {
  id: number;
  title: string;
  content: string;
  owner_id: number;
  board_id: number;
  created_at: string;
}

interface User {
  id: number;
  email: string;
  username: string;
  // 加上 optional (?) 以防後端沒回傳此欄位導致錯誤
  is_superuser?: boolean; 
}

function Home() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Modal 狀態
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newPost, setNewPost] = useState({ title: '', content: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  useEffect(() => {
    checkLoginStatus();
    fetchPosts();
  }, []);

  const checkLoginStatus = async () => {
    const token = localStorage.getItem('token');
    if (token) {
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      try {
        const response = await api.get<User>('/users/me');
        console.log("登入成功:", response.data); // Debug 用
        setUser(response.data);
      } catch (error) {
        console.error("Token 驗證失敗", error);
        localStorage.removeItem('token');
        delete api.defaults.headers.common['Authorization'];
        setUser(null);
      }
    }
  };

  const fetchPosts = async () => {
    try {
      const response = await api.get<Post[]>('/posts/');
      setPosts(response.data);
    } catch (error) {
      console.error("無法取得文章列表:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    // 請確認這裡的 Client ID 和 Port 與後端 .env 一致
    const GOOGLE_CLIENT_ID = "649846936042-8ie2p37egq28cbadqcj686i53kl2jf80.apps.googleusercontent.com"; 
    const REDIRECT_URI = "http://localhost:8000/api/v1/auth/google/callback";
    const targetUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${GOOGLE_CLIENT_ID}&redirect_uri=${REDIRECT_URI}&response_type=code&scope=email%20profile&access_type=offline`;
    window.location.href = targetUrl;
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    delete api.defaults.headers.common['Authorization'];
    setUser(null);
    window.location.href = '/'; // 強制重整清除狀態
  };

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPost.title || !newPost.content) return;
    setIsSubmitting(true);
    try {
      const response = await api.post<Post>('/posts/', {
        title: newPost.title,
        content: newPost.content,
        board_id: 1 
      });
      setPosts([response.data, ...posts]);
      setNewPost({ title: '', content: '' });
      setIsModalOpen(false);
    } catch (error) {
      alert("發文失敗");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-gray-800 font-sans">
      {/* --- 導航列 (Responsive) --- */}
      <nav className="bg-white shadow-sm border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            {/* Logo 區 */}
            <div className="flex items-center">
              <div className="bg-indigo-600 p-2 rounded-lg mr-2 sm:mr-3">
                 <MessageSquare className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
              </div>
              <span className="text-lg sm:text-xl font-bold text-gray-900 tracking-tight">ACG 論壇</span>
            </div>
            
            {/* 使用者區塊 */}
            <div className="flex items-center">
              {user ? (
                <div className="flex items-center gap-2 sm:gap-4 bg-slate-50 px-2 py-1 sm:px-4 sm:py-2 rounded-full border border-slate-200">
                  <div className="flex items-center text-slate-700 font-medium">
                    <UserIcon className="w-4 h-4 sm:mr-2 text-indigo-500"/>
                    {/* 手機版隱藏名字，只顯示圖示 */}
                    <span className="hidden sm:block text-sm">{user.username}</span>
                  </div>
                  <div className="w-px h-4 bg-slate-300 mx-1"></div>
                  <button 
                    onClick={handleLogout} 
                    className="text-slate-500 hover:text-red-600 flex items-center transition-colors p-1"
                    title="登出"
                  >
                    <LogOut className="w-4 h-4 sm:mr-1" />
                    <span className="hidden sm:block text-sm">登出</span>
                  </button>
                </div>
              ) : (
                <button 
                  onClick={handleGoogleLogin}
                  className="flex items-center px-3 py-2 sm:px-5 sm:py-2.5 text-xs sm:text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-all shadow-sm"
                >
                  <LogIn className="w-4 h-4 mr-1 sm:mr-2" />
                  登入
                </button>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* --- 主要內容區 (Responsive Padding) --- */}
      <main className="max-w-5xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {/* Header 區塊：手機版垂直排列，桌面版水平排列 */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-6 gap-4">
          <div>
             <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">最新討論</h1>
             <p className="text-sm sm:text-base text-gray-500 mt-1">歡迎來到動漫遊戲交流區</p>
          </div>
          
          {user && (
            <button 
              onClick={() => setIsModalOpen(true)}
              className="w-full sm:w-auto px-4 py-2 bg-indigo-600 text-white rounded-lg shadow-sm hover:bg-indigo-700 transition font-medium flex items-center justify-center"
            >
              <PenLine className="w-4 h-4 mr-2" />
              發表新文章
            </button>
          )}
        </div>

        {/* 文章列表 */}
        {loading ? (
          <div className="flex justify-center py-20">
             <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
          </div>
        ) : posts.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 sm:p-12 text-center">
            <div className="mx-auto w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
               <MessageSquare className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900">目前還沒有文章</h3>
            <p className="text-gray-500 mt-2">快來成為第一個發文的人吧！</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {posts.map((post) => (
              <article 
                key={post.id} 
                className="bg-white rounded-xl p-5 sm:p-6 shadow-sm border border-slate-100 hover:shadow-md hover:border-indigo-100 transition-all cursor-pointer group"
              >
                <div className="flex justify-between items-start gap-4">
                    <div className="flex-1">
                        <h3 className="text-lg sm:text-xl font-bold text-gray-900 group-hover:text-indigo-600 transition-colors mb-2 line-clamp-1">
                            {post.title}
                        </h3>
                        <p className="text-sm sm:text-base text-slate-600 line-clamp-2 leading-relaxed">
                            {post.content}
                        </p>
                    </div>
                    <span className="shrink-0 bg-slate-100 text-slate-600 text-[10px] sm:text-xs font-medium px-2 py-0.5 rounded border border-slate-200">
                      #{post.board_id}
                    </span>
                </div>
                
                <div className="mt-4 pt-4 border-t border-slate-50 flex items-center text-xs sm:text-sm text-slate-400">
                  <span className="flex items-center">
                    <UserIcon className="w-3 h-3 mr-1" />
                    <span className="hidden sm:inline">UID:</span> {post.owner_id}
                  </span>
                  <span className="mx-2">•</span>
                  <span>{new Date(post.created_at).toLocaleDateString()}</span>
                </div>
              </article>
            ))}
          </div>
        )}
      </main>

      {/* --- RWD Modal --- */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm">
          {/* w-full 在手機上佔滿，sm:max-w-lg 在電腦上限制寬度 */}
          <div className="bg-white w-full sm:max-w-lg rounded-t-xl sm:rounded-xl shadow-2xl overflow-hidden animate-fade-in flex flex-col max-h-[90vh]">
            
            <div className="flex justify-between items-center p-4 border-b border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900">發表新文章</h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleCreatePost} className="p-4 space-y-4 flex-1 overflow-y-auto">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">標題</label>
                <input
                  type="text"
                  required
                  placeholder="請輸入標題..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                  value={newPost.title}
                  onChange={(e) => setNewPost({ ...newPost, title: e.target.value })}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">內容</label>
                <textarea
                  required
                  rows={8} // 手機上稍微高一點方便打字
                  placeholder="分享你的想法..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition resize-none"
                  value={newPost.content}
                  onChange={(e) => setNewPost({ ...newPost, content: e.target.value })}
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition flex items-center"
                >
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : '確認發布'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// 路由部分不變
function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
    </Routes>
  );
}

export default App;