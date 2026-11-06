import { describe, it, expect, beforeAll } from 'vitest';
import i18n from '../../i18n/config';

/**
 * LT-601: the home's counts read right for one and for many - "1 appointments"
 * was on the English demo's income cards, "1 תורים" on the Hebrew ones. The
 * app's own i18next (Hebrew fallback and all), the real strings, every form a
 * language has: Hebrew one/two/other, Arabic's six (0, 1, 2, 3-10, 11-99, 100+).
 */
beforeAll(async () => {
  await i18n.changeLanguage('en');
});

const say = (lng: string, key: string, count: number) => i18n.getFixedT(lng)(key, { count });

const APPOINTMENTS: Record<string, Record<number, string>> = {
  en: { 0: '0 appointments', 1: '1 appointment', 2: '2 appointments', 12: '12 appointments' },
  he: { 0: '0 תורים', 1: 'תור אחד', 2: '2 תורים', 12: '12 תורים', 20: '20 תורים' },
  ar: {
    0: 'لا مواعيد', 1: 'موعد واحد', 2: 'موعدان', 3: '3 مواعيد', 10: '10 مواعيد',
    11: '11 موعدًا', 99: '99 موعدًا', 100: '100 موعد', 103: '103 مواعيد',
  },
  es: { 0: '0 citas', 1: '1 cita', 2: '2 citas', 12: '12 citas' },
  fr: { 0: '0 rendez-vous', 1: '1 rendez-vous', 2: '2 rendez-vous', 12: '12 rendez-vous' },
};

describe('count texts in every language (LT-601)', () => {
  it.each(Object.keys(APPOINTMENTS))('%s: the income cards, the services chart and the home list', (lng) => {
    for (const [count, text] of Object.entries(APPOINTMENTS[lng])) {
      expect(say(lng, 'incomeStats.appointments', Number(count))).toBe(text);
      expect(say(lng, 'dashboardList.total', Number(count))).toBe(text);
    }
  });

  it.each([
    ['en', { 1: '1 participant', 12: '12 participants' }],
    ['he', { 1: 'משתתף אחד', 2: '2 משתתפים', 12: '12 משתתפים' }],
    ['ar', { 0: 'لا مشاركين', 1: 'مشارك واحد', 2: 'مشاركان', 5: '5 مشاركين', 12: '12 مشاركًا', 100: '100 مشارك' }],
    ['es', { 1: '1 participante', 12: '12 participantes' }],
    ['fr', { 0: '0 participant', 1: '1 participant', 12: '12 participants' }],
  ] as const)("%s: a class's headcount", (lng, texts) => {
    for (const [count, text] of Object.entries(texts)) {
      expect(say(lng, 'appointments.session.participants', Number(count))).toBe(text);
    }
  });

  it.each([
    ['en', { 1: '1 cancelled', 3: '3 cancelled' }],
    ['he', { 1: 'ביטול אחד', 3: '3 ביטולים' }],
    ['ar', { 1: 'إلغاء واحد', 2: 'إلغاءان', 3: '3 إلغاءات', 11: '11 إلغاءً', 100: '100 إلغاء' }],
    ['es', { 1: '1 cancelado', 3: '3 cancelados' }],
    ['fr', { 1: '1 annulé', 3: '3 annulés' }],
  ] as const)("%s: a class's cancelled bookings", (lng, texts) => {
    for (const [count, text] of Object.entries(texts)) {
      expect(say(lng, 'appointments.session.cancelledCount', Number(count))).toBe(text);
    }
  });
});
