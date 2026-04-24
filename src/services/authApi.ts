import axios from 'axios';
import { User } from '../types';
import globals from './globals';

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