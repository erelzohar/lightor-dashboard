import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import AppointmentCalendar from '../../components/appointments/AppointmentCalendar';
import { Appointment, AppointmentType } from '../../types';

const { t } = vi.hoisted(() => ({
  t: (key: string, vars?: Record<string, unknown>) => (vars && 'count' in vars ? `${key}:${vars.count}` : key),
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t }) }));
vi.mock('../../contexts/ThemeContext', () => ({
  useTheme: () => ({ language: 'en', direction: 'ltr' }),
}));
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ auth: { user: { _id: 'u1', name: 'Coach Owner' } } }),
}));
vi.mock('../../hooks/useAppDispatch', () => ({ useAppDispatch: () => vi.fn() }));
vi.mock('../../hooks/useAppSelector', () => ({
  useAppSelector: (selector: (s: { webConfig: { data: null } }) => unknown): unknown =>
    selector({ webConfig: { data: null } }),
}));
vi.mock('../../store/slices/appointmentsSlice', () => ({
  updateAppointmentStatus: vi.fn(() => ({ type: 'noop' })),
}));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));
// The walk-in's booking (LT-204) is tested with OwnerBookingModal itself.
vi.mock('../../components/customers/OwnerBookingModal', () => ({
  default: (props: { open: boolean }) => (props.open ? <div data-testid="booking-modal" /> : null),
}));

beforeAll(() => {
  // The calendar scrolls its grid to "now"; jsdom lays nothing out.
  Element.prototype.scrollTo = vi.fn();
});

const HOUR = 3_600_000;
// Tomorrow at 10:00: inside the visible week and the grid's 06:00–22:00.
const tomorrowAtTen = () => {
  const now = new Date();
  return String(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 10).valueOf());
};

const yoga: AppointmentType = {
  _id: 'c1',
  name: 'Group training',
  webConfig_id: 'w1',
  price: '60',
  durationMS: String(HOUR),
  kind: 'class',
  capacity: 12,
  sessions: [{ weekday: 0, time: '10:00' }],
};

/**
 * The calendar's roster follows the store too (LT-204): opened on a class
 * block, it gains the walk-in once the appointments are fetched again, and
 * offers the walk-in seat in the first place.
 */
describe('the calendar roster of a class', () => {
  const at = tomorrowAtTen();
  const attendee = (id: string, name: string): Appointment => ({
    _id: id,
    name,
    type: yoga,
    phone: `+9725000000${id}`,
    status: 'scheduled',
    user_id: 'u1',
    timestamp: at,
  });
  const klass = () => [attendee('1', 'Dana Cohen'), attendee('2', 'Avi Levi'), attendee('3', 'Noa Bar')];

  it('offers "Add participant" and shows the walk-in once the list is fetched again', () => {
    const { rerender } = render(<AppointmentCalendar appointments={klass()} onAppointmentClick={vi.fn()} />);

    fireEvent.click(screen.getByText('appointments.session.participants:3'));
    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'appointments.session.addParticipant' }));
    expect(screen.getByTestId('booking-modal')).toBeTruthy();

    rerender(
      <AppointmentCalendar appointments={[...klass(), attendee('4', 'Walk In')]} onAppointmentClick={vi.fn()} />
    );

    const roster = screen.getByRole('dialog');
    expect(within(roster).getByText('Walk In')).toBeTruthy();
    expect(within(roster).getByText('appointments.session.participants:4')).toBeTruthy();
  });
});
