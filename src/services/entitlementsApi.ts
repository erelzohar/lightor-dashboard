import apiClient from './apiClient';
import globals from './globals';

/**
 * The caller's plan, limits and current usage (LT-032). Read-only: limits
 * come from the same server module that enforces them, so whatever this
 * returns is what the API will actually allow.
 */

export interface PlanLimits {
  monthlyAppointments: number | null;
  maxServices: number | null;
  hourlyReminder: boolean;
  aiGenerationsPerMonth: number;
  aiEditsPerMonth: number;
  /** Gemini tokens per month; null = unlimited (every current plan). */
  aiTokensPerMonth: number | null;
  showBranding: boolean;
  /** Customers page: top-customers ranking and CSV export are Plus (LT-125). */
  customerInsights: boolean;
  customerExport: boolean;
}

export interface MyEntitlements {
  /** The resolved plan: under the pilot grant 'plus' with a free subscription. */
  plan: 'free' | 'plus';
  limits: PlanLimits;
  usage: {
    appointmentsThisMonth: number;
    servicesCount: number;
    aiGenerationsThisMonth: number;
    aiTokensThisMonth: number;
  };
  /**
   * Pilot grant (LT-187): while set, the account has every Plus feature free
   * until this ISO date although nothing was bought — `plan` above already
   * reflects it. Null on a paid plan, once the window lapses, or with the
   * grant off. Optional so an API deployed before this build still parses.
   */
  pilot?: { until: string } | null;
}

export const fetchMyEntitlements = async (): Promise<MyEntitlements | null> => {
  // LT-009: the cookie authenticates; the Bearer is a pre-cookie shim (2027-02).
  const token = localStorage.getItem('lightor');
  try {
    const response = await apiClient.get(`${globals.entitlementsUrl}me`, {
      withCredentials: true,
      ...(token ? { headers: { Authorization: `Bearer ${token}` } } : {}),
    });
    return response.data?.success ? (response.data.data as MyEntitlements) : null;
  } catch {
    // The meter is decoration; a failed fetch must never break the page.
    return null;
  }
};
