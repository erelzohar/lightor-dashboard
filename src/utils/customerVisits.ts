import type { CustomerHistoryRow, CustomerStats } from '../services/customersApi';

/**
 * How the customer card counts and names visits (LT-315).
 *
 * The API's `visits` follows the house convention "anything not cancelled",
 * so it counts bookings that have not happened yet — and the list showed
 * "1+1" for a customer with one cancelled and one upcoming booking: one
 * "visit" that was the upcoming one, plus the same one as upcoming.
 * A visit here is one that has taken place.
 */
export const pastVisits = (stats: Pick<CustomerStats, 'visits' | 'upcoming'>): number =>
  Math.max(0, (stats.visits ?? 0) - (stats.upcoming ?? 0));

const startOf = (row: Pick<CustomerHistoryRow, 'scheduledAt' | 'timestamp'>): number =>
  row.scheduledAt ? Date.parse(row.scheduledAt) : Number(row.timestamp);

/**
 * The first appointment's date — not when the customer record was made,
 * which is when their first booking was *placed* (or when the owner added
 * them by hand). The earliest booking that was not cancelled; none, null.
 */
export const firstVisitOf = (history: CustomerHistoryRow[]): string | null => {
  let first: number | null = null;
  for (const row of history) {
    if (row.status === 'cancelled') continue;
    const at = startOf(row);
    if (Number.isFinite(at) && (first === null || at < first)) first = at;
  }
  return first === null ? null : new Date(first).toISOString();
};

/**
 * A history row's status as the rest of the dashboard shows it
 * (appointmentUtils.getDisplayStatus): a booking still "scheduled" once it
 * is over (with the same 15 minutes' grace) reads as completed.
 */
export const historyStatus = (row: CustomerHistoryRow, now = Date.now()): CustomerHistoryRow['status'] => {
  if (row.status !== 'scheduled') return row.status;
  const end = startOf(row) + (Number(row.typeDurationMS) || 0) + 15 * 60_000;
  return now > end ? 'completed' : 'scheduled';
};
