import { useEffect, useState, useRef } from 'react';
import { Routes, Route } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import api, { uploadImage } from './services/api';
import AuthCallback from './features/AuthCallback';
import { 
  MessageSquare, LogIn, LogOut, User as UserIcon, Loader2, X, 
  ThumbsUp, ThumbsDown, MessageCircle, Clock, AlertTriangle, 
  Trash2, CornerDownRight, Image as ImageIcon, Eye, EyeOff,
  Settings, History, Layers
} from 'lucide-react';

// --- [CSS Styles for White Edge Black Text] ---
const globalStyles = `
  .text-outline-white {
    color: #000;
    text-shadow: 
      -1px -1px 0 #fff,  
       1px -1px 0 #fff,
      -1px  1px 0 #fff,
       1px  1px 0 #fff;
    font-weight: 700;
  }
  .text-outline-white-sm {
    color: #000;
    text-shadow: 
      -0.5px -0.5px 0 #fff,  
       0.5px -0.5px 0 #fff,
      -0.5px  0.5px 0 #fff,
       0.5px  0.5px 0 #fff;
    font-weight: 600;
  }
`;

// --- [Type Definitions] ---
interface Board {
  id: number;
  name: string;
  description: string;
}

interface Post {
  id: number;
  title: string;
  content: string;
  owner_id: number;
  board_id: number;
  created_at: string;
  is_spoiler: boolean;
  like_count?: number; 
  dislike_count?: number;
  owner?: UserPublic;
}

interface Comment {
  id: number;
  content: string;
  user_id: number;
  post_id: number;
  is_spoiler: boolean;
  created_at: string;
  user?: UserPublic;
}

interface User {
  id: number;
  email: string;
  username: string;
  nickname?: string;
  bg_left?: string;
  bg_middle?: string;
  bg_right?: string;
}

interface UserPublic {
  id: number;
  username: string;
  nickname?: string;
}

// --- [Helper & Config] ---
const getDisplayName = (u?: UserPublic) => {
  if (!u) return '未知使用者';
  return u.nickname || u.username; // 優先顯示暱稱
};

const parseSpoiler = (text: string) => {
  if (!text) return "";
  return text.replace(/\|\|(.*?)\|\|/g, '[$1](#spoiler)');
};

const markdownComponents: any = {
  img: ({node, ...props}: any) => (
    <img {...props} className="max-w-full h-auto rounded-lg my-2 border border-gray-100 shadow-sm" loading="lazy" />
  ),
  a: ({href, children, ...props}: any) => {
    if (href === '#spoiler') {
      const [visible, setVisible] = useState(false);
      return (
        <span 
          onClick={(e) => { e.preventDefault(); setVisible(!visible); }}
          className={`cursor-pointer px-1 rounded transition-all select-none align-middle mx-0.5 ${
            visible 
              ? 'bg-gray-100 text-gray-800 border border-gray-200' 
              : 'bg-gray-800 text-transparent hover:bg-gray-700'
          }`}
          title="點擊顯示防雷內容"
        >
          {visible ? children : '雷雷雷雷'}
        </span>
      );
    }
    return <a href={href} {...props} className="text-blue-600 hover:underline" target="_blank" rel="noreferrer">{children}</a>;
  }
};

// --- [Sub-Component] Comment Item ---
const CommentItem = ({ comment, index, onQuote }: { comment: Comment, index: number, onQuote: (c: Comment, idx: number) => void }) => {
  const [isRevealed, setIsRevealed] = useState(false);

  return (
    <article className="bg-white/95 backdrop-blur-sm p-4 rounded border border-gray-200 shadow-sm relative group transition-all hover:shadow-md">
       <div className="flex justify-between items-start mb-2 border-b border-gray-50 pb-2">
          <div className="flex items-center gap-2">
             <span className="text-gray-700 font-bold text-sm">{getDisplayName(comment.user)}</span>
             <span className="text-xs text-gray-400">{new Date(comment.created_at).toLocaleString()}</span>
             {comment.is_spoiler && (
               <span className="text-[10px] text-red-500 border border-red-200 bg-red-50 px-1 rounded font-bold">防雷</span>
             )}
          </div>
          <span className="text-xs font-mono text-gray-400">#{index + 2}</span>
       </div>
       
       <div className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap markdown-body">
          {comment.is_spoiler && !isRevealed ? (
              <div 
                onClick={() => setIsRevealed(true)}
                className="bg-gray-50 p-3 rounded text-center border border-gray-200 cursor-pointer select-none hover:bg-gray-100 transition group/spoiler"
              >
                 <p className="text-gray-500 text-xs font-medium flex items-center justify-center gap-1 group-hover/spoiler:text-gray-700">
                    <EyeOff className="w-3 h-3"/> 留言涉及劇透，點擊查看
                 </p>
              </div>
          ) : (
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                {parseSpoiler(comment.content)}
              </ReactMarkdown>
          )}
       </div>

       <div className="mt-2 flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
          <button 
             onClick={() => onQuote(comment, index)}
             className="text-xs text-gray-400 hover:text-blue-600 flex items-center bg-gray-50 px-2 py-1 rounded"
          >
             <CornerDownRight className="w-3 h-3 mr-1"/> 引用
          </button>
       </div>
    </article>
  );
};



