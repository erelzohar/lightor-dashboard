import { describe, it, expect } from 'vitest';
import {
  countSessions,
  groupSessions,
  isGroupSession,
  sessionKeyOf,
  sessionDisplayStatus,
  activeParticipants,
} from '../../utils/sessions';
import { Appointment, AppointmentType } from '../../types';

const HOUR = 3_600_000;

const type = (id: string, durationMS = String(HOUR)): AppointmentType => ({
  _id: id,
  name: `Service ${id}`,
  webConfig_id: 'w1',
  price: '60',
  durationMS,
});

const appt = (over: Partial<Appointment> & { _id: string }): Appointment => ({
  name: 'Someone',
  type: type('t1'),
  phone: '+972500000000',
  status: 'scheduled',
  user_id: 'u1',
  timestamp: String(Date.now() + 48 * HOUR),
  ...over,
});

describe('grouping bookings into sessions', () => {
  it('leaves a one-to-one business with one session per booking', () => {
    const now = Date.now();
    const list = [
      appt({ _id: 'a', timestamp: String(now) }),
      appt({ _id: 'b', timestamp: String(now + HOUR) }),
    ];

    const sessions = groupSessions(list);

    expect(sessions).toHaveLength(2);
    expect(sessions.every(session => !isGroupSession(session))).toBe(true);
    expect(sessions.every(session => session.participants.length === 1)).toBe(true);
  });

  it('collapses a class into one session', () => {
    const at = String(Date.now() + 24 * HOUR);
    const list = [
      appt({ _id: 'a', name: 'Dana', timestamp: at }),
      appt({ _id: 'b', name: 'Avi', timestamp: at }),
      appt({ _id: 'c', name: 'Noa', timestamp: at }),
    ];

    const sessions = groupSessions(list);

    expect(sessions).toHaveLength(1);
    expect(isGroupSession(sessions[0])).toBe(true);
    expect(sessions[0].participants).toHaveLength(3);
    expect(sessions[0].durationMS).toBe(HOUR);
  });

  it('keeps two services at the same time apart', () => {
    const at = String(Date.now() + 24 * HOUR);
    const sessions = groupSessions([
      appt({ _id: 'a', timestamp: at, type: type('t1') }),
      appt({ _id: 'b', timestamp: at, type: type('t2') }),
    ]);

    expect(sessions).toHaveLength(2);
  });

  it('orders sessions by start time', () => {
    const now = Date.now();
    const sessions = groupSessions([
      appt({ _id: 'late', timestamp: String(now + 5 * HOUR) }),
      appt({ _id: 'early', timestamp: String(now) }),
    ]);

    expect(sessions[0].participants[0]._id).toBe('early');
  });

  it('sorts cancelled people to the end of the roster', () => {
    const at = String(Date.now() + 24 * HOUR);
    const sessions = groupSessions([
      appt({ _id: 'a', name: 'Zoe', status: 'cancelled', timestamp: at }),
      appt({ _id: 'b', name: 'Avi', timestamp: at }),
    ]);

    expect(sessions[0].participants.map(p => p.name)).toEqual(['Avi', 'Zoe']);
    expect(activeParticipants(sessions[0])).toHaveLength(1);
  });

  it('reads as cancelled only when everyone has dropped out', () => {
    const at = String(Date.now() + 24 * HOUR);

    const partly = groupSessions([
      appt({ _id: 'a', status: 'cancelled', timestamp: at }),
      appt({ _id: 'b', timestamp: at }),
    ]);
    expect(sessionDisplayStatus(partly[0])).toBe('scheduled');

    const gone = groupSessions([
      appt({ _id: 'a', status: 'cancelled', timestamp: at }),
      appt({ _id: 'b', status: 'cancelled', timestamp: at }),
    ]);
    expect(sessionDisplayStatus(gone[0])).toBe('cancelled');
  });

  it('counts sessions rather than people', () => {
    const at = String(Date.now() + 24 * HOUR);
    const twelve = Array.from({ length: 12 }, (_, i) => appt({ _id: `p${i}`, timestamp: at }));

    expect(countSessions(twelve)).toBe(1);
    expect(countSessions([...twelve, appt({ _id: 'other', timestamp: String(Date.now()) })])).toBe(2);
    expect(countSessions([])).toBe(0);
  });

  it('keys a session on its service and its start', () => {
    const at = String(Date.now());
    expect(sessionKeyOf(appt({ _id: 'a', timestamp: at }))).toBe(`t1|${at}`);
  });
});
