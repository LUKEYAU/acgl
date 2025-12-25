import { useEffect, useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import api, { uploadImage, updateUserProfile } from './services/api';
import AuthCallback from './features/AuthCallback';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { 
  MessageSquare, LogOut, User as UserIcon, Loader2, X, Layers, 
  ThumbsUp, ThumbsDown, AlertTriangle, Trash2, CornerDownRight,
  ImageIcon, EyeOff, Settings, History, BookOpen, Flame, Sparkles, Heart, Eye
} from 'lucide-react';

// --- 1. 型別定義 ---

interface UserPublic {
  id: number;
  username: string;
  nickname?: string;
}

interface User {
  id: number;
  email: string;
  username: string;
  nickname?: string;
  bg_left?: string;
  bg_middle?: string;
  bg_right?: string;
  is_superuser: boolean;
}

interface Post {
  id: number;
  title: string;
  content: string;
  owner_id: number;
  board_id: number;
  created_at: string;
  is_spoiler: boolean;
  owner?: UserPublic; // 巢狀作者資訊
}

interface Comment {
  id: number;
  content: string;
  user_id: number;
  created_at: string;
  is_spoiler: boolean;
  user?: UserPublic; // 巢狀作者資訊
}

interface Board {
  id: number;
  name: string;
  description: string;
}

interface Manga {
  id: number;
  title: string;
  author: string;
  cover: string;
  views: number;
  likes: number;
  tags: string[];
}

// --- 2. 假資料與 Helper ---

const MOCK_MANGA_LIST: Manga[] = [
  { id: 1, title: "轉生到異世界當工程師", author: "CodeMaster", cover: "https://placehold.co/300x450/2563eb/FFF?text=ISEKAI+DEV", views: 12000, likes: 850, tags: ["異世界", "搞笑"] },
  { id: 2, title: "校園裡的魔法使", author: "Sakura", cover: "https://placehold.co/300x450/db2777/FFF?text=MAGIC+SCHOOL", views: 8900, likes: 620, tags: ["校園", "魔法"] },
  { id: 3, title: "Cyberpunk: 邊緣行者 (二創)", author: "NeonCity", cover: "https://placehold.co/300x450/facc15/000?text=CYBERPUNK", views: 34000, likes: 2100, tags: ["科幻", "二創"] },
  { id: 4, title: "原神：提瓦特遊記", author: "Paimon", cover: "https://placehold.co/300x450/16a34a/FFF?text=GENSHIN", views: 15600, likes: 980, tags: ["遊戲", "同人"] },
  { id: 5, title: "進擊的巨人：後日談", author: "Freedom", cover: "https://placehold.co/300x450/7f1d1d/FFF?text=TITAN", views: 45000, likes: 3200, tags: ["熱血", "劇情"] },
  { id: 6, title: "我的妹妹哪有這麼可愛", author: "Oreimo", cover: "https://placehold.co/300x450/ec4899/FFF?text=SISTER", views: 6700, likes: 430, tags: ["戀愛", "日常"] },
];

// 解析 ||文字|| 為 Markdown Link
const parseSpoiler = (text: string) => {
  return text.replace(/\|\|(.*?)\|\|/g, '[$1](#spoiler)');
};

// Markdown 元件設定
const markdownComponents = {
  img: ({node, ...props}: any) => <img {...props} className="max-w-full h-auto rounded-lg my-2 shadow-sm" />,
  a: ({href, children, ...props}: any) => {
    if (href === '#spoiler') {
      const [visible, setVisible] = useState(false);
      return (
        <span 
          onClick={(e) => { e.preventDefault(); setVisible(!visible); }}
          className={`cursor-pointer px-1 rounded transition-all select-none inline-block align-middle ${
            visible ? 'bg-gray-200 text-gray-800' : 'bg-gray-800 text-transparent hover:bg-gray-700 min-w-[30px]'
          }`}
          title="點擊顯示防雷內容"
        >
          {visible ? children : '雷雷'}
        </span>
      );
    }
    return <a href={href} {...props} className="text-blue-600 hover:underline">{children}</a>;
  }
};

// --- 3. 主要元件 ---

function Home() {
  // Data State
  const [posts, setPosts] = useState<Post[]>([]);
  const [boards, setBoards] = useState<Board[]>([]);
  const [activeBoardId, setActiveBoardId] = useState<number | null>(null);
  const [user, setUser] = useState<User | null>(null);
  
  // View State
  const [currentSection, setCurrentSection] = useState<'forum' | 'manga'>('forum'); // 分區
  const [viewMode, setViewMode] = useState<'all' | 'history'>('all'); // 論壇模式
  const [mangaTab, setMangaTab] = useState<'popular' | 'latest'>('popular'); // 漫畫 Tab
  const [loading, setLoading] = useState(true);

  // Selected Post & Interaction
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [postComments, setPostComments] = useState<Comment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [spoilerRevealed, setSpoilerRevealed] = useState(false); // 主文防雷解鎖

  // Reply State
  const [replyContent, setReplyContent] = useState('');
  const [replyIsSpoiler, setReplyIsSpoiler] = useState(false);

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [newPost, setNewPost] = useState({ title: '', content: '', board_id: 1, is_spoiler: false });
  const [editProfile, setEditProfile] = useState({ nickname: '', bg_left: '', bg_middle: '', bg_right: '' });

  // Init
  useEffect(() => {
    checkLoginStatus();
    fetchBoards();
  }, []);

  // Fetch Posts Logic
  useEffect(() => {
    if (currentSection === 'forum') {
        setSelectedPost(null);
        fetchPosts();
    }
  }, [activeBoardId, viewMode, currentSection]);

  // Fetch Comments Logic
  useEffect(() => {
    if (selectedPost) {
      setSpoilerRevealed(false);
      fetchComments(selectedPost.id);
    }
  }, [selectedPost]);

  // --- API Functions ---

  const checkLoginStatus = async () => {
    const token = localStorage.getItem('token');
    if (token) {
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      try {
        const response = await api.get<User>('/users/me');
        setUser(response.data);
      } catch {
        localStorage.removeItem('token');
        setUser(null);
      }
    }
  };

  const fetchBoards = async () => {
    try {
      const response = await api.get<Board[]>('/boards/');
      setBoards(response.data);
    } catch (error) { console.error(error); }
  };

  const fetchPosts = async () => {
    setLoading(true);
    try {
      let url = '/posts/';
      if (viewMode === 'history' && user) {
          url = `/posts/?user_id=${user.id}`;
      } else if (activeBoardId) {
          url = `/posts/?board_id=${activeBoardId}`;
      }
      const response = await api.get<Post[]>(url);
      setPosts(response.data);
    } catch (error) { console.error(error); } 
    finally { setLoading(false); }
  };

  const fetchComments = async (postId: number) => {
    setLoadingComments(true);
    try {
      const res = await api.get(`/posts/${postId}/comments`);
      setPostComments(res.data);
    } catch (error) { console.error(error); }
    finally { setLoadingComments(false); }
  };

  // --- Action Handlers ---

  const handleGoogleLogin = () => {
    const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    const REDIRECT_URI = "http://localhost/api/v1/auth/google/callback";
    if(!GOOGLE_CLIENT_ID) return alert("Missing Google Client ID");
    window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${GOOGLE_CLIENT_ID}&redirect_uri=${REDIRECT_URI}&response_type=code&scope=email%20profile&access_type=offline`;
  };

  const getDisplayName = (u?: UserPublic) => {
    if (!u) return '未知使用者';
    return u.nickname || u.username;
  };

  // Upload Images
  const handleUpload = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return await uploadImage(formData);
  };

  const handlePostImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const res = await handleUpload(file);
        setNewPost(prev => ({ ...prev, content: prev.content + `\n![image](${res.data.url})\n` }));
      } catch { alert("上傳失敗"); }
    }
  };

  const handleReplyImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const res = await handleUpload(file);
        setReplyContent(prev => prev + `\n![image](${res.data.url})\n`);
      } catch { alert("上傳失敗"); }
    }
  };

  // Create Post
  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await api.post<Post>('/posts/', newPost);
      // 只有在當前看板或全部主題時才插入列表
      if (!activeBoardId || activeBoardId === newPost.board_id) {
          if (viewMode === 'all') {
             setPosts([response.data, ...posts]);
             setSelectedPost(response.data);
          }
      }
      setNewPost({ title: '', content: '', board_id: activeBoardId || 1, is_spoiler: false });
      setIsModalOpen(false);
    } catch { alert("發文失敗"); }
  };

  // Create Comment
  const handleSubmitComment = async () => {
    if (!selectedPost || !replyContent.trim()) return;
    try {
      const res = await api.post(`/posts/${selectedPost.id}/comments?content=${encodeURIComponent(replyContent)}&is_spoiler=${replyIsSpoiler}`);
      setPostComments([...postComments, res.data]);
      setReplyContent('');
      setReplyIsSpoiler(false);
    } catch { alert("留言失敗"); }
  };

  // Profile Management
  const openProfileModal = () => {
    if (user) {
      setEditProfile({
        nickname: user.nickname || user.username,
        bg_left: user.bg_left || '',
        bg_middle: user.bg_middle || '',
        bg_right: user.bg_right || ''
      });
      setIsProfileOpen(true);
    }
  };

  const handleProfileBgUpload = async (key: 'bg_left' | 'bg_middle' | 'bg_right', file: File) => {
    try {
        const res = await handleUpload(file);
        setEditProfile(prev => ({ ...prev, [key]: res.data.url }));
    } catch { alert("上傳失敗"); }
  };

  const handleSaveProfile = async () => {
    try {
        const res = await updateUserProfile(editProfile);
        setUser(res.data);
        setIsProfileOpen(false);
        alert("設定已更新");
    } catch { alert("更新失敗"); }
  };

  // Misc Helpers
  const insertNewPostSpoiler = () => setNewPost(prev => ({ ...prev, content: prev.content + " ||隱藏內容|| " }));
  const insertReplySpoiler = () => setReplyContent(prev => prev + " ||隱藏內容|| ");
  const handleVote = async (dir: number) => {
      if(!selectedPost) return;
      try { await api.post(`/posts/${selectedPost.id}/vote?dir=${dir}`); alert("投票成功 (需後端回傳最新數值)"); } 
      catch { alert("請先登入"); }
  };
  const handleDeletePost = async () => {
      if(!selectedPost) return;
      if(confirm("確定刪除？")) {
          try { await api.delete(`/posts/${selectedPost.id}`); setPosts(posts.filter(p => p.id !== selectedPost.id)); setSelectedPost(null); }
          catch { alert("刪除失敗"); }
      }
  };

  return (
    <div className="h-screen flex flex-col bg-gray-100 font-sans overflow-hidden">
      {/* --- Navbar --- */}
      <nav className="h-14 bg-white/90 backdrop-blur shadow-sm border-b border-gray-200 flex-shrink-0 z-50">
        <div className="max-w-[1600px] mx-auto px-4 h-full flex justify-between items-center">
          <div className="flex items-center cursor-pointer" onClick={() => {setCurrentSection('forum'); setViewMode('all'); setActiveBoardId(null);}}>
             <div className="bg-gray-900 p-1.5 rounded mr-2"><MessageSquare className="h-5 w-5 text-white" /></div>
             <span className="text-lg font-bold text-gray-900">𝔸ℂ𝔾 𝔽𝕠𝕣𝕦𝕞</span>
          </div>
          <div className="flex items-center gap-4">
             {user ? (
                <>
                  <button onClick={openProfileModal} className="flex items-center gap-2 text-sm font-medium hover:bg-gray-100 px-2 py-1 rounded transition">
                     <Settings className="w-4 h-4 text-gray-500" />
                     {user.nickname || user.username}
                  </button>
                  <button onClick={() => { localStorage.removeItem('token'); window.location.reload(); }} title="登出">
                    <LogOut className="w-4 h-4 text-gray-500 hover:text-red-600"/>
                  </button>
                  <button onClick={() => setIsModalOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded text-sm font-medium">
                    發文
                  </button>
                </>
             ) : (
                <button onClick={handleGoogleLogin} className="text-sm text-blue-600 font-medium">登入</button>
             )}
          </div>
        </div>
      </nav>

      {/* --- Main Layout --- */}
      <div className="flex-1 flex overflow-hidden max-w-[1600px] mx-auto w-full shadow-2xl">
        
        {/* [左欄] Sidebar */}
        <aside 
            className="w-56 border-r border-gray-200 flex-shrink-0 hidden md:flex flex-col relative bg-cover bg-center transition-all duration-500"
            style={{ backgroundImage: user?.bg_left ? `url(${user.bg_left})` : 'none', backgroundColor: user?.bg_left ? 'transparent' : '#f9fafb' }}
        >
           {user?.bg_left && <div className="absolute inset-0 bg-black/20 pointer-events-none"></div>}
           
           <div className="p-3 relative z-10 flex-1 overflow-y-auto">
             <div className="text-xs font-bold text-gray-500 mb-2 px-2 uppercase tracking-wider bg-white/50 inline-block rounded backdrop-blur-sm">瀏覽模式</div>
             <button onClick={() => { setCurrentSection('forum'); setViewMode('all'); setActiveBoardId(null); }} className={`w-full text-left px-3 py-2 rounded mb-1 text-sm font-bold flex items-center gap-2 ${currentSection === 'forum' && viewMode === 'all' && !activeBoardId ? 'bg-white/80 text-blue-700 shadow-sm' : 'text-outline-white hover:bg-white/30'}`}>
               <Layers className="w-4 h-4"/> 全部主題
             </button>
             {user && (
                 <button onClick={() => { setCurrentSection('forum'); setViewMode('history'); setActiveBoardId(null); }} className={`w-full text-left px-3 py-2 rounded mb-4 text-sm font-bold flex items-center gap-2 ${currentSection === 'forum' && viewMode === 'history' ? 'bg-white/80 text-blue-700 shadow-sm' : 'text-outline-white hover:bg-white/30'}`}>
                   <History className="w-4 h-4"/> 我的發文歷史
                 </button>
             )}

             <div className="text-xs font-bold text-gray-500 mb-2 mt-4 px-2 uppercase tracking-wider bg-white/50 inline-block rounded backdrop-blur-sm">看板分類</div>
             {boards.map(b => (
               <button key={b.id} onClick={() => { setCurrentSection('forum'); setActiveBoardId(b.id); setViewMode('all'); }} className={`w-full text-left px-3 py-2 rounded mb-1 text-sm font-bold ${currentSection === 'forum' && activeBoardId === b.id ? 'bg-white/80 text-blue-700 shadow-sm' : 'text-outline-white hover:bg-white/30'}`}>
                 # {b.name}
               </button>
             ))}
           </div>

           {/* ACG Manga Button */}
           <div className="p-3 border-t border-gray-200/30 relative z-10 bg-gradient-to-t from-black/10 to-transparent">
              <button onClick={() => setCurrentSection('manga')} className={`w-full flex items-center justify-center gap-2 px-3 py-3 rounded-lg font-bold transition-all shadow-lg group ${currentSection === 'manga' ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white scale-105' : 'bg-white/80 hover:bg-white text-gray-800 hover:scale-105'}`}>
                 <BookOpen className={`w-5 h-5 ${currentSection === 'manga' ? 'text-white' : 'text-pink-600 group-hover:animate-bounce'}`} /> ACG Manga
              </button>
           </div>
        </aside>

        {/* --- Content Area Switching --- */}
        {currentSection === 'forum' ? (
            <>
                {/* [中欄] 論壇列表 */}
                <div 
                    className="w-full md:w-96 border-r border-gray-200 flex flex-col flex-shrink-0 relative bg-cover bg-center transition-all duration-500"
                    style={{ backgroundImage: user?.bg_middle ? `url(${user.bg_middle})` : 'none', backgroundColor: user?.bg_middle ? 'transparent' : '#ffffff' }}
                >
                   {user?.bg_middle && <div className="absolute inset-0 bg-black/10 pointer-events-none"></div>}
                   <div className="h-10 border-b border-gray-200/50 flex items-center px-4 sticky top-0 z-10 backdrop-blur-md bg-white/70">
                      <span className="font-bold text-sm text-gray-800">{viewMode === 'history' ? "我的發文紀錄" : (activeBoardId ? boards.find(b => b.id === activeBoardId)?.name : "最新熱門")}</span>
                   </div>
                   <div className="flex-1 overflow-y-auto relative z-0">
                     {loading ? <div className="py-10 text-center"><Loader2 className="animate-spin mx-auto w-6 h-6 text-gray-500"/></div> : posts.map(post => (
                         <div key={post.id} onClick={() => setSelectedPost(post)} className={`p-3 border-b border-gray-200/50 cursor-pointer hover:bg-white/40 transition-colors ${selectedPost?.id === post.id ? 'bg-white/60 border-l-4 border-l-blue-500' : 'border-l-4 border-l-transparent'}`}>
                            <div className="flex justify-between items-start mb-1"><h3 className={`text-sm font-bold leading-tight line-clamp-2 text-outline-white`}>{post.title}</h3></div>
                            <div className="flex items-center justify-between mt-2"><div className="flex items-center gap-3 text-xs text-outline-white opacity-90"><span className="flex items-center gap-1"><UserIcon className="w-3 h-3" /> {getDisplayName(post.owner)}</span></div></div>
                         </div>
                     ))}
                   </div>
                </div>

                {/* [右欄] 閱讀區 */}
                <main 
                    className="flex-1 flex flex-col min-w-0 relative bg-cover bg-center transition-all duration-500"
                    style={{ backgroundImage: user?.bg_right ? `url(${user.bg_right})` : 'none', backgroundColor: user?.bg_right ? 'transparent' : '#f3f4f6' }}
                >
                   {user?.bg_right && <div className="absolute inset-0 bg-black/10 pointer-events-none"></div>}
                   {selectedPost ? (
                    <>
                     {/* Sticky Header */}
                     <header className="bg-white/80 backdrop-blur border-b border-gray-200 p-4 shadow-sm flex-shrink-0 z-10 flex justify-between items-start gap-4">
                         <div>
                            <div className="flex items-center gap-2 mb-1"><span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded font-bold">{boards.find(b => b.id === selectedPost.board_id)?.name || "綜合"}</span><span className="text-xs text-gray-400">{new Date(selectedPost.created_at).toLocaleString()}</span></div>
                            <h1 className="text-xl font-bold text-gray-900 leading-snug">{selectedPost.title}</h1>
                         </div>
                         <div className="flex items-center gap-1 bg-gray-50 rounded-lg p-1 border border-gray-200 flex-shrink-0">
                            <button onClick={() => handleVote(1)} className="flex flex-col items-center justify-center px-3 py-1 hover:bg-gray-200 rounded transition group"><ThumbsUp className="w-5 h-5 text-gray-400 group-hover:text-blue-600 mb-0.5" /><span className="text-xs font-bold text-gray-500 group-hover:text-blue-600">12</span></button>
                            <div className="w-px h-8 bg-gray-200"></div>
                            <button onClick={() => handleVote(-1)} className="flex flex-col items-center justify-center px-3 py-1 hover:bg-gray-200 rounded transition group"><ThumbsDown className="w-5 h-5 text-gray-400 group-hover:text-red-600 mb-0.5" /><span className="text-xs font-bold text-gray-500 group-hover:text-red-600">3</span></button>
                         </div>
                     </header>

                     {/* Scrollable Content */}
                     <div className="flex-1 overflow-y-auto p-4 space-y-3 scroll-smooth relative z-0">
                         {/* 樓主 */}
                         <article className="bg-white/95 backdrop-blur-sm p-5 rounded border border-gray-200 shadow-sm relative group">
                            <div className="flex justify-between items-start mb-3 border-b border-gray-100 pb-2">
                                <div className="flex items-center gap-2"><span className="text-blue-600 font-bold text-sm">{getDisplayName(selectedPost.owner)}</span><span className="text-xs text-gray-400">(樓主)</span></div>
                                <span className="text-xs font-mono text-gray-400">#1</span>
                            </div>
                            <div className="text-base text-gray-800 leading-relaxed whitespace-pre-wrap min-h-[80px] markdown-body">
                                 {selectedPost.is_spoiler && !spoilerRevealed ? (
                                    <div className="bg-gray-50 p-8 rounded text-center border border-gray-200 flex flex-col items-center gap-3 select-none cursor-pointer hover:bg-gray-100 transition" onClick={() => setSpoilerRevealed(true)}>
                                        <AlertTriangle className="w-8 h-8 text-red-400" />
                                        <div><p className="text-gray-600 font-bold text-lg">涉及劇透內容</p><p className="text-gray-400 text-sm">此文章內容已被隱藏，點擊顯示</p></div>
                                    </div>
                                 ) : (
                                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>{parseSpoiler(selectedPost.content)}</ReactMarkdown>
                                 )}
                            </div>
                            <div className="mt-4 pt-2 flex justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                               {user && user.id === selectedPost.owner_id && <button onClick={handleDeletePost} className="text-xs text-gray-400 hover:text-red-600 flex items-center"><Trash2 className="w-3 h-3 mr-1"/> 刪除</button>}
                               <button onClick={() => setReplyContent(`> ${selectedPost.content.substring(0, 30)}...\n`)} className="text-xs text-gray-400 hover:text-blue-600 flex items-center"><CornerDownRight className="w-3 h-3 mr-1"/> 引用</button>
                            </div>
                         </article>

                         {/* 留言 */}
                         {loadingComments ? <div className="text-center py-6"><Loader2 className="animate-spin w-6 h-6 mx-auto text-gray-400"/></div> : postComments.map((comment, index) => {
                             const [isRevealed, setIsRevealed] = useState(false);
                             return (
                               <article key={comment.id} className="bg-white/95 backdrop-blur-sm p-4 rounded border border-gray-200 shadow-sm relative group">
                                  <div className="flex justify-between items-start mb-2 border-b border-gray-50 pb-2">
                                     <div className="flex items-center gap-2">
                                        <span className="text-gray-700 font-bold text-sm">{getDisplayName(comment.user)}</span>
                                        <span className="text-xs text-gray-400">{new Date(comment.created_at).toLocaleString()}</span>
                                        {comment.is_spoiler && <span className="text-xs text-red-500 border border-red-200 bg-red-50 px-1 rounded">防雷</span>}
                                     </div>
                                     <span className="text-xs font-mono text-gray-400">#{index + 2}</span>
                                  </div>
                                  <div className="text-sm text-gray-800 leading-relaxed">
                                      {comment.is_spoiler && !isRevealed ? (
                                          <div onClick={() => setIsRevealed(true)} className="bg-gray-100 p-4 rounded text-center border border-gray-200 cursor-pointer select-none hover:bg-gray-200 transition">
                                             <p className="text-gray-500 text-xs font-medium flex items-center justify-center gap-1"><EyeOff className="w-3 h-3"/> 留言涉及劇透，點擊查看</p>
                                          </div>
                                      ) : (
                                          <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>{parseSpoiler(comment.content)}</ReactMarkdown>
                                      )}
                                  </div>
                                  <div className="mt-2 flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                                     <button onClick={() => setReplyContent(prev => prev + `> 回覆 #${index + 2} ${getDisplayName(comment.user)}: ${comment.content.substring(0, 20)}...\n`)} className="text-xs text-gray-400 hover:text-blue-600 flex items-center"><CornerDownRight className="w-3 h-3 mr-1"/> 引用</button>
                                  </div>
                               </article>
                             );
                         })}
                         <div className="h-20"></div>
                     </div>

                     {/* Sticky Reply Box */}
                     <div className="bg-white border-t border-gray-200 p-3 shadow-lg z-20">
                        {user ? (
                           <div className="flex flex-col gap-2 max-w-4xl mx-auto">
                              <div className="flex gap-2 items-end">
                                  <div className="flex-1 relative">
                                    <textarea value={replyContent} onChange={(e) => setReplyContent(e.target.value)} placeholder="參與討論... 使用 ||內容|| 可隱藏部分文字" className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none text-sm h-10 min-h-[40px] max-h-24 transition-all focus:h-20" />
                                    <label className="absolute bottom-2 left-2 text-gray-400 hover:text-blue-600 cursor-pointer p-1 rounded-full hover:bg-gray-100 transition"><input type="file" className="hidden" accept="image/*" onChange={handleReplyImageUpload} /><ImageIcon className="w-5 h-5" /></label>
                                    <button onClick={insertReplySpoiler} className="absolute bottom-2 left-9 text-gray-400 hover:text-gray-700 p-1 rounded-full hover:bg-gray-100 transition"><EyeOff className="w-5 h-5" /></button>
                                    <button onClick={() => setReplyContent(prev => prev + `> ${selectedPost.content.substring(0, 20)}...\n`)} className="absolute bottom-2 right-2 text-gray-400 hover:text-blue-600 p-1 rounded-full hover:bg-gray-100 transition"><CornerDownRight className="w-5 h-5" /></button>
                                  </div>
                                  <button onClick={handleSubmitComment} disabled={!replyContent.trim()} className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white px-4 rounded-lg text-sm font-bold flex-shrink-0 h-10 transition-colors">回覆</button>
                              </div>
                              <div className="flex items-center gap-4 px-1">
                                   <div className="flex items-center"><input id="reply-spoiler" type="checkbox" checked={replyIsSpoiler} onChange={(e) => setReplyIsSpoiler(e.target.checked)} className="w-4 h-4 text-red-600 rounded border-gray-300 focus:ring-red-500" /><label htmlFor="reply-spoiler" className="ml-2 text-xs text-gray-600 flex items-center cursor-pointer select-none"><AlertTriangle className="w-3 h-3 mr-1 text-red-500" /> 整層防雷 (涉及大量劇透時勾選)</label></div>
                              </div>
                           </div>
                        ) : (
                           <div className="text-center text-sm text-gray-500 py-1"><button onClick={handleGoogleLogin} className="text-blue-600 hover:underline font-bold">登入</button> 以發表回覆</div>
                        )}
                     </div>
                    </>
                   ) : (
                     <div className="h-full flex flex-col items-center justify-center relative z-10"><p className="font-bold text-2xl text-outline-white opacity-80">請選擇文章閱讀</p></div>
                   )}
                </main>
            </>
        ) : (
            /* --- ACG Manga Section --- */
            <main className="flex-1 bg-gray-50 overflow-y-auto relative animate-fade-in">
                <div className="bg-white border-b border-gray-200 sticky top-0 z-20 px-6 py-4 flex items-center justify-between shadow-sm">
                    <div className="flex items-center gap-3"><div className="bg-pink-100 p-2 rounded-lg"><BookOpen className="w-6 h-6 text-pink-600" /></div><div><h1 className="text-xl font-bold text-gray-900">ACG Manga 二創/原創區</h1><p className="text-xs text-gray-500">探索社群創作的漫畫與插畫作品</p></div></div>
                    <div className="flex bg-gray-100 p-1 rounded-lg">
                        <button onClick={() => setMangaTab('popular')} className={`px-4 py-1.5 rounded-md text-sm font-bold flex items-center gap-2 transition-all ${mangaTab === 'popular' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}><Flame className={`w-4 h-4 ${mangaTab === 'popular' ? 'text-orange-500' : ''}`} /> 熱度榜</button>
                        <button onClick={() => setMangaTab('latest')} className={`px-4 py-1.5 rounded-md text-sm font-bold flex items-center gap-2 transition-all ${mangaTab === 'latest' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}><Sparkles className={`w-4 h-4 ${mangaTab === 'latest' ? 'text-yellow-500' : ''}`} /> 最新上架</button>
                    </div>
                </div>
                <div className="p-6">
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                        {(mangaTab === 'latest' ? [...MOCK_MANGA_LIST].reverse() : MOCK_MANGA_LIST).map(manga => (
                            <div key={manga.id} className="group cursor-pointer bg-white rounded-xl shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden border border-gray-100">
                                <div className="aspect-[2/3] overflow-hidden relative"><img src={manga.cover} alt={manga.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" /><div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3"><button className="bg-pink-600 text-white w-full py-2 rounded-lg font-bold text-sm shadow-lg hover:bg-pink-700">開始閱讀</button></div></div>
                                <div className="p-3"><div className="flex flex-wrap gap-1 mb-2">{manga.tags.map(tag => (<span key={tag} className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">#{tag}</span>))}</div><h3 className="font-bold text-gray-800 text-sm line-clamp-1 mb-1 group-hover:text-pink-600 transition-colors">{manga.title}</h3><p className="text-xs text-gray-400 mb-3">作者: {manga.author}</p><div className="flex items-center justify-between text-xs text-gray-400 border-t border-gray-100 pt-2"><span className="flex items-center gap-1"><Eye className="w-3 h-3" /> {manga.views.toLocaleString()}</span><span className="flex items-center gap-1 hover:text-pink-500"><Heart className="w-3 h-3" /> {manga.likes}</span></div></div>
                            </div>
                        ))}
                    </div>
                </div>
            </main>
        )}
      </div>

      {/* --- Modals --- */}
      
      {/* 1. Create Post Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg overflow-hidden animate-fade-in">
             <div className="flex justify-between items-center p-3 border-b bg-gray-50"><h3 className="font-bold text-gray-700">發表新主題</h3><button onClick={() => setIsModalOpen(false)}><X className="w-5 h-5 text-gray-500" /></button></div>
             <form onSubmit={handleCreatePost} className="p-4 space-y-3">
               <div><label className="block text-xs font-bold text-gray-500 mb-1">看板</label><select value={newPost.board_id} onChange={(e) => setNewPost({ ...newPost, board_id: Number(e.target.value) })} className="w-full p-2 border border-gray-300 rounded text-sm bg-white">{boards.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></div>
               <div><input type="text" required placeholder="標題" className="w-full p-2 border border-gray-300 rounded text-sm focus:border-blue-500 outline-none font-bold" value={newPost.title} onChange={(e) => setNewPost({ ...newPost, title: e.target.value })} /></div>
               <div>
                  <textarea required rows={8} placeholder="內容... 支援 Markdown 與 ||防雷文字||" className="w-full p-2 border border-gray-300 rounded-t text-sm focus:border-blue-500 outline-none resize-none border-b-0" value={newPost.content} onChange={(e) => setNewPost({ ...newPost, content: e.target.value })} />
                  <div className="flex items-center gap-1 border border-t-0 border-gray-300 rounded-b px-2 py-1.5 bg-gray-50 mb-3"><label className="cursor-pointer p-1.5 text-gray-500 hover:bg-gray-200 rounded transition" title="上傳圖片"><input type="file" className="hidden" accept="image/*" onChange={handlePostImageUpload} /><ImageIcon className="w-4 h-4" /></label><button type="button" onClick={insertNewPostSpoiler} className="p-1.5 text-gray-500 hover:bg-gray-200 rounded transition" title="插入部分防雷 ||文字||"><EyeOff className="w-4 h-4" /></button><div className="flex-1"></div><span className="text-xs text-gray-400">支援 Markdown</span></div>
               </div>
               <div className="flex items-center"><input id="spoiler" type="checkbox" checked={newPost.is_spoiler} onChange={(e) => setNewPost({ ...newPost, is_spoiler: e.target.checked })} className="mr-2" /><label htmlFor="spoiler" className="text-xs text-gray-600 flex items-center cursor-pointer"><AlertTriangle className="w-3 h-3 mr-1 text-red-500"/> 加密防雷內容</label></div>
               <div className="pt-2 flex justify-end"><button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded text-sm font-bold hover:bg-blue-700">發布</button></div>
             </form>
          </div>
        </div>
      )}

      {/* 2. Profile Modal */}
      {isProfileOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
           <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in">
              <div className="p-4 border-b flex justify-between items-center bg-gray-50"><h3 className="font-bold text-gray-800 flex items-center gap-2"><Settings className="w-5 h-5"/> 個人風格設定</h3><button onClick={() => setIsProfileOpen(false)}><X className="w-5 h-5 text-gray-500"/></button></div>
              <div className="p-5 space-y-5">
                  <div><label className="block text-xs font-bold text-gray-500 mb-1">顯示暱稱</label><input type="text" value={editProfile.nickname} onChange={e => setEditProfile({...editProfile, nickname: e.target.value})} className="w-full p-2 border rounded font-bold text-gray-800" /></div>
                  <div className="space-y-3">
                      <p className="text-xs font-bold text-gray-500 mb-1">自訂背景 (點擊上傳)</p>
                      {['bg_left', 'bg_middle', 'bg_right'].map((key) => {
                          const k = key as 'bg_left' | 'bg_middle' | 'bg_right';
                          const label = k === 'bg_left' ? '左欄' : k === 'bg_middle' ? '中欄' : '右欄';
                          return (
                            <div key={k} className="flex items-center gap-3">
                                <div className="w-20 h-12 bg-gray-100 rounded border flex items-center justify-center overflow-hidden relative">{editProfile[k] ? <img src={editProfile[k]} className="w-full h-full object-cover"/> : <span className="text-xs text-gray-400">{label}</span>}</div>
                                <label className="flex-1 cursor-pointer bg-blue-50 text-blue-600 px-3 py-2 rounded text-sm font-bold text-center hover:bg-blue-100 transition">上傳{label}背景<input type="file" className="hidden" accept="image/*" onChange={(e) => e.target.files && handleProfileBgUpload(k, e.target.files[0])} /></label>
                            </div>
                          )
                      })}
                  </div>
              </div>
              <div className="p-4 bg-gray-50 border-t flex justify-end"><button onClick={handleSaveProfile} className="bg-blue-600 text-white px-6 py-2 rounded font-bold hover:bg-blue-700 shadow-lg">儲存設定</button></div>
           </div>
        </div>
      )}

    </div>
  );
}

// Router Entry
export default function App() {
    return (
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
      </Routes>
    );
}