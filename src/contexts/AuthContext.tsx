import React, { createContext, useContext, useState, useEffect } from 'react';
import { jwtDecode } from 'jwt-decode';
import { AuthState, User } from '../types';
import { loginUser, googleLogin, facebookLogin, changePassword, getCurrentUser } from '../services/authApi';
import { updateUserInfo } from '../services/userApi';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch } from '../hooks/useAppDispatch';
import { logout as storeLogout } from '../store/slices/userSlice';
interface AuthContextType {
  auth: AuthState;
  login: (username: string, password: string) => Promise<void>;
  loginWithGoogle: (token: string) => Promise<void>;
  loginWithFacebook: (accessToken: string) => Promise<void>;
  logout: () => void;
  loading: boolean;
  updateUser: (userData: Partial<User>) => Promise<void>;
  updatePassword: (currentPassword: string, newPassword: string, confirmNewPassword: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [auth, setAuth] = useState<AuthState>({
    user: null,
    token: null,
    isAuthenticated: false,
    isLoading: true,
    error: null,
  });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  // Initial authentication check (runs ONLY on first load)
  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('lightor');

      if (token) {
        try {
          const user = await getCurrentUser();
          setAuth({
            user,
            token,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });
        } catch (error) {
          localStorage.removeItem('lightor');
          setAuth({
            user: null,
            token: null,
            isAuthenticated: false,
            isLoading: false,
            error: 'Invalid token',
          });
        }
      } else {
        setAuth(prev => ({ ...prev, isLoading: false }));
      }
    };

    initAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = async (username: string, password: string) => {
    setLoading(true);
    try {
      const { token } = await loginUser(username, password);
      localStorage.setItem('lightor', token);
      const user = await getCurrentUser();

      setAuth({
        user,
        token,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });

      navigate('/dashboard', { replace: true });
    } catch (error) {
      setAuth(prev => ({
        ...prev,
        error: 'Invalid credentials',
        isLoading: false,
      }));
    } finally {
      setLoading(false);
    }
  };

  const loginWithGoogle = async (credential: string) => {
    setLoading(true);
    try {
      const { token } = await googleLogin(credential);
      localStorage.setItem('lightor', token);
      const user = await getCurrentUser();

      setAuth({
        user,
        token,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });

      navigate('/dashboard', { replace: true });
    } catch (error) {
      setAuth(prev => ({
        ...prev,
        error: 'Google login failed',
        isLoading: false,
      }));
    } finally {
      setLoading(false);
    }
  };

  const loginWithFacebook = async (accessToken: string) => {
    setLoading(true);
    try {
      const { token } = await facebookLogin(accessToken);
      localStorage.setItem('lightor', token);
      const user = await getCurrentUser();

      setAuth({
        user,
        token,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });

      navigate('/dashboard', { replace: true });
    } catch (error) {
      setAuth(prev => ({
        ...prev,
        error: 'Facebook login failed',
        isLoading: false,
      }));
    } finally {
      setLoading(false);
    }
  };

  const updateUser = async (userData: Partial<User>) => {
    if (!auth.user) return;

    try {
      const updatedUser = await updateUserInfo(auth.user._id, userData);
      setAuth(prev => ({
        ...prev,
        user: { ...prev.user!, ...updatedUser }
      }));
    } catch (error: any) {
      throw new Error(error.message || 'Failed to update user account');
    }
  };

  const updatePassword = async (currentPassword: string, newPassword: string, confirmNewPassword: string) => {
    try {
      const response = await changePassword(currentPassword, newPassword, confirmNewPassword);
      if (response.success && response.token) {
        localStorage.setItem('lightor', response.token);
        const decoded = jwtDecode<{ user: User }>(response.token);
        setAuth(prev => ({
          ...prev,
          user: decoded.user,
          token: response.token!
        }));
      }
    } catch (error: any) {
      throw new Error(error.message || 'Failed to update password');
    }
  };

  const logout = () => {
    localStorage.removeItem('lightor');
    setAuth({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    });
    dispatch(storeLogout());
    navigate('/', { replace: true });
  };

  return (
    <AuthContext.Provider value={{ auth, login, loginWithGoogle, loginWithFacebook, logout, loading, updateUser, updatePassword }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
};