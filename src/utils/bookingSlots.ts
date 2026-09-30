import type { DateOverride } from '../types';

/**
 * Dates and opening hours for an owner-made booking (LT-122). The start
 * times themselves come from ownerSchedule.ts (LT-211), the site's own
 * calculation: these hours less the vacations, the bookings and the classes.
 */

interface OpeningHours {
  workingDays: (string | null)[];
  dateOverrides?: DateOverride[];
}

const pad = (n: number): string => String(n).padStart(2, '0');

/** Local calendar date as "YYYY-MM-DD" (no timezone shift). */
export const localDateKey = (date: Date): string =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const toMinutes = (hhmm: string): number | null => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
};

/**
 * The "HH:MM-HH:MM" ranges that apply on this date, or null when closed: a
 * per-date override first (`dateOverrides`, `null` = closed that day), else
 * the weekday's entry in `workingDays`.
 */
export const hoursForDate = (hours: OpeningHours, date: Date): string | null => {
  const override = hours.dateOverrides?.find((o) => o.date === localDateKey(date));
  if (override) return override.hours;
  return hours.workingDays[date.getDay()] ?? null;
};

/** Combine a calendar date and "HH:MM" into an epoch-ms timestamp (local time). */
export const slotTimestamp = (date: Date, hhmm: string): number => {
  const minutes = toMinutes(hhmm) ?? 0;
  const d = new Date(date);
  d.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return d.valueOf();
};
