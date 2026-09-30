import { Appointment, AppointmentType } from '../types';
import type { ClassSessionAvailability } from '../services/appointmentsApi';
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
  /**
   * Cancelled bookings sort last; the rest by name. Empty only for a class
   * session nobody has booked into yet, as the server lists it (LT-211).
   */
  participants: Appointment[];
}

const typeIdOf = (appointment: Appointment): string =>
  appointment.type?._id || appointment.type?.name || 'unknown';

export const sessionKeyOf = (appointment: Appointment): string =>
  `${typeIdOf(appointment)}|${appointment.timestamp}`;

/**
 * True when the roster is worth showing as a session rather than one booking:
 * always for a class (LT-211) — its roster is where the next participant is
 * added, the first one included — and for anything else booked more than once.
 */
export const isGroupSession = (session: Session): boolean =>
  session.type?.kind === 'class' || session.participants.length > 1;

export const activeParticipants = (session: Session): Appointment[] =>
  session.participants.filter((participant) => participant.status !== 'cancelled');

/**
 * The status the session as a whole reads as. Every live participant shares a
 * start and a duration, so they all resolve identically; a session survives
 * until its last booking is cancelled. A class runs whoever comes (LT-211):
 * with nobody booked, or everybody cancelled, it reads by the clock.
 */
export const sessionDisplayStatus = (session: Session): string => {
  const live = activeParticipants(session)[0];
  if (live) return getDisplayStatus(live);
  if (session.type?.kind !== 'class') return 'cancelled';
  return getDisplayStatus({
    status: 'scheduled',
    timestamp: session.timestamp,
    type: { ...session.type, durationMS: String(session.durationMS) },
  } as Appointment);
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
 * The session with this id, rebuilt from the bookings as they are now
 * (LT-204). A roster keeps the id of what it shows, never a copy, so a walk-in
 * seated from it — or anyone cancelled in it — appears as soon as the store
 * has the change. A class session nobody has booked yet is found among the
 * sessions the server lists (LT-211). Null when neither holds the id (any more).
 */
export const findSession = (
  appointments: Appointment[],
  id: string | null,
  listed: Session[] = []
): Session | null => {
  if (!id) return null;
  const booked = groupSessions(appointments.filter((appointment) => sessionKeyOf(appointment) === id))[0];
  return booked ?? listed.find((session) => session.id === id) ?? null;
};

/**
 * A class's sessions as the server lists them (LT-211), as sessions with no
 * one in them yet: an empty class holds no booking, so without these the
 * calendar had nothing to show for it and nowhere to add its first
 * participant. The id is the one its bookings will carry. A session of a
 * service the page does not know is left out, and one listed twice is one.
 */
export const listedSessions = (listed: ClassSessionAvailability[], types: AppointmentType[]): Session[] => {
  const seen = new Set<string>();
  return listed.flatMap((occurrence) => {
    const type = types.find((candidate) => candidate._id === occurrence.type_id);
    const id = `${occurrence.type_id}|${occurrence.timestamp}`;
    if (!type || seen.has(id)) return [];
    seen.add(id);
    return [{
      id,
      type,
      timestamp: occurrence.timestamp,
      startMs: parseInt(occurrence.timestamp, 10) || 0,
      durationMS: Number(occurrence.durationMS || type.durationMS || 0),
      participants: [],
    }];
  });
};

/**
 * The booked sessions with the listed ones nobody has booked into added
 * (LT-211), by start time. A listed session some booking already stands for
 * is that booking's session, not a second one.
 */
export const withListedSessions = (booked: Session[], listed: Session[]): Session[] => {
  const ids = new Set(booked.map((session) => session.id));
  return [...booked, ...listed.filter((session) => !ids.has(session.id))].sort((a, b) => a.startMs - b.startMs);
};

/**
 * How many things are on the owner's plate. Erel's call (2026-09-09): a
 * counter means sessions, not people — a coach teaching two classes has two
 * things today, not twenty-four. Money and plan limits keep counting people,
 * because that is what they are.
 */
export const countSessions = (appointments: Appointment[]): number =>
  new Set(appointments.map(sessionKeyOf)).size;
