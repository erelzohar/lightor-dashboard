import { describe, it, expect } from 'vitest';
import { businessCountryOf, businessFormats, usesAmericanFormats } from '../../utils/businessFormats';

/**
 * LT-702: a business in the United States (by its business phone) writes the
 * 12-hour clock and the month before the day; every other business writes
 * exactly what the dashboard wrote before.
 */
const LANGS = ['he', 'en', 'ar', 'fr', 'es'] as const;
// The ternary every page copied before LT-702.
const OLD_LOCALE: Record<string, string> = { he: 'he-IL', ar: 'ar', fr: 'fr', es: 'es', en: 'en-GB' };
const OLD_WRITTEN: Record<string, string> = { he: 'he-IL', ar: 'ar-u-nu-latn', fr: 'fr-FR', es: 'es-ES', en: 'en-GB' };
const FSI = '⁨';
const PDI = '⁩';

const at = (h: number, m = 0) => new Date(2026, 11, 2, h, m);

describe('which countries write the American way (LT-702)', () => {
  it('is the United States only, by the business phone', () => {
    expect(usesAmericanFormats('US')).toBe(true);
    for (const c of ['IL', 'CA', 'GB', 'FR', null, undefined, '']) expect(usesAmericanFormats(c)).toBe(false);
    expect(businessCountryOf('+12125550142')).toBe('US');
    expect(businessCountryOf('+972501234567')).toBe('IL');
    expect(businessCountryOf('+14165550123')).toBe('CA');
    expect(businessCountryOf('')).toBeNull();
    expect(businessCountryOf(undefined)).toBeNull();
    expect(businessCountryOf({ not: 'a phone' })).toBeNull();
  });
});

describe('a business that is not American writes what it wrote before', () => {
  for (const country of ['IL', 'CA', null]) {
    for (const lang of LANGS) {
      it(`${country ?? 'no phone'} in ${lang}`, () => {
        const f = businessFormats(lang, country);
        expect(f.american).toBe(false);
        expect(f.hour12).toBe(false);
        expect(f.monthFirst).toBe(false);
        expect(f.dateLocale).toBe(OLD_LOCALE[lang]);
        expect(f.writtenDateLocale).toBe(OLD_WRITTEN[lang]);
        expect(f.numberLocale).toBe(OLD_LOCALE[lang]);
        expect(f.time(at(15))).toBe('15:00');
        expect(f.time(at(0))).toBe('00:00');
        expect(f.time(at(9, 5))).toBe('09:05');
        expect(f.clock('15:00')).toBe('15:00');
        expect(f.clock('09:30')).toBe('09:30');
        expect(f.hour(15)).toBe('15:00');
        expect(f.hour(7)).toBe('07:00');
        const options = { day: '2-digit', month: 'short', year: 'numeric' } as const;
        expect(f.dateTime(at(14, 30), options)).toBe(at(14, 30).toLocaleString(OLD_LOCALE[lang], { ...options, hour: '2-digit', minute: '2-digit' }));
      });
    }
  }

  it('reads the zone as before', () => {
    const ms = Date.UTC(2026, 11, 2, 20, 0); // 15:00 in New York, 22:00 in Jerusalem
    expect(businessFormats('en', 'IL').zonedTime(ms, 'Asia/Jerusalem')).toBe('22:00');
    expect(businessFormats('en', 'IL').zonedTime(ms, 'America/New_York')).toBe('15:00');
  });

  it('has no language yet: Hebrew, as the pages assumed', () => {
    expect(businessFormats(undefined, null).dateLocale).toBe('he-IL');
  });
});

