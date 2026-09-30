import { describe, it, expect } from 'vitest';
import {
  classDayStatus,
  dayStatus,
  freeSlots,
  isPastDay,
  parseIntervals,
  sessionsOnDay,
  type ScheduleFacts,
} from '../../utils/ownerSchedule';

// Sunday 2030-03-03 and Monday 2030-03-04; "now" is the Saturday before.
const SUNDAY = new Date(2030, 2, 3);
const MONDAY = new Date(2030, 2, 4);
const NOW = new Date(2030, 2, 2, 12).valueOf();
const MIN = 60_000;
const HOUR = 60 * MIN;
const at = (day: Date, h: number, m = 0) => new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m).valueOf();

const facts = (over: Partial<ScheduleFacts> = {}): ScheduleFacts => ({
  workingDays: ['09:00-12:00', '10:00-11:00,14:00-15:00', null, null, null, null, null],
  busy: [],
  classes: [],
  ...over,
});

/**
 * The owner's booking calendar works out free times as the site's does
 * (LT-211, a mirror of lightor-front Schedule.tsx).
 */
describe('free start times', () => {
  it("steps through the day's hours by the service's length, an hour at most", () => {
    expect(freeSlots(facts(), SUNDAY, 30 * MIN, NOW)).toEqual(['09:00', '09:30', '10:00', '10:30', '11:00', '11:30']);
    // Two hours long: it steps by the hour, and must end by 12:00.
    expect(freeSlots(facts(), SUNDAY, 2 * HOUR, NOW)).toEqual(['09:00', '10:00']);
  });

  it('keeps a slot inside one range, never across the break', () => {
    expect(freeSlots(facts(), MONDAY, 30 * MIN, NOW)).toEqual(['10:00', '10:30', '14:00', '14:30']);
    expect(freeSlots(facts(), MONDAY, 90 * MIN, NOW)).toEqual([]);
  });

  it('leaves out what a booking, a class or a vacation takes', () => {
    const taken = facts({
      busy: [{ timestamp: String(at(SUNDAY, 9, 30)), durationMS: String(30 * MIN) }],
      classes: [{ type_id: 'c1', timestamp: String(at(SUNDAY, 11)), durationMS: String(HOUR), capacity: 12, booked: 0 }],
      vacations: [{ startDate: String(at(SUNDAY, 10, 30)), endDate: String(at(SUNDAY, 11)) }],
    });
    // 09:30 is booked; a class nobody has booked still holds 11:00–12:00;
    // the vacation covers 10:30.
    expect(freeSlots(taken, SUNDAY, 30 * MIN, NOW)).toEqual(['09:00', '10:00']);
  });

  it('offers nothing that has already begun', () => {
    expect(freeSlots(facts(), SUNDAY, 30 * MIN, at(SUNDAY, 10, 15))).toEqual(['10:30', '11:00', '11:30']);
  });

  it('honours a date override, closed or opened', () => {
    const overridden = facts({
      dateOverrides: [
        { date: '2030-03-03', hours: null },
        { date: '2030-03-05', hours: '16:00-17:00' },
      ],
    });
    expect(freeSlots(overridden, SUNDAY, 30 * MIN, NOW)).toEqual([]);
    expect(freeSlots(overridden, new Date(2030, 2, 5), 30 * MIN, NOW)).toEqual(['16:00', '16:30']);
  });

  it('parses hours tolerantly', () => {
    expect(parseIntervals('14:00-15:00, 09:00-12:00')).toEqual([
      { startMin: 540, endMin: 720 },
      { startMin: 840, endMin: 900 },
    ]);
    expect(parseIntervals('25:00-26:00,12:00-11:00,oops')).toEqual([]);
    expect(parseIntervals(null)).toEqual([]);
  });
});

describe("a day's dot", () => {
  it('reads plenty of room as full, little as limited', () => {
    expect(dayStatus(facts(), SUNDAY, 30 * MIN, NOW)).toBe('full');
    const busy = [9, 10, 11].map((h) => ({ timestamp: String(at(SUNDAY, h)), durationMS: String(HOUR) }));
    const nearlyFull = facts({ busy: busy.slice(0, 2) });
    expect(dayStatus(nearlyFull, SUNDAY, 30 * MIN, NOW)).toBe('limited');
    expect(dayStatus(facts({ busy }), SUNDAY, 30 * MIN, NOW)).toBe('none');
  });

  it('says vacation when a vacation covers the opening, none on a closed day, past before today', () => {
    const away = facts({ vacations: [{ startDate: String(at(SUNDAY, 0)), endDate: String(at(SUNDAY, 23)) }] });
    expect(dayStatus(away, SUNDAY, 30 * MIN, NOW)).toBe('vacation');
    expect(dayStatus(facts(), new Date(2030, 2, 5), 30 * MIN, NOW)).toBe('none');
    expect(dayStatus(facts(), new Date(2030, 2, 1), 30 * MIN, NOW)).toBe('past');
    expect(isPastDay(new Date(2030, 2, 2), NOW)).toBe(false);
  });
});

describe("a class's days", () => {
  const session = (h: number, booked: number, capacity = 12, typeId = 'c1') => ({
    type_id: typeId,
    timestamp: String(at(SUNDAY, h)),
    durationMS: String(HOUR),
    capacity,
    booked,
  });

  it("lists one class's sessions on one day, soonest first, full ones kept", () => {
    const classes = [session(19, 3), session(8, 12), session(10, 0, 12, 'other')];
    expect(sessionsOnDay(classes, 'c1', SUNDAY).map((s) => [s.timestamp, s.booked])).toEqual([
      [String(at(SUNDAY, 8)), 12],
      [String(at(SUNDAY, 19)), 3],
    ]);
    expect(sessionsOnDay(classes, 'c1', MONDAY)).toEqual([]);
  });

  it('is open while a session has a seat, limited with three or fewer left', () => {
    expect(classDayStatus([session(19, 3)], 'c1', SUNDAY, NOW)).toBe('full');
    expect(classDayStatus([session(19, 10)], 'c1', SUNDAY, NOW)).toBe('limited');
    expect(classDayStatus([session(19, 12)], 'c1', SUNDAY, NOW)).toBe('none');
    // A walk-in into a session that began yesterday (LT-204): the server lists it, so it is open.
    expect(classDayStatus([session(19, 3)], 'c1', SUNDAY, at(MONDAY, 9))).toBe('full');
    expect(classDayStatus([], 'c1', SUNDAY, at(MONDAY, 9))).toBe('past');
  });
});
