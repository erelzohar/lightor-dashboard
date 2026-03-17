import axios from 'axios';
import { User } from '../types';
import { MOCK_USER } from '../utils/mockData';
import globals from './globals';

// Create an axios instance with default config
const api = axios.create({
  baseURL: globals.usersUrl,
});

// Add request interceptor to include the token with each request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('ezlines');

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

export const loginUser = async (username: string, password: string): Promise<{ token: string; user: User }> => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (username === 'anna' && password === '123456') {
        const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2ODIwZTUzZTkzYTM4NzhkMTUzMjhiN2YiLCJuYW1lIjoi15DXoNeUINen15XXodee15jXmden16EiLCJpYXQiOjE2OTMzMjM1NDMsImV4cCI6MTY5MzQwOTk0M30.WYi3tblwMTcRXBA-eYS9MhSQmL2A5F8TuoJjQKSWU9I';

        resolve({
          token,
          user: MOCK_USER,
        });
      } else {
        reject(new Error('Invalid credentials'));
      }
    }, 500);
  });
};

export const validateToken = async (token: string): Promise<User> => {
  try {
    const response = await api.get('/auth/validate-token', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    return response.data.user;
  } catch (error) {
    throw new Error('Invalid token');
  }
};

export const updateUserInfo = async (id: string, userData: Partial<User>): Promise<User> => {
  try {
    const response = await api.put<any>(`/${id}`, userData);
    return response.data.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.message || 'Failed to update account');
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
