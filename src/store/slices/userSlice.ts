import { createSlice } from '@reduxjs/toolkit';
import { User } from '../../types';

/**
 * Residual slice. It once carried a `login` thunk wired to a FAKE login
 * (hardcoded anna/123456 resolving a canned JWT — see LT-021) and an
 * `updateAccount` thunk calling a function that did not exist; both were
 * dead code and are gone. What remains is the one export with a real
 * consumer: `logout`, dispatched by AuthContext to reset store state.
 */
interface UserState {
  user: User | null;
  loading: boolean;
  error: string | null;
}

const initialState: UserState = {
  user: null,
  loading: false,
  error: null,
};

const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {
    logout: (state) => {
      state.user = null;
    },
  },
});

export const { logout } = userSlice.actions;
export default userSlice.reducer;