// --- [Main Component] ---
function Home() {
  // Data State
  const [posts, setPosts] = useState<Post[]>([]);
  const [boards, setBoards] = useState<Board[]>([]);
  const [activeBoardId, setActiveBoardId] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<'all' | 'history'>('all');
  
  // View State
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [postComments, setPostComments] = useState<Comment[]>([]);
  const [spoilerRevealed, setSpoilerRevealed] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  
  // Loading State
  const [loading, setLoading] = useState(true);
  const [loadingComments, setLoadingComments] = useState(false);
  
  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false); // Post Modal
  const [isProfileOpen, setIsProfileOpen] = useState(false); // Profile Modal
  
  // Forms
  const [newPost, setNewPost] = useState({ title: '', content: '', board_id: 1, is_spoiler: false });
  const [editProfile, setEditProfile] = useState({ nickname: '', bg_left: '', bg_middle: '', bg_right: '' });
  const [replyContent, setReplyContent] = useState('');
  const [replyIsSpoiler, setReplyIsSpoiler] = useState(false);

  // --- Effects ---
  useEffect(() => {
    checkLoginStatus();
    fetchBoards();
  }, []);

  // 統一的 Post Fetching 邏輯
  useEffect(() => {
    const fetchPosts = async () => {
      setLoading(true);
      try {
        let url = '/posts/';
        // 如果是歷史模式且有登入，篩選該 User
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

    setSelectedPost(null); // 切換模式時清空選擇
    fetchPosts();
  }, [activeBoardId, viewMode, user?.id]); // 加入 user.id 依賴

  useEffect(() => {
    if (selectedPost) {
      setSpoilerRevealed(false);
      fetchComments(selectedPost.id);
    }
  }, [selectedPost]);

  // --- API Methods ---
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
    } catch (e) { console.error(e); }
  };

  const fetchComments = async (postId: number) => {
    setLoadingComments(true);
    try {
      const res = await api.get(`/posts/${postId}/comments`);
      setPostComments(res.data);
    } catch (e) { console.error(e); }
    finally { setLoadingComments(false); }
  };

  // --- User Profile Logic ---
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

  const handleBgUpload = async (key: 'bg_left' | 'bg_middle' | 'bg_right', file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    try {
        const res = await uploadImage(formData);
        setEditProfile(prev => ({ ...prev, [key]: res.data.url }));
    } catch (e) { alert("圖片上傳失敗"); }
  };

  const handleSaveProfile = async () => {
    try {
        // 假設 api.patch('/users/me', data) 存在
        const res = await api.patch('/users/me', editProfile);
        setUser(res.data);
        setIsProfileOpen(false);
        alert("個人風格已更新");
    } catch (e) { alert("更新失敗"); }
  };

  // --- Interaction Logic ---
  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await api.post<Post>('/posts/', newPost);
      if (viewMode === 'all' && (!activeBoardId || activeBoardId === newPost.board_id)) {
        setPosts([response.data, ...posts]);
        setSelectedPost(response.data);
      } else if (viewMode === 'history') {
        setPosts([response.data, ...posts]);
      }
      setNewPost({ title: '', content: '', board_id: activeBoardId || 1, is_spoiler: false });
      setIsModalOpen(false);
    } catch (e) { alert("發文失敗"); }
  };

  const handleSubmitComment = async () => {
    if (!selectedPost || !replyContent.trim()) return;
    try {
      const res = await api.post(`/posts/${selectedPost.id}/comments?content=${encodeURIComponent(replyContent)}&is_spoiler=${replyIsSpoiler}`);
      setPostComments([...postComments, res.data]);
      setReplyContent('');
      setReplyIsSpoiler(false);
    } catch (e) { alert("留言失敗"); }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, target: 'post' | 'reply') => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await uploadImage(formData);
      const markdown = `\n![image](${res.data.url})\n`;
      if (target === 'post') {
        setNewPost(prev => ({ ...prev, content: prev.content + markdown }));
      } else {
        setReplyContent(prev => prev + markdown);
      }
    } catch (e) { alert("圖片上傳失敗"); }
  };

  const handleDeletePost = async () => {
    if(!selectedPost || !confirm("確定刪除？")) return;
    try {
      await api.delete(`/posts/${selectedPost.id}`);
      setPosts(posts.filter(p => p.id !== selectedPost.id));
      setSelectedPost(null);
    } catch { alert("刪除失敗"); }
  };

  const handleGoogleLogin = () => {
    const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!CLIENT_ID) return alert("環境變數 VITE_GOOGLE_CLIENT_ID 未設定");
    const REDIRECT_URI = "http://localhost:8000/api/v1/auth/google/callback";
    window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${CLIENT_ID}&redirect_uri=${REDIRECT_URI}&response_type=code&scope=email%20profile&access_type=offline`;
  };

  return (
    <>
    <style>{globalStyles}</style>
    <div className="h-screen flex flex-col bg-gray-100 text-gray-800 font-sans overflow-hidden">
      
      {/* --- Navbar --- */}
      <nav className="h-14 bg-white/90 backdrop-blur shadow-sm border-b border-gray-200 flex-shrink-0 z-50">
        <div className="max-w-[1600px] mx-auto px-4 h-full flex justify-between items-center">
          <div className="flex items-center">
             <div className="bg-gray-900 p-1.5 rounded mr-2"><MessageSquare className="h-5 w-5 text-white" /></div>
             <span className="text-lg font-bold text-gray-900 tracking-tight">ACG Forum</span>
          </div>
          <div className="flex items-center gap-4">
             {user ? (
                <>
                  <button onClick={openProfileModal} className="flex items-center gap-2 text-sm font-bold hover:bg-gray-100 px-2 py-1 rounded transition text-gray-700">
                     <Settings className="w-4 h-4" />
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
                <button onClick={handleGoogleLogin} className="text-sm text-blue-600 font-medium">登入 / 註冊</button>
             )}
          </div>
        </div>
      </nav>

      

      {/* --- Main Layout --- */}
      <div className="flex-1 flex overflow-hidden max-w-[1600px] mx-auto w-full shadow-2xl">
        
        {/* [Left Column] Boards & History */}
        <aside 
            className="w-56 border-r border-gray-200 flex-shrink-0 overflow-y-auto hidden md:block relative bg-cover bg-center transition-all duration-500"
            style={{ 
                backgroundImage: user?.bg_left ? `url(${user.bg_left})` : 'none',
                backgroundColor: user?.bg_left ? 'transparent' : '#f9fafb'
            }}
        >
           {/* Dark Overlay for readability if image exists */}
           {user?.bg_left && <div className="absolute inset-0 bg-black/10 pointer-events-none"></div>}

           <div className="p-3 relative z-10">
             <div className="text-xs font-bold text-gray-500 mb-2 px-2 uppercase tracking-wider bg-white/50 inline-block rounded backdrop-blur-sm shadow-sm">瀏覽模式</div>
             
             <button
                onClick={() => { setViewMode('all'); setActiveBoardId(null); }}
                className={`w-full text-left px-3 py-2 rounded mb-1 text-sm flex items-center gap-2 ${
                    viewMode === 'all' && activeBoardId === null 
                    ? 'bg-white/90 text-blue-700 shadow-sm font-bold' 
                    : 'text-outline-white hover:bg-white/30'
                }`}
             >
               <Layers className="w-4 h-4"/> 全部主題
             </button>

             {user && (
                 <button
                    onClick={() => { setViewMode('history'); setActiveBoardId(null); }}
                    className={`w-full text-left px-3 py-2 rounded mb-4 text-sm flex items-center gap-2 ${
                        viewMode === 'history' 
                        ? 'bg-white/90 text-blue-700 shadow-sm font-bold' 
                        : 'text-outline-white hover:bg-white/30'
                    }`}
                 >
                   <History className="w-4 h-4"/> 我的發文歷史
                 </button>
             )}

             <div className="text-xs font-bold text-gray-500 mb-2 px-2 uppercase tracking-wider bg-white/50 inline-block rounded backdrop-blur-sm shadow-sm">看板分類</div>
             {boards.map(b => (
               <button
                 key={b.id}
                 onClick={() => { setActiveBoardId(b.id); setViewMode('all'); }}
                 className={`w-full text-left px-3 py-2 rounded mb-1 text-sm ${
                    viewMode === 'all' && activeBoardId === b.id 
                    ? 'bg-white/90 text-blue-700 shadow-sm font-bold' 
                    : 'text-outline-white hover:bg-white/30'
                 }`}
               >
                 # {b.name}
               </button>
             ))}
           </div>
        </aside>

        {/* [Middle Column] Post List */}
        <div 
            className="w-full md:w-96 border-r border-gray-200 flex flex-col flex-shrink-0 relative bg-cover bg-center transition-all duration-500"
            style={{ 
                backgroundImage: user?.bg_middle ? `url(${user.bg_middle})` : 'none',
                backgroundColor: user?.bg_middle ? 'transparent' : '#ffffff' 
            }}
        >
            {user?.bg_middle && <div className="absolute inset-0 bg-black/10 pointer-events-none"></div>}

            <div className="h-10 border-b border-gray-200/50 flex items-center px-4 sticky top-0 z-10 backdrop-blur-md bg-white/70">
              <span className="font-bold text-sm text-gray-800">
                {viewMode === 'history' ? "我的發文紀錄" : (activeBoardId ? boards.find(b => b.id === activeBoardId)?.name : "最新熱門")}
              </span>
            </div>
            
            <div className="flex-1 overflow-y-auto relative z-0">
             {loading ? <div className="py-10 text-center"><Loader2 className="animate-spin mx-auto w-6 h-6 text-gray-500"/></div> : 
               posts.map(post => (
                 <div 
                   key={post.id}
                   onClick={() => setSelectedPost(post)}
                   className={`p-3 border-b border-gray-200/50 cursor-pointer hover:bg-white/40 transition-colors ${
                     selectedPost?.id === post.id ? 'bg-white/60 border-l-4 border-l-blue-500' : 'border-l-4 border-l-transparent'
                   }`}
                 >
                    <div className="flex justify-between items-start mb-1">
                       <h3 className={`text-sm leading-tight line-clamp-2 text-outline-white`}>
                         {post.title}
                       </h3>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                       <div className="flex items-center gap-3 text-xs text-outline-white-sm opacity-90">
                          <span className="flex items-center gap-1"><UserIcon className="w-3 h-3" /> {getDisplayName(post.owner)}</span>
                          <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {new Date(post.created_at).toLocaleDateString()}</span>
                       </div>
                    </div>
                 </div>
               ))
             }
            </div>
        </div>

        {/* [Right Column] Reading Area */}
        <main 
            className="flex-1 flex flex-col min-w-0 relative bg-cover bg-center transition-all duration-500"
            style={{ 
                backgroundImage: user?.bg_right ? `url(${user.bg_right})` : 'none',
                backgroundColor: user?.bg_right ? 'transparent' : '#f3f4f6' 
            }}
        >
           {/* Darker overlay for content readability */}
           {user?.bg_right && <div className="absolute inset-0 bg-black/10 pointer-events-none"></div>}

           {selectedPost ? (
            <>
                <header className="bg-white/90 backdrop-blur border-b border-gray-200 p-4 shadow-sm flex-shrink-0 z-10 flex justify-between items-start gap-4">
                 <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded font-bold">
                        {boards.find(b => b.id === selectedPost.board_id)?.name || "綜合"}
                      </span>
                      <span className="text-xs text-gray-400">{new Date(selectedPost.created_at).toLocaleString()}</span>
                    </div>
                    <h1 className="text-xl font-bold text-gray-900 leading-snug">{selectedPost.title}</h1>
                 </div>
                 <div className="flex items-center gap-1 bg-gray-50 rounded-lg p-1 border border-gray-200 flex-shrink-0">
                    {/* Fake Voting Buttons for UI Demo */}
                    <button className="flex flex-col items-center justify-center px-3 py-1 hover:bg-gray-200 rounded transition"><ThumbsUp className="w-5 h-5 text-gray-400"/><span className="text-xs font-bold text-gray-500">0</span></button>
                    <div className="w-px h-8 bg-gray-200"></div>
                    <button className="flex flex-col items-center justify-center px-3 py-1 hover:bg-gray-200 rounded transition"><ThumbsDown className="w-5 h-5 text-gray-400"/><span className="text-xs font-bold text-gray-500">0</span></button>
                 </div>
                </header>

                <div className="flex-1 overflow-y-auto p-4 space-y-3 scroll-smooth relative z-0">
                   {/* #1 Post Body */}
                   <article className="bg-white/95 backdrop-blur-sm p-5 rounded border border-gray-200 shadow-sm relative group">
                      <div className="flex justify-between items-start mb-3 border-b border-gray-100 pb-2">
                         <div className="flex items-center gap-2">
                            <span className="text-blue-600 font-bold text-sm">{getDisplayName(selectedPost.owner)}</span>
                            <span className="text-xs text-gray-400">(樓主)</span>
                         </div>
                         <span className="text-xs font-mono text-gray-400">#1</span>
                      </div>
                      <div className="text-base text-gray-800 leading-relaxed whitespace-pre-wrap min-h-[80px] markdown-body">
                         {selectedPost.is_spoiler && !spoilerRevealed ? (
                            <div className="bg-gray-50 p-8 rounded text-center border border-gray-200 flex flex-col items-center gap-3 select-none cursor-pointer hover:bg-gray-100 transition" onClick={() => setSpoilerRevealed(true)}>
                               <AlertTriangle className="w-8 h-8 text-red-400" />
                               <div><p className="text-gray-600 font-bold text-lg">涉及劇透內容</p><p className="text-gray-400 text-sm">此文章內容已被隱藏</p></div>
                               <button className="bg-white border border-gray-300 text-gray-700 px-4 py-1.5 rounded-full text-sm font-medium hover:text-blue-600 hover:border-blue-400 transition mt-2">點擊顯示內容</button>
                            </div>
                         ) : (
                            <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                              {parseSpoiler(selectedPost.content)}
                            </ReactMarkdown>
                         )}
                      </div>
                      <div className="mt-4 pt-2 flex justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                         {user && user.id === selectedPost.owner_id && (
                             <button onClick={handleDeletePost} className="text-xs text-gray-400 hover:text-red-600 flex items-center"><Trash2 className="w-3 h-3 mr-1"/> 刪除</button>
                         )}
                         <button onClick={() => setReplyContent(`> ${selectedPost.content.substring(0, 30)}...\n`)} className="text-xs text-gray-400 hover:text-blue-600 flex items-center"><CornerDownRight className="w-3 h-3 mr-1"/> 引用</button>
                      </div>
                   </article>

                   {/* Comments */}
                   {loadingComments ? <div className="text-center py-6"><Loader2 className="animate-spin w-6 h-6 mx-auto text-gray-400"/></div> : 
                      postComments.map((comment, index) => (
                         <CommentItem 
                            key={comment.id} 
                            comment={comment} 
                            index={index} 
                            onQuote={(c, idx) => setReplyContent(prev => prev + `> 回覆 #${idx + 2} User ${c.user_id}: ${c.content.substring(0, 20)}...\n`)}
                         />
                      ))
                   }
                   <div className="h-20"></div>
                </div>

                {/* Reply Box */}
                <div className="bg-white/95 backdrop-blur border-t border-gray-200 p-3 shadow-lg z-20">
                   {user ? (
                     <div className="flex flex-col gap-2 max-w-4xl mx-auto">
                        <div className="flex gap-2 items-end">
                            <div className="flex-1 relative">
                              <textarea
                                value={replyContent}
                                onChange={(e) => setReplyContent(e.target.value)}
                                placeholder="參與討論... 支援 Markdown 與 ||隱藏內容||"
                                className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none text-sm h-10 min-h-[40px] max-h-24 transition-all focus:h-20"
                              />
                              <label className="absolute bottom-2 left-2 text-gray-400 hover:text-blue-600 cursor-pointer p-1 rounded-full hover:bg-gray-100 transition">
                                  <input type="file" className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, 'reply')} />
                                  <ImageIcon className="w-5 h-5" />
                              </label>
                              <button onClick={() => setReplyContent(prev => prev + " ||隱藏內容|| ")} className="absolute bottom-2 left-9 text-gray-400 hover:text-gray-700 p-1 rounded-full hover:bg-gray-100 transition"><EyeOff className="w-5 h-5" /></button>
                              <button onClick={() => setReplyContent(prev => prev + `> ${selectedPost.content.substring(0, 20)}...\n`)} className="absolute bottom-2 right-2 text-gray-400 hover:text-blue-600 p-1 rounded-full hover:bg-gray-100 transition"><CornerDownRight className="w-5 h-5" /></button>
                            </div>
                            <button onClick={handleSubmitComment} disabled={!replyContent.trim()} className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white px-4 rounded-lg text-sm font-bold flex-shrink-0 h-10 transition-colors">回覆</button>
                        </div>
                        <div className="flex items-center gap-4 px-1">
                             <div className="flex items-center">
                                <input id="reply-spoiler" type="checkbox" checked={replyIsSpoiler} onChange={(e) => setReplyIsSpoiler(e.target.checked)} className="w-4 h-4 text-red-600 rounded border-gray-300 focus:ring-red-500" />
                                <label htmlFor="reply-spoiler" className="ml-2 text-xs text-gray-600 flex items-center cursor-pointer select-none"><AlertTriangle className="w-3 h-3 mr-1 text-red-500" /> 整層防雷 (涉及大量劇透時勾選)</label>
                             </div>
                        </div>
                     </div>
                   ) : (
                     <div className="text-center text-sm text-gray-500 py-1"><button onClick={handleGoogleLogin} className="text-blue-600 hover:underline font-bold">登入</button> 以發表回覆</div>
                   )}
                </div>
             </>
           ) : (
             <div className="h-full flex flex-col items-center justify-center relative z-10">
                <MessageSquare className="w-20 h-20 mb-4 opacity-50 text-outline-white" />
                <p className="font-bold text-2xl text-outline-white opacity-80">請選擇左側文章開始閱讀</p>
             </div>
           )}
        </main>
      </div>

      {/* --- Modal (Create Post) --- */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg overflow-hidden animate-fade-in">
            <div className="flex justify-between items-center p-3 border-b bg-gray-50">
              <h3 className="font-bold text-gray-700">發表新主題</h3>
              <button onClick={() => setIsModalOpen(false)}><X className="w-5 h-5 text-gray-500" /></button>
            </div>
            <form onSubmit={handleCreatePost} className="p-4 space-y-3">
               <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">看板</label>
                  <select value={newPost.board_id} onChange={(e) => setNewPost({ ...newPost, board_id: Number(e.target.value) })} className="w-full p-2 border border-gray-300 rounded text-sm bg-white">
                     {boards.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
               </div>
               <div>
                  <input type="text" required placeholder="標題" className="w-full p-2 border border-gray-300 rounded text-sm focus:border-blue-500 outline-none font-bold" value={newPost.title} onChange={(e) => setNewPost({ ...newPost, title: e.target.value })} />
               </div>
               <div>
                  <textarea required rows={8} placeholder="內容... 支援 Markdown 與 ||防雷文字||" className="w-full p-2 border border-gray-300 rounded-t text-sm focus:border-blue-500 outline-none resize-none border-b-0" value={newPost.content} onChange={(e) => setNewPost({ ...newPost, content: e.target.value })} />
                  <div className="flex items-center gap-1 border border-t-0 border-gray-300 rounded-b px-2 py-1.5 bg-gray-50 mb-3">
                     <label className="cursor-pointer p-1.5 text-gray-500 hover:bg-gray-200 rounded transition"><input type="file" className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, 'post')} /><ImageIcon className="w-4 h-4" /></label>
                     <button type="button" onClick={() => setNewPost(p => ({...p, content: p.content + " ||隱藏內容|| "}))} className="p-1.5 text-gray-500 hover:bg-gray-200 rounded transition"><EyeOff className="w-4 h-4" /></button>
                     <div className="flex-1"></div>
                     <span className="text-xs text-gray-400">支援 Markdown</span>
                  </div>
               </div>
               <div className="flex items-center">
                  <input id="spoiler" type="checkbox" checked={newPost.is_spoiler} onChange={(e) => setNewPost({ ...newPost, is_spoiler: e.target.checked })} className="mr-2" />
                  <label htmlFor="spoiler" className="text-xs text-gray-600 flex items-center cursor-pointer"><AlertTriangle className="w-3 h-3 mr-1 text-red-500"/> 整層加密防雷</label>
               </div>
               <div className="pt-2 flex justify-end">
                  <button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded text-sm font-bold hover:bg-blue-700">發布</button>
               </div>
            </form>
          </div>
        </div>
      )}

      {/* --- Modal (Profile Settings) --- */}
      {isProfileOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
           <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in">
              <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                  <h3 className="font-bold text-gray-800 flex items-center gap-2">
                      <Settings className="w-5 h-5"/> 個人風格設定
                  </h3>
                  <button onClick={() => setIsProfileOpen(false)}><X className="w-5 h-5 text-gray-500"/></button>
              </div>
              <div className="p-5 space-y-5">
                  <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1">顯示暱稱</label>
                      <input 
                        type="text" 
                        value={editProfile.nickname}
                        onChange={e => setEditProfile({...editProfile, nickname: e.target.value})}
                        className="w-full p-2 border rounded font-bold text-gray-800 focus:outline-blue-500"
                        placeholder={user?.username}
                      />
                  </div>

                  <div className="space-y-3">
                      <p className="text-xs font-bold text-gray-500 mb-1">自訂背景 (點擊上傳)</p>
                      {/* Left Bg */}
                      <div className="flex items-center gap-3">
                          <div className="w-20 h-12 bg-gray-100 rounded border flex items-center justify-center overflow-hidden relative">
                              {editProfile.bg_left ? <img src={editProfile.bg_left} className="w-full h-full object-cover"/> : <span className="text-xs text-gray-400">左欄</span>}
                          </div>
                          <label className="flex-1 cursor-pointer bg-blue-50 text-blue-600 px-3 py-2 rounded text-sm font-bold text-center hover:bg-blue-100 transition">
                             上傳左欄背景
                             <input type="file" className="hidden" accept="image/*" onChange={(e) => e.target.files && handleBgUpload('bg_left', e.target.files[0])} />
                          </label>
                      </div>
                      {/* Middle Bg */}
                      <div className="flex items-center gap-3">
                          <div className="w-20 h-12 bg-gray-100 rounded border flex items-center justify-center overflow-hidden relative">
                              {editProfile.bg_middle ? <img src={editProfile.bg_middle} className="w-full h-full object-cover"/> : <span className="text-xs text-gray-400">中欄</span>}
                          </div>
                          <label className="flex-1 cursor-pointer bg-blue-50 text-blue-600 px-3 py-2 rounded text-sm font-bold text-center hover:bg-blue-100 transition">
                             上傳中欄背景
                             <input type="file" className="hidden" accept="image/*" onChange={(e) => e.target.files && handleBgUpload('bg_middle', e.target.files[0])} />
                          </label>
                      </div>
                      {/* Right Bg */}
                      <div className="flex items-center gap-3">
                          <div className="w-20 h-12 bg-gray-100 rounded border flex items-center justify-center overflow-hidden relative">
                              {editProfile.bg_right ? <img src={editProfile.bg_right} className="w-full h-full object-cover"/> : <span className="text-xs text-gray-400">右欄</span>}
                          </div>
                          <label className="flex-1 cursor-pointer bg-blue-50 text-blue-600 px-3 py-2 rounded text-sm font-bold text-center hover:bg-blue-100 transition">
                             上傳右欄背景
                             <input type="file" className="hidden" accept="image/*" onChange={(e) => e.target.files && handleBgUpload('bg_right', e.target.files[0])} />
                          </label>
                      </div>
                  </div>
              </div>
              <div className="p-4 bg-gray-50 border-t flex justify-end">
                  <button onClick={handleSaveProfile} className="bg-blue-600 text-white px-6 py-2 rounded font-bold hover:bg-blue-700 shadow-lg">
                      儲存設定
                  </button>
              </div>
           </div>
        </div>
      )}
    </div>
    </>
  );
}

// --- [Router Entry] ---
export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
    </Routes>
  );
}