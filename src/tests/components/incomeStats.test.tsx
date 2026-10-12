import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import IncomeStats, { incomeIn, incomePeriods } from '../../components/dashboard/IncomeStats';
import { sparklinePath } from '../../components/ui/stats-widget';
import { Appointment, AppointmentType } from '../../types';

const { t } = vi.hoisted(() => ({ t: (k: string) => (k === 'appointments.currencySymbol' ? '₪' : k) }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t }) }));

const HOUR = 3_600_000;
const service = (price: string): AppointmentType => ({ _id: 's', name: 'Gel', webConfig_id: 'w', price, durationMS: String(HOUR) });
const done = (at: Date, price = '100'): Appointment => ({
  _id: `${at.valueOf()}-${price}`, name: 'Dana', type: service(price), phone: '0500000000',
  status: 'completed', user_id: 'u', timestamp: String(at.valueOf()),
});
const daysAgo = (n: number, hour = 9) => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - n, hour);
};

// A fixed afternoon, so "today at 01:00" is always in the past whatever the
// hour the suite runs at. Only Date is faked; framer-motion keeps real timers.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 13, 15, 0));
});
afterEach(() => {
  vi.useRealTimers();
});

/** LT-272 — the income cards are stats widgets fed by real periods. */
describe('income periods', () => {
  it('runs 7 days, 7 weeks and 6 months, each ending now', () => {
    const now = new Date(2026, 9, 13, 15, 30);
    const { days, weeks, months } = incomePeriods(now);
    expect([days.length, weeks.length, months.length]).toEqual([7, 7, 6]);
    for (const list of [days, weeks, months]) expect(list[list.length - 1].end).toBe(now);
    expect(days[6].start).toEqual(new Date(2026, 9, 13));
    expect(days[0].start).toEqual(new Date(2026, 9, 7));
    // Back to back: each period ends the millisecond before the next begins.
    for (let i = 0; i < 6; i++) expect(days[i].end.valueOf() + 1).toBe(days[i + 1].start.valueOf());
    expect(weeks[6].start).toEqual(new Date(2026, 9, 11)); // Sunday
    expect(months[0].start).toEqual(new Date(2026, 4, 1));
    expect(months[4].end).toEqual(new Date(2026, 8, 30, 23, 59, 59, 999));
  });

  it('counts completed appointments only, and a service without a price as 0 (not NaN)', () => {
    const period = { start: daysAgo(0, 0), end: new Date() };
    const cancelled = { ...done(daysAgo(0, 1)), status: 'cancelled' };
    const r = incomeIn([done(daysAgo(0, 1), '120'), done(daysAgo(0, 2), ''), cancelled, done(daysAgo(3))], period);
    expect(r).toEqual({ income: 120, count: 2 });
  });
});

describe('the income cards', () => {
  it('show the current figure, the change against the previous period, and a sparkline', () => {
    const appts = [done(daysAgo(0, 1), '150'), done(daysAgo(1), '100')];
    render(<IncomeStats appointments={appts} />);
    const cards = screen.getAllByTestId('stats-widget');
    expect(cards).toHaveLength(3);

    const today = within(cards[0]);
    expect(today.getByText('incomeStats.today')).toBeInTheDocument();
    expect(today.getByText('₪150')).toBeInTheDocument();
    expect(today.getByText('50%')).toBeInTheDocument(); // 150 vs 100 yesterday
    expect(today.getByText('1 incomeStats.appointments · incomeStats.vsYesterday')).toBeInTheDocument();
    expect(cards[0].querySelector('path[stroke]')?.getAttribute('stroke')).toBe('#22c55e');
  });

  it('turns orange for a drop, and neutral with nothing to compare', () => {
    render(<IncomeStats appointments={[done(daysAgo(0, 1), '50'), done(daysAgo(1), '100')]} />);
    const [today] = screen.getAllByTestId('stats-widget');
    expect(within(today).getByText('50%')).toBeInTheDocument();
    expect(today.querySelector('path[stroke]')?.getAttribute('stroke')).toBe('#f97316');
  });

  it('draws a flat line, never NaN, for an empty series', () => {
    expect(sparklinePath([0, 0, 0])).not.toContain('NaN');
    expect(sparklinePath([5])).not.toContain('NaN');
    render(<IncomeStats appointments={[]} />);
    for (const card of screen.getAllByTestId('stats-widget')) {
      expect(card.querySelector('path[stroke]')?.getAttribute('stroke')).toBe('#8b5cf6');
      expect(card.innerHTML).not.toContain('NaN');
    }
  });
});
