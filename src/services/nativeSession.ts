import { Preferences } from '@capacitor/preferences';
import { isNativeApp } from '../lib/platform';

/**
 * The session token store for the iOS/Android app (LT-128, mobile plan
 * phase 1 §2).
 *
 * On the web the session is the HttpOnly `_d_t` cookie (LT-009) and nothing
 * here does anything — every function is a no-op returning null, so callers
 * never branch on platform themselves. Inside the Capacitor shell the cookie
 * is not relied on at all (iOS ITP can drop it; the WebView origin is not the
 * dashboard's): every login response carries the JWT in its body, we keep it
 * in `@capacitor/preferences` and `apiClient` sends it as a Bearer.
 *
 * `getCachedToken()` is synchronous so the axios request interceptor can
 * read it without awaiting; `loadSession()` hydrates the cache once at
 * startup, before the first `/auth/me` probe.
 */
const KEY = 'lightor.session';

let cached: string | null = null;

/** Read the stored token into the cache. Resolves to the token (or null). */
export const loadSession = async (): Promise<string | null> => {
  if (!isNativeApp()) return null;
  try {
    const { value } = await Preferences.get({ key: KEY });
    cached = value || null;
  } catch {
    cached = null;
  }
  return cached;
};

export const saveSession = async (token: string): Promise<void> => {
  if (!isNativeApp() || !token) return;
  cached = token;
  try {
    await Preferences.set({ key: KEY, value: token });
  } catch {
    // The in-memory copy still serves this run; the next login re-persists.
  }
};

export const clearSession = async (): Promise<void> => {
  cached = null;
  if (!isNativeApp()) return;
  try {
    await Preferences.remove({ key: KEY });
  } catch {
    // Nothing to do — the cache is already gone, which is what logout needs.
  }
};

/** The hydrated token, synchronously. Always null on the web. */
export const getCachedToken = (): string | null => (isNativeApp() ? cached : null);
