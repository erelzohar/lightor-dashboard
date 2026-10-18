/**
 * Phone helpers (LT-122, LT-404).
 *
 * Phones are stored in E.164 ("+972584006014") since LT-404; older rows may
 * still hold what was typed ("058-400 6014", "0584006014", "972…"). Every
 * shape goes through `toE164` first, the same reading the server makes
 * (lightor-back utils/phoneHelper.ts), so the dashboard and the API agree on
 * what is one number.
 */
import { parsePhoneNumberFromString } from 'libphonenumber-js/min';

export type PhoneKind = 'mobile' | 'landline';

/**
 * The one stored form, E.164, read as Israeli when written locally. Takes
 * "050-123 4567", "00972…", "+972 050…" (the trunk 0 kept after the country
 * code) and "972…" without a plus. Null when it is no valid number.
 */
export const toE164 = (phone: string | null | undefined): string | null => {
  let raw = String(phone ?? '').trim();
  if (!raw) return null;
  raw = raw.replace(/[^\d+]/g, '');
  if (raw.startsWith('00')) raw = `+${raw.slice(2)}`;
  if (/^\+?9720\d/.test(raw)) raw = `+972${raw.replace(/^\+?9720/, '')}`;
  else if (/^972\d{8,9}$/.test(raw)) raw = `+${raw}`;
  const parsed = parsePhoneNumberFromString(raw, 'IL');
  return parsed?.isValid() ? parsed.format('E.164') : null;
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

/** Which numbers a field takes: an Israeli mobile only, or any Israeli number (mobile or landline). */
export type PhoneAccept = 'mobile' | 'any';

export interface PhoneChangeInfo {
  valid: boolean;
  kind: PhoneKind | null;
}

/** Whether a value is a number a field taking `accept` takes, and its kind. */
export const checkPhone = (value: string | null | undefined, accept: PhoneAccept): PhoneChangeInfo => {
  const kind = israeliPhoneKind(value);
  return { valid: !!kind && (accept === 'any' || kind === 'mobile'), kind };
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
