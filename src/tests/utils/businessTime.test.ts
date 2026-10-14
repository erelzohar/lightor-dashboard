import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  DEFAULT_TIME_ZONE,
  businessTimeZone,
  deviceTimeZone,
  gmtOffsetLabel,
  isValidTimeZone,
  zoneOffsetMs,
  zonedDateKey,
  zonedDateOf,
  zonedInputToMs,
  zonedInputValue,
  zonedParts,
  zonedSlotMs,
  zonedTimeLabel,
  zonedTimeToMs,
  zonedToday,
} from '../../utils/businessTime';

/**
 * The business's clock (LT-318). Every expectation is an absolute instant
 * (Date.UTC), so the suite means the same in any process zone — it is run
 * under TZ=UTC and TZ=Asia/Dubai as well as the machine's own.
 */
const HOUR = 3_600_000;
const J = 'Asia/Jerusalem';
const NY = 'America/New_York';
const DUBAI = 'Asia/Dubai';
const AUCKLAND = 'Pacific/Auckland';
const ADELAIDE = 'Australia/Adelaide';

const carrier = (d: Date) => [d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes()];

describe('the zone itself', () => {
  it("reads the config's zone, or the server's default when it has none or not a real one", () => {
    expect(businessTimeZone({ timeZone: NY })).toBe(NY);
    expect(businessTimeZone({})).toBe(DEFAULT_TIME_ZONE);
    expect(businessTimeZone(null)).toBe(DEFAULT_TIME_ZONE);
    expect(businessTimeZone(undefined)).toBe(DEFAULT_TIME_ZONE);
    expect(businessTimeZone({ timeZone: 'Mars/Olympus_Mons' })).toBe(DEFAULT_TIME_ZONE);
    expect(businessTimeZone({ timeZone: '' })).toBe(DEFAULT_TIME_ZONE);
    expect(DEFAULT_TIME_ZONE).toBe('Asia/Jerusalem');
    expect(isValidTimeZone('Asia/Kathmandu')).toBe(true);
    expect(isValidTimeZone(42)).toBe(false);
  });

  describe("the device's zone, for a site built on it", () => {
    afterEach(() => vi.restoreAllMocks());
    const deviceSays = (timeZone: string | undefined) => {
      const real = Intl.DateTimeFormat.prototype.resolvedOptions;
      vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockImplementation(function (this: Intl.DateTimeFormat) {
        return { ...real.call(this), timeZone } as Intl.ResolvedDateTimeFormatOptions;
      });
    };

    it('is the IANA zone the browser names', () => {
      deviceSays('Europe/Paris');
      expect(deviceTimeZone()).toBe('Europe/Paris');
    });

    it('is nothing when the browser names no place — UTC, an Etc zone, or nothing it knows', () => {
      for (const tz of ['UTC', 'Etc/GMT-3', 'Etc/Unknown', 'Nowhere/Special', undefined]) {
        deviceSays(tz);
        expect(deviceTimeZone()).toBeUndefined();
        vi.restoreAllMocks();
      }
    });
  });
});

