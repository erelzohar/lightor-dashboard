import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import AppointmentCalendar from '../../components/appointments/AppointmentCalendar';
import { Appointment, AppointmentType } from '../../types';

const { t } = vi.hoisted(() => ({ t: (key: string) => key }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t }) }));
vi.mock('../../contexts/ThemeContext', () => ({ useTheme: () => ({ language: 'en', direction: 'ltr' }) }));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ auth: { user: { _id: 'u1', name: 'Owner' } } }) }));
vi.mock('../../hooks/useAppDispatch', () => ({ useAppDispatch: () => vi.fn() }));
vi.mock('../../hooks/useAppSelector', () => ({
  useAppSelector: (selector: (s: unknown) => unknown): unknown =>
    selector({ webConfig: { data: null }, appointments: { appointmentTypes: [] } }),
}));
vi.mock('../../services/appointmentsApi', () => ({ getClassSessions: vi.fn() }));
vi.mock('../../store/slices/appointmentsSlice', () => ({
  updateAppointmentStatus: vi.fn(() => ({ type: 'noop' })),
  fetchAppointmentTypes: vi.fn(() => ({ type: 'noop' })),
}));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../../components/customers/OwnerBookingModal', () => ({ default: (): null => null }));
vi.mock('../../lib/haptics', () => ({ lightTick: vi.fn(), impact: vi.fn() }));

beforeAll(() => {
  Element.prototype.scrollTo = vi.fn();
});

const HOUR = 3_600_000;
const service: AppointmentType = { _id: 's1', name: 'Gel manicure', webConfig_id: 'w1', price: '140', durationMS: String(HOUR) };
const at = (days: number, hour: number) => {
  const now = new Date();
  return String(new Date(now.getFullYear(), now.getMonth(), now.getDate() + days, hour).valueOf());
};
const booking = (id: string, name: string, timestamp: string): Appointment => ({
  _id: id, name, type: service, phone: '+972500000001', status: 'scheduled', user_id: 'u1', timestamp,
});

/**
 * LT-287 — the next appointment always shows (beside the calendar, and above
 * the grid on a phone) until the owner hides it, and says which day it is.
 */
describe('the next appointment', () => {
  it('names the day, opens from the phone bar, and stays hidden once hidden - across visits', () => {
    const onAppointmentClick = vi.fn();
    const appts = [booking('a2', 'Later Person', at(3, 10)), booking('a1', 'Dana Cohen', at(1, 9))];
    const { unmount } = render(<AppointmentCalendar appointments={appts} onAppointmentClick={onAppointmentClick} />);

    // The panel's card: tomorrow, 09:00 – 10:00 — the earliest one, not the later.
    expect(screen.getByTestId('next-appt-when')).toHaveTextContent('Tomorrow · 09:00 – 10:00');
    const bar = screen.getByTestId('next-appt-bar');
    expect(bar).toHaveTextContent('Dana Cohen');
    fireEvent.click(within(bar).getByText(/Dana Cohen/));
    expect(onAppointmentClick).toHaveBeenCalledWith(appts[1]);

    fireEvent.click(screen.getByRole('button', { name: 'Hide' }));
    expect(screen.queryByTestId('next-appt-bar')).toBeNull();
    expect(screen.queryByTestId('next-appt-when')).toBeNull();
    unmount();

    // Remembered on the next visit; and it can come back.
    render(<AppointmentCalendar appointments={appts} onAppointmentClick={onAppointmentClick} />);
    expect(screen.queryByTestId('next-appt-bar')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Show the next appointment' }));
    expect(screen.getByTestId('next-appt-bar')).toBeInTheDocument();

    // The phone bar's ✕ hides both.
    fireEvent.click(screen.getByRole('button', { name: 'Hide the next appointment' }));
    expect(screen.queryByTestId('next-appt-when')).toBeNull();
  });

  it('says so when nothing is coming', () => {
    render(<AppointmentCalendar appointments={[booking('p', 'Past', at(-2, 9))]} onAppointmentClick={vi.fn()} />);
    expect(screen.getByText('No upcoming appointments')).toBeInTheDocument();
    expect(screen.queryByTestId('next-appt-bar')).toBeNull();
  });
});
