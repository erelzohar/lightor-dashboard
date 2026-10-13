import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import AppointmentCalendar from '../../components/appointments/AppointmentCalendar';
import { getClassSessions } from '../../services/appointmentsApi';
import { Appointment, AppointmentType } from '../../types';

const { t } = vi.hoisted(() => ({ t: (key: string) => key }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t }) }));
vi.mock('../../contexts/ThemeContext', () => ({ useTheme: () => ({ language: 'en', direction: 'ltr' }) }));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ auth: { user: { _id: 'u1', name: 'Owner' } } }) }));
vi.mock('../../hooks/useAppDispatch', () => ({ useAppDispatch: () => vi.fn() }));
const { yoga } = vi.hoisted(() => ({
  yoga: { _id: 'c1', name: 'Evening yoga', webConfig_id: 'w1', price: '60', durationMS: '1800000', kind: 'class', capacity: 12 },
}));
vi.mock('../../hooks/useAppSelector', () => ({
  useAppSelector: (selector: (s: unknown) => unknown): unknown =>
    selector({ webConfig: { data: { _id: 'w1', subDomain: 'studio' } }, appointments: { appointmentTypes: [yoga] } }),
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
beforeEach(() => {
  localStorage.clear();
});

const HOUR = 3_600_000;
const manicure: AppointmentType = { _id: 's1', name: 'Gel manicure', webConfig_id: 'w1', price: '140', durationMS: String(HOUR) };
const at = (days: number, hour: number) => {
  const now = new Date();
  return String(new Date(now.getFullYear(), now.getMonth(), now.getDate() + days, hour).valueOf());
};
const booking = (id: string, name: string, timestamp: string): Appointment => ({
  _id: id, name, type: manicure, phone: '+972500000001', status: 'scheduled', user_id: 'u1', timestamp,
});

/**
 * LT-293 — a class nobody has booked yet holds no appointment, so the card
 * said nothing was coming while the class sat on the grid tomorrow at 21:00.
 */
describe('the next appointment, when it is a class', () => {
  it('shows a class nobody has booked yet, and opens its roster', async () => {
    vi.mocked(getClassSessions).mockResolvedValue([
      { type_id: 'c1', timestamp: at(1, 21), durationMS: '1800000', capacity: 12, booked: 0 },
    ]);
    render(<AppointmentCalendar appointments={[booking('p', 'Past', at(-2, 9)), booking('l', 'Later', at(3, 10))]} onAppointmentClick={vi.fn()} />);

    expect(await screen.findByText('0/12 booked', { selector: 'span' })).toBeInTheDocument();
    expect(screen.getByTestId('next-appt-when')).toHaveTextContent('Tomorrow · 21:00 – 21:30');
    const bar = screen.getByTestId('next-appt-bar');
    expect(bar).toHaveTextContent('Evening yoga · 0/12 booked');

    fireEvent.click(within(bar).getByText(/Evening yoga/));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('still shows a booking that comes before the class', async () => {
    vi.mocked(getClassSessions).mockResolvedValue([
      { type_id: 'c1', timestamp: at(2, 21), durationMS: '1800000', capacity: 12, booked: 0 },
    ]);
    const onAppointmentClick = vi.fn();
    const appts = [booking('a1', 'Dana Cohen', at(1, 9))];
    render(<AppointmentCalendar appointments={appts} onAppointmentClick={onAppointmentClick} />);
    await vi.waitFor(() => expect(getClassSessions).toHaveBeenCalled());

    const bar = screen.getByTestId('next-appt-bar');
    expect(bar).toHaveTextContent('Gel manicure · Dana Cohen');
    fireEvent.click(within(bar).getByText(/Dana Cohen/));
    expect(onAppointmentClick).toHaveBeenCalledWith(appts[0]);
  });
});