describe('wall clock → instant', () => {
  it('turns the same wall clock into each zone\'s own instant', () => {
    // Monday 2030-03-04 10:00 — winter everywhere north, summer in Auckland.
    expect(zonedTimeToMs(2030, 2, 4, 10, 0, J)).toBe(Date.UTC(2030, 2, 4, 8, 0));
    expect(zonedTimeToMs(2030, 2, 4, 10, 0, NY)).toBe(Date.UTC(2030, 2, 4, 15, 0));
    expect(zonedTimeToMs(2030, 2, 4, 10, 0, DUBAI)).toBe(Date.UTC(2030, 2, 4, 6, 0));
    expect(zonedTimeToMs(2030, 2, 4, 10, 0, AUCKLAND)).toBe(Date.UTC(2030, 2, 3, 21, 0));
    expect(zonedTimeToMs(2030, 2, 4, 10, 0, 'Asia/Kathmandu')).toBe(Date.UTC(2030, 2, 4, 4, 15));
  });

  it('follows Israel back to winter time on 25.10.2026', () => {
    // 02:00 summer time became 01:00 winter time at 23:00 UTC.
    expect(zonedTimeToMs(2026, 9, 25, 0, 0, J)).toBe(Date.UTC(2026, 9, 24, 21, 0));
    expect(zonedTimeToMs(2026, 9, 25, 9, 0, J)).toBe(Date.UTC(2026, 9, 25, 7, 0));
    expect(zonedTimeToMs(2026, 9, 24, 9, 0, J)).toBe(Date.UTC(2026, 9, 24, 6, 0));
    // 01:30 happened twice: the later one.
    expect(zonedTimeToMs(2026, 9, 25, 1, 30, J)).toBe(Date.UTC(2026, 9, 24, 23, 30));
    expect(zoneOffsetMs(Date.UTC(2026, 9, 24, 22, 59), J)).toBe(3 * HOUR);
    expect(zoneOffsetMs(Date.UTC(2026, 9, 24, 23, 0), J)).toBe(2 * HOUR);
  });

  it('follows Israel forward to summer time on 26.3.2027', () => {
    // 02:00 winter time became 03:00 summer time at 00:00 UTC.
    expect(zonedTimeToMs(2027, 2, 26, 1, 59, J)).toBe(Date.UTC(2027, 2, 25, 23, 59));
    expect(zonedTimeToMs(2027, 2, 26, 9, 0, J)).toBe(Date.UTC(2027, 2, 26, 6, 0));
    expect(zonedTimeToMs(2027, 2, 25, 9, 0, J)).toBe(Date.UTC(2027, 2, 25, 7, 0));
    // 02:30 never happened that night: it lands after the jump.
    expect(zonedTimeLabel(zonedTimeToMs(2027, 2, 26, 2, 30, J), J)).toBe('03:30');
  });

  it('follows New York and Auckland through their own changes', () => {
    // New York: 8 March 2026 forward, 1 November 2026 back.
    expect(zonedTimeToMs(2026, 2, 7, 9, 0, NY)).toBe(Date.UTC(2026, 2, 7, 14, 0));
    expect(zonedTimeToMs(2026, 2, 8, 9, 0, NY)).toBe(Date.UTC(2026, 2, 8, 13, 0));
    expect(zonedTimeToMs(2026, 10, 1, 9, 0, NY)).toBe(Date.UTC(2026, 10, 1, 14, 0));
    // Auckland: summer time from 27 September 2026.
    expect(zonedTimeToMs(2026, 8, 26, 9, 0, AUCKLAND)).toBe(Date.UTC(2026, 8, 25, 21, 0));
    expect(zonedTimeToMs(2026, 8, 28, 9, 0, AUCKLAND)).toBe(Date.UTC(2026, 8, 27, 20, 0));
  });

  it('follows Adelaide, half an hour off UTC, across its change at a UTC half hour', () => {
    // 4 October 2026, 02:00 ACST (+9:30) became 03:00 ACDT (+10:30) at 16:30 UTC.
    // Read the hour's start first: a cache keyed on the UTC hour would then
    // answer the old offset for the half hour after the change.
    expect(zoneOffsetMs(Date.UTC(2026, 9, 3, 16, 0), ADELAIDE)).toBe(9.5 * HOUR);
    expect(zoneOffsetMs(Date.UTC(2026, 9, 3, 16, 29), ADELAIDE)).toBe(9.5 * HOUR);
    expect(zoneOffsetMs(Date.UTC(2026, 9, 3, 16, 30), ADELAIDE)).toBe(10.5 * HOUR);
    expect(zoneOffsetMs(Date.UTC(2026, 9, 3, 16, 45), ADELAIDE)).toBe(10.5 * HOUR);
    expect(zonedTimeLabel(Date.UTC(2026, 9, 3, 16, 29), ADELAIDE)).toBe('01:59');
    expect(zonedTimeLabel(Date.UTC(2026, 9, 3, 16, 30), ADELAIDE)).toBe('03:00');
    expect(zonedTimeToMs(2026, 9, 4, 1, 30, ADELAIDE)).toBe(Date.UTC(2026, 9, 3, 16, 0));
    expect(zonedTimeToMs(2026, 9, 4, 9, 0, ADELAIDE)).toBe(Date.UTC(2026, 9, 3, 22, 30));
    // And back on 5 April 2026: 03:00 ACDT became 02:00 ACST at 16:30 UTC.
    expect(zoneOffsetMs(Date.UTC(2026, 3, 4, 16, 0), ADELAIDE)).toBe(10.5 * HOUR);
    expect(zoneOffsetMs(Date.UTC(2026, 3, 4, 16, 30), ADELAIDE)).toBe(9.5 * HOUR);
    expect(zonedTimeToMs(2026, 3, 5, 9, 0, ADELAIDE)).toBe(Date.UTC(2026, 3, 4, 23, 30));
  });

  it('takes a carrier day and minutes past the business\'s midnight, rolling over the hour', () => {
    const day = new Date(2026, 9, 25);
    expect(zonedSlotMs(day, 9, 30, J)).toBe(Date.UTC(2026, 9, 25, 7, 30));
    expect(zonedSlotMs(day, 0, 570, J)).toBe(Date.UTC(2026, 9, 25, 7, 30));
    expect(zonedSlotMs(day, 9, 30, NY)).toBe(Date.UTC(2026, 9, 25, 13, 30));
  });
});

