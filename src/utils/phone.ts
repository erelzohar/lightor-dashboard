/**
 * Phone helpers (LT-122, LT-404).
 *
 * Phones are stored in E.164 ("+972584006014") since LT-404; older rows may
 * still hold what was typed ("058-400 6014", "0584006014", "972…"). Every
 * shape goes through `toE164` first, the same reading the server makes
 * (lightor-back utils/phoneHelper.ts), so the dashboard and the API agree on
 * what is one number.
 */
import { parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js/min';

export type PhoneKind = 'mobile' | 'landline';

/** Home: the country a number written locally is read in unless a field says otherwise. */
export const HOME_COUNTRY = 'IL';

/**
 * LT-677: the countries a phone field can offer, Israel and the ones the
 * app knows abroad: the calling code, and how a local number is written
 * there (the field's placeholder). Which of them are open is the server's
 * word (services/phoneCountries).
 */
export const PHONE_COUNTRY_DATA: Readonly<Record<string, { dialCode: string; placeholder: string }>> = {
  IL: { dialCode: '972', placeholder: '050-123-4567' },
  US: { dialCode: '1', placeholder: '(212) 555-0123' },
};

/**
 * The one stored form, E.164, read as Israeli when written locally. Takes
 * "050-123 4567", "00972…", "+972 050…" (the trunk 0 kept after the country
 * code) and "972…" without a plus. Null when it is no valid number.
 *
 * LT-677: `country` is the country a local number is read in when it is not
 * Israel (a field's chip): "(212) 555-0123" read in the US is "+12125550123".
 * A number written with "+" or "00" is its own country's whatever is passed.
 */
export const toE164 = (phone: string | null | undefined, country: string = HOME_COUNTRY): string | null => {
  let raw = String(phone ?? '').trim();
  if (!raw) return null;
  raw = raw.replace(/[^\d+]/g, '');
  if (raw.startsWith('00')) raw = `+${raw.slice(2)}`;
  if (country === HOME_COUNTRY) {
    if (/^\+?9720\d/.test(raw)) raw = `+972${raw.replace(/^\+?9720/, '')}`;
    else if (/^972\d{8,9}$/.test(raw)) raw = `+${raw}`;
  } else if (/^\+9720\d/.test(raw)) {
    // Without a plus, "972…" is a local number there (972 is a Texas area code).
    raw = `+972${raw.slice(5)}`;
  }
  const parsed = parsePhoneNumberFromString(raw, country as CountryCode);
  return parsed?.isValid() ? parsed.format('E.164') : null;
};

/**
 * The country of a valid number ("IL", "US", "CA": what libphonenumber says,
 * so +1 is not always the US), read as `toE164` reads it. Null when it is no
 * valid number.
 */
export const phoneCountryOf = (phone: string | null | undefined): string | null => {
  const e164 = toE164(phone);
  return (e164 && parsePhoneNumberFromString(e164)?.country) || null;
};

/** A valid number outside Israel. */
export const isAbroadPhone = (phone: string | null | undefined): boolean => {
  const country = phoneCountryOf(phone);
  return !!country && country !== HOME_COUNTRY;
};

/**
 * LT-677: a number of one of the countries opened abroad, in E.164 (the only
 * form the API takes a number abroad in); null for anything else, an Israeli
 * number included.
 */
export const openAbroadE164 = (phone: string | null | undefined, abroad: readonly string[]): string | null => {
  if (!abroad.length) return null;
  const e164 = toE164(phone);
  const country = e164 && parsePhoneNumberFromString(e164)?.country;
  return e164 && country && country !== HOME_COUNTRY && abroad.includes(country) ? e164 : null;
};

/** The United States' time zones (IANA names), beside the `America/Indiana/...` style families below. */
const US_ZONES: ReadonlySet<string> = new Set([
  'America/New_York', 'America/Detroit', 'America/Chicago', 'America/Menominee', 'America/Denver', 'America/Boise',
  'America/Phoenix', 'America/Los_Angeles', 'America/Anchorage', 'America/Juneau', 'America/Sitka', 'America/Metlakatla',
  'America/Yakutat', 'America/Nome', 'America/Adak', 'Pacific/Honolulu',
]);

/**
 * Where the device is, by its clock: the first guess at the country of a
 * new owner who has no phone yet (LT-677). The time zone, not the language:
 * many phones in Israel are set to English ("en-US"), and their owners are
 * not in the United States. Null when the zone names no country we know.
 */
export const deviceCountry = (): string | null => {
  let zone = '';
  try {
    zone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? '';
  } catch {
    return null;
  }
  if (zone === 'Asia/Jerusalem' || zone === 'Asia/Tel_Aviv') return 'IL';
  if (US_ZONES.has(zone) || /^America\/(Indiana|Kentucky|North_Dakota)\//.test(zone) || /^US\//.test(zone)) return 'US';
  return null;
};

/**
 * A valid Israeli number's kind: a mobile (05X), which takes a code and
 * WhatsApp, or a landline (any other valid Israeli line, 07X VoIP included).
 * Null for anything else, foreign numbers included (Israel only for now).
 */
export const israeliPhoneKind = (phone: string | null | undefined): PhoneKind | null => {
  const e164 = toE164(phone);
  if (!e164) return null;
  const parsed = parsePhoneNumberFromString(e164);
  if (!parsed || parsed.country !== 'IL') return null;
  return String(parsed.nationalNumber).startsWith('5') ? 'mobile' : 'landline';
};

/**
 * Which numbers a field takes: an Israeli mobile only, any Israeli number
 * (mobile or landline), or any valid number in the world (LT-407: a
 * customer of a business abroad; written locally it is read as Israeli).
 * LT-677: `mobile` (an owner's phone) and `any` (a business's) also take a
 * valid number of a country opened abroad, where nothing tells a mobile
 * from a landline.
 */
export type PhoneAccept = 'mobile' | 'any' | 'world';

export interface PhoneChangeInfo {
  valid: boolean;
  /** An Israeli number's kind; null for a number abroad. */
  kind: PhoneKind | null;
}

/**
 * Whether a value is a number a field taking `accept` takes, and its kind.
 * `abroad` is the countries opened abroad (none: Israel only, as before
 * LT-677); `country` is the one a local number is read in (a field's chip).
 */
export const checkPhone = (
  value: string | null | undefined,
  accept: PhoneAccept,
  abroad: readonly string[] = [],
  country: string = HOME_COUNTRY
): PhoneChangeInfo => {
  const e164 = toE164(value, country);
  const kind = israeliPhoneKind(e164);
  if (accept === 'world') return { valid: !!e164, kind };
  if (kind) return { valid: accept === 'any' || kind === 'mobile', kind };
  return { valid: !!openAbroadE164(e164, abroad), kind: null };
};

/** Two writings of one number ("050-1234567", "+972501234567") are one number. */
export const samePhone = (a: string | null | undefined, b: string | null | undefined): boolean => {
  const x = toE164(a);
  if (x) return x === toE164(b);
  // Neither reads as a number: compare what was typed, digit by digit.
  const digits = (v: string | null | undefined) => (v ?? '').replace(/\D/g, '');
  return digits(a) !== '' && digits(a) === digits(b) && !toE164(b);
};

/**
 * How a phone reads on screen. An Israeli number in the national form with
 * one hyphen after its prefix ("050-1234567", "03-1234567", "077-1234567");
 * a foreign one internationally, its "+" kept ("+1 415 555 2671"); anything
 * that is no valid number exactly as it was stored. Show it in a `dir="ltr"`
 * box: a foreign number's spaces reorder in a right-to-left line.
 */
export const formatPhoneForDisplay = (phone: string | null | undefined): string => {
  const e164 = toE164(phone);
  if (!e164) return (phone ?? '').trim();
  const parsed = parsePhoneNumberFromString(e164);
  if (!parsed) return e164;
  if (parsed.country !== 'IL') return parsed.formatInternational();
  const national = String(parsed.nationalNumber);
  // 1-700 / 1-800 lines have their own grouping.
  if (national.startsWith('1')) return parsed.formatNational();
  // Mobiles (5X) and the non-geographic 7X lines have a 3-digit prefix;
  // the area codes 02/03/04/08/09 have two.
  const prefixLength = /^[57]/.test(national) ? 2 : 1;
  return `0${national.slice(0, prefixLength)}-${national.slice(prefixLength)}`;
};

/** A call link: "tel:+972584006014"; a value that is no number keeps its digits (and a leading +). */
export const telHref = (phone: string | null | undefined): string => {
  const e164 = toE164(phone);
  if (e164) return `tel:${e164}`;
  const raw = (phone ?? '').trim();
  return `tel:${raw.startsWith('+') ? '+' : ''}${raw.replace(/\D/g, '')}`;
};

/** A WhatsApp link: wa.me takes the international digits, no "+": "https://wa.me/972584006014". */
export const whatsAppHref = (phone: string | null | undefined): string => {
  const e164 = toE164(phone);
  if (e164) return `https://wa.me/${e164.slice(1)}`;
  const digits = (phone ?? '').replace(/\D/g, '');
  return `https://wa.me/${digits.startsWith('0') ? `972${digits.slice(1)}` : digits}`;
};
