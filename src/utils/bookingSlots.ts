import type { DateOverride } from '../types';

/**
 * Candidate start times for an owner-made booking (LT-122).
 *
 * Derived from the business's opening hours — a per-date override first
 * (`dateOverrides`, `null` = closed that day), else the weekday's entry in
 * `workingDays` — stepping through each "HH:MM-HH:MM" range in the service's
 * duration. Advisory only: the server's overlap check is authoritative, and a
 * taken slot comes back as a 409 the modal turns into a toast.
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

const fromMinutes = (total: number): string => `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;

/** The "HH:MM-HH:MM" ranges that apply on this date, or [] when closed. */
export const hoursForDate = (hours: OpeningHours, date: Date): string | null => {
  const override = hours.dateOverrides?.find((o) => o.date === localDateKey(date));
  if (override) return override.hours;
  return hours.workingDays[date.getDay()] ?? null;
};

export const generateSlots = (hours: OpeningHours, date: Date, durationMs: number): string[] => {
  const spec = hoursForDate(hours, date);
  if (!spec) return [];
  const step = Math.max(Math.round(durationMs / 60_000), 5);
  const slots: string[] = [];

  for (const range of spec.split(',')) {
    const [startRaw, endRaw] = range.split('-');
    if (!startRaw || !endRaw) continue;
    const start = toMinutes(startRaw);
    const end = toMinutes(endRaw);
    if (start === null || end === null) continue;
    for (let t = start; t + step <= end; t += step) slots.push(fromMinutes(t));
  }
  return slots;
};

/** Combine a calendar date and "HH:MM" into an epoch-ms timestamp (local time). */
export const slotTimestamp = (date: Date, hhmm: string): number => {
  const minutes = toMinutes(hhmm) ?? 0;
  const d = new Date(date);
  d.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return d.valueOf();
};
