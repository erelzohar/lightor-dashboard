import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import AppointmentCalendar from '../../components/appointments/AppointmentCalendar';

/**
 * LT-340 — the week view greys the days the business is closed, from its own
 * hours. It used to grey Saturday and Sunday for everyone, so an Israeli
 * business open on Sunday saw its first working day as a day off.
 */
const { t } = vi.hoisted(() => ({ t: (key: string) => key }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t }) }));
vi.mock('../../contexts/ThemeContext', () => ({ useTheme: () => ({ language: 'en', direction: 'ltr' }) }));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ auth: { user: { _id: 'u1', name: 'Owner' } } }) }));
vi.mock('../../hooks/useAppDispatch', () => ({ useAppDispatch: () => vi.fn() }));
const store = vi.hoisted(() => ({ webConfig: { data: null as unknown }, appointments: { appointmentTypes: [] } }));
vi.mock('../../hooks/useAppSelector', () => ({
  useAppSelector: (selector: (s: unknown) => unknown): unknown => selector(store),
}));
vi.mock('../../services/appointmentsApi', () => ({ getClassSessions: vi.fn() }));
vi.mock('../../store/slices/appointmentsSlice', () => ({
  updateAppointmentStatus: vi.fn(),
  fetchAppointmentTypes: vi.fn(() => ({ type: 'noop' })),
}));
vi.mock('../../components/customers/OwnerBookingModal', () => ({ default: (): null => null }));
vi.mock('../../lib/haptics', () => ({ lightTick: vi.fn(), impact: vi.fn() }));

beforeAll(() => {
  Element.prototype.scrollTo = vi.fn();
});
afterEach(() => vi.useRealTimers());

// Sunday to Friday open, Friday short, Saturday closed.
const israeliWeek = ['08:00-20:00', '08:00-20:00', '08:00-20:00', '08:00-20:00', '08:00-20:00', '08:00-14:00', null];

/** The week view's day columns, keyed by weekday (0 = Sunday), as greyed or not. */
const greyedByWeekday = (container: HTMLElement): Record<number, boolean> => {
  // The grid's columns, not the header's: they carry the hour lines.
  const columns = [...container.querySelectorAll<HTMLElement>('div.relative.border-l')]
    .filter((column) => column.querySelector(':scope > div.absolute.border-t'));
  expect(columns).toHaveLength(7);
  // The week opens on today, a Wednesday (3).
  return Object.fromEntries(columns.map((column, i) => [(3 + i) % 7, !!column.style.background && !column.style.background.includes('99, 102, 241')]));
};

describe("the week view greys the business's closed days (LT-340)", () => {
  const onWednesday = () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 14, 10, 0)); // Wednesday 14 October 2026
  };

  it('greys Saturday and leaves an Israeli Sunday open', () => {
    onWednesday();
    store.webConfig.data = { workingDays: israeliWeek, dateOverrides: [] };

    const { container } = render(<AppointmentCalendar appointments={[]} onAppointmentClick={vi.fn()} />);
    const greyed = greyedByWeekday(container);

    expect(greyed[6]).toBe(true);
    expect(greyed[0]).toBe(false);
    expect(greyed[5]).toBe(false);
  });

  it('greys a date the owner closed, and opens a usual day off they opened', () => {
    onWednesday();
    store.webConfig.data = {
      workingDays: israeliWeek,
      dateOverrides: [{ date: '2026-10-18', hours: null }, { date: '2026-10-17', hours: '10:00-12:00' }],
    };

    const { container } = render(<AppointmentCalendar appointments={[]} onAppointmentClick={vi.fn()} />);
    const greyed = greyedByWeekday(container);

    expect(greyed[0]).toBe(true); // Sunday 18.10, closed that date
    expect(greyed[6]).toBe(false); // Saturday 17.10, opened that date
  });

  it('greys nothing before the hours have loaded', () => {
    onWednesday();
    store.webConfig.data = null;

    const { container } = render(<AppointmentCalendar appointments={[]} onAppointmentClick={vi.fn()} />);

    expect(Object.values(greyedByWeekday(container)).some(Boolean)).toBe(false);
  });
});
