import apiClient from './apiClient';
import { Vacation } from '../types';
import globals from './globals';

const URL = globals.vacationsUrl;

// A site's vacations. The API lists them only by the site: GET /api/vacations/:webConfigId
// (LT-626: a bare GET /api/vacations/ answered 404, and the API has no route
// for one vacation by its id either).
export const getVacations = async (webConfigId: string): Promise<Vacation[]> => {
  if (!webConfigId) throw new Error('webConfig id is required');
  try {
    const res = await apiClient.get(`${URL}${webConfigId}`);
    return res.data.data;
  } catch (err) {
    console.error('Failed to fetch vacations:', err);
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
