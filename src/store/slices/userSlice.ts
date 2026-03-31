import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { User } from '../../types';
import * as userApi from '../../services/userApi';
import * as authApi from '../../services/authApi';

interface UserState {
  user: User | null;
  token: string | null;
  loading: boolean;
  error: string | null;
}

const initialState: UserState = {
  user: null,
  token: localStorage.getItem('lightor'),
  loading: false,
  error: null,
};

export const login = createAsyncThunk(
  'user/login',
  async ({ username, password }: { username: string; password: string }) => {
    const response = await userApi.loginUser(username, password);
    localStorage.setItem('lightor', response.token);
    return response;
  }
);

export const updateAccount = createAsyncThunk(
  'user/updateAccount',
  async (userData: Partial<User>) => {
    const response = await authApi.updateUserAccount(userData);
    return response;
  }
);

const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {
    logout: (state) => {
      state.user = null;
      state.token = null;
      localStorage.removeItem('lightor');
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(login.pending, (state) => {
        state.loading = true;
      })
      .addCase(login.fulfilled, (state, action) => {
        state.user = action.payload.user;
        state.token = action.payload.token;
        state.loading = false;
        state.error = null;
      })
      .addCase(login.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Login failed';
      })
      .addCase(updateAccount.fulfilled, (state, action) => {
        state.user = action.payload;
      });
  },
});

export const { logout } = userSlice.actions;
export default userSlice.reducer;