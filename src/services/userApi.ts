import axios from 'axios';
import { User } from '../types';
import { MOCK_USER } from '../utils/mockData';
import globals from './globals';

// Create an axios instance with default config
const api = axios.create({
  baseURL: globals.usersUrl,
  withCredentials: true,
});

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

/**
 * ⚠️ DUMMY DATA / FAKE LOGIN — DELETE ME (mission LT-021)
 *
 * This is not a real login. It accepts one hardcoded username and password and
 * resolves with a hardcoded, long-expired JWT plus MOCK_USER. It never contacts
 * the API.
 *
 * Currently DEAD: the only caller is the `login` thunk in
 * store/slices/userSlice.ts, which nothing dispatches — AuthContext uses the
 * real services/authApi.ts `loginUser`. It still ships in the bundle, and a
 * hardcoded-credentials code path is the kind of thing that gets wired up by
 * accident later. Remove this and the userSlice thunk together.
 */
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
