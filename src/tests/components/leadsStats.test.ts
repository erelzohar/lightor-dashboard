import { describe, it, expect, beforeAll } from 'vitest';
import i18next, { type TFunction } from 'i18next';
import { formatResponseTime, monthChange } from '../../components/dashboard/LeadsStats';
import he from '../../i18n/locales/he.json';
import en from '../../i18n/locales/en.json';
import fr from '../../i18n/locales/fr.json';
import ar from '../../i18n/locales/ar.json';

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

// The real strings, so the units read as the owner sees them.
const tFor: Record<string, TFunction> = {};
beforeAll(async () => {
  for (const [lng, translation] of Object.entries({ he, en, fr, ar })) {
    const instance = i18next.createInstance();
    await instance.init({ lng, resources: { [lng]: { translation } }, interpolation: { escapeValue: false } });
    tFor[lng] = instance.t;
  }
});

/** LT-274 — the leads home's average response time and month-on-month change. */
describe('formatResponseTime', () => {
  it('reads minutes under an hour, hours with one decimal under two days, and days beyond', () => {
    const he = (ms: number | null) => formatResponseTime(ms, tFor.he, 'he');
    expect(he(null)).toBe('-');
    expect(he(20_000)).toBe('1 דק׳'); // never "0 minutes"
    expect(he(45 * MIN)).toBe('45 דק׳');
    expect(he(59.6 * MIN)).toBe('1 שעה'); // rounds into hours, not "60 min"
    expect(he(90 * MIN)).toBe('1.5 שעות');
    expect(he(2 * HOUR)).toBe('2 שעות'); // no ".0"
    expect(he(47.9 * HOUR)).toBe('47.9 שעות');
    expect(he(47.96 * HOUR)).toBe('2 ימים');
    expect(he(3 * DAY + 5 * HOUR)).toBe('3 ימים');
  });

  it('uses each language’s units and decimal mark, in Western digits', () => {
    expect(formatResponseTime(2.5 * HOUR, tFor.en, 'en')).toBe('2.5 hours');
    expect(formatResponseTime(HOUR, tFor.en, 'en')).toBe('1 hour');
    expect(formatResponseTime(2.5 * HOUR, tFor.fr, 'fr')).toBe('2,5 h');
    expect(formatResponseTime(2.5 * HOUR, tFor.ar, 'ar')).toBe('2.5 س');
  });
});

describe('monthChange', () => {
  it('compares with last month, and stays silent when last month had nothing', () => {
    expect(monthChange(12, 8)).toBe(50);
    expect(monthChange(6, 8)).toBe(-25);
    expect(monthChange(5, 0)).toBeNull();
    expect(monthChange(0, 0)).toBeNull();
  });
});
