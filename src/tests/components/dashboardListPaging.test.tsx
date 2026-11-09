import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import DashboardAppointmentsList, { ROWS_PER_PAGE } from '../../components/dashboard/DashboardAppointmentsList';
import { Appointment, AppointmentType } from '../../types';

const { t } = vi.hoisted(() => ({
  t: (key: string, vars?: Record<string, unknown>) => (vars && 'count' in vars ? `${key}:${vars.count}` : key),
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t }) }));
vi.mock('../../contexts/ThemeContext', () => ({ useTheme: () => ({ language: 'en', direction: 'ltr' }) }));
vi.mock('../../hooks/useAppDispatch', () => ({ useAppDispatch: () => vi.fn() }));
vi.mock('../../hooks/useAppSelector', () => ({
  useAppSelector: (selector: (s: { webConfig: { data: null } }) => unknown): unknown => selector({ webConfig: { data: null } }),
}));
vi.mock('../../store/slices/appointmentsSlice', () => ({ updateAppointmentStatus: vi.fn(() => ({ type: 'noop' })) }));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../../components/customers/OwnerBookingModal', () => ({ default: (): null => null }));

const HOUR = 3_600_000;
const cleaning: AppointmentType = { _id: 't1', name: 'Cleaning', webConfig_id: 'w1', price: '250', durationMS: String(HOUR) };
/** A demo account's book: 100 one-to-one bookings, a few hours apart; every third one done. */
const book = (count: number): Appointment[] => Array.from({ length: count }, (_, i) => ({
  _id: `a${i}`, name: `Customer ${i}`, type: cleaning, phone: `+97250000${String(i).padStart(4, '0')}`,
  status: i % 3 === 0 ? 'completed' : 'scheduled', user_id: 'u1', timestamp: String(Date.now() + (i + 1) * 3 * HOUR),
} as Appointment));

/** An IntersectionObserver the test drives: `reach()` says the list's end came into view. */
let onSeen: ((entries: { isIntersecting: boolean }[]) => void) | null = null;
class ReachableObserver {
  constructor(callback: (entries: { isIntersecting: boolean }[]) => void) { onSeen = callback; }
  observe() {}
  unobserve() {}
  disconnect() { onSeen = null; }
}
const reach = () => act(() => { onSeen?.([{ isIntersecting: true }]); });
const rows = () => screen.getAllByText(/^Customer \d+$/).length / 2; // each row is drawn for desktop and phone

afterEach(() => { onSeen = null; });

/**
 * LT-627: the home list draws its rows a page at a time. A demo account's 360
 * rows were some 17,000 elements, built on every visit to the home page and
 * torn down on leaving it (opening the calendar from home waited on that).
 */
describe('the home list, a page of rows at a time (LT-627)', () => {
  it('draws the first page, and the next as the box is scrolled to its end', () => {
    vi.stubGlobal('IntersectionObserver', ReachableObserver);
    render(<DashboardAppointmentsList appointments={book(100)} onAppointmentClick={vi.fn()} />);

    expect(rows()).toBe(ROWS_PER_PAGE);
    expect(screen.getByText('dashboardList.total:100')).toBeInTheDocument();
    reach();
    expect(rows()).toBe(ROWS_PER_PAGE * 2);
    reach();
    reach();
    expect(rows()).toBe(100);
    expect(screen.queryByTestId('list-more')).toBeNull();
  });

  it('starts again from the top when the filter changes', () => {
    vi.stubGlobal('IntersectionObserver', ReachableObserver);
    render(<DashboardAppointmentsList appointments={book(100)} onAppointmentClick={vi.fn()} />);
    reach();
    expect(rows()).toBe(ROWS_PER_PAGE * 2);

    fireEvent.click(screen.getByRole('button', { name: 'appointments.scheduled' }));
    expect(rows()).toBe(ROWS_PER_PAGE);
    expect(screen.getByText('dashboardList.total:66')).toBeInTheDocument();
  });

  it('draws a short list whole, with nothing waiting at its end', () => {
    vi.stubGlobal('IntersectionObserver', ReachableObserver);
    render(<DashboardAppointmentsList appointments={book(12)} onAppointmentClick={vi.fn()} />);
    expect(rows()).toBe(12);
    expect(screen.queryByTestId('list-more')).toBeNull();
  });
});
