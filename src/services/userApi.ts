import axios from 'axios';
import { User } from '../types';
import globals from './globals';
import { install401Handler } from './authInterceptor';

// Create an axios instance with default config
const api = axios.create({
  baseURL: globals.usersUrl,
  withCredentials: true,
});
install401Handler(api);

// LT-009: the session now rides an HttpOnly cookie (withCredentials). This
// Bearer interceptor is a transition shim for sessions that predate the
// cookie — AuthContext migrates them at startup and clears localStorage, so
// this finds nothing on any session created after LT-009. Delete it (and the
// other copies of it) once pre-cookie tokens have aged out: 2027-02.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('lightor');

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});


export const updateUserInfo = async (id: string, userData: Partial<User>): Promise<User> => {
  try {
    const response = await api.put<any>(`/${id}`, userData);
    return response.data.data;
  } catch (error: any) {
    // The API's error envelope is { success:false, error }, not .message —
    // surface the real reason (e.g. "Email already in use") when it's there.
    throw new Error(error.response?.data?.error || error.response?.data?.message || 'Failed to update account');
  }
};

// Add this function to your authApi.ts

export const getUserById = async (id: string): Promise<User> => {
  try {
    const response = await api.get<any>(`/${id}`);
    return response.data.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.message || 'Failed to fetch user');
  }
};
