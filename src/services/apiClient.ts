import axios from 'axios';
import { install401Handler } from './authInterceptor';

/**
 * The single axios instance every dashboard API call goes through.
 *
 * It carries the session cookie (withCredentials), the legacy Bearer shim, and
 * the 401 auto-logout — so those live in exactly one place instead of being
 * re-declared in every service. Services pass FULL urls (globals.<x>Url + path);
 * there is no per-service baseURL.
 */
const apiClient = axios.create({ withCredentials: true });

// LT-009 transition shim: sessions ride the HttpOnly cookie now, so this only
// finds a token on sessions that predate the cookie — AuthContext migrates them
// at startup and clears localStorage. Delete once pre-cookie tokens have aged
// out: 2027-02.
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('lightor');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Expired/invalid token → auto-logout in place (see authInterceptor).
install401Handler(apiClient);

export default apiClient;
