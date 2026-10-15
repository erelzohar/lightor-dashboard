import { describe, it, expect } from 'vitest';
import { hoursForDate, localDateKey, slotTimestamp } from '../../utils/bookingSlots';

// Sunday 2030-03-03 (getDay() === 0) and Monday 2030-03-04.
const SUNDAY = new Date(2030, 2, 3);
const MONDAY = new Date(2030, 2, 4);

const hours = {
  workingDays: ['09:00-12:00', '10:00-11:00,14:00-15:00', null, null, null, null, null],
};

// The start times themselves are ownerSchedule.ts's (LT-211), tested there.
describe('owner booking dates and hours (LT-122)', () => {
  it("reads the weekday's hours, closed as null", () => {
    expect(hoursForDate(hours, SUNDAY)).toBe('09:00-12:00');
    expect(hoursForDate(hours, MONDAY)).toBe('10:00-11:00,14:00-15:00');
    expect(hoursForDate(hours, new Date(2030, 2, 5))).toBeNull();
  });

  it('lets a date override win - including closing an open day', () => {
    const withOverrides = {
      ...hours,
      dateOverrides: [
        { date: '2030-03-03', hours: null },
        { date: '2030-03-05', hours: '16:00-17:00' },
      ],
    };
    expect(hoursForDate(withOverrides, SUNDAY)).toBeNull();
    expect(hoursForDate(withOverrides, new Date(2030, 2, 5))).toBe('16:00-17:00');
  });

  it("keys a carrier day by its own fields and combines a slot on the business's clock (LT-318)", () => {
    expect(localDateKey(SUNDAY)).toBe('2030-03-03');
    expect(slotTimestamp(SUNDAY, '09:30', 'Asia/Jerusalem')).toBe(Date.UTC(2030, 2, 3, 7, 30));
  });

  // LT-318: a predecessor stored a booking an hour early when the visitor's
  // phone was set an hour ahead of the business. The instant is the
  // business's 09:30 whatever zone this process runs in (the suite runs
  // under TZ=UTC and TZ=Asia/Dubai too).
  it("turns a New York business's 09:30 into New York's instant, on any device", () => {
    expect(slotTimestamp(SUNDAY, '09:30', 'America/New_York')).toBe(Date.UTC(2030, 2, 3, 14, 30));
    // Its clocks go forward on 10 March 2030: 09:30 is then an hour nearer UTC.
    expect(slotTimestamp(new Date(2030, 2, 10), '09:30', 'America/New_York')).toBe(Date.UTC(2030, 2, 10, 13, 30));
    expect(slotTimestamp(SUNDAY, '09:30', 'Asia/Dubai')).toBe(Date.UTC(2030, 2, 3, 5, 30));
  });
});
