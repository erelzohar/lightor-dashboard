import type { DateOverride } from '../types';
import type { BusySlot, ClassSessionAvailability } from '../services/appointmentsApi';
import { hoursForDate } from './bookingSlots';

/**
 * The site's booking calendar, for the owner's own bookings (LT-211).
 *
 * A MIRROR of lightor-front's Schedule.tsx (generateTimeSlots,
 * getAvailabilityStatus, sessionsOnDate) and utils/workingHours.ts
 * (parseIntervals): the two apps share no package, so a fix to one belongs in
 * the other too. Same inputs — the opening hours, the vacations, and the
 * availability endpoint's taken times and class sessions — so the owner is
 * offered the times a customer would be.
 *
 * Two differences, on purpose: the owner is not held to the customers'
 * booking window (the server spares the owner it), and a class session that
 * began up to a day ago is still offered, for a walk-in (LT-204) — the
 * server lists those to the owner only.
 */
export interface ScheduleFacts {
  workingDays: (string | null)[];
  dateOverrides?: DateOverride[];
  vacations?: { startDate: string; endDate: string }[];
  busy: BusySlot[];
  classes: ClassSessionAvailability[];
}

/** A day's dot, as the site paints it: plenty of room, little, none, or a vacation. */
export type DayStatus = 'full' | 'limited' | 'none' | 'vacation' | 'past';

interface WorkingInterval {
  /** Minutes since local midnight, inclusive. */
  startMin: number;
  /** Minutes since local midnight, exclusive. */
  endMin: number;
}

const RANGE_RE = /^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$/;

/**
 * "09:00-13:00,14:00-18:00" → sorted minute ranges; the gap is the break
 * (LT-057). Malformed or inverted ranges are skipped, never thrown on.
 */
export const parseIntervals = (hours: string | null | undefined): WorkingInterval[] => {
  if (!hours || typeof hours !== 'string') return [];
  const intervals: WorkingInterval[] = [];
  for (const part of hours.split(',')) {
    const match = RANGE_RE.exec(part.trim());
    if (!match) continue;
    const startMin = +match[1] * 60 + +match[2];
    const endMin = +match[3] * 60 + +match[4];
    if (+match[2] > 59 || +match[4] > 59) continue;
    if (startMin >= 24 * 60 || endMin > 24 * 60) continue;
    if (endMin <= startMin) continue;
    intervals.push({ startMin, endMin });
  }
  return intervals.sort((a, b) => a.startMin - b.startMin);
};

const pad = (n: number): string => String(n).padStart(2, '0');

const at = (date: Date, minutes: number): number => {
  const d = new Date(date);
  d.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return d.getTime();
};

const overlaps = (start: number, end: number, otherStart: number, otherEnd: number): boolean =>
  start < otherEnd && otherStart < end;

const sameDay = (ms: number, date: Date): boolean => {
  const d = new Date(ms);
  return d.getFullYear() === date.getFullYear() && d.getMonth() === date.getMonth() && d.getDate() === date.getDate();
};

/** Before today, by the local calendar. */
export const isPastDay = (date: Date, now = Date.now()): boolean => {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const day = new Date(date);
  day.setHours(0, 0, 0, 0);
  return day.getTime() < today.getTime();
};

/**
 * Start times ("HH:MM") a service of this length can take on this day. A
 * slot fits inside one range of the day's hours, never across a break; steps
 * by the service's length, or by the hour for a longer one; starts after now;
 * and stays clear of a vacation, a booking, and a class the owner teaches —
 * an empty class holds no booking, yet the server refuses a private one over
 * it (LT-152).
 */
export const freeSlots = (facts: ScheduleFacts, date: Date, durationMS: number, now = Date.now()): string[] => {
  const intervals = parseIntervals(hoursForDate(facts, date));
  const durationMinutes = durationMS / 60_000;
  if (!intervals.length || !(durationMinutes > 0)) return [];
  const step = durationMinutes > 60 ? 60 : durationMinutes;

  const slots: string[] = [];
  for (const { startMin, endMin } of intervals) {
    for (let time = startMin; time + durationMinutes <= endMin; time += step) {
      const start = at(date, time);
      const end = start + durationMS;
      if (start <= now) continue;
      if (facts.vacations?.some((v) => overlaps(start, end, Number(v.startDate), Number(v.endDate)))) continue;
      if (facts.classes.some((c) => overlaps(start, end, Number(c.timestamp), Number(c.timestamp) + Number(c.durationMS)))) continue;
      if (facts.busy.some((b) => overlaps(start, end, Number(b.timestamp), Number(b.timestamp) + Number(b.durationMS)))) continue;
      slots.push(`${pad(Math.floor(time / 60))}:${pad(time % 60)}`);
    }
  }
  return slots;
};

/**
 * A day's dot for a service of this length: more than 55% of the day's
 * possible slots free is "full" availability, fewer is "limited"; a working
 * day with none left reads "vacation" when a vacation covers its opening,
 * else "none".
 */
export const dayStatus = (facts: ScheduleFacts, date: Date, durationMS: number, now = Date.now()): DayStatus => {
  if (isPastDay(date, now)) return 'past';
  const intervals = parseIntervals(hoursForDate(facts, date));
  const free = freeSlots(facts, date, durationMS, now);

  if (!free.length) {
    if (!intervals.length) return 'none';
    const opening = at(date, intervals[0].startMin);
    const onVacation = facts.vacations?.some((v) =>
      overlaps(opening, opening + durationMS, Number(v.startDate), Number(v.endDate))
    );
    return onVacation ? 'vacation' : 'none';
  }

  const workingMinutes = intervals.reduce((sum, { startMin, endMin }) => sum + (endMin - startMin), 0);
  const possible = Math.floor(workingMinutes / (durationMS / 60_000));
  return free.length > Math.floor(possible * 0.55) ? 'full' : 'limited';
};

/** One class's sessions on one day, soonest first, full ones included: "full" is worth knowing. */
export const sessionsOnDay = (
  classes: ClassSessionAvailability[],
  typeId: string,
  date: Date
): ClassSessionAvailability[] =>
  classes
    .filter((session) => session.type_id === typeId && sameDay(Number(session.timestamp), date))
    .sort((a, b) => Number(a.timestamp) - Number(b.timestamp));

/**
 * A class day's dot (LT-155): open while a session has a seat, "limited" when
 * every open one has three or fewer left. A past day is open only for a
 * session the server still lists to the owner.
 */
export const classDayStatus = (
  classes: ClassSessionAvailability[],
  typeId: string,
  date: Date,
  now = Date.now()
): DayStatus => {
  const open = sessionsOnDay(classes, typeId, date).filter((session) => session.booked < session.capacity);
  if (!open.length) return isPastDay(date, now) ? 'past' : 'none';
  return open.every((session) => session.capacity - session.booked <= 3) ? 'limited' : 'full';
};
