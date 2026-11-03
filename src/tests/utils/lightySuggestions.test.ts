import { describe, it, expect } from 'vitest';
import { lightySuggestions, type SuggestFacts } from '../../utils/lightySuggestions';
import { zonedTimeToMs } from '../../utils/businessTime';
import type { Appointment } from '../../types';

/**
 * LT-566: Lighty's ready questions follow the business. Every time is on the
 * business's clock (Asia/Jerusalem), whatever zone the test machine is in.
 */
const TZ = 'Asia/Jerusalem';
// Tuesday 2026-11-03 at 10:00 in Israel.
const at = (day: number, h: number, min = 0) => zonedTimeToMs(2026, 10, day, h, min, TZ);
const TUE_MORNING = at(3, 10);
const OPEN = '09:00-17:00';
// Sunday to Saturday: closed on Saturday only.
const WEEK = [OPEN, OPEN, OPEN, OPEN, OPEN, '08:00-13:00', null];

const appt = (ms: number, status = 'scheduled'): Appointment =>
  ({ _id: String(ms), name: 'Dana', phone: '', status, user_id: 'u1', timestamp: String(ms), type: { durationMS: 3_600_000 } } as unknown as Appointment);

const facts = (over: Partial<SuggestFacts> = {}): SuggestFacts => ({
  conversion: 'book',
  timeZone: TZ,
  workingDays: WEEK,
  appointments: [appt(at(1, 10), 'completed')],
  appointmentsLoaded: true,
  waitingLeads: 0,
  ...over,
});
const keys = (f: SuggestFacts, now = TUE_MORNING) => lightySuggestions(f, now).map((s) => s.key);

describe("Lighty's ready questions (LT-566)", () => {
  it("asks about today in the morning, with the bookings still ahead on the chip", () => {
    const list = lightySuggestions(facts({ appointments: [appt(at(1, 10), 'completed'), appt(at(3, 9)), appt(at(3, 12)), appt(at(3, 14)), appt(at(3, 15), 'cancelled'), appt(at(4, 11))] }), TUE_MORNING);
    // 09:00 is past and the 15:00 one is cancelled.
    expect(list[0]).toEqual({ key: 'today', count: 2 });
  });

  it('asks about tomorrow in the evening, with its bookings', () => {
    const list = lightySuggestions(facts({ appointments: [appt(at(1, 10), 'completed'), appt(at(4, 11)), appt(at(4, 12))] }), at(3, 18));
    expect(list[0]).toEqual({ key: 'tomorrow', count: 2 });
    expect(list.map((s) => s.key)).not.toContain('today');
  });

  it('asks about tomorrow on a closed day with nothing on it', () => {
    // Saturday 2026-11-07 is closed.
    expect(keys(facts(), at(7, 10))[0]).toBe('tomorrow');
  });

  it('puts the new leads up front with their number, and leaves the question out when there are none', () => {
    expect(lightySuggestions(facts({ waitingLeads: 3 }), TUE_MORNING)[1]).toEqual({ key: 'newLeads', count: 3 });
    expect(keys(facts({ waitingLeads: 0 }))).not.toContain('newLeads');
    expect(keys(facts({ waitingLeads: 0 }))).not.toContain('leads');
    // Not known (the stats could not be read): the general question.
    expect(keys(facts({ waitingLeads: null }))).toContain('leads');
  });

  it('offers to block the coming Friday only while it is open', () => {
    expect(keys(facts())).toContain('blockDay');
    // Closed by its weekday.
    expect(keys(facts({ workingDays: [OPEN, OPEN, OPEN, OPEN, OPEN, null, null] }))).not.toContain('blockDay');
    // Closed by a special date.
    expect(keys(facts({ dateOverrides: [{ date: '2026-11-06', hours: null }] }))).not.toContain('blockDay');
    // Already a day off.
    expect(keys(facts({ vacations: [{ startDate: String(at(6, 0)), endDate: String(at(7, 0)) }] }))).not.toContain('blockDay');
  });

  it("on a Friday, the Friday offered is next week's", () => {
    // Friday 2026-11-06 open; 2026-11-13 closed.
    expect(keys(facts({ dateOverrides: [{ date: '2026-11-13', hours: null }] }), at(6, 9))).not.toContain('blockDay');
    expect(keys(facts({ dateOverrides: [{ date: '2026-11-06', hours: null }] }), at(6, 9))).toContain('blockDay');
  });

  it('asks when tomorrow is free only when tomorrow is open', () => {
    expect(keys(facts())).toContain('tomorrowFree');
    // Friday evening: Saturday is closed.
    expect(keys(facts(), at(6, 18))).not.toContain('tomorrowFree');
  });

  it("asks what the week holds at its start, and for a summary later", () => {
    expect(keys(facts(), at(1, 9))).toContain('weekAhead');
    expect(keys(facts(), at(2, 9))).toContain('weekAhead');
    expect(keys(facts())).toContain('week');
    expect(keys(facts())).not.toContain('weekAhead');
  });

  it('asks about regulars only once someone has come, or while the bookings are not read yet', () => {
    expect(keys(facts())).toContain('regulars');
    expect(keys(facts({ appointments: [appt(at(10, 10))] }))).not.toContain('regulars');
    expect(keys(facts({ appointments: [], appointmentsLoaded: false }))).toContain('regulars');
  });

  it('shows no number before the bookings are read', () => {
    expect(lightySuggestions(facts({ appointments: [], appointmentsLoaded: false }), TUE_MORNING)[0]).toEqual({ key: 'today' });
  });

  it('asks about products on a products site, or to add one when there are none', () => {
    expect(keys(facts())).not.toContain('products');
    // LT-569: with products, the most viewed of them; without the summary, the products.
    expect(keys(facts({ catalog: true, productsTotal: 4 }))).toContain('topProducts');
    expect(keys(facts({ catalog: true }))).toContain('products');
    expect(keys(facts({ catalog: true, productsTotal: 0 }))).toContain('addProduct');
  });

  it('keeps a booking site to six', () => {
    expect(keys(facts({ waitingLeads: 2, catalog: true, productsTotal: 1 }))).toHaveLength(6);
  });

  describe('a leads site', () => {
    const leads = (over: Partial<SuggestFacts> = {}) => facts({ conversion: 'lead', ...over });

    it('asks nothing about bookings or the calendar', () => {
      const list = keys(leads({ waitingLeads: 2 }));
      expect(list).toEqual(['newLeads', 'lastMonth', 'visits', 'services', 'howHours']);
    });

    it("asks for last month's summary in the month's first days", () => {
      expect(keys(leads(), at(2, 10))).toContain('lastMonth');
      expect(keys(leads(), at(4, 10))).toContain('month');
    });

    it('asks about products when it shows them', () => {
      expect(keys(leads({ catalog: true, productsTotal: 3 }))).toContain('topProducts');
      // Five at most: the hours question gives way.
      expect(keys(leads({ waitingLeads: 1, catalog: true, productsTotal: 3 }))).toEqual(['newLeads', 'lastMonth', 'visits', 'topProducts', 'services']);
    });
  });
});
