import { Appointment, AppointmentType } from '../types';
import { getDisplayStatus } from './appointmentUtils';

/**
 * A session is every booking that shares one service and one start time.
 *
 * For a one-to-one business that is always a single booking, so grouping is a
 * no-op and the calendar and list render exactly what they rendered before.
 * For a group class (LT-149) it is the whole roster: twelve people booked into
 * Sunday 19:00 are one thing on the owner's calendar, not twelve cards stacked
 * on top of each other.
 *
 * The grouping key is derived, not stored. Attendees of a class are ordinary
 * appointments carrying the same `type_id` and `timestamp`, which is exactly
 * the pair this file groups on — so the dashboard reads classes correctly
 * before the backend knows the word "class".
 */
export interface Session {
  /** `${typeId}|${timestamp}` — stable across re-renders and re-fetches. */
  id: string;
  type: AppointmentType;
  /** Epoch-ms string, as stored on every appointment. */
  timestamp: string;
  startMs: number;
  durationMS: number;
  /** Cancelled bookings sort last; the rest by name. Never empty. */
  participants: Appointment[];
}

const typeIdOf = (appointment: Appointment): string =>
  appointment.type?._id || appointment.type?.name || 'unknown';

export const sessionKeyOf = (appointment: Appointment): string =>
  `${typeIdOf(appointment)}|${appointment.timestamp}`;

/** True when the roster is worth showing as a session rather than one booking. */
export const isGroupSession = (session: Session): boolean =>
  session.participants.length > 1;

export const activeParticipants = (session: Session): Appointment[] =>
  session.participants.filter((participant) => participant.status !== 'cancelled');

/**
 * The status the session as a whole reads as. Every live participant shares a
 * start and a duration, so they all resolve identically; a session survives
 * until its last booking is cancelled.
 */
export const sessionDisplayStatus = (session: Session): string => {
  const live = activeParticipants(session)[0];
  return live ? getDisplayStatus(live) : 'cancelled';
};

const byRoster = (a: Appointment, b: Appointment): number => {
  const aCancelled = a.status === 'cancelled' ? 1 : 0;
  const bCancelled = b.status === 'cancelled' ? 1 : 0;
  if (aCancelled !== bCancelled) return aCancelled - bCancelled;
  return (a.name || '').localeCompare(b.name || '');
};

/** Groups bookings into sessions, ordered by start time. */
export const groupSessions = (appointments: Appointment[]): Session[] => {
  const byKey = new Map<string, Session>();

  appointments.forEach((appointment) => {
    const id = sessionKeyOf(appointment);
    const existing = byKey.get(id);

    if (existing) {
      existing.participants.push(appointment);
      return;
    }

    byKey.set(id, {
      id,
      type: appointment.type,
      timestamp: appointment.timestamp,
      startMs: parseInt(appointment.timestamp, 10) || 0,
      durationMS: Number(appointment.type?.durationMS || 0),
      participants: [appointment],
    });
  });

  return Array.from(byKey.values())
    .map((session) => ({ ...session, participants: session.participants.sort(byRoster) }))
    .sort((a, b) => a.startMs - b.startMs);
};

/**
 * How many things are on the owner's plate. Erel's call (2026-09-09): a
 * counter means sessions, not people — a coach teaching two classes has two
 * things today, not twenty-four. Money and plan limits keep counting people,
 * because that is what they are.
 */
export const countSessions = (appointments: Appointment[]): number =>
  new Set(appointments.map(sessionKeyOf)).size;
