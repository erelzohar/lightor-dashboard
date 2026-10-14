import type { DateOverride } from '../types';
import { zonedSlotMs } from './businessTime';

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

/**
 * A carrier day (businessTime.ts) as "YYYY-MM-DD", read off its own fields:
 * no zone enters into it.
 */
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

/**
 * A carrier day and "HH:MM" on the BUSINESS's clock as an epoch-ms instant
 * (LT-318): never the device's, or an owner whose phone is set to another
 * zone books 11:00 as some other hour.
 */
export const slotTimestamp = (date: Date, hhmm: string, timeZone: string): number => {
  const minutes = toMinutes(hhmm) ?? 0;
  return zonedSlotMs(date, 0, minutes, timeZone);
};
