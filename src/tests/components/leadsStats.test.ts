import { describe, it, expect, beforeAll } from 'vitest';
import i18next, { type TFunction } from 'i18next';
import { conversionRate, formatResponseTime, monthChange } from '../../components/dashboard/LeadsStats';
import type { LeadStats } from '../../services/leadsApi';
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

/** LT-569: the share of the 30 days' visits that left a lead. */
describe('conversionRate', () => {
  const perDay = Array.from({ length: 30 }, (_, i) => ({ date: `2026-10-${String(i + 2).padStart(2, '0')}`, count: i % 10 === 0 ? 2 : 0 }));
  const stats = (visits: LeadStats['visits']): LeadStats =>
    ({ thisMonth: 0, lastMonth: 0, waiting: 0, last30: { total: 6, handled: 0 }, avgResponseMs: null, perDay, topic: null, visits });

  it('is the leads per hundred visits, to one decimal', () => {
    expect(conversionRate(stats({ thisMonth: 0, lastMonthToDate: 0, last30: 140, perDay: [], since: '2026-09-01' }))).toEqual({ rate: 4.3, leads: 6, visits: 140 });
  });

  it('counts only the leads from the day the visits were counted', () => {
    // Leads on 2, 12 and 22 October; visits counted from the 10th.
    expect(conversionRate(stats({ thisMonth: 0, lastMonthToDate: 0, last30: 40, perDay: [], since: '2026-10-10' }))).toEqual({ rate: 10, leads: 4, visits: 40 });
  });

  it('is none without a visit, or from an older API', () => {
    expect(conversionRate(stats({ thisMonth: 0, lastMonthToDate: 0, last30: 0, perDay: [], since: null }))).toBeNull();
    expect(conversionRate(stats(undefined))).toBeNull();
  });
});
