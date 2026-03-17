import { combineReducers, configureStore } from '@reduxjs/toolkit';
import appointmentsReducer from './slices/appointmentsSlice';
import webConfigReducer from './slices/webConfigSlice';
import userReducer, { logout } from './slices/userSlice';
import vacationsReducer from './slices/vacationsSlice';


const appReducer = combineReducers({
  appointments: appointmentsReducer,
  webConfig: webConfigReducer,
  user: userReducer,
  vacations: vacationsReducer,
});

const rootReducer = (state: ReturnType<typeof appReducer> | undefined, action: any) => {
  // When logout is dispatched, clear the entire store
  if (action.type === logout.type) {    
    state = undefined;
  }
  
  return appReducer(state, action);
};

export const store = configureStore({
  reducer: rootReducer,
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;