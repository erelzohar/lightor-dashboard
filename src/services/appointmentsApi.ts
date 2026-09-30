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


export interface CreateAppointmentBody {
  name: string;
  phone: string;
  type_id: string;
  /** Epoch milliseconds as a string, as the API stores it. */
  timestamp: string;
  user_id: string;
  channelType?: 'sms' | 'whatsapp';
  /**
   * Answers to the booking questions (LT-178): key + value. The server takes
   * label and type from the owner's catalog and drops unknown keys. An
   * address chosen from Google's suggestions adds its place (LT-206).
   */
  answers?: { key: string; value: string; placeId?: string; lat?: number; lng?: number }[];
}

/**
 * Owner-made booking (LT-122). A signed-in business books into its own
 * calendar without an OTP; the server refuses a foreign user_id and answers
 * 409 when the slot overlaps an existing appointment — callers turn that
 * into a message rather than an error. A class answers 409 with a `code`
 * (LT-152): CLASS_FULL, ALREADY_BOOKED, NOT_A_SESSION.
 */
export const createAppointment = async (body: CreateAppointmentBody): Promise<Appointment> => {
  const res = await apiClient.post(APPOINTMENTS_URL, body);
  return res.data.data;
};

/** One session of a group class, as the availability endpoint counts it (LT-152). */
export interface ClassSessionAvailability {
  type_id: string;
  /**
   * Epoch ms as a string, computed by the server on the Asia/Jerusalem wall
   * clock. Booked back exactly as received — never rebuilt in the browser.
   */
  timestamp: string;
  durationMS: string;
  capacity: number;
  /** Seats taken: bookings not cancelled. */
  booked: number;
}

/**
 * The class sessions in a window, with their seats (LT-204). The public
 * availability endpoint, addressed by subdomain; signed in as the site's
 * owner it also lists sessions that already started (up to a day back) and
 * ones past the customers' booking window, so a walk-in can still be seated.
 */
export const getClassSessions = async (
  subdomain: string,
  startDate: string,
  endDate: string
): Promise<ClassSessionAvailability[]> => {
  const res = await apiClient.get(`${APPOINTMENTS_URL}availability`, {
    params: { subdomain, startDate, endDate },
  });
  return res.data.classes ?? [];
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