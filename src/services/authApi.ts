import apiClient from './apiClient';
import { User } from '../types';
import globals from './globals';

/**
 * LT-009: the session lives in an HttpOnly cookie set by the API, invisible
 * to every script in this page — which is the point; localStorage was one XSS
 * away from handing over a 180-day session. Nothing here writes localStorage
 * any more. The only remaining *read* is `legacyToken()`, a transition shim
 * for sessions created before the cookie existed: AuthContext exchanges such
 * a token for a cookie once (cookieSync) and deletes it. Remove the shim and
 * every `...legacyAuthHeader()` spread once pre-cookie tokens have aged out:
 * 2027-02.
 */
const legacyToken = (): string | null => localStorage.getItem('lightor');

/**
 * A failed auth request that keeps what the API said about it: the HTTP
 * status and the machine-readable `code` (LT-315 — change password:
 * WRONG_PASSWORD, SAME_PASSWORD; delete account: PASSWORD_REQUIRED,
 * WRONG_PASSWORD, EMAIL_MISMATCH; reset: RESET_TOKEN_INVALID), next to the
 * message older callers match on.
 */
export class AuthRequestError extends Error {
  status?: number;
  code?: string;

  constructor(message: string, status?: number, code?: string) {
    super(message);
    this.name = 'AuthRequestError';
    this.status = status;
    this.code = code;
  }
}

type ApiFailure = { response?: { status?: number; data?: { error?: unknown; code?: unknown } } };
const toAuthError = (error: unknown, fallback: string): AuthRequestError => {
  const response = (error as ApiFailure)?.response;
  const message = typeof response?.data?.error === 'string' && response.data.error ? response.data.error : fallback;
  const code = typeof response?.data?.code === 'string' ? response.data.code : undefined;
  return new AuthRequestError(message, response?.status, code);
};
const legacyAuthHeader = () => {
  const token = legacyToken();
  return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
};

/**
 * Trade the short-lived handoff token minted at signup for a real session.
 * The response *sets the session cookie*; the body's token is not stored.
 * (LT-030 / LT-009)
 */
export const handoffLogin = async (handoffToken: string): Promise<{ token: string; user: User }> => {
  const response = await apiClient.post(
    globals.authUrl + 'handoff',
    { token: handoffToken },
    { withCredentials: true },
  );
  if (!response.data?.success) throw new Error('Handoff failed');
  return { token: response.data.token, user: response.data.data };
};

/**
 * One-time migration of a pre-cookie session: prove it with the Bearer, get
 * the cookie back. The caller deletes the localStorage copy on success.
 */
export const cookieSync = async (token: string): Promise<void> => {
  const response = await apiClient.post(
    globals.authUrl + 'cookie-sync',
    {},
    { withCredentials: true, headers: { Authorization: `Bearer ${token}` } },
  );
  if (!response.data?.success) throw new Error('Cookie sync failed');
};

/** Clears the HttpOnly session cookie — only the server can, JS cannot see it. */
export const serverLogout = async (): Promise<void> => {
  try {
    await apiClient.get(`${globals.authUrl}logout`, { withCredentials: true });
  } catch {
    // Logging out locally must never be blocked by a network hiccup; the
    // cookie's JWT still dies at its own expiry.
  }
};

export const loginUser = async (email: string, password: string, staySignedIn = false): Promise<{ token: string; user: User }> => {
  try {
    const response = await apiClient.post(
      globals.authUrl + 'login',
      { email, password, staySignedIn },
      { withCredentials: true },
    );
    if (response.data?.success) {
      return { token: response.data?.token, user: response.data.data }
    }

  } catch (error) {
    throw new Error('Invalid credentials');
  }
};

export const googleLogin = async (token: string): Promise<{ token: string; user: User }> => {
  try {
    const response = await apiClient.post(
      globals.authUrl + 'google',
      { token },
      { withCredentials: true },
    );
    if (response.data?.success) {
      return { token: response.data?.token, user: response.data.data }
    }
    throw new Error('Invalid credentials');
  } catch (error) {
    throw new Error('Google login failed');
  }
};

/**
 * Native Google Sign-In (LT-128 §3): the iOS/Android plugin yields an ID
 * token, not the access token the web popup gives `googleLogin`. Same
 * endpoint, `{ idToken }` body; the API verifies it against the app's OAuth
 * client IDs.
 */
