import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { Vacation } from '../../types';
import * as vacationsApi from '../../services/vacationsApi';

interface VacationsState {
  data: Vacation[];
  selectedVacation: Vacation | null;
  loading: boolean;
  error: string | null;
}

const initialState: VacationsState = {
  data: [],
  selectedVacation: null,
  loading: false,
  error: null,
};

// === CRUD Thunks ===

// Fetch all vacations
export const fetchVacations = createAsyncThunk(
  'vacations/fetchAll',
  async () => {
    const response = await vacationsApi.getVacations();
    return response;
  }
);

// Fetch single vacation by ID
export const fetchVacationById = createAsyncThunk(
  'vacations/fetchById',
  async (id: string) => {
    const response = await vacationsApi.getVacationById(id);
    return response;
  }
);

// Create new vacation
export const createVacation = createAsyncThunk(
  'vacations/create',
  async (vacation: Omit<Vacation, '_id'>) => {
    const response = await vacationsApi.createVacation(vacation);
    return response;
  }
);

// Update vacation
export const updateVacation = createAsyncThunk(
  'vacations/update',
  async (vacation: Vacation) => {
    const response = await vacationsApi.updateVacation(vacation);
    return response;
  }
);

// Delete vacation
export const deleteVacation = createAsyncThunk(
  'vacations/delete',
  async (id: string) => {
    await vacationsApi.deleteVacation(id);
    return id;
  }
);

const vacationsSlice = createSlice({
  name: 'vacations',
  initialState,
  reducers: {
    clearSelectedVacation: (state) => {
      state.selectedVacation = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // === Fetch all ===
      .addCase(fetchVacations.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchVacations.fulfilled, (state, action) => {
        state.data = action.payload;
        state.loading = false;
        state.error = null;
      })
      .addCase(fetchVacations.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch vacations';
      })

      // === Fetch by ID ===
      .addCase(fetchVacationById.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchVacationById.fulfilled, (state, action) => {
        state.selectedVacation = action.payload;
        state.loading = false;
        state.error = null;
      })
      .addCase(fetchVacationById.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch vacation';
      })

      // === Create ===
      .addCase(createVacation.fulfilled, (state, action) => {
        state.data.push(action.payload);
      })
      .addCase(createVacation.rejected, (state, action) => {
        state.error = action.error.message || 'Failed to create vacation';
      })

      // === Update ===
      .addCase(updateVacation.fulfilled, (state, action) => {
        const index = state.data.findIndex(v => v._id === action.payload._id);
        if (index !== -1) state.data[index] = action.payload;
        if (state.selectedVacation?._id === action.payload._id) {
          state.selectedVacation = action.payload;
        }
      })
      .addCase(updateVacation.rejected, (state, action) => {
        state.error = action.error.message || 'Failed to update vacation';
      })

      // === Delete ===
      .addCase(deleteVacation.fulfilled, (state, action) => {
        state.data = state.data.filter(v => v._id !== action.payload);
        if (state.selectedVacation?._id === action.payload) {
          state.selectedVacation = null;
        }
      })
      .addCase(deleteVacation.rejected, (state, action) => {
        state.error = action.error.message || 'Failed to delete vacation';
      });
  },
});

export const { clearSelectedVacation } = vacationsSlice.actions;
export default vacationsSlice.reducer;
