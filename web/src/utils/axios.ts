import axios from "axios";
import { tokenStore } from "./token";
import { API_BASE_URL } from "../config/env";
import { installAuthRefresh } from "./authRefresh";

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const token = tokenStore.get();

  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// On 401: renew the access token and retry once (logs out if the session is over).
// Also installed on the default axios instance, which most services use directly.
installAuthRefresh(api);
installAuthRefresh(axios);

export default api;