export const googleLoginWithIdToken = async (idToken: string): Promise<{ token: string; user: User }> => {
  // Deliberately NOT wrapped in a try/catch that replaces the error with a
  // fixed string (the pattern the older calls above use): the API's own
  // message is the only thing that tells a native sign-in failure apart from
  // a server-side misconfiguration, and swallowing it cost a debugging round
  // trip on the first real device attempt (LT-128).
  const response = await apiClient.post(
    globals.authUrl + 'google',
    { idToken },
    { withCredentials: true },
  );
  if (!response.data?.success) throw new Error('Google login failed');
  return { token: response.data?.token, user: response.data.data };
};

export const facebookLogin = async (accessToken: string): Promise<{ token: string; user: User }> => {
  try {
    const response = await apiClient.post(
      globals.authUrl + 'facebook',
      { accessToken },
      { withCredentials: true },
    );
    if (response.data?.success) {
      return { token: response.data?.token, user: response.data.data }
    }
    throw new Error('Invalid credentials');
  } catch (error) {
    throw new Error('Facebook login failed');
  }
};

export const getCurrentUser = async (): Promise<User> => {
  try {
    const response = await apiClient.get(`${globals.authUrl}me`, {
      withCredentials: true,
      ...legacyAuthHeader(),
    });

    return response.data.data;
  } catch (error) {
    throw new Error('Invalid token');
  }
};


export const verifyEmail = async (token: string): Promise<void> => {
  const response = await apiClient.get(`${globals.authUrl}verify/${token}`);
  if (!response.data?.success) {
    throw new Error('Verification failed');
  }
};

export const resendVerification = async (email: string): Promise<void> => {
  await apiClient.post(`${globals.authUrl}resend-verification`, { email });
};

/**
 * Delete the caller's account (LT-031). Password accounts prove intent with
 * their password; social accounts (no password exists) type the account email.
 * The backend cancels any live Paddle subscription immediately before
 * deleting, and aborts if it cannot — so a failure here can mean "nothing was
 * deleted, try again", which the thrown message reflects.
 */
export const deleteAccount = async (proof: { password?: string; confirmEmail?: string }): Promise<void> => {
  let response;
  try {
    response = await apiClient.delete(`${globals.authUrl}me`, {
      withCredentials: true,
      ...legacyAuthHeader(),
      data: proof,
      // A wrong password here is the dialog's error, not a lost session (LT-315).
      credentialCheck: true,
    });
  } catch (error) {
    throw toAuthError(error, 'Account deletion failed');
  }
  if (!response.data?.success) throw new AuthRequestError('Account deletion failed');
};

export const changePassword = async (currentPassword: string, newPassword: string, confirmNewPassword: string): Promise<{ success: boolean; token?: string; message: string }> => {
  try {
    const response = await apiClient.put(
      `${globals.authUrl}change-password`,
      { currentPassword, newPassword, confirmNewPassword },
      {
        withCredentials: true,
        ...legacyAuthHeader(),
        // A wrong current password is a field error, not a lost session (LT-315).
        credentialCheck: true,
      },
    );
    return response.data;
  } catch (error) {
    throw toAuthError(error, 'Failed to update password');
  }
};

/**
 * Ask for a password-reset email (LT-315). The API answers the same for an
 * address it does not know, so the caller always says "if an account
 * exists, we sent a link" — success here never confirms an account.
 */
export const requestPasswordReset = async (email: string): Promise<void> => {
  try {
    await apiClient.post(`${globals.authUrl}forgot-password`, { email });
  } catch (error) {
    throw toAuthError(error, 'Could not send the reset email');
  }
};

/**
 * Set a new password with the emailed link's token (LT-315). The API's route
 * is `PUT /auth/reset-password/:resetToken` with `{ password, confirmPassword }`;
 * a 200 sets the session cookie and returns `{ token }`, the JWT the native
 * app keeps as its Bearer (as on login and handoff). An invalid, used or
 * expired link is a 400 with code RESET_TOKEN_INVALID.
 */
export const resetPassword = async (resetToken: string, password: string): Promise<{ token?: string }> => {
  try {
    const response = await apiClient.put(
      `${globals.authUrl}reset-password/${encodeURIComponent(resetToken)}`,
      { password, confirmPassword: password },
      { withCredentials: true },
    );
    const token = response.data?.token;
    return { token: typeof token === 'string' ? token : undefined };
  } catch (error) {
    throw toAuthError(error, 'Password reset failed');
  }
};
