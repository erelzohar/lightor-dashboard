import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { Appointment, AppointmentType } from '../../types';
import * as appointmentsApi from '../../services/appointmentsApi';
import { MOCK_APPOINTMENTS, MOCK_APPOINTMENT_TYPES } from '../../utils/mockData';

interface AppointmentsState {
  appointments: Appointment[];
  appointmentTypes: AppointmentType[];
  loading: boolean;
  error: string | null;
}

const initialState: AppointmentsState = {
  appointments: MOCK_APPOINTMENTS,
  appointmentTypes: MOCK_APPOINTMENT_TYPES,
  loading: false,
  error: null,
};

/* ------------------ Existing Thunks ------------------ */

export const fetchAppointments = createAsyncThunk<
  Appointment[],
  {
    user_id: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
    sort?: string;
  }
>(
  'appointments/fetchAppointments',
  async ({ user_id, startDate, endDate, page, limit, sort }) => {
    const response = await appointmentsApi.getAppointments({
      user_id,
      startDate,
      endDate,
      page,
      limit,
      sort,
    });

    // const now = Date.now();
    // response.forEach(a => {
    //   if (a.status === 'scheduled' && +a.timestamp < now) {
    //     try {
    //       // appointmentsApi.updateAppointmentStatus(a._id, 'completed');
    //       a.status = 'completed';
    //     } catch (err) {
    //       console.error('Failed to update appointment status:', err);
    //     }
    //   }
    // });
    return response;
  }
);

export const fetchAppointmentTypes = createAsyncThunk<AppointmentType[], { webConfig_id: string }>(
  'appointments/fetchAppointmentTypes',
  async ({ webConfig_id }) => {
    const response = await appointmentsApi.getAppointmentTypes(webConfig_id);    
    return response;
  }
);

export const updateAppointmentStatus = createAsyncThunk(
  'appointments/updateStatus',
  async ({ id, status }: { id: string; status: 'scheduled' | 'completed' | 'cancelled' }) => {
    const response = await appointmentsApi.updateAppointmentStatus(id, status);
    return response;
  }
);

/* ------------------ NEW: Appointment Type CRUD ------------------ */

export const createAppointmentType = createAsyncThunk(
  'appointments/createAppointmentType',
  async (data: Omit<AppointmentType, '_id'>) => {
    const response = await appointmentsApi.createAppointmentType(data);
    return response;
  }
);

export const updateAppointmentType = createAsyncThunk(
  'appointments/updateAppointmentType',
  async ({ id, data }: { id: string; data: Partial<AppointmentType> }) => {
    const response = await appointmentsApi.updateAppointmentType(id, data);
    return response;
  }
);

export const deleteAppointmentType = createAsyncThunk(
  'appointments/deleteAppointmentType',
  async (id: string) => {
    await appointmentsApi.deleteAppointmentType(id);
    return id;
  }
);

/* ------------------ Slice ------------------ */

const appointmentsSlice = createSlice({
  name: 'appointments',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      /* ---- Existing Appointment Fetch / Update ---- */
      .addCase(fetchAppointments.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchAppointments.fulfilled, (state, action) => {
        state.appointments = action.payload;
        state.loading = false;
        state.error = null;
      })
      .addCase(fetchAppointments.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch appointments';
      })
      .addCase(fetchAppointmentTypes.fulfilled, (state, action) => {
        state.appointmentTypes = action.payload;
      })
      .addCase(updateAppointmentStatus.fulfilled, (state, action) => {
        const index = state.appointments.findIndex(app => app._id === action.payload._id);
        if (index !== -1) {
          state.appointments[index] = action.payload;
        }
      })
      .addCase(createAppointmentType.fulfilled, (state, action) => {
        state.appointmentTypes.push(action.payload);
      })
      .addCase(updateAppointmentType.fulfilled, (state, action) => {
        const index = state.appointmentTypes.findIndex(type => type._id === action.payload._id);
        if (index !== -1) {
          state.appointmentTypes[index] = action.payload;
        }
      })
      .addCase(deleteAppointmentType.fulfilled, (state, action) => {
        state.appointmentTypes = state.appointmentTypes.filter(type => type._id !== action.payload);
      });
  },
});

export default appointmentsSlice.reducer;
