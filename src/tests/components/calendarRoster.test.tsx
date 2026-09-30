import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import AppointmentCalendar from '../../components/appointments/AppointmentCalendar';
import { Appointment, AppointmentType } from '../../types';
import { getClassSessions } from '../../services/appointmentsApi';

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
// The grid asks the server for the week's class sessions (LT-211) once the
// store knows a class and the site's subdomain.
const store = vi.hoisted(() => ({
  state: {
    webConfig: { data: null as null | { _id: string; subDomain: string } },
    appointments: { appointmentTypes: [] as unknown[] },
  },
}));
vi.mock('../../hooks/useAppSelector', () => ({
  useAppSelector: (selector: (s: typeof store.state) => unknown): unknown => selector(store.state),
}));
vi.mock('../../services/appointmentsApi', () => ({ getClassSessions: vi.fn() }));
vi.mock('../../store/slices/appointmentsSlice', () => ({
  updateAppointmentStatus: vi.fn(() => ({ type: 'noop' })),
  fetchAppointmentTypes: vi.fn(() => ({ type: 'noop' })),
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

/**
 * A class nobody has booked into holds no appointment (LT-211): the grid
 * draws it from the server's list of the week's sessions, and its roster is
 * where the first participant is added.
 */
describe('a class nobody has booked yet, on the calendar', () => {
  const at = tomorrowAtTen();
  const listing = { type_id: 'c1', timestamp: at, durationMS: String(HOUR), capacity: 12, booked: 0 };

  beforeEach(() => {
    store.state.webConfig.data = { _id: 'w1', subDomain: 'studio' };
    store.state.appointments.appointmentTypes = [yoga];
    vi.mocked(getClassSessions).mockReset().mockResolvedValue([listing]);
  });

  afterEach(() => {
    store.state.webConfig.data = null;
    store.state.appointments.appointmentTypes = [];
  });

  it('draws the empty session for the week on show, seats counted', async () => {
    render(<AppointmentCalendar appointments={[]} onAppointmentClick={vi.fn()} />);

    const block = await screen.findByTestId('empty-session');
    expect(within(block).getByText('Group training')).toBeTruthy();
    expect(within(block).getByText('0/12')).toBeTruthy();
    expect(within(block).getByText('appointments.session.empty')).toBeTruthy();

    const [subdomain, from, to] = vi.mocked(getClassSessions).mock.calls[0];
    const today = new Date();
    expect(subdomain).toBe('studio');
    expect(Number(from)).toBe(new Date(today.getFullYear(), today.getMonth(), today.getDate()).valueOf());
    expect(Number(to)).toBe(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 7).valueOf() - 1);
  });

  it('opens its roster, empty, with "Add participant"', async () => {
    render(<AppointmentCalendar appointments={[]} onAppointmentClick={vi.fn()} />);

    fireEvent.click(await screen.findByTestId('empty-session'));

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getAllByText('appointments.session.empty').length).toBeGreaterThan(0);
    fireEvent.click(within(dialog).getByRole('button', { name: 'appointments.session.addParticipant' }));
    expect(screen.getByTestId('booking-modal')).toBeTruthy();
  });

  it('becomes the booked session, not a second block, once its first booking arrives', async () => {
    const first: Appointment = {
      _id: '1', name: 'Dana Cohen', type: yoga, phone: '+972500000001', status: 'scheduled', user_id: 'u1', timestamp: at,
    };
    const { rerender } = render(<AppointmentCalendar appointments={[]} onAppointmentClick={vi.fn()} />);
    fireEvent.click(await screen.findByTestId('empty-session'));

    rerender(<AppointmentCalendar appointments={[first]} onAppointmentClick={vi.fn()} />);

    expect(screen.queryByTestId('empty-session')).toBeNull();
    expect(screen.getAllByTestId('session-block')).toHaveLength(1);
    expect(within(screen.getByRole('dialog')).getByText('Dana Cohen')).toBeTruthy();
  });
});
