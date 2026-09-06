import axios from 'axios';
import { install401Handler } from './authInterceptor';
import { getCachedToken } from './nativeSession';

/**
 * The single axios instance every dashboard API call goes through.
 *
 * It carries the session cookie (withCredentials), the legacy Bearer shim, and
 * the 401 auto-logout — so those live in exactly one place instead of being
 * re-declared in every service. Services pass FULL urls (globals.<x>Url + path);
 * there is no per-service baseURL.
 */
const apiClient = axios.create({ withCredentials: true });

apiClient.interceptors.request.use((config) => {
  // Native app (LT-128): the session is a Bearer from @capacitor/preferences,
  // not the cookie — the WebView's origin is not the dashboard's, and iOS ITP
  // may drop third-party cookies. `getCachedToken()` is always null on the
  // web. This is the deliberate Bearer path the LT-009 deletion must keep.
  const native = getCachedToken();
  if (native) {
    config.headers.Authorization = `Bearer ${native}`;
    return config;
  }

  // LT-009 transition shim (web only): sessions ride the HttpOnly cookie now,
  // so this only finds a token on sessions that predate the cookie —
  // AuthContext migrates them at startup and clears localStorage. Delete this
  // branch (not the native one above) once pre-cookie tokens have aged out:
  // 2027-02.
  const token = localStorage.getItem('lightor');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Expired/invalid token → auto-logout in place (see authInterceptor).
install401Handler(apiClient);

export default apiClient;
