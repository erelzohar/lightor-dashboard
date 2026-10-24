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

/**
 * `appDefault` (LT-455): this was the account's first phone with the app,
 * so the server just turned the booking emails off.
 */
export const registerDevice = async (body: RegisterDeviceBody): Promise<{ appDefault: boolean }> => {
  const response = await apiClient.post(globals.devicesUrl, body);
  if (!response.data?.success) throw new Error('Device registration failed');
  return { appDefault: response.data.appDefault === true };
};

export const unregisterDevice = async (token: string): Promise<void> => {
  await apiClient.delete(`${globals.devicesUrl}${encodeURIComponent(token)}`);
};
