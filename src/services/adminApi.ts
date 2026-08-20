import axios from 'axios';
import globals from './globals';
import { PlanLimits } from './entitlementsApi';

/**
 * Operator admin panel API (LT-058). Every call maps 1:1 onto
 * `/api/admin/*` on the backend, which sits behind `authorize('admin')` —
 * the AdminRoute guard in the client is UX, this API is the real boundary.
 *
 * Unlike entitlementsApi (decorative, swallow-and-null), admin pages need
 * real failures: every function here THROWS on error and the pages catch
 * and toast.
 */

// ---------------------------------------------------------------- plumbing --

const authHeaders = () => {
  // LT-009: the cookie authenticates; the Bearer is a pre-cookie shim (2027-02).
  const token = localStorage.getItem('lightor');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const get = async <T>(path: string, params?: Record<string, unknown>): Promise<T> => {
  const response = await axios.get(`${globals.adminUrl}${path}`, {
    withCredentials: true,
    headers: authHeaders(),
    params,
  });
  return response.data as T;
};

const send = async <T>(
  method: 'post' | 'patch' | 'delete',
  path: string,
  body?: Record<string, unknown>
): Promise<T> => {
  const response = await axios.request({
    method,
    url: `${globals.adminUrl}${path}`,
    withCredentials: true,
    headers: authHeaders(),
    data: body,
  });
  return response.data as T;
};

// ------------------------------------------------------------------- types --

export interface Paginated<T> {
  success: boolean;
  count: number;
  pagination: { total: number; page: number; limit: number; pages: number };
  data: T[];
}

export interface AdminOverview {
  totals: {
    businesses: number;
    verified: number;
    byBoardingStatus: Record<string, number>;
    bySubscriptionStatus: Record<string, number>;
    appointmentsTotal: number;
    appointmentsThisMonth: number;
  };
  funnel: { signedUp: number; onboarded: number; verified: number; paying: number };
  mrr: { activeMonthly: number; activeYearly: number; mrrILS: number; estimated: boolean };
  paddleEnv: 'sandbox' | 'production';
}

export interface TimeseriesPoint {
  date: string;
  count: number;
}

export interface AppointmentSeriesPoint {
  date: string;
  scheduled: number;
  cancelled: number;
}

export interface TopBusiness {
  userId: string;
  bookings: number;
  name?: string;
  email?: string;
  subscriptionStatus?: string;
  businessName?: string;
  subDomain?: string;
}

export interface AdminSubscription {
  status: 'free' | 'active' | 'past_due' | 'canceled' | 'deleted';
  priceId?: string;
  customerId?: string;
  subscriptionId?: string;
  nextBillDate?: string;
  cancelAtPeriodEnd?: boolean;
}

export interface AdminUserRow {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  role: 'admin' | 'client' | 'user';
  isVerified: boolean;
  boardingStatus: 'new' | 'onboarded' | 'active';
  subscription: AdminSubscription;
  defaultLanguage: string;
  channelType?: 'sms' | 'whatsapp';
  webConfig_id?: string;
  createdAt: string;
  updatedAt: string;
  businessName?: string;
  subDomain?: string;
}

export interface AdminRecentAppointment {
  _id: string;
  name: string;
  phone: string;
  timestamp: string;
  status: string;
  channelType?: string;
  createdAt: string;
}

export interface AdminUserDetail {
  user: AdminUserRow;
  webConfig: { businessName: string; subDomain: string; createdAt: string } | null;
  plan: 'free' | 'plus';
  limits: PlanLimits;
  usage: { appointmentsThisMonth: number; servicesCount: number; aiGenerationsThisMonth: number };
  counts: { appointmentsTotal: number; lastBookedAt: string | null };
  recentAppointments: AdminRecentAppointment[];
}

export interface AdminAppointmentRow {
  _id: string;
  name: string;
  phone: string;
  timestamp: string;
  scheduledAt: string | null;
  status: 'scheduled' | 'cancelled' | 'completed';
  channelType?: string;
  createdAt: string;
  user_id: string;
  ownerName?: string;
  ownerEmail?: string;
  businessName?: string;
  subDomain?: string;
  typeName?: string;
  typePrice?: string;
}

export interface SubscriptionsSummary {
  byStatus: Record<string, number>;
  activeMonthly: number;
  activeYearly: number;
  mrrILS: number;
  estimated: boolean;
  paddleEnv: 'sandbox' | 'production';
}

export interface CostsSummary {
  month: string;
  estimated: boolean;
  variable: {
    sms: { count: number; costILS: number };
    whatsapp: { count: number; costILS: number };
    email: { count: number; costILS: number };
    ai: { calls: number; inputTokens: number; outputTokens: number; costILS: number };
  };
  fixedILS: number;
  variableILS: number;
  totalILS: number;
  days: { date: string; costILS: number }[];
}

export interface TenantCost {
  userId: string;
  costILS: number;
  counts: { sms: number; whatsapp: number; email: number; ai: number };
  name?: string;
  email?: string;
  subscriptionStatus?: string;
  businessName?: string;
  subDomain?: string;
}

export interface LiveSubscriptionItem {
  quantity: number;
  productName?: string;
  priceName?: string;
  /** Major units — ₪119 arrives as 119. */
  amount: number;
  currencyCode?: string;
  interval?: string;
  frequency?: number;
}

export interface LiveSubscription {
  id: string;
  status: string;
  currencyCode?: string;
  startedAt?: string | null;
  nextBilledAt?: string | null;
  canceledAt?: string | null;
  pausedAt?: string | null;
  currentPeriod: { startsAt?: string; endsAt?: string } | null;
  billingCycle: { frequency?: number; interval?: string } | null;
  scheduledChange: { action?: string; effectiveAt?: string | null } | null;
  items: LiveSubscriptionItem[];
  managementUrls: { updatePaymentMethod?: string; cancel?: string } | null;
}

export interface LiveTransaction {
  id: string;
  status: string;
  origin?: string;
  billedAt?: string | null;
  createdAt?: string;
  invoiceNumber?: string | null;
  currencyCode?: string;
  total: number;
}

export interface UserBilling {
  subscription: LiveSubscription | null;
  transactions: LiveTransaction[];
  /** The stored subscription id is one Paddle no longer knows (wiped sandbox / deleted). */
  stale?: boolean;
}

export interface AdminUsersQuery {
  page?: number;
  limit?: number;
  search?: string;
  subscriptionStatus?: string;
  boardingStatus?: string;
  verified?: 'true' | 'false';
  sort?: string;
  order?: 'asc' | 'desc';
}

export interface AdminAppointmentsQuery {
  page?: number;
  limit?: number;
  userId?: string;
  status?: string;
  from?: string;
  to?: string;
  sort?: 'timestamp' | 'createdAt';
  order?: 'asc' | 'desc';
}

// ------------------------------------------------------------------- calls --

export const fetchOverview = async (): Promise<AdminOverview> =>
  (await get<{ data: AdminOverview }>('overview')).data;

export const fetchTimeseries = async (
  metric: 'signups' | 'appointments',
  interval: 'day' | 'month',
  from?: string,
  to?: string
): Promise<TimeseriesPoint[]> =>
  (await get<{ data: TimeseriesPoint[] }>('overview/timeseries', { metric, interval, from, to })).data;

export const fetchTopBusinesses = async (limit = 10): Promise<TopBusiness[]> =>
  (await get<{ data: TopBusiness[] }>('overview/top-businesses', { limit })).data;

export const fetchUsers = async (query: AdminUsersQuery = {}): Promise<Paginated<AdminUserRow>> =>
  get<Paginated<AdminUserRow>>('users', query as Record<string, unknown>);

export const fetchUser = async (id: string): Promise<AdminUserDetail> =>
  (await get<{ data: AdminUserDetail }>(`users/${id}`)).data;

export const verifyUserEmail = async (id: string): Promise<void> => {
  await send('post', `users/${id}/verify-email`);
};

export const changeUserRole = async (id: string, role: 'admin' | 'user' | 'client'): Promise<void> => {
  await send('patch', `users/${id}/role`, { role });
};

export const cancelUserSubscription = async (
  id: string,
  effectiveFrom: 'next_billing_period' | 'immediately' = 'next_billing_period'
): Promise<{ activeUntil: string | null }> =>
  (await send<{ data: { activeUntil: string | null } }>('post', `users/${id}/subscription/cancel`, {
    effectiveFrom,
  })).data;

export const resumeUserSubscription = async (id: string): Promise<void> => {
  await send('post', `users/${id}/subscription/resume`);
};

export const deleteUser = async (id: string, confirmEmail: string): Promise<void> => {
  await send('delete', `users/${id}`, { confirmEmail });
};

export const fetchUserBilling = async (id: string): Promise<UserBilling> =>
  (await get<{ data: UserBilling }>(`users/${id}/billing`)).data;

export const fetchInvoiceUrl = async (transactionId: string): Promise<string> =>
  (await get<{ data: { url: string } }>(`billing/invoice/${transactionId}`)).data.url;

export const fetchAppointments = async (
  query: AdminAppointmentsQuery = {}
): Promise<Paginated<AdminAppointmentRow>> =>
  get<Paginated<AdminAppointmentRow>>('appointments', query as Record<string, unknown>);

export const fetchAppointmentsSeries = async (
  interval: 'day' | 'month',
  from?: string,
  to?: string,
  userId?: string
): Promise<AppointmentSeriesPoint[]> =>
  (await get<{ data: AppointmentSeriesPoint[] }>('appointments/timeseries', {
    interval,
    from,
    to,
    userId,
  })).data;

export const fetchSubscriptions = async (
  query: { page?: number; limit?: number; status?: string } = {}
): Promise<Paginated<AdminUserRow> & { summary: SubscriptionsSummary }> =>
  get<Paginated<AdminUserRow> & { summary: SubscriptionsSummary }>(
    'subscriptions',
    query as Record<string, unknown>
  );

export const fetchCostsSummary = async (month?: string): Promise<CostsSummary> =>
  (await get<{ data: CostsSummary }>('costs/summary', month ? { month } : undefined)).data;

export const fetchCostsByTenant = async (
  month?: string,
  limit = 20
): Promise<TenantCost[]> =>
  (await get<{ data: { month: string; tenants: TenantCost[] } }>('costs/by-tenant', {
    ...(month ? { month } : {}),
    limit,
  })).data.tenants;
