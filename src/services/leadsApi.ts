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