describe('an American business', () => {
  it('in English: en-US, the 12-hour clock, midnight and noon', () => {
    const f = businessFormats('en', 'US');
    expect(f.american).toBe(true);
    expect(f.hour12).toBe(true);
    expect(f.monthFirst).toBe(true);
    expect(f.dateLocale).toBe('en-US');
    expect(f.writtenDateLocale).toBe('en-US');
    expect(f.numberLocale).toBe('en-GB');
    expect(f.time(at(15))).toBe('3:00 PM');
    expect(f.time(at(0))).toBe('12:00 AM');
    expect(f.time(at(12))).toBe('12:00 PM');
    expect(f.time(at(9, 5))).toBe('9:05 AM');
    expect(f.hour(15)).toBe('3 PM');
    expect(f.hour(0)).toBe('12 AM');
    expect(f.hour(12)).toBe('12 PM');
    expect(at(15).toLocaleDateString(f.dateLocale)).toBe('12/2/2026');
    expect(at(15).toLocaleDateString(f.dateLocale, { month: 'short', day: 'numeric', year: 'numeric' })).toBe('Dec 2, 2026');
    expect(at(15).toLocaleDateString(f.dateLocale, { weekday: 'long', month: 'short', day: 'numeric' })).toBe('Wednesday, Dec 2');
    expect(f.dateTime(at(14, 30), { day: '2-digit', month: 'short', year: 'numeric' })).toBe('Dec 02, 2026, 2:30 PM');
  });

  it('keeps the data as it is: an "HH:MM" string is only drawn differently', () => {
    const f = businessFormats('en', 'US');
    expect(f.clock('15:00')).toBe('3:00 PM');
    expect(f.clock('00:00')).toBe('12:00 AM');
    expect(f.clock('12:00')).toBe('12:00 PM');
    expect(f.clock('24:00')).toBe('12:00 AM');
    expect(f.clock('9:30')).toBe('9:30 AM');
    expect(f.clock('not a time')).toBe('not a time');
    expect(f.clock('')).toBe('');
  });

  it('reads the business zone, not the device', () => {
    const ms = Date.UTC(2026, 11, 2, 20, 0);
    expect(businessFormats('en', 'US').zonedTime(ms, 'America/New_York')).toBe('3:00 PM');
    expect(businessFormats('en', 'US').zonedTime(ms, 'America/Los_Angeles')).toBe('12:00 PM');
  });

  it('in Spanish: es-US', () => {
    const f = businessFormats('es', 'US');
    expect(f.dateLocale).toBe('es-US');
    expect(f.writtenDateLocale).toBe('es-US');
    expect(f.monthFirst).toBe(true);
    expect(f.numberLocale).toBe('es');
    expect(f.time(at(15))).toMatch(/^3:00 p\.\s?m\.$/);
    expect(f.hour(15)).toMatch(/^3 p\.\s?m\.$/);
  });

  it('in French: its own dates, only the clock turns 12-hour', () => {
    const f = businessFormats('fr', 'US');
    expect(f.dateLocale).toBe('fr');
    expect(f.writtenDateLocale).toBe('fr-FR');
    expect(f.monthFirst).toBe(false);
    expect(f.time(at(15))).toBe('3:00 PM');
    expect(f.hour(15)).toBe('3 PM');
  });

  it('in Hebrew and Arabic: its own dates, the 12-hour clock isolated so it does not flip', () => {
    const he = businessFormats('he', 'US');
    expect(he.dateLocale).toBe('he-IL');
    expect(he.monthFirst).toBe(false);
    expect(he.time(at(15))).toBe(`${FSI}3:00 PM${PDI}`);
    expect(he.time(at(0))).toBe(`${FSI}12:00 AM${PDI}`);
    expect(he.hour(15)).toBe(`${FSI}3 PM${PDI}`);
    expect(he.clock('12:00')).toBe(`${FSI}12:00 PM${PDI}`);
    expect(he.dateTime(at(14, 30), { day: '2-digit', month: 'short' })).toBe(
      `${at(14, 30).toLocaleDateString('he-IL', { day: '2-digit', month: 'short' })}, ${FSI}2:30 PM${PDI}`,
    );

    const ar = businessFormats('ar', 'US');
    expect(ar.dateLocale).toBe('ar');
    expect(ar.writtenDateLocale).toBe('ar-u-nu-latn');
    // Latin digits, as its 24-hour clock had.
    expect(ar.time(at(15))).toMatch(new RegExp(`^${FSI}3:00 \\S+${PDI}$`));
  });
});
