import { type AxiosInstance, type AxiosError } from 'axios';

/**
 * Auto-logout on an expired/failed session token.
 *
 * A protected endpoint answers 401 ("Not authorized, token failed") once the
 * JWT expires. Without this, the stale session lingers until the user refreshes
 * — and only then gets bounced to login. Here we notify the app on any 401 so it
 * can log out in place, no refresh needed.
 *
 * The 401→logout decision is split: this layer only *reports* the 401 (it can't
 * see React state); AuthContext decides whether to act, and only logs out when a
 * session is actually active — a failed login is also a 401 and must not trip it.
 * (403 is authorization, not authentication, and is deliberately left alone.)
 */
let unauthorizedHandler: (() => void) | null = null;

/** AuthContext registers here; returns an unsubscribe. */
export function setUnauthorizedHandler(fn: () => void): () => void {
  unauthorizedHandler = fn;
  return () => {
    if (unauthorizedHandler === fn) unauthorizedHandler = null;
  };
}

function report401(error: AxiosError): Promise<never> {
  if (error.response?.status === 401) unauthorizedHandler?.();
  return Promise.reject(error);
}

/**
 * Add the 401 reporter to an axios instance. Called once, on the shared
 * apiClient — every service goes through it.
 */
export function install401Handler(instance: AxiosInstance): void {
  instance.interceptors.response.use((r) => r, report401);
}
