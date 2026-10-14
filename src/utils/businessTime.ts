/**
 * The business's own clock (LT-318). Every wall-clock time the business
 * works by — opening hours, a slot, a vacation's start — is a time in the
 * BUSINESS's time zone, never the device's: an owner whose phone is set an
 * hour ahead must still book 11:00 as the business's 11:00.
 *
 * Calendar days travel as "carrier" Dates at local midnight
 * (`new Date(y, m, d)`): only their year, month, date and weekday are read,
 * and a calendar date's weekday is the same in every zone. A carrier never
 * stands for an instant; it becomes one only through these helpers.
 *
 * A mirror of the public site's own helpers (lightor-front): the two apps
 * share no package, so a fix to one belongs in the other too.
 */

/** The server's default, for a config saved before LT-318 or one that is not a zone. */
export const DEFAULT_TIME_ZONE = 'Asia/Jerusalem';

const validity = new Map<string, boolean>();

/** True for a name this browser knows as an IANA time zone. */
export const isValidTimeZone = (tz: unknown): tz is string => {
  if (typeof tz !== 'string' || !tz) return false;
  let valid = validity.get(tz);
  if (valid === undefined) {
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: tz });
      valid = true;
    } catch {
      valid = false;
    }
    validity.set(tz, valid);
  }
  return valid;
};

/** The business's zone: its own when it is one, else the server's default. */
export const businessTimeZone = (config?: { timeZone?: string } | null): string =>
  isValidTimeZone(config?.timeZone) ? config.timeZone : DEFAULT_TIME_ZONE;

/**
 * The device's own zone, for a site created on it (AiBuilder) — undefined
 * when the browser cannot tell, or tells only "UTC": no business is located
 * in UTC, it is what a privacy setting or an unset machine reports, and the
 * server's default serves such an owner better.
 */
export const deviceTimeZone = (): string | undefined => {
  let tz: string | undefined;
  try {
    tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return undefined;
  }
  if (!isValidTimeZone(tz)) return undefined;
  if (tz === 'UTC' || tz === 'GMT' || tz.startsWith('Etc/')) return undefined;
  return tz;
};

export interface ZonedParts {
  year: number;
  /** 0-based, as Date's. */
  month: number;
  day: number;
  hour: number;
  minute: number;
}

const formatters = new Map<string, Intl.DateTimeFormat>();
const formatterFor = (tz: string): Intl.DateTimeFormat => {
  let formatter = formatters.get(tz);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
    });
    formatters.set(tz, formatter);
  }
  return formatter;
};

/** The wall clock in `tz` at this instant. */
export const zonedParts = (ms: number, tz: string): ZonedParts => {
  const parts: Partial<Record<Intl.DateTimeFormatPartTypes, number>> = {};
  for (const part of formatterFor(tz).formatToParts(ms)) {
    if (part.type !== 'literal') parts[part.type] = Number(part.value);
  }
  return {
    year: parts.year,
    month: parts.month - 1,
    day: parts.day,
    // Some engines still say 24 for midnight despite h23.
    hour: parts.hour % 24,
    minute: parts.minute,
  };
};

// Offsets change only on a quarter hour of UTC: every zone is a whole number
// of quarter hours off UTC (Asia/Kathmandu +5:45, Pacific/Chatham +12:45) and
// changes on a local whole hour. Cached per (zone, quarter hour), worked out
// at the quarter's start: uncached Intl calls in the slot loops made a
// predecessor's calendar thousands of times slower.
const QUARTER_HOUR = 900_000;
const MAX_CACHED = 20_000;
const offsets = new Map<string, number>();

/** How far `tz`'s wall clock is ahead of UTC at this instant, in ms. */
export const zoneOffsetMs = (ms: number, tz: string): number => {
  const bucket = Math.floor(ms / QUARTER_HOUR);
  const key = `${tz}|${bucket}`;
  let offset = offsets.get(key);
  if (offset === undefined) {
    const at = bucket * QUARTER_HOUR;
    const p = zonedParts(at, tz);
    offset = Date.UTC(p.year, p.month, p.day, p.hour, p.minute) - at;
    if (offsets.size >= MAX_CACHED) offsets.clear();
    offsets.set(key, offset);
  }
  return offset;
};

/**
 * The instant at which `tz`'s wall clock reads y-m-d h:min (month 0-based;
 * minutes past 59 roll over, as Date.UTC's do). A time the clock skips when
 * it goes forward lands after the jump; a time it shows twice when it goes
 * back is the later of the two.
 */
export const zonedTimeToMs = (y: number, m: number, d: number, h: number, min: number, tz: string): number => {
  const wall = Date.UTC(y, m, d, h, min);
  const guess = wall - zoneOffsetMs(wall, tz);
  // Again from the guess: it may sit on the other side of a change.
  return wall - zoneOffsetMs(guess, tz);
};

/** A carrier day at h:min on the business's clock, as an instant. */
export const zonedSlotMs = (day: Date, h: number, min: number, tz: string): number =>
  zonedTimeToMs(day.getFullYear(), day.getMonth(), day.getDate(), h, min, tz);

/** The carrier of the business's calendar day at this instant. */
export const zonedDateOf = (ms: number, tz: string): Date => {
  const p = zonedParts(ms, tz);
  return new Date(p.year, p.month, p.day);
};

/** The business's today, as a carrier. */
export const zonedToday = (tz: string, now = Date.now()): Date => zonedDateOf(now, tz);

const pad = (n: number): string => String(n).padStart(2, '0');

/** "HH:MM" on the business's clock. */
export const zonedTimeLabel = (ms: number, tz: string): string => {
  const p = zonedParts(ms, tz);
  return `${pad(p.hour)}:${pad(p.minute)}`;
};

/** "YYYY-MM-DD" of the business's calendar day at this instant. */
export const zonedDateKey = (ms: number, tz: string): string => {
  const p = zonedParts(ms, tz);
  return `${p.year}-${pad(p.month + 1)}-${pad(p.day)}`;
};

/** "YYYY-MM-DDTHH:MM" on the business's clock — a `datetime-local` input's value. */
export const zonedInputValue = (ms: number, tz: string): string => {
  const p = zonedParts(ms, tz);
  return `${p.year}-${pad(p.month + 1)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
};

const INPUT_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/;

/** A `datetime-local` value read as the business's wall clock; NaN when it is not one. */
export const zonedInputToMs = (value: string, tz: string): number => {
  const match = INPUT_RE.exec(value ?? '');
  if (!match) return NaN;
  const [, y, mo, d, h, mi] = match.map(Number);
  return zonedTimeToMs(y, mo - 1, d, h, mi, tz);
};

/**
 * A device-local Date whose fields read the business's wall clock at this
 * instant — for formatters (date-fns) that only know the device's zone.
 * Display only, never an instant: a wall time the DEVICE's clock skips
 * (its own spring-forward hour) shows an hour on.
 */
export const zonedWallDate = (ms: number, tz: string): Date => {
  const p = zonedParts(ms, tz);
  return new Date(p.year, p.month, p.day, p.hour, p.minute);
};

/** "GMT+3", "GMT+5:30", "GMT-4", "GMT" — the zone's offset at this instant. */
export const gmtOffsetLabel = (tz: string, now = Date.now()): string => {
  const minutes = Math.round(zoneOffsetMs(now, tz) / 60_000);
  if (minutes === 0) return 'GMT';
  const sign = minutes > 0 ? '+' : '-';
  const abs = Math.abs(minutes);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `GMT${sign}${h}${m ? `:${pad(m)}` : ''}`;
};
