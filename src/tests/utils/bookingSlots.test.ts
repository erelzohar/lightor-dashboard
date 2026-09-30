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

  it('lets a date override win — including closing an open day', () => {
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

  it('keys dates locally and combines a slot into a local timestamp', () => {
    expect(localDateKey(SUNDAY)).toBe('2030-03-03');
    const ts = slotTimestamp(SUNDAY, '09:30');
    const d = new Date(ts);
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes()]).toEqual([2030, 2, 3, 9, 30]);
  });
});
