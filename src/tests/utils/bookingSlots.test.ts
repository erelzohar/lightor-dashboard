import { describe, it, expect } from 'vitest';
import { generateSlots, hoursForDate, localDateKey, slotTimestamp } from '../../utils/bookingSlots';

// Sunday 2030-03-03 (getDay() === 0) and Monday 2030-03-04.
const SUNDAY = new Date(2030, 2, 3);
const MONDAY = new Date(2030, 2, 4);
const THIRTY_MIN = 30 * 60_000;

const hours = {
  workingDays: ['09:00-12:00', '10:00-11:00,14:00-15:00', null, null, null, null, null],
};

describe('owner booking slots (LT-122)', () => {
  it('steps through the weekday range in the service duration', () => {
    expect(generateSlots(hours, SUNDAY, THIRTY_MIN)).toEqual(['09:00', '09:30', '10:00', '10:30', '11:00', '11:30']);
  });

  it('handles several ranges and a longer service', () => {
    expect(generateSlots(hours, MONDAY, THIRTY_MIN)).toEqual(['10:00', '10:30', '14:00', '14:30']);
    expect(generateSlots(hours, MONDAY, 60 * 60_000)).toEqual(['10:00', '14:00']);
  });

  it('is empty on a closed weekday', () => {
    expect(generateSlots(hours, new Date(2030, 2, 5), THIRTY_MIN)).toEqual([]);
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
    expect(generateSlots(withOverrides, SUNDAY, THIRTY_MIN)).toEqual([]);
    expect(generateSlots(withOverrides, new Date(2030, 2, 5), THIRTY_MIN)).toEqual(['16:00', '16:30']);
  });

  it('keys dates locally and combines a slot into a local timestamp', () => {
    expect(localDateKey(SUNDAY)).toBe('2030-03-03');
    const ts = slotTimestamp(SUNDAY, '09:30');
    const d = new Date(ts);
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes()]).toEqual([2030, 2, 3, 9, 30]);
  });
});
