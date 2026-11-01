import apiClient from './apiClient';
import globals from './globals';

/**
 * Notifications API (LT-527) — 1:1 with `/api/notifications`: the newest
 * messages the system sent this owner. Primary data, so these THROW on
 * failure and the page decides what to show.
 */
export interface OwnerNotification {
  _id: string;
  event: string;
  title: string;
  body: string;
  /** The dashboard page a tap opens; empty for none. */
  url: string;
  read: boolean;
  createdAt: string;
}

const authHeaders = () => {
  // LT-009: the cookie authenticates; the Bearer is a pre-cookie shim (2027-02).
  const token = localStorage.getItem('lightor');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const request = () => ({ withCredentials: true, headers: authHeaders() });

export const fetchNotifications = async (): Promise<{ data: OwnerNotification[]; unread: number }> =>
  (await apiClient.get(globals.notificationsUrl, request())).data;

export const fetchUnreadNotifications = async (): Promise<number> =>
  (await apiClient.get(`${globals.notificationsUrl}unread`, request())).data.unread;

export const markNotificationsRead = async (): Promise<void> => {
  await apiClient.post(`${globals.notificationsUrl}read`, undefined, request());
};
