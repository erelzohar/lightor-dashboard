import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import type { FacebookCredential } from '../lib/facebookSignIn';
import toast from 'react-hot-toast';
import { AuthState, User } from '../types';
import { loginUser, googleLogin, googleLoginWithIdToken, appleLogin, facebookLogin, changePassword, getCurrentUser, cookieSync, serverLogout } from '../services/authApi';
import { isServerUnreachable } from '../services/serverUnreachable';
import { updateUserInfo } from '../services/userApi';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch } from '../hooks/useAppDispatch';
import { logout as storeLogout } from '../store/slices/userSlice';
import { setUnauthorizedHandler } from '../services/authInterceptor';
import { loadSession, saveSession, clearSession } from '../services/nativeSession';
import { hasSessionHint, setSessionHint, clearSessionHint } from '../services/sessionHint';
import { registerForPush, unregisterPush } from '../services/pushClient';
import { isNativeApp } from '../lib/platform';
import i18n from '../i18n/config';
interface AuthContextType {
  auth: AuthState;
  login: (email: string, password: string, staySignedIn?: boolean) => Promise<void>;
  loginWithGoogle: (token: string) => Promise<void>;
  /** Native Google Sign-In (LT-128 §3): the plugin's ID token, not an access token. */
  loginWithGoogleIdToken: (idToken: string) => Promise<void>;
  /** LT-383: Sign in with Apple; rethrows, like the native Google call, so the page can show why. */
  loginWithApple: (payload: { idToken: string; nonce: string; authorizationCode?: string; name?: string }) => Promise<void>;
  loginWithFacebook: (credential: FacebookCredential) => Promise<void>;
  logout: () => void;
  loading: boolean;
  updateUser: (userData: Partial<User> & { phoneToken?: string }) => Promise<void>;
  updatePassword: (currentPassword: string, newPassword: string, confirmNewPassword: string) => Promise<void>;
  /**
   * Re-read the user from /auth/me. For state that changes server-side without
   * the dashboard's involvement — the Paddle webhook flipping a subscription is
   * the canonical case (LT-004).
   */
  refreshUser: () => Promise<User | null>;
  /** LT-614: asks the server again after "no connection" (the screen's button; it also retries by itself). */
  retryConnection: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/** LT-614: how often the app asks again while the server cannot be reached. */
const OFFLINE_RETRY_MS = 5000;

/** loginUser's failure codes as the sign-in card's keys (LT-340); any other failure reads as a wrong password. */
const LOGIN_ERROR_KEYS: Record<string, string> = {
  TOO_MANY_ATTEMPTS: 'login.tooManyAttempts',
  NETWORK: 'login.networkError',
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [auth, setAuth] = useState<AuthState>({
    user: null,
    token: null,
    isAuthenticated: false,
    isLoading: true,
    error: null,
  });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  // Auto-logout when a request comes back 401 (expired/invalid token) so the
  // user is bounced to login in place — no page refresh needed. Refs let the
  // once-registered handler always see the latest auth state and logout fn.
  const isAuthedRef = useRef(false);
  const logoutRef = useRef<() => void>(() => {});
  useEffect(() => {
    isAuthedRef.current = auth.isAuthenticated;
  }, [auth.isAuthenticated]);
  useEffect(() => {
    return setUnauthorizedHandler(() => {
      // Ignore 401s while logged out — e.g. a failed login is also a 401 and
      // must not trigger this. Flip the ref immediately to dedupe the burst of
      // 401s a Promise.all of expired requests produces.
      if (!isAuthedRef.current) return;
      isAuthedRef.current = false;
      toast.error(i18n.t('login.sessionExpired', { defaultValue: 'Your session has expired. Please sign in again.' }));
      logoutRef.current();
    });
  }, []);

  // Push registration (LT-129): once per session, only after the account is
  // both signed in and verified — i.e. after the first successful /auth/me,
  // never on launch or on a login that has not completed. No-op on the web.
  const pushRegisteredRef = useRef(false);
  useEffect(() => {
    if (!auth.isAuthenticated || !auth.user?.isVerified || pushRegisteredRef.current) return;
    pushRegisteredRef.current = true;
    void registerForPush();
  }, [auth.isAuthenticated, auth.user?.isVerified]);

  // Asks the server who is signed in: signed in, signed out, or (LT-614) "no
  // connection" when the server could not be asked at all. That last one is
  // not a sign-out: the session hint and the app's stored token stay, the
  // routes show the no-connection screen, and the question is asked again.
  const probingRef = useRef(false);
  const probeSession = async (): Promise<void> => {
    if (probingRef.current) return;
    probingRef.current = true;
    try {
      // The cookie (if any) rides along; no token handling in client code.
      const user = await getCurrentUser();
      setSessionHint();
      setAuth({
        user,
        token: null,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
      if (user.defaultLanguage) i18n.changeLanguage(user.defaultLanguage);
    } catch (error) {
      if (isServerUnreachable(error)) {
        setAuth({ user: null, token: null, isAuthenticated: false, isLoading: false, error: null, offline: true });
        return;
      }
      clearSessionHint();
      setAuth({
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      });
    } finally {
      probingRef.current = false;
    }
  };

  // Initial authentication check (runs ONLY on first load)
  useEffect(() => {
    const initAuth = async () => {
      // LT-009 migration: a token in localStorage is a session from before the
      // HttpOnly cookie existed. Trade it for the cookie once and delete it —
      // after this block, no session material is readable from JavaScript.
      // (Shim; remove once pre-cookie tokens have aged out: 2027-02.)
      const legacy = localStorage.getItem('lightor');
      if (legacy) {
        try {
          await cookieSync(legacy);
        } catch {
          // Expired or forged — either way it has no business persisting.
        }
        localStorage.removeItem('lightor');
      }

      // Native app (LT-128): hydrate the Bearer from @capacitor/preferences so
      // the probe below carries it. No-op (null) on the web.
      const nativeToken = await loadSession();

      // LT-164: nothing suggests a session exists — no hint from an earlier
      // login, no legacy token just traded, no native Bearer — so don't ask.
      // The probe's only possible answer is a 401, and Login.tsx paints
      // nothing until it lands. A stale hint still probes and fails as before.
      if (!hasSessionHint() && !legacy && !nativeToken) {
        setAuth({ user: null, token: null, isAuthenticated: false, isLoading: false, error: null });
        return;
      }

      await probeSession();
    };

    initAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // LT-614: while the server cannot be reached, ask again every few seconds,
  // when the browser says it is back online, and when the app comes back to
  // the screen (an Android WebView does not always fire "online").
  useEffect(() => {
    if (!auth.offline) return undefined;
    const retry = () => { void probeSession(); };
    const onVisible = () => { if (document.visibilityState === 'visible') retry(); };
    const timer = window.setInterval(retry, OFFLINE_RETRY_MS);
    window.addEventListener('online', retry);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('online', retry);
      document.removeEventListener('visibilitychange', onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.offline]);

  const login = async (email: string, password: string, staySignedIn = false) => {
    setLoading(true);
    try {
      // The response set the HttpOnly session cookie; nothing to store here
      // on the web. staySignedIn (LT-066) picks the 60m vs 180d session
      // server-side — the native app always takes the 180d token and keeps it
      // as a Bearer (LT-128): a phone app that logs itself out hourly is broken.
      const { token } = await loginUser(email, password, isNativeApp() || staySignedIn);
      if (token) await saveSession(token);
      const user = await getCurrentUser();
      setSessionHint();

      setAuth({
        user,
        token: null,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
      if (user.defaultLanguage) i18n.changeLanguage(user.defaultLanguage);

      navigate('/', { replace: true });
    } catch (error) {
      // A translation key: the sign-in card says it in the owner's language.
      const code = error instanceof Error ? error.message : '';
      setAuth(prev => ({
        ...prev,
        error: LOGIN_ERROR_KEYS[code] ?? 'login.invalidCredentials',
        isLoading: false,
      }));
    } finally {
      setLoading(false);
    }
  };

  /**
   * Shared tail of both Google paths: the web popup's access token and the
   * native plugin's ID token differ only in the API call that trades them.
   */
  const finishGoogleLogin = async (exchange: () => Promise<{ token: string }>) => {
    setLoading(true);
    try {
      // The response set the HttpOnly session cookie; on native the body's
      // token becomes the Bearer (LT-128).
      const { token } = await exchange();
      if (token) await saveSession(token);
      const user = await getCurrentUser();
      setSessionHint();

      setAuth({
        user,
        token: null,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
      if (user.defaultLanguage) i18n.changeLanguage(user.defaultLanguage);

      navigate('/', { replace: true });
    } catch (err) {
      // Prefer the API's own message ("Invalid Google token" means the token's
      // client id is not in the server's GOOGLE_MOBILE_CLIENT_IDS) over a
      // generic one, then rethrow so a caller can add context (LT-128).
      const e = err as { response?: { data?: { error?: string } }; message?: string };
      setAuth(prev => ({
        ...prev,
        error: e.response?.data?.error || e.message || 'Google login failed',
        isLoading: false,
      }));
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // The web popup path has no caller to handle a rejection (it is invoked from
  // the Google button's onSuccess), so it keeps swallowing after the state is
  // set; the native path awaits and adds the token's audience to the message.
  const loginWithGoogle = (credential: string) =>
    finishGoogleLogin(() => googleLogin(credential)).catch(() => {});
  const loginWithGoogleIdToken = (idToken: string) => finishGoogleLogin(() => googleLoginWithIdToken(idToken));
  const loginWithApple = (payload: { idToken: string; nonce: string; authorizationCode?: string; name?: string }) =>
    finishGoogleLogin(() => appleLogin(payload));

  const loginWithFacebook = async (credential: FacebookCredential) => {
    setLoading(true);
    try {
      // The response set the HttpOnly session cookie; on native the body's
      // token becomes the Bearer (LT-128).
      const { token } = await facebookLogin(credential);
      if (token) await saveSession(token);
      const user = await getCurrentUser();
      setSessionHint();

      setAuth({
        user,
        token: null,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
      if (user.defaultLanguage) i18n.changeLanguage(user.defaultLanguage);

      navigate('/', { replace: true });
    } catch (error) {
      // The API's own words when it answered (LT-552); a Facebook account
      // with no email to share gets our sentence on what to do instead.
      const e = error as { response?: { data?: { error?: string; code?: string } } };
      setAuth(prev => ({
        ...prev,
        error: e.response?.data?.code === 'FACEBOOK_NO_EMAIL'
          ? i18n.t('login.facebookNoEmail')
          : e.response?.data?.error || i18n.t('login.facebookFailed'),
        isLoading: false,
      }));
    } finally {
      setLoading(false);
    }
  };

  const updateUser = async (userData: Partial<User> & { phoneToken?: string }) => {
    if (!auth.user) return;

    try {
      const updatedUser = await updateUserInfo(auth.user._id, userData);
      setAuth(prev => ({
        ...prev,
        user: { ...prev.user!, ...updatedUser }
      }));
    } catch (error: any) {
      throw Object.assign(new Error(error.message || 'Failed to update user account'), { code: error.code });
    }
  };

  const refreshUser = async (): Promise<User | null> => {
    if (!auth.isAuthenticated) return null;
    try {
      const user = await getCurrentUser();
      setAuth(prev => ({ ...prev, user }));
      return user;
    } catch {
      // A transient /me failure should not eject the session; the caller
      // polls, so the next attempt covers it.
      return null;
    }
  };

  const updatePassword = async (currentPassword: string, newPassword: string, confirmNewPassword: string) => {
    try {
      const response = await changePassword(currentPassword, newPassword, confirmNewPassword);
      if (response.success) {
        // The response rotated the session cookie server-side. Read the user
        // from /auth/me rather than unpacking the token — payloads carry only
        // { id, role } since LT-002.
        const user = await getCurrentUser();
        setAuth(prev => ({
          ...prev,
          user,
          token: null
        }));
      }
    } catch (error) {
      // Rethrown as is: the AuthRequestError carries the API's status and
      // code, which the form turns into a field error (LT-315).
      throw error instanceof Error ? error : new Error('Failed to update password');
    }
  };

  const logout = () => {
    // Only the server can clear an HttpOnly cookie. Fire-and-forget: local
    // state resets regardless, and the JWT dies at its own expiry anyway.
    void serverLogout();
    // Native (LT-128/LT-129): drop the push registration for this account
    // while the Bearer is still cached (the DELETE needs it), then forget the
    // Bearer. Both are no-ops on the web. Also covers the 401 auto-logout.
    void unregisterPush().finally(() => void clearSession());
    pushRegisteredRef.current = false;
    localStorage.removeItem('lightor');
    clearSessionHint();
    setAuth({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    });
    dispatch(storeLogout());
    navigate('/', { replace: true });
  };
  // Keep the 401 handler pointed at the current logout closure.
  logoutRef.current = logout;

  return (
    <AuthContext.Provider value={{ auth, login, loginWithGoogle, loginWithGoogleIdToken, loginWithApple, loginWithFacebook, logout, loading, updateUser, updatePassword, refreshUser, retryConnection: probeSession }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
};