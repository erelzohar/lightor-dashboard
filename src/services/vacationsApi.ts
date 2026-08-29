import apiClient from './apiClient';
import { Vacation } from '../types';
import globals from './globals';

const URL = globals.vacationsUrl;

// Get all vacations
export const getVacations = async (): Promise<Vacation[]> => {
  try {
    const res = await apiClient.get(URL);
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
    const res = await apiClient.get(`${URL}${id}`);
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
    const res = await apiClient.post(URL, vacation);
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
    const res = await apiClient.put(`${URL}${vacation._id}`, vacation);
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
    await apiClient.delete(`${URL}${id}`);
  } catch (err) {
    console.error('Failed to delete vacation:', err);
    throw err;
  }
};
