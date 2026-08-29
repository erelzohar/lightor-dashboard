import apiClient from './apiClient';
import globals from './globals';

/**
 * The owner's ICS subscription feed (LT-044). The URL itself is the
 * credential — the server mints it lazily on first fetch and rotates it on
 * regenerate, killing the old link immediately.
 */

const authHeaders = () => {
  // LT-009: the cookie authenticates; the Bearer is a pre-cookie shim (2027-02).
  const token = localStorage.getItem('lightor');
  return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
};

export const fetchCalendarFeedUrl = async (): Promise<string | null> => {
  try {
    const response = await apiClient.get(`${globals.calendarUrl}feed-info`, {
      withCredentials: true,
      ...authHeaders(),
    });
    return response.data?.success ? (response.data.data.url as string) : null;
  } catch {
    return null;
  }
};

export const regenerateCalendarFeedUrl = async (): Promise<string | null> => {
  try {
    const response = await apiClient.post(
      `${globals.calendarUrl}feed/regenerate`,
      {},
      { withCredentials: true, ...authHeaders() }
    );
    return response.data?.success ? (response.data.data.url as string) : null;
  } catch {
    return null;
  }
};

/**
 * Google Calendar sync (LT-045). `configured:false` means the server has no
 * OAuth credentials — the card hides itself rather than offering a dead
 * button. Connecting is a full-page redirect through Google's consent screen;
 * the server sends the browser back to /settings?gcal=connected|error.
 */
export interface GoogleCalendarStatus {
  configured: boolean;
  connected: boolean;
  revoked: boolean;
  email: string | null;
}

export const fetchGoogleCalendarStatus = async (): Promise<GoogleCalendarStatus | null> => {
  try {
    const response = await apiClient.get(`${globals.calendarUrl}google/status`, {
      withCredentials: true,
      ...authHeaders(),
    });
    return response.data?.success ? (response.data.data as GoogleCalendarStatus) : null;
  } catch {
    return null;
  }
};

export const fetchGoogleConnectUrl = async (): Promise<string | null> => {
  try {
    const response = await apiClient.get(`${globals.calendarUrl}google/connect-url`, {
      withCredentials: true,
      ...authHeaders(),
    });
    return response.data?.success ? (response.data.data.url as string) : null;
  } catch {
    return null;
  }
};

export const disconnectGoogleCalendar = async (): Promise<boolean> => {
  try {
    const response = await apiClient.post(
      `${globals.calendarUrl}google/disconnect`,
      {},
      { withCredentials: true, ...authHeaders() }
    );
    return Boolean(response.data?.success);
  } catch {
    return false;
  }
};
