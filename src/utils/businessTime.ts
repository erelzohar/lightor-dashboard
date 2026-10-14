/**
 * The business's clock (LT-315): Asia/Jerusalem, whatever the device says.
 *
 * Opening hours, "today", the slots offered and the timestamp a booking
 * stores are all wall-clock times in Israel — the server renders the SMS
 * confirmation and the reminders there. Built with the device's clock, an
 * owner whose phone was on London time booked 16:00 and stored 18:00 Israel
 * time. These helpers turn between an instant (epoch ms) and the Israeli
 * wall clock with Intl alone, so they follow the clock changes (Israel
 * falls back on 2026-10-25) without a time-zone library.
 *
 * A calendar day travels as a plain local `Date` built from its year, month
 * and day (`new Date(y, m, d)`): only its components are read, never its
 * instant, so the device's zone cannot move it. Days are stepped by their
 * components too, never by 86 400 000 ms.
 */
export const BUSINESS_TZ = 'Asia/Jerusalem';

interface WallClock {
  year: number;
  /** 0-based, as Date's. */
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

let partsFormat: Intl.DateTimeFormat | null = null;
const formatter = (): Intl.DateTimeFormat => {
  if (!partsFormat) {
    partsFormat = new Intl.DateTimeFormat('en-US', {
      timeZone: BUSINESS_TZ,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
    });
  }
  return partsFormat;
};

/** The Israeli wall clock at an instant. */
export const businessClock = (ms: number): WallClock => {
  const out: Record<string, number> = {};
  for (const part of formatter().formatToParts(new Date(ms))) {
    if (part.type !== 'literal') out[part.type] = Number(part.value);
  }
  return {
    year: out.year,
    month: out.month - 1,
    day: out.day,
    // Some engines say "24" for midnight even with h23.
    hour: out.hour === 24 ? 0 : out.hour,
    minute: out.minute,
    second: out.second,
  };
};

/** How far Israel's clock is ahead of UTC at an instant, in ms (2 or 3 hours). */
const offsetAt = (ms: number): number => {
  const c = businessClock(ms);
  return Date.UTC(c.year, c.month, c.day, c.hour, c.minute, c.second) - Math.floor(ms / 1000) * 1000;
};

/**
 * The instant at which Israel's clock reads this date and time (month
 * 0-based; overflowing values roll over as Date.UTC's do). Two passes: the
 * offset is read at a first guess, then again where that lands, so a time on
 * the day the clocks change gets the offset in force at that time.
 */
export const businessTimeToMs = (year: number, month: number, day: number, hour = 0, minute = 0): number => {
  const wall = Date.UTC(year, month, day, hour, minute);
  const first = wall - offsetAt(wall);
  const second = offsetAt(first);
  return wall - second;
};

const pad = (n: number): string => String(n).padStart(2, '0');

/** An instant's Israeli calendar date, "YYYY-MM-DD". */
export const businessDateKey = (ms: number): string => {
  const c = businessClock(ms);
  return `${c.year}-${pad(c.month + 1)}-${pad(c.day)}`;
};

/** An instant's Israeli calendar date, as a calendar-day `Date` (see above). */
export const businessDay = (ms: number = Date.now()): Date => {
  const c = businessClock(ms);
  return new Date(c.year, c.month, c.day);
};

/** An instant's Israeli time of day, "HH:MM". */
export const businessTimeOfDay = (ms: number): string => {
  const c = businessClock(ms);
  return `${pad(c.hour)}:${pad(c.minute)}`;
};
