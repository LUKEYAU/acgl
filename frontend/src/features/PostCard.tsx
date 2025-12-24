import { useState } from 'react';
import api from '../services/api';
import { MessageSquare, ThumbsUp, ThumbsDown, Trash2, ChevronDown, ChevronUp, AlertTriangle, CornerDownRight, User as UserIcon } from 'lucide-react';

// 定義 Post 介面 (需與 App.tsx 一致)
interface Post {
  id: number;
  title: string;
  content: string;
  owner_id: number;
  board_id: number;
  created_at: string;
  is_spoiler: boolean;
}

interface Comment {
  id: number;
  content: string;
  user_id: number;
}

interface PostCardProps {
  post: Post;
  currentUserId?: number;
  onDelete: (id: number) => void;
}

export default function PostCard({ post, currentUserId, onDelete }: PostCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [spoilerRevealed, setSpoilerRevealed] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsLoaded, setCommentsLoaded] = useState(false);
  const [replyContent, setReplyContent] = useState('');
  
  // 模擬投票數 (實際專案應從後端 Post 資料中讀取)
  const [votes, setVotes] = useState({ up: 0, down: 0 });

  // 展開/收合邏輯
  const toggleExpand = () => {
    setExpanded(!expanded);
    if (!expanded && !commentsLoaded) {
      loadComments();
    }
  };

  // 載入留言
  const loadComments = async () => {
    try {
      const res = await api.get(`/posts/${post.id}/comments`);
      setComments(res.data);
      setCommentsLoaded(true);
    } catch (e) { console.error("載入留言失敗", e); }
  };

  // 投票
  const handleVote = async (dir: number) => {
    try {
      await api.post(`/posts/${post.id}/vote?dir=${dir}`);
      // 簡單的前端更新 (實際應重新 fetch 最新數據)
      if (dir === 1) setVotes(prev => ({ ...prev, up: prev.up + 1 }));
      else setVotes(prev => ({ ...prev, down: prev.down + 1 }));
    } catch (e) { alert("請先登入"); }
  };

  // 刪除
  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation(); // 防止點擊垃圾桶時觸發文章展開
    if (window.confirm("確定要刪除這篇文章嗎？")) {
      try {
        await api.delete(`/posts/${post.id}`);
        onDelete(post.id); // 通知上層移除該文章
      } catch (e) { alert("刪除失敗"); }
    }
  };

  // 送出留言
  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyContent.trim()) return;
    try {
      const res = await api.post(`/posts/${post.id}/comments?content=${replyContent}`);
      setComments([...comments, res.data]);
      setReplyContent('');
    } catch (e) { alert("留言失敗"); }
  };

  // 引用
  const handleQuote = () => {
    // 簡單的 Markdown 引用格式
    setReplyContent(`> ${post.content.substring(0, 50)}...\n\n`);
  };

  return (
    <article className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden transition-all hover:shadow-md mb-4">
      {/* 標題區 (點擊可展開) */}
      <div 
        onClick={toggleExpand}
        className="p-4 cursor-pointer flex justify-between items-start hover:bg-slate-50 transition-colors"
      >
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            {post.is_spoiler && (
              <span className="flex items-center text-xs font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded border border-red-100">
                <AlertTriangle className="w-3 h-3 mr-1" />
                防雷
              </span>
            )}
            <h3 className="text-lg font-bold text-gray-900 leading-tight">
              {post.title}
            </h3>
          </div>
          <div className="text-xs text-slate-400 flex items-center gap-2 mt-2">
             <UserIcon className="w-3 h-3" />
             <span>UID: {post.owner_id}</span>
             <span>•</span>
             <span>{new Date(post.created_at).toLocaleDateString()}</span>
             {!expanded && <span className="text-slate-300 ml-2">點擊展開...</span>}
          </div>
        </div>
        <div className="flex items-center gap-3">
            {/* 只有作者本人顯示刪除按鈕 */}
            {currentUserId === post.owner_id && (
                <button onClick={handleDelete} className="p-2 text-slate-400 hover:text-red-600 rounded-full hover:bg-red-50 transition">
                    <Trash2 className="w-4 h-4" />
                </button>
            )}
            {expanded ? <ChevronUp className="w-5 h-5 text-slate-400"/> : <ChevronDown className="w-5 h-5 text-slate-400"/>}
        </div>
      </div>

      {/* 展開內容區 */}
      {expanded && (
        <div className="px-6 pb-6 pt-2 border-t border-slate-50 animate-fade-in">
          
          {/* 文章內容 (含防雷遮罩) */}
          <div className="mb-6 relative min-h-[50px]">
             <div className={`prose prose-slate max-w-none text-gray-700 whitespace-pre-wrap leading-relaxed ${
                 post.is_spoiler && !spoilerRevealed ? 'blur-md select-none' : ''
             }`}>
                 {post.content}
             </div>
             
             {/* 防雷按鈕 */}
             {post.is_spoiler && !spoilerRevealed && (
                 <div className="absolute inset-0 flex items-center justify-center z-10">
                     <button 
                         onClick={() => setSpoilerRevealed(true)}
                         className="bg-gray-900/80 text-white px-4 py-2 rounded-full text-sm font-medium hover:bg-gray-900 transition backdrop-blur-sm flex items-center"
                     >
                         <AlertTriangle className="w-4 h-4 mr-2" />
                         內容涉及劇透，點擊顯示
                     </button>
                 </div>
             )}
          </div>

          {/* 操作按鈕列 */}
          <div className="flex items-center gap-4 py-3 border-t border-b border-slate-100 mb-4">
             <button onClick={() => handleVote(1)} className="flex items-center gap-1.5 text-slate-500 hover:text-indigo-600 transition text-sm">
                 <ThumbsUp className="w-4 h-4" /> 讚 ({votes.up})
             </button>
             <button onClick={() => handleVote(-1)} className="flex items-center gap-1.5 text-slate-500 hover:text-pink-600 transition text-sm">
                 <ThumbsDown className="w-4 h-4" /> 倒 ({votes.down})
             </button>
             <div className="w-px h-4 bg-slate-200 mx-2"></div>
             <button onClick={handleQuote} className="flex items-center gap-1.5 text-slate-500 hover:text-indigo-600 transition text-sm">
                 <CornerDownRight className="w-4 h-4" /> 引用回覆
             </button>
          </div>

          {/* 留言區塊 */}
          <div className="bg-slate-50 rounded-lg p-4">
              <h4 className="text-sm font-bold text-slate-700 mb-3 flex items-center">
                  <MessageSquare className="w-4 h-4 mr-2" /> 
                  留言 ({comments.length})
              </h4>
              
              <div className="space-y-3 mb-4 max-h-60 overflow-y-auto">
                  {comments.length === 0 ? (
                      <p className="text-xs text-slate-400 italic">尚無留言，成為第一個討論的人吧！</p>
                  ) : (
                      comments.map(c => (
                          <div key={c.id} className="text-sm bg-white p-3 rounded border border-slate-200 shadow-sm">
                              <span className="font-semibold text-indigo-600 mr-2">UID {c.user_id}:</span>
                              <span className="text-slate-700">{c.content}</span>
                          </div>
                      ))
                  )}
              </div>

              {/* 留言輸入框 */}
              {currentUserId ? (
                  <form onSubmit={handleSubmitComment} className="flex gap-2">
                      <input 
                          type="text" 
                          placeholder="輸入留言..." 
                          className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                          value={replyContent}
                          onChange={e => setReplyContent(e.target.value)}
                      />
                      <button type="submit" className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 whitespace-nowrap">
                          送出
                      </button>
                  </form>
              ) : (
                  <p className="text-xs text-center text-slate-400">請先登入以發表留言</p>
              )}
          </div>
        </div>
      )}
    </article>
  );
}