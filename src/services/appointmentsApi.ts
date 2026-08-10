import axios from 'axios';
import { AppointmentType, Appointment } from '../types';
import globals from './globals';

// Create an axios instance with default config for appointments
const api = axios.create({
  baseURL: globals.appointmentsUrl,
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

// Create an axios instance with default config for appointments types
const typesApi = axios.create({
  baseURL: globals.typesUrl,
  withCredentials: true,
});

// Add request interceptor to include the token with each request
typesApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('lightor');

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

/* ------------------ Appointment Types ------------------ */

export const getAppointmentTypes = async (webConfig_id: string): Promise<AppointmentType[]> => {
  try {
    const res = await typesApi.get('webconfig/' + webConfig_id);
    return res.data.data;
  } catch (err) {
    console.error('Failed to fetch appointment types:', err);
    throw err;
  }
};

export const createAppointmentType = async (
  data: Omit<AppointmentType, '_id'>
): Promise<AppointmentType> => {
  try {
    const res = await typesApi.post('/', data);
    return res.data.data;
  } catch (err) {
    console.error('Failed to create appointment type:', err);
    throw err;
  }
};

export const updateAppointmentType = async (
  id: string,
  data: Partial<AppointmentType>
): Promise<AppointmentType> => {
  try {
    const res = await typesApi.put(id, data);
    return res.data.data;
  } catch (err) {
    console.error('Failed to update appointment type:', err);
    throw err;
  }
};

export const deleteAppointmentType = async (id: string): Promise<void> => {
  try {
    await typesApi.delete(id);
  } catch (err) {
    console.error('Failed to delete appointment type:', err);
    throw err;
  }
};

/* ------------------ Appointments ------------------ */

export const getAppointments = async ({
  user_id,
  startDate,
  endDate,
  page,
  limit,
  sort,
}: {
  user_id: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
  sort?: string;
}): Promise<Appointment[]> => {
  try {
    if (!user_id) throw "user_id required";
    const response = await api.get('/', {
      params: {
        user_id,
        startDate,
        endDate,
        page,
        limit,
        sort,
      },
    });
    return response.data.data;
  } catch (error) {
    console.error('Failed to fetch appointments:', error);
    throw error;
  }
};


export const updateAppointmentStatus = async (
  id: string,
  status: 'scheduled' | 'completed' | 'cancelled'
): Promise<Appointment> => {
  if (!id) return;
  try {
    const res = await await api.put(id, { status });
    return res.data.data;
  }
  catch (err) {
    console.log(err);
    throw err;
  }
};