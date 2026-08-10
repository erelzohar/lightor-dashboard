import axios from 'axios';
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
  const response = await axios.post(
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
  const response = await axios.post(
    globals.authUrl + 'cookie-sync',
    {},
    { withCredentials: true, headers: { Authorization: `Bearer ${token}` } },
  );
  if (!response.data?.success) throw new Error('Cookie sync failed');
};

/** Clears the HttpOnly session cookie — only the server can, JS cannot see it. */
export const serverLogout = async (): Promise<void> => {
  try {
    await axios.get(`${globals.authUrl}logout`, { withCredentials: true });
  } catch {
    // Logging out locally must never be blocked by a network hiccup; the
    // cookie's JWT still dies at its own expiry.
  }
};

export const loginUser = async (username: string, password: string): Promise<{ token: string; user: User }> => {
  try {
    const response = await axios.post(
      globals.authUrl + 'login',
      { username, password },
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
    const response = await axios.post(
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

export const facebookLogin = async (accessToken: string): Promise<{ token: string; user: User }> => {
  try {
    const response = await axios.post(
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
    const response = await axios.get(`${globals.authUrl}me`, {
      withCredentials: true,
      ...legacyAuthHeader(),
    });

    return response.data.data;
  } catch (error) {
    throw new Error('Invalid token');
  }
};


export const verifyEmail = async (token: string): Promise<void> => {
  const response = await axios.get(`${globals.authUrl}verify/${token}`);
  if (!response.data?.success) {
    throw new Error('Verification failed');
  }
};

export const resendVerification = async (email: string): Promise<void> => {
  await axios.post(`${globals.authUrl}resend-verification`, { email });
};

/**
 * Delete the caller's account (LT-031). Password accounts prove intent with
 * their password; social accounts (no password exists) type the account email.
 * The backend cancels any live Paddle subscription immediately before
 * deleting, and aborts if it cannot — so a failure here can mean "nothing was
 * deleted, try again", which the thrown message reflects.
 */
export const deleteAccount = async (proof: { password?: string; confirmEmail?: string }): Promise<void> => {
  try {
    const response = await axios.delete(`${globals.authUrl}me`, {
      withCredentials: true,
      ...legacyAuthHeader(),
      data: proof,
    });
    if (!response.data?.success) throw new Error('Account deletion failed');
  } catch (error: any) {
    throw new Error(error.response?.data?.error || 'Account deletion failed');
  }
};

export const changePassword = async (currentPassword: string, newPassword: string, confirmNewPassword: string): Promise<{ success: boolean; token?: string; message: string }> => {
  try {
    const response = await axios.put(
      `${globals.authUrl}change-password`,
      { currentPassword, newPassword, confirmNewPassword },
      {
        withCredentials: true,
        ...legacyAuthHeader(),
      },
    );
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.error || 'Failed to update password');
  }
};
