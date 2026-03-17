import axios from 'axios';
import { Vacation } from '../types';
import globals from './globals';

// Create axios instance for vacations
const api = axios.create({
  baseURL: globals.vacationsUrl,
});

// Add interceptor to attach token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('ezlines');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});


// Get all vacations
export const getVacations = async (): Promise<Vacation[]> => {
  try {
    const res = await api.get('/');
    return res.data.data;
  } catch (err) {
    console.error('Failed to fetch vacations:', err);
    throw err;
  }
};

// Get vacation by ID
export const getVacationById = async (id: string): Promise<Vacation> => {
  if (!id) throw new Error('Vacation ID is required');
  try {
    const res = await api.get(id);
    return res.data.data;
  } catch (err) {
    console.error('Failed to fetch vacation:', err);
    throw err;
  }
};

// Create new vacation
export const createVacation = async (
  vacation: Omit<Vacation, '_id'>
): Promise<Vacation> => {
  try {
    const res = await api.post('/', vacation);
    return res.data.data;
  } catch (err) {
    console.error('Failed to create vacation:', err);
    throw err;
  }
};

// Update existing vacation
export const updateVacation = async (
  vacation: Vacation
): Promise<Vacation> => {
  if (!vacation._id) throw new Error('Vacation ID is required for update');
  try {
    const res = await api.put(vacation._id, vacation);
    return res.data.data;
  } catch (err) {
    console.error('Failed to update vacation:', err);
    throw err;
  }
};

// Delete vacation by ID
export const deleteVacation = async (id: string): Promise<void> => {
  if (!id) throw new Error('Vacation ID is required for delete');
  try {
    await api.delete(id);
  } catch (err) {
    console.error('Failed to delete vacation:', err);
    throw err;
  }
};
