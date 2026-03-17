import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { WebConfig } from '../../types';
import * as webConfigApi from '../../services/webConfigApi';

interface WebConfigState {
  data: WebConfig | null;
  loading: boolean;
  error: string | null;
}

const initialState: WebConfigState = {
  data: null,
  loading: false,
  error: null,
};

export const fetchWebConfig = createAsyncThunk(
  'webConfig/fetch',
  async (_id: string) => {
    const response = await webConfigApi.getWebConfigById(_id);
    return response;
  }
);

export const updateWebConfig = createAsyncThunk(
  'webConfig/update',
  async (config: Partial<WebConfig> & { _id: string }) => {    
    const response = await webConfigApi.updateWebConfig(config);    
    return response;
  }
);

const webConfigSlice = createSlice({
  name: 'webConfig',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchWebConfig.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchWebConfig.fulfilled, (state, action) => {
        state.data = action.payload;
        state.loading = false;
        state.error = null;
      })
      .addCase(fetchWebConfig.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch web config';
      })
      .addCase(updateWebConfig.fulfilled, (state, action) => {
        state.data = action.payload;
      });
  },
});

export default webConfigSlice.reducer;