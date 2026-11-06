import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import i18n from '../../i18n/config';
import IncomeStats from '../../components/dashboard/IncomeStats';
import DashboardDonutChart from '../../components/dashboard/DashboardDonutChart';
import { Appointment, AppointmentType } from '../../types';

const HOUR = 3_600_000;
const gel: AppointmentType = { _id: 's', name: 'Gel', webConfig_id: 'w', price: '100', durationMS: String(HOUR) };
const done = (at: Date): Appointment => ({
  _id: String(at.valueOf()), name: 'Dana', type: gel, phone: '0500000000',
  status: 'completed', user_id: 'u', timestamp: String(at.valueOf()),
});

// Tuesday 13 October 2026, 15:00: one appointment today, a second on Sunday
// (this week), a third on the 2nd (this month). Only Date is faked.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 13, 15, 0));
});
afterEach(() => {
  vi.useRealTimers();
});
const today = () => done(new Date(2026, 9, 13, 9));
const three = () => [today(), done(new Date(2026, 9, 11, 9)), done(new Date(2026, 9, 2, 9))];

/**
 * LT-601: "1 appointments · vs yesterday by this time" on the English demo's
 * home. The real i18next and strings: today one, this week two, this month
 * three - one, Hebrew's and Arabic's two, and many.
 */
describe('the home income cards count in the right plural', () => {
  it.each([
    ['en', ['1 appointment', '2 appointments', '3 appointments']],
    ['he', ['תור אחד', '2 תורים', '3 תורים']],
    ['ar', ['موعد واحد', 'موعدان', '3 مواعيد']],
    ['es', ['1 cita', '2 citas', '3 citas']],
    ['fr', ['1 rendez-vous', '2 rendez-vous', '3 rendez-vous']],
  ])('%s', async (lng, counts) => {
    await i18n.changeLanguage(lng);
    render(<IncomeStats appointments={three()} />);
    const cards = screen.getAllByTestId('stats-widget');
    const vs = ['incomeStats.vsYesterday', 'incomeStats.vsLastWeek', 'incomeStats.vsLastMonth'];
    counts.forEach((count, i) => {
      expect(within(cards[i]).getByText(`${count} · ${i18n.t(vs[i])}`)).toBeInTheDocument();
    });
  });
});

describe("the services chart's count (LT-601)", () => {
  it.each([
    ['en', '1 appointment', '3 appointments'],
    ['he', 'תור אחד', '3 תורים'],
    ['ar', 'موعد واحد', '3 مواعيد'],
  ])('%s', async (lng, one, many) => {
    await i18n.changeLanguage(lng);
    const { unmount } = render(<DashboardDonutChart appointments={[today()]} timeRange="month" currentDate={new Date()} />);
    expect(screen.getByText(one)).toBeInTheDocument();
    unmount();
    render(<DashboardDonutChart appointments={three()} timeRange="month" currentDate={new Date()} />);
    expect(screen.getByText(many)).toBeInTheDocument();
  });
});
