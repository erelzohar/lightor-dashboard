import type { Appointment, DateOverride } from '../types';
import { getDisplayStatus } from './appointmentUtils';
import { hoursForDate } from './bookingSlots';
import { parseIntervals } from './ownerSchedule';
import type { Session } from './sessions';

/**
 * Dragging a booking in the dashboard calendar (LT-345): to another time, or
 * onto another booking to swap the two. The arithmetic and the verdict live
 * here, apart from the calendar's drawing, so they can be read and tested on
 * their own. Times are on the clock the calendar draws by.
 */

/** Erel's step (LT-345): a dragged booking lands on whole five minutes. */
export const SNAP_MINUTES = 5;

/** A booking the owner may pick up: one-to-one, scheduled and not yet begun. */
export const isDraggable = (appointment: Appointment): boolean =>
  appointment.type?.kind !== 'class' && getDisplayStatus(appointment) === 'scheduled';

/** The minute of its day a time is at, on the clock the calendar draws by. */
export const minutesOfDay = (ms: number): number => {
  const d = new Date(ms);
  return d.getHours() * 60 + d.getMinutes();
};

/**
 * Where a booking lands when its top is drawn at `minutes` into the day (read
 * off where the pointer is, LT-353, through the calendar's scale, LT-359):
 * rounded to SNAP_MINUTES and kept inside the drawn hours with its whole
 * length. Built from the day's date and a minute count, so a day the clocks
 * change on still lands on the minute it shows.
 */
export const startAtMinutes = ({
  minutes,
  day,
  durationMS,
  firstHour,
  lastHour,
}: {
  minutes: number;
  day: Date;
  durationMS: number;
  firstHour: number;
  lastHour: number;
}): number => {
  const snapped = Math.round(minutes / SNAP_MINUTES) * SNAP_MINUTES;
  const latest = lastHour * 60 - Math.ceil(durationMS / 60_000);
  const clamped = Math.min(Math.max(snapped, firstHour * 60), Math.max(latest, firstHour * 60));
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, clamped).valueOf();
};

/**
 * Which edge of the calendar a dragged booking is held at (LT-353): -1 over
 * the hours column at the start side (back), 1 within `endPx` of the far side
 * (ahead), 0 elsewhere. Past either side counts as that side. In Hebrew the
 * start is the right and tomorrow lies to the left.
 */
export const edgeAt = ({
  x,
  left,
  right,
  rtl,
  startPx,
  endPx,
}: {
  x: number;
  left: number;
  right: number;
  rtl: boolean;
  startPx: number;
  endPx: number;
}): -1 | 0 | 1 => {
  const fromStart = rtl ? right - x : x - left;
  const fromEnd = rtl ? x - left : right - x;
  if (fromStart < startPx) return -1;
  if (fromEnd < endPx) return 1;
  return 0;
};

export type DropVerdict =
  | { kind: 'move'; startMs: number; warning?: 'outsideHours' | 'vacation' }
  | { kind: 'swap'; target: Appointment }
  | { kind: 'none' }
  | { kind: 'refused'; reason: 'past' | 'taken' };

interface OpeningHours {
  workingDays?: (string | null)[];
  dateOverrides?: DateOverride[];
  vacations?: { startDate: string; endDate: string }[];
}

const overlaps = (aStart: number, aEnd: number, bStart: number, bEnd: number) => aStart < bEnd && bStart < aEnd;

/**
 * What a drop means:
 *  - onto another booking that may itself be picked up → a swap (whether the
 *    two fit in each other's place is the server's to say, LT-345);
 *  - back where it was → nothing;
 *  - into the past, or partly over another booking or a class → refused;
 *  - anywhere else → a move, with a word when it is outside the opening
 *    hours or in a vacation (the owner may book there, LT-332).
 * `sessions` are the target day's, as the calendar draws them.
 */
export const dropVerdict = ({
  appointment,
  startMs,
  day,
  overAppointment,
  sessions,
  hours,
  now = Date.now(),
}: {
  appointment: Appointment;
  startMs: number;
  day: Date;
  overAppointment?: Appointment | null;
  sessions: Session[];
  hours?: OpeningHours | null;
  now?: number;
}): DropVerdict => {
  if (overAppointment && overAppointment._id !== appointment._id && isDraggable(overAppointment)) {
    return { kind: 'swap', target: overAppointment };
  }
  if (startMs === Number(appointment.timestamp)) return { kind: 'none' };
  if (startMs <= now) return { kind: 'refused', reason: 'past' };

  const endMs = startMs + (Number(appointment.type?.durationMS) || 0);
  const inTheWay = sessions.some((session) => {
    const live = session.type?.kind === 'class' || session.participants.some((p) => p.status !== 'cancelled' && p._id !== appointment._id);
    return live && overlaps(startMs, endMs, session.startMs, session.startMs + session.durationMS);
  });
  if (inTheWay) return { kind: 'refused', reason: 'taken' };

  if (hours?.vacations?.some((v) => overlaps(startMs, endMs, Number(v.startDate), Number(v.endDate)))) {
    return { kind: 'move', startMs, warning: 'vacation' };
  }
  if (hours?.workingDays?.length === 7) {
    const startMin = minutesOfDay(startMs);
    const endMin = startMin + (endMs - startMs) / 60_000;
    const fits = parseIntervals(hoursForDate({ workingDays: hours.workingDays, dateOverrides: hours.dateOverrides }, day))
      .some((range) => startMin >= range.startMin && endMin <= range.endMin);
    if (!fits) return { kind: 'move', startMs, warning: 'outsideHours' };
  }
  return { kind: 'move', startMs };
};
