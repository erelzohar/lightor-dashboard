import { phoneCountryOf } from './phone';
import { zonedTimeLabel, zonedWallDate } from './businessTime';

/**
 * LT-702: how a business writes its dates and clock times, by its country
 * (its business phone's country). The one place that says which countries
 * write the American way: add a country here and every screen follows.
 */
const AMERICAN_FORMAT_COUNTRIES: ReadonlySet<string> = new Set(['US']);

/** True when a business of this country writes the 12-hour clock and the month before the day. */
export const usesAmericanFormats = (country: string | null | undefined): boolean =>
  !!country && AMERICAN_FORMAT_COUNTRIES.has(country);

/** The country of a business phone, or null (no phone, not a number). */
export const businessCountryOf = (phone: unknown): string | null =>
  typeof phone === 'string' && phone.trim() ? phoneCountryOf(phone) : null;

/** The dashboard's date locale per language, as every page wrote it before LT-702. */
const baseDateLocale = (lang: string): string =>
  lang === 'he' ? 'he-IL' : lang === 'ar' ? 'ar' : lang === 'fr' ? 'fr' : lang === 'es' ? 'es' : 'en-GB';

/** The Blog and domain pages' own variant (Latin digits in Arabic, region-tagged French and Spanish). */
const baseWrittenDateLocale = (lang: string): string =>
  lang === 'he' ? 'he-IL' : lang === 'ar' ? 'ar-u-nu-latn' : lang === 'fr' ? 'fr-FR' : lang === 'es' ? 'es-ES' : 'en-GB';

/** An American business: English and Spanish take their US locale, other languages keep their own. */
const americanLocale = (lang: string): string | null =>
  lang === 'en' ? 'en-US' : lang === 'es' ? 'es-US' : null;

const pad = (n: number): string => String(n).padStart(2, '0');

/** Intl puts bidi marks and narrow no-break spaces into some clocks; a label wants neither. */
const clean = (s: string): string => s.replace(/[‎‏؜]/g, '').replace(/[  ]/g, ' ');

const CLOCK_RE = /^(\d{1,2}):(\d{2})$/;

export interface BusinessFormats {
  /** The business writes the American way (12-hour clock, month before day). */
  american: boolean;
  /** The clock is 12-hour ("3:00 PM"). */
  hour12: boolean;
  /** date-fns patterns put the month before the day (American, in English or Spanish). */
  monthFirst: boolean;
  /** The locale for `toLocaleDateString` / `Intl.DateTimeFormat` dates. */
  dateLocale: string;
  /** The Blog and domain pages' variant of `dateLocale`. */
  writtenDateLocale: string;
  /** The page language's own locale whatever the country, for money and numbers (dates take `dateLocale`). */
  numberLocale: string;
  /**
   * A date with its clock, in `dateLocale`: `toLocaleString` with these date
   * options and "14:30" as before; for an American business the date, ", "
   * and the 12-hour clock ("Dec 02, 2026, 2:30 PM").
   */
  dateTime: (value: Date | number | string, dateOptions: Intl.DateTimeFormatOptions) => string;
  /**
   * A device-local Date's clock (its own fields): "15:00" / "3:00 PM". A
   * 12-hour clock in Hebrew or Arabic comes inside a first-strong isolate.
   */
  time: (date: Date | number) => string;
  /** An instant on the business's clock in `tz`: "15:00" / "3:00 PM". */
  zonedTime: (ms: number, tz: string) => string;
  /** An "HH:MM" data string as drawn: unchanged / "3:00 PM". Anything else comes back as it is. */
  clock: (hhmm: string) => string;
  /** A calendar hour column's label: "15:00" / "3 PM". */
  hour: (h: number) => string;
}

export const businessFormats = (language: string | null | undefined, country: string | null | undefined): BusinessFormats => {
  const lang = language || 'he';
  const american = usesAmericanFormats(country);
  const usLocale = american ? americanLocale(lang) : null;
  const numberLocale = baseDateLocale(lang);
  const dateLocale = usLocale ?? numberLocale;
  const writtenDateLocale = usLocale ?? baseWrittenDateLocale(lang);
  // The 12-hour clock in the page's language; Arabic keeps the Latin digits its 24-hour clock had.
  const timeLocale = lang === 'ar' ? 'ar-u-nu-latn' : dateLocale;

  if (!american) {
    return {
      american, hour12: false, monthFirst: false, dateLocale, writtenDateLocale, numberLocale,
      dateTime: (value, dateOptions) =>
        new Date(value).toLocaleString(dateLocale, { ...dateOptions, hour: '2-digit', minute: '2-digit' }),
      time: (date) => {
        const d = new Date(date);
        return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
      },
      zonedTime: zonedTimeLabel,
      clock: (hhmm) => hhmm,
      hour: (h) => `${pad(h)}:00`,
    };
  }

  const minuteFormat = new Intl.DateTimeFormat(timeLocale, { hour: 'numeric', minute: '2-digit', hour12: true });
  const hourFormat = new Intl.DateTimeFormat(timeLocale, { hour: 'numeric', hour12: true });
  // In a right-to-left page the clock is isolated (first-strong), so "3:00 PM" does not read "PM 3:00".
  const rtl = lang === 'he' || lang === 'ar';
  const isolate = (text: string): string => (rtl ? `\u2068${text}\u2069` : text);
  const time = (date: Date | number): string => isolate(clean(minuteFormat.format(new Date(date))));
  return {
    american, hour12: true, monthFirst: !!usLocale, dateLocale, writtenDateLocale, numberLocale,
    time,
    dateTime: (value, dateOptions) => {
      const date = new Date(value);
      return `${date.toLocaleDateString(dateLocale, dateOptions)}, ${time(date)}`;
    },
    zonedTime: (ms, tz) => time(zonedWallDate(ms, tz)),
    clock: (hhmm) => {
      const match = CLOCK_RE.exec(hhmm ?? '');
      if (!match) return hhmm;
      const h = Number(match[1]);
      const m = Number(match[2]);
      if (h > 24 || m > 59) return hhmm;
      return time(new Date(2000, 0, 1, h % 24, m));
    },
    hour: (h) => isolate(clean(hourFormat.format(new Date(2000, 0, 1, h % 24)))),
  };
};
