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
import { zonedTimeToMs } from '../../utils/businessTime';

// Sunday 2030-03-03 and Monday 2030-03-04 (carriers); "now" is the Saturday
// before. Every instant is on the business's clock — Asia/Jerusalem, the
// default — so the suite means the same on any device (LT-318).
const SUNDAY = new Date(2030, 2, 3);
const MONDAY = new Date(2030, 2, 4);
const MIN = 60_000;
const HOUR = 60 * MIN;
const J = 'Asia/Jerusalem';
const NY = 'America/New_York';
const atIn = (tz: string, day: Date, h: number, m = 0) => zonedTimeToMs(day.getFullYear(), day.getMonth(), day.getDate(), h, m, tz);
const at = (day: Date, h: number, m = 0) => atIn(J, day, h, m);
const NOW = at(new Date(2030, 2, 2), 12);

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
    // Listed twice (LT-211: the day the clock went back), drawn once.
    expect(sessionsOnDay([session(19, 3), session(19, 3)], 'c1', SUNDAY)).toHaveLength(1);
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

/**
 * LT-318: the business's clock, not the device's. A New York business's
 * hours are New York's, whatever zone the owner's phone is set to (the
 * suite runs under TZ=UTC and TZ=Asia/Dubai too).
 */
describe("a business in another zone than the device's", () => {
  const ny = (over: Partial<ScheduleFacts> = {}) => facts({ timeZone: NY, ...over });

  it("keeps New York's own bookings out, and no one else's hour", () => {
    // 09:30 New York is taken; 09:30 Jerusalem is 02:30 in New York — no clash.
    const taken = ny({
      busy: [
        { timestamp: String(atIn(NY, SUNDAY, 9, 30)), durationMS: String(30 * MIN) },
        { timestamp: String(at(SUNDAY, 9, 30)), durationMS: String(30 * MIN) },
      ],
    });
    expect(freeSlots(taken, SUNDAY, 30 * MIN, NOW)).toEqual(['09:00', '10:00', '10:30', '11:00', '11:30']);
  });

  it("offers nothing that has begun on New York's clock", () => {
    expect(freeSlots(ny(), SUNDAY, 30 * MIN, atIn(NY, SUNDAY, 10, 15))).toEqual(['10:30', '11:00', '11:30']);
    // 10:15 in Jerusalem is still the small hours in New York: the whole day is ahead.
    expect(freeSlots(ny(), SUNDAY, 30 * MIN, at(SUNDAY, 10, 15))).toHaveLength(6);
  });

  it("reads the past and a vacation on the business's calendar", () => {
    // Sunday 05:00 in Jerusalem is still Saturday evening in New York.
    const now = Date.UTC(2030, 2, 3, 3, 0);
    const saturday = new Date(2030, 2, 2);
    expect(isPastDay(saturday, now, J)).toBe(true);
    expect(isPastDay(saturday, now, NY)).toBe(false);
    expect(dayStatus(facts(), saturday, 30 * MIN, now)).toBe('past');
    const away = ny({ vacations: [{ startDate: String(atIn(NY, SUNDAY, 0)), endDate: String(atIn(NY, SUNDAY, 23)) }] });
    expect(dayStatus(away, SUNDAY, 30 * MIN, NOW)).toBe('vacation');
  });

  it("puts a class session on the business's day, not the device's", () => {
    // Sunday 22:00 in New York is Monday 05:00 in Jerusalem.
    const late = { type_id: 'c1', timestamp: String(atIn(NY, SUNDAY, 22)), durationMS: String(HOUR), capacity: 12, booked: 0 };
    expect(sessionsOnDay([late], 'c1', SUNDAY, NY)).toHaveLength(1);
    expect(sessionsOnDay([late], 'c1', MONDAY, NY)).toHaveLength(0);
    expect(sessionsOnDay([late], 'c1', MONDAY, J)).toHaveLength(1);
    expect(classDayStatus([late], 'c1', SUNDAY, NOW, NY)).toBe('full');
  });
});
