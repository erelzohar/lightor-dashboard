import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';
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

export const createWebConfig = createAsyncThunk(
  'webConfig/create',
  async (config: Partial<WebConfig>) => {
    const response = await webConfigApi.createWebConfig(config);
    return response;
  }
);

export const updateWebConfig = createAsyncThunk(
  'webConfig/update',
  async (config: Partial<WebConfig> & { _id: string; contactPhoneToken?: string }) => {
    try {
      return await webConfigApi.updateWebConfig(config);
    } catch (err) {
      // The server's own code (LT-404: CONTACT_PHONE_INVALID, PHONE_NOT_VERIFIED,
      // PHONE_MISMATCH) rides on the rejected action's `error.code`, which
      // otherwise carries axios's generic one. The message stays axios's.
      const serverCode = axios.isAxiosError(err) ? (err.response?.data as { code?: unknown } | undefined)?.code : undefined;
      if (typeof serverCode === 'string') throw Object.assign(new Error((err as Error).message), { code: serverCode });
      throw err;
    }
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
      .addCase(createWebConfig.fulfilled, (state, action) => {
        state.data = action.payload;
      })
      .addCase(updateWebConfig.fulfilled, (state, action) => {
        // LT-661: a save never changes the owner's own domain (only
        // /api/domain does), so an answer that does not name it keeps the
        // one the last read brought; the next read is the truth again.
        const servedOn = state.data?._id === action.payload?._id ? state.data?.customHost : undefined;
        state.data = action.payload;
        if (servedOn && state.data && state.data.customHost === undefined) state.data.customHost = servedOn;
      });
  },
});

export default webConfigSlice.reducer;