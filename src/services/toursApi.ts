import apiClient from './apiClient';
import globals from './globals';

/**
 * Lighty's page tours (LT-389), 1:1 with `PATCH /api/users/me/tours`: the
 * tours an owner has been through and the off switch live on the account,
 * so the web and the app agree.
 */
export interface ToursState {
  seen: string[];
  off: boolean;
}

const patchTours = async (body: { seen?: string[]; off?: boolean; reset?: boolean }): Promise<ToursState> => {
  const response = await apiClient.patch<{ data: { tours: ToursState } }>(`${globals.usersUrl}me/tours`, body);
  return response.data.data.tours;
};

/** A tour was finished or skipped: never again on this account. */
export const markTourSeen = (id: string): Promise<ToursState> => patchTours({ seen: [id] });

/** Tours off (or back on) everywhere. */
export const setToursOff = (off: boolean): Promise<ToursState> => patchTours({ off });

/** Every tour again, from the start, and tours on. */
export const restartTours = (): Promise<ToursState> => patchTours({ reset: true, off: false });
