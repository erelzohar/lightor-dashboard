import apiClient from './apiClient';
import { User } from '../types';
import globals from './globals';

const URL = globals.usersUrl;

export const updateUserInfo = async (id: string, userData: Partial<User>): Promise<User> => {
  try {
    const response = await apiClient.put<any>(`${URL}${id}`, userData);
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
    const response = await apiClient.get<any>(`${URL}${id}`);
    return response.data.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.message || 'Failed to fetch user');
  }
};
