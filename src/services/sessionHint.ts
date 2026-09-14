/**
 * "Probably signed in" marker (LT-164).
 *
 * The web session is an HttpOnly cookie the page cannot read, so the only way
 * to learn whether one exists is to ask `/auth/me`. For a logged-out visitor
 * that probe always ends in a 401 — Chrome logs it as an error, and Login.tsx
 * renders nothing until the probe resolves, so the first paint of the login
 * page waited on a round trip whose answer was known in advance.
 *
 * This flag caches that answer: set once a login has succeeded, cleared on
 * logout. It carries no secret and proves nothing — a stale flag (the cookie
 * expired, or was cleared) just means the probe runs and fails exactly as it
 * did before. Only its *absence* is acted on: skip the probe and render the
 * signed-out state at once. Anything that finds a session by other means
 * (the pre-cookie migration shim, the native app's Bearer) still probes.
 */
const KEY = 'lightor.signedIn';

// localStorage can throw (Safari private mode, blocked storage); a hint that
// cannot be read is the same as no hint — one extra probe, never a lockout.
export const hasSessionHint = (): boolean => {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
};

export const setSessionHint = (): void => {
  try {
    localStorage.setItem(KEY, '1');
  } catch {
    // Nothing to do: the next load probes as if the hint were never set.
  }
};

export const clearSessionHint = (): void => {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // A hint that cannot be removed is stale, and a stale hint just probes.
  }
};
