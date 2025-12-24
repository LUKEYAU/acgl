import axios from 'axios';

const api = axios.create({
  baseURL: '/api/v1', // 對應後端的 API 版本路徑
});

export default api;
export const deletePost = (id: number) => api.delete(`/posts/${id}`);
export const votePost = (id: number, dir: number) => api.post(`/posts/${id}/vote?dir=${dir}`);
export const getComments = (id: number) => api.get(`/posts/${id}/comments`);
export const updateUserProfile = (data: { nickname?: string, bg_left?: string, bg_middle?: string, bg_right?: string }) => 
  api.patch('/users/me', data);
export const createComment = (id: number, content: string, is_spoiler: boolean) => 
  api.post(`/posts/${id}/comments?content=${encodeURIComponent(content)}&is_spoiler=${is_spoiler}`);

export const uploadImage = (formData: FormData) => 
  api.post('/upload/image', formData, {
    headers: { 'Content-Type': 'multipart/form-data' } // 這是上傳檔案必須的
  });
