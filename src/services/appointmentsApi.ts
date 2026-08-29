import apiClient from './apiClient';
import { AppointmentType, Appointment } from '../types';
import globals from './globals';

const APPOINTMENTS_URL = globals.appointmentsUrl;
const TYPES_URL = globals.typesUrl;

/* ------------------ Appointment Types ------------------ */

export const getAppointmentTypes = async (webConfig_id: string): Promise<AppointmentType[]> => {
  try {
    const res = await apiClient.get(`${TYPES_URL}webconfig/${webConfig_id}`);
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
    const res = await apiClient.post(TYPES_URL, data);
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
    const res = await apiClient.put(`${TYPES_URL}${id}`, data);
    return res.data.data;
  } catch (err) {
    console.error('Failed to update appointment type:', err);
    throw err;
  }
};

export const deleteAppointmentType = async (id: string): Promise<void> => {
  try {
    await apiClient.delete(`${TYPES_URL}${id}`);
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
    const response = await apiClient.get(APPOINTMENTS_URL, {
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
    const res = await apiClient.put(`${APPOINTMENTS_URL}${id}`, { status });
    return res.data.data;
  }
  catch (err) {
    console.log(err);
    throw err;
  }
};