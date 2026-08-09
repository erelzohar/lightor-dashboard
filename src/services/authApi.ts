import axios from 'axios';
import { User } from '../types';
import globals from './globals';

/**
 * Trade the short-lived handoff token minted at signup for a real session.
 * Overwrites any session already in localStorage on purpose: the whole point
 * is that the freshly registered account wins over a stale one. (LT-030)
 */
export const handoffLogin = async (handoffToken: string): Promise<{ token: string; user: User }> => {
  const response = await axios.post(globals.authUrl + 'handoff', { token: handoffToken });
  if (!response.data?.success) throw new Error('Handoff failed');
  localStorage.setItem('lightor', response.data.token);
  return { token: response.data.token, user: response.data.data };
};

export const loginUser = async (username: string, password: string): Promise<{ token: string; user: User }> => {
  try {
    const response = await axios.post(globals.authUrl + 'login', { username, password });
    if (response.data?.success) {
      localStorage.setItem('lightor', response.data?.token);
      return { token: response.data?.token, user: response.data.data }
    }

  } catch (error) {
    throw new Error('Invalid credentials');
  }
};

export const googleLogin = async (token: string): Promise<{ token: string; user: User }> => {
  try {
    const response = await axios.post(globals.authUrl + 'google', { token });
    if (response.data?.success) {
      localStorage.setItem('lightor', response.data?.token);
      return { token: response.data?.token, user: response.data.data }
    }
    throw new Error('Invalid credentials');
  } catch (error) {
    throw new Error('Google login failed');
  }
};

export const facebookLogin = async (accessToken: string): Promise<{ token: string; user: User }> => {
  try {
    const response = await axios.post(globals.authUrl + 'facebook', { accessToken });
    if (response.data?.success) {
      localStorage.setItem('lightor', response.data?.token);
      return { token: response.data?.token, user: response.data.data }
    }
    throw new Error('Invalid credentials');
  } catch (error) {
    throw new Error('Facebook login failed');
  }
};

export const getCurrentUser = async (): Promise<User> => {
  const token = localStorage.getItem('lightor');
  if (!token) throw new Error('No token found');

  try {
    const response = await axios.get(`${globals.authUrl}me`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
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
  const token = localStorage.getItem('lightor');
  try {
    const response = await axios.delete(`${globals.authUrl}me`, {
      headers: { Authorization: `Bearer ${token}` },
      data: proof,
    });
    if (!response.data?.success) throw new Error('Account deletion failed');
  } catch (error: any) {
    throw new Error(error.response?.data?.error || 'Account deletion failed');
  }
};

export const changePassword = async (currentPassword: string, newPassword: string, confirmNewPassword: string): Promise<{ success: boolean; token?: string; message: string }> => {
  const token = localStorage.getItem('lightor');
  try {
    const response = await axios.put(
      `${globals.authUrl}change-password`,
      { currentPassword, newPassword, confirmNewPassword },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.error || 'Failed to update password');
  }
};