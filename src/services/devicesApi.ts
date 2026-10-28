import apiClient from './apiClient';
import globals from './globals';

/**
 * Push device registry (LT-129, mobile plan phase 2 §1).
 *
 * `POST /api/devices` upserts on `token`, so re-registering on every launch
 * and on FCM token refresh is the intended usage. `DELETE /api/devices/:token`
 * on logout stops pushes for an account the phone no longer holds.
 */
export interface RegisterDeviceBody {
  token: string;
  platform: 'ios' | 'android' | 'web';
  locale?: string;
  appVersion?: string;
}

export const registerDevice = async (body: RegisterDeviceBody): Promise<void> => {
  const response = await apiClient.post(globals.devicesUrl, body);
  if (!response.data?.success) throw new Error('Device registration failed');
};

export const unregisterDevice = async (token: string): Promise<void> => {
  await apiClient.delete(`${globals.devicesUrl}${encodeURIComponent(token)}`);
};