describe('instant → wall clock', () => {
  it("reads the instant on the business's clock, not the device's", () => {
    const ms = Date.UTC(2026, 9, 24, 21, 30);
    expect(zonedParts(ms, J)).toEqual({ year: 2026, month: 9, day: 25, hour: 0, minute: 30 });
    expect(zonedParts(ms, NY)).toEqual({ year: 2026, month: 9, day: 24, hour: 17, minute: 30 });
    expect(zonedTimeLabel(ms, DUBAI)).toBe('01:30');
    expect(zonedTimeLabel(ms, AUCKLAND)).toBe('10:30');
    expect(zonedDateKey(ms, J)).toBe('2026-10-25');
    expect(zonedDateKey(ms, NY)).toBe('2026-10-24');
  });

  it("gives the business's calendar day as a carrier at local midnight", () => {
    const ms = Date.UTC(2026, 9, 24, 12, 0); // 01:00 on the 25th in Auckland
    expect(carrier(zonedDateOf(ms, AUCKLAND))).toEqual([2026, 9, 25, 0, 0]);
    expect(carrier(zonedDateOf(ms, NY))).toEqual([2026, 9, 24, 0, 0]);
    expect(carrier(zonedToday(AUCKLAND, ms))).toEqual([2026, 9, 25, 0, 0]);
    // Midnight in Jerusalem, 21:00 the day before in UTC.
    expect(carrier(zonedToday(J, Date.UTC(2026, 9, 24, 21, 0)))).toEqual([2026, 9, 25, 0, 0]);
  });

  it('round-trips a datetime-local value on the business clock', () => {
    expect(zonedInputToMs('2026-10-25T09:00', J)).toBe(Date.UTC(2026, 9, 25, 7, 0));
    expect(zonedInputToMs('2026-10-25T09:00', NY)).toBe(Date.UTC(2026, 9, 25, 13, 0));
    expect(zonedInputValue(Date.UTC(2026, 9, 25, 7, 0), J)).toBe('2026-10-25T09:00');
    for (const tz of [J, NY, DUBAI, AUCKLAND, ADELAIDE]) {
      for (const value of ['2026-10-25T09:00', '2027-03-26T23:45', '2026-01-01T00:00']) {
        expect(zonedInputValue(zonedInputToMs(value, tz), tz)).toBe(value);
      }
    }
    expect(zonedInputToMs('', J)).toBeNaN();
    expect(zonedInputToMs('next tuesday', J)).toBeNaN();
  });

  it("names a zone's offset as of an instant", () => {
    const summer = Date.UTC(2026, 6, 1);
    const winter = Date.UTC(2026, 0, 15);
    expect(gmtOffsetLabel(J, summer)).toBe('GMT+3');
    expect(gmtOffsetLabel(J, winter)).toBe('GMT+2');
    expect(gmtOffsetLabel(NY, summer)).toBe('GMT-4');
    expect(gmtOffsetLabel('Asia/Kolkata', summer)).toBe('GMT+5:30');
    expect(gmtOffsetLabel('Asia/Kathmandu', summer)).toBe('GMT+5:45');
    expect(gmtOffsetLabel('UTC', summer)).toBe('GMT');
  });
});
