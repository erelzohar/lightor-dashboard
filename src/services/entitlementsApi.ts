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
  /** Contact-form leads per month (LT-197); null = unlimited. Absent on an older API. */
  monthlyLeads?: number | null;
  /**
   * The owner's own alerts by SMS or WhatsApp (LT-213) — Plus. Absent on an
   * older API, which reads as allowed: the server decides the channel anyway.
   */
  ownerTextAlerts?: boolean;
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
    /** LT-197; absent on an older API. */
    leadsThisMonth?: number;
  };
  /**
   * Pilot grant (LT-187): while set, the account has every Plus feature free
   * until this ISO date although nothing was bought — `plan` above already
   * reflects it. Null on a paid plan, once the window lapses, or with the
   * grant off. Optional so an API deployed before this build still parses.
   * `upgradeFrom` (LT-290): when the plans open — a week before `until`.
   */
  pilot?: { until: string; upgradeFrom?: string | null } | null;
  /**
   * LT-310: Plus that is not bought — the operator's own account. Nothing is
   * offered or managed for it. Optional so an older API still parses.
   */
  complimentary?: boolean;
  /**
   * LT-458: the bookings made this period, cancelled ones included - a
   * subscriber's month of 500, or a free-period month of 200 (at 200 the
   * site stops taking bookings until a card is added). Null on the free
   * plan, whose own cap is `limits.monthlyAppointments`. `extraAgorot`: what
   * a booking over the 500 costs; null when nothing is charged for it.
   * Optional so an older API still parses.
   */
  bookings?: BookingsMeter | null;
  /**
   * LT-458: what Lightor+ includes, said beside the plans on offer:
   * `included` bookings a month, then `extraAgorot` each (null while nothing
   * is charged for them). Optional so an older API still parses.
   */
  bookingTerms?: { included: number; extraAgorot: number | null };
  /** LT-458: Paddle is retrying a failed payment - no bookings, inquiries or reminders until it is paid. */
  paymentFailed?: boolean;
}

export interface BookingsMeter {
  kind: 'plus' | 'freePeriod';
  used: number;
  included: number;
  periodStart: string;
  periodEnd: string;
  extraAgorot: number | null;
  /** LT-465, a subscriber's period only; absent on an older API. */
  extras?: ExtrasSwitch;
}

/**
 * The owner's switch for the bookings over the 500 (LT-465): `chosen` is the
 * switch, `on` whether extras are taken now, `blockedBy` why they cannot be
 * turned on, `closed` whether online booking stopped at the 500.
 */
export interface ExtrasSwitch {
  chosen: boolean;
  on: boolean;
  // LT-466: an unpaid extras charge, and the free days with a card (the choice is kept, it starts with the first payment).
  blockedBy: 'billingOff' | 'notSubscribed' | 'paymentFailed' | 'chargeFailed' | 'cancelScheduled' | 'trialing' | null;
  changedAt: string | null;
  closed: boolean;
}

/** Turn the extras on or off (LT-465); the meter as it is now. Throws, unlike the read above. */
export const setExtraBookings = async (autoCharge: boolean): Promise<BookingsMeter | null> => {
  const token = localStorage.getItem('lightor');
  const response = await apiClient.patch(
    `${globals.entitlementsUrl}extra-bookings`,
    { autoCharge },
    { withCredentials: true, ...(token ? { headers: { Authorization: `Bearer ${token}` } } : {}) }
  );
  return (response.data?.data?.bookings as BookingsMeter | null) ?? null;
};

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
