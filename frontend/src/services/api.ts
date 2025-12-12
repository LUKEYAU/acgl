import axios from 'axios';

const api = axios.create({
  baseURL: '/api/v1', // 對應後端的 API 版本路徑
});

export default api;