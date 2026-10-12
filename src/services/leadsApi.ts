import apiClient from './apiClient';
import globals from './globals';
import type { AppointmentAnswer } from '../types';

/**
 * Leads API (LT-197) — 1:1 with `/api/leads/*`: the messages visitors left
 * through the site's contact form. Primary data, so every function THROWS on
 * failure and the page decides what to show; the API answers with the
 * caller's own leads only.
 */

export type LeadStatus = 'new' | 'contacted' | 'closed';
export const LEAD_STATUSES: LeadStatus[] = ['new', 'contacted', 'closed'];

export interface Lead {
  _id: string;
  name: string;
  phone: string;
  message?: string;
  answers?: AppointmentAnswer[];
  status: LeadStatus;
  createdAt: string;
  updatedAt: string;
}

export interface LeadsPage {
  success: boolean;
  data: Lead[];
  pagination: { total: number; page: number; limit: number; pages: number };
  counts: Record<LeadStatus, number>;
}

/** A leads site's home numbers (LT-274), as `/api/leads/stats` answers them. */
export interface LeadStats {
  /** Since the 1st of this month — the count the free plan's leads meter uses. */
  thisMonth: number;
  /** The previous calendar month. */
  lastMonth: number;
  /** Status 'new', all time. */
  waiting: number;
  /** Created in the last 30 days; handled = moved out of 'new'. */
  last30: { total: number; handled: number };
  /** Arrival to the first move out of 'new', last 30 days; null until one is measured. */
  avgResponseMs: number | null;
  /** 30 Israel calendar days, oldest first, today last. */
  perDay: { date: string; count: number }[];
  /** The contact form's first multiple-choice question over the last 30 days: top 4 and the rest. */
  topic: { label: string; items: { value: string; count: number }[]; other: number } | null;
}

const authHeaders = () => {
  // LT-009: the cookie authenticates; the Bearer is a pre-cookie shim (2027-02).
  const token = localStorage.getItem('lightor');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const fetchLeads = async (params: { status?: LeadStatus; page?: number; limit?: number } = {}): Promise<LeadsPage> => {
  const response = await apiClient.get(globals.leadsUrl, {
    withCredentials: true,
    headers: authHeaders(),
    params,
  });
  return response.data as LeadsPage;
};

export const fetchLeadStats = async (): Promise<LeadStats> => {
  const response = await apiClient.get(`${globals.leadsUrl}stats`, {
    withCredentials: true,
    headers: authHeaders(),
  });
  return response.data.data as LeadStats;
};

export const updateLeadStatus = async (id: string, status: LeadStatus): Promise<Lead> => {
  const response = await apiClient.patch(`${globals.leadsUrl}${id}`, { status }, {
    withCredentials: true,
    headers: authHeaders(),
  });
  return response.data.data as Lead;
};

export const deleteLead = async (id: string): Promise<void> => {
  await apiClient.delete(`${globals.leadsUrl}${id}`, {
    withCredentials: true,
    headers: authHeaders(),
  });
};
