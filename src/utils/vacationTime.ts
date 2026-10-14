import { zonedInputToMs, zonedInputValue, zonedParts } from './businessTime';

/**
 * A vacation's times on the business's clock (LT-318). Stored as epoch ms;
 * typed in a `datetime-local` input ("YYYY-MM-DDTHH:MM") as the business's
 * wall clock, never the device's.
 */

/** A vacation's start or end as an instant: stored ms, or an input's value. NaN when neither. */
export const vacationMs = (value: string, timeZone: string): number => {
  if (value === undefined || value === null || value === '') return NaN;
  if (!isNaN(+value)) return +value;
  const zoned = zonedInputToMs(value, timeZone);
  return isNaN(zoned) ? new Date(value).getTime() : zoned;
};

/** A vacation's start or end as a `datetime-local` value on the business's clock; '' when unreadable. */
export const vacationInputValue = (value: string, timeZone: string): string => {
  const ms = vacationMs(value, timeZone);
  return Number.isFinite(ms) ? zonedInputValue(ms, timeZone) : '';
};

/**
 * Whole days a vacation spans, by the business's wall clock: a day the clock
 * goes back or forward is still one day, not 25 or 23 hours of one.
 */
export const vacationDays = (startMs: number, endMs: number, timeZone: string): number => {
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return 0;
  const wall = (ms: number) => {
    const p = zonedParts(ms, timeZone);
    return Date.UTC(p.year, p.month, p.day, p.hour, p.minute);
  };
  return Math.ceil((wall(endMs) - wall(startMs)) / (1000 * 60 * 60 * 24));
};
