import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { Appointment, AppointmentType } from '../../types';
import * as appointmentsApi from '../../services/appointmentsApi';
import { MOCK_APPOINTMENTS, MOCK_APPOINTMENT_TYPES, USE_MOCK_DATA } from '../../utils/mockData';

interface AppointmentsState {
  appointments: Appointment[];
  appointmentTypes: AppointmentType[];
  loading: boolean;
  /** The appointments have been read at least once (LT-331): before that an empty list means "not yet", not "none". */
  loaded: boolean;
  /** The services are being read (LT-358): a second ask waits for this one. */
  typesLoading: boolean;
  error: string | null;
}

const initialState: AppointmentsState = {
  // ⚠️ DUMMY DATA (LT-021) — the appointment list, calendar and stats widgets
  // start populated with fabricated rows and keep showing them until a real
  // fetch replaces them (and indefinitely if that fetch fails). Set
  // USE_MOCK_DATA to false in utils/mockData.ts to start empty instead.
  appointments: USE_MOCK_DATA ? MOCK_APPOINTMENTS : [],
  appointmentTypes: USE_MOCK_DATA ? MOCK_APPOINTMENT_TYPES : [],
  loading: false,
  loaded: USE_MOCK_DATA,
  typesLoading: false,
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
  },
  {
    // Asked for by the page and by each class-session reader at once (LT-358):
    // one request is enough.
    condition: (_, { getState }) => !(getState() as { appointments?: AppointmentsState }).appointments?.typesLoading,
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
  reducers: {
    loadMockData: (state) => {
      state.appointments = MOCK_APPOINTMENTS;
      state.appointmentTypes = MOCK_APPOINTMENT_TYPES;
    },
  },
  extraReducers: (builder) => {
    builder
      /* ---- Existing Appointment Fetch / Update ---- */
      .addCase(fetchAppointments.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchAppointments.fulfilled, (state, action) => {
        state.appointments = action.payload;
        state.loading = false;
        state.loaded = true;
        state.error = null;
      })
      .addCase(fetchAppointments.rejected, (state, action) => {
        state.loading = false;
        state.loaded = true;
        state.error = action.error.message || 'Failed to fetch appointments';
      })
      .addCase(fetchAppointmentTypes.pending, (state) => {
        state.typesLoading = true;
      })
      .addCase(fetchAppointmentTypes.fulfilled, (state, action) => {
        state.appointmentTypes = action.payload;
        state.typesLoading = false;
      })
      .addCase(fetchAppointmentTypes.rejected, (state) => {
        state.typesLoading = false;
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

export const { loadMockData } = appointmentsSlice.actions;
export default appointmentsSlice.reducer;
