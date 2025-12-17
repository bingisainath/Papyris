import axios from "axios";
import { tokenStore } from "./token";

const api = axios.create({
  baseURL: process.env.REACT_APP_API_BASE_URL,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const token = tokenStore.get();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    // If backend says token invalid/expired => wipe token
    if (err?.response?.status === 401) {
      tokenStore.clear();
    }
    return Promise.reject(err);
  }
);

export default api;
