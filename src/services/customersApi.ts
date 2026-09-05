import apiClient from './apiClient';
import globals from './globals';
import { Paginated } from './adminApi';

/**
 * Customers directory API (LT-122) — 1:1 with `/api/customers/*`.
 *
 * Primary data, so like adminApi every function THROWS on failure and the
 * page decides what to show; the API answers with the caller's own customers
 * only, whatever the client asks for.
 */

// ---------------------------------------------------------------- plumbing --

const authHeaders = () => {
  // LT-009: the cookie authenticates; the Bearer is a pre-cookie shim (2027-02).
  const token = localStorage.getItem('lightor');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const get = async <T>(path: string, params?: Record<string, unknown>): Promise<T> => {
  const response = await apiClient.get(`${globals.customersUrl}${path}`, {
    withCredentials: true,
    headers: authHeaders(),
    params,
  });
  return response.data as T;
};

const send = async <T>(method: 'post' | 'patch', path: string, body?: Record<string, unknown>): Promise<T> => {
  const response = await apiClient.request({
    method,
    url: `${globals.customersUrl}${path}`,
    withCredentials: true,
    headers: authHeaders(),
    data: body,
  });
  return response.data as T;
};

/** Does this thrown error carry the given machine-readable `code`? */
export const isApiErrorCode = (error: unknown, code: string): boolean =>
  (error as { response?: { data?: { code?: string } } })?.response?.data?.code === code;

export const apiErrorStatus = (error: unknown): number | undefined =>
  (error as { response?: { status?: number } })?.response?.status;

// ------------------------------------------------------------------- types --

export interface CustomerStats {
  visits: number;
  cancelled: number;
  upcoming: number;
  revenue: number;
  lastVisit: string | null;
  nextVisit: string | null;
}

export interface CustomerRow extends CustomerStats {
  _id: string;
  name: string;
  phone: string;
  phoneNormalized: string;
  isBlocked: boolean;
  blockedAt: string | null;
  source: 'booking' | 'manual';
  firstSeenAt: string;
  lastSeenAt: string;
  createdAt: string;
}

export interface CustomerRecord {
  _id: string;
  name: string;
  phone: string;
  phoneNormalized: string;
  isBlocked: boolean;
  blockedAt: string | null;
  blockReason: string | null;
  notes: string;
  source: 'booking' | 'manual';
  firstSeenAt: string;
  lastSeenAt: string;
  createdAt: string;
}

export interface CustomerHistoryRow {
  _id: string;
  name: string;
  phone: string;
  timestamp: string;
  scheduledAt: string | null;
  status: 'scheduled' | 'cancelled' | 'completed';
  channelType?: 'sms' | 'whatsapp';
  createdAt: string;
  type_id: string;
  typeName?: string;
  typePrice?: string;
  typeDurationMS?: string;
}

export interface CustomerDetail {
  customer: CustomerRecord;
  stats: CustomerStats;
  history: CustomerHistoryRow[];
}

export interface TopCustomer {
  customerId: string | null;
  name: string;
  phone: string;
  visits: number;
  revenue: number;
  isBlocked: boolean;
}

export interface CustomersOverview {
  totals: { customers: number; blocked: number; newThisMonth: number; returning: number };
  top: { byVisits: TopCustomer[]; byRevenue: TopCustomer[] };
}

export type CustomerSort = 'name' | 'lastSeenAt' | 'createdAt' | 'visits' | 'lastVisit';

export interface CustomerListParams {
  page?: number;
  limit?: number;
  search?: string;
  sort?: CustomerSort;
  order?: 'asc' | 'desc';
  blocked?: 'true' | 'false';
}

// --------------------------------------------------------------- functions --

export const fetchCustomers = (params: CustomerListParams): Promise<Paginated<CustomerRow>> =>
  get<Paginated<CustomerRow>>('', params as Record<string, unknown>);

export const fetchCustomerStats = async (limit = 5): Promise<CustomersOverview> =>
  (await get<{ data: CustomersOverview }>('stats', { limit })).data;

export const fetchCustomer = async (id: string): Promise<CustomerDetail> =>
  (await get<{ data: CustomerDetail }>(id)).data;

export const createCustomer = async (body: {
  name: string;
  phone: string;
  isBlocked?: boolean;
  blockReason?: string;
  notes?: string;
}): Promise<CustomerRecord> => (await send<{ data: CustomerRecord }>('post', '', body)).data;

export const setCustomerBlock = (
  id: string,
  body: { isBlocked: boolean; reason?: string; cancelUpcoming?: boolean }
): Promise<{ data: CustomerRecord; cancelledCount: number }> =>
  send<{ data: CustomerRecord; cancelledCount: number }>('patch', `${id}/block`, body);

export const setCustomerNotes = async (id: string, notes: string): Promise<CustomerRecord> =>
  (await send<{ data: CustomerRecord }>('patch', `${id}/notes`, { notes })).data;

/**
 * Downloads the CSV through the authenticated client (a bare <a href> would
 * not carry the Bearer shim) and hands it to the browser as a file.
 */
export const exportCustomersCsv = async (params: Pick<CustomerListParams, 'search' | 'blocked'>): Promise<void> => {
  const response = await apiClient.get(`${globals.customersUrl}export.csv`, {
    withCredentials: true,
    headers: authHeaders(),
    params,
    responseType: 'blob',
  });
  const disposition = (response.headers?.['content-disposition'] as string | undefined) ?? '';
  const match = /filename="([^"]+)"/.exec(disposition);
  const filename = match?.[1] ?? 'customers.csv';

  const url = URL.createObjectURL(response.data as Blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};
