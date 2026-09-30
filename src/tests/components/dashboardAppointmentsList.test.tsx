import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import DashboardAppointmentsList from '../../components/dashboard/DashboardAppointmentsList';
import { Appointment, AppointmentType } from '../../types';

const { t } = vi.hoisted(() => ({
  t: (key: string, vars?: Record<string, unknown>) => (vars && 'count' in vars ? `${key}:${vars.count}` : key),
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t }) }));
vi.mock('../../contexts/ThemeContext', () => ({
  useTheme: () => ({ language: 'en', direction: 'ltr' }),
}));
vi.mock('../../hooks/useAppDispatch', () => ({ useAppDispatch: () => vi.fn() }));
// The roster's AnswersList (LT-178) reads the booking-questions catalog off the saved config.
vi.mock('../../hooks/useAppSelector', () => ({
  useAppSelector: (selector: (s: { webConfig: { data: null } }) => unknown): unknown =>
    selector({ webConfig: { data: null } }),
}));
vi.mock('../../store/slices/appointmentsSlice', () => ({
  updateAppointmentStatus: vi.fn(() => ({ type: 'noop' })),
}));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));
// The roster's walk-in booking (LT-204) is tested with OwnerBookingModal itself.
vi.mock('../../components/customers/OwnerBookingModal', () => ({ default: (): null => null }));

const HOUR = 3_600_000;
const AT = String(Date.now() + 48 * HOUR);

const yoga: AppointmentType = {
  _id: 'c1',
  name: 'Group training',
  webConfig_id: 'w1',
  price: '60',
  durationMS: String(HOUR),
  kind: 'class',
  capacity: 20,
  sessions: [{ weekday: 0, time: '19:00' }],
};
const haircut: AppointmentType = { _id: 't1', name: 'Haircut', webConfig_id: 'w1', price: '80', durationMS: String(HOUR) };

const booking = (id: string, name: string, over: Partial<Appointment> = {}): Appointment => ({
  _id: id,
  name,
  type: yoga,
  phone: `+97250000${id.padStart(4, '0')}`,
  status: 'scheduled',
  user_id: 'u1',
  timestamp: AT,
  ...over,
});

const twelve = () => Array.from({ length: 12 }, (_, i) => booking(String(i + 1), `Trainee ${i + 1}`));

const renderList = (appointments: Appointment[], onAppointmentClick = vi.fn()) =>
  render(<DashboardAppointmentsList appointments={appointments} onAppointmentClick={onAppointmentClick} />);

/**
 * The home list groups a class's bookings by session (LT-204), as the
 * calendar and the appointments list do (LT-152): a class of twelve was
 * twelve rows, each with its own call button, and the header counted twelve.
 */
describe('the home list with a class in it', () => {
  it('shows twelve bookings of one session as one row, with the headcount and what it brings in', () => {
    renderList(twelve());

    // The header counts rows: the session once.
    expect(screen.getByText('1 dashboardList.total')).toBeTruthy();
    // Desktop and phone layouts are both in the DOM: one row, drawn twice.
    expect(screen.getAllByText('appointments.session.participants:12')).toHaveLength(2);
    expect(screen.getAllByText('Group training')).toHaveLength(2);
    expect(screen.getAllByText('appointments.currencySymbol720')).toHaveLength(2);
    // Nobody is named on the row, and there is no one number to call.
    expect(screen.queryByText('Trainee 1')).toBeNull();
    expect(screen.queryAllByTitle('appointments.call')).toHaveLength(0);
    expect(screen.queryAllByTitle('WhatsApp')).toHaveLength(0);
  });

  it('opens the roster on document.body instead of one booking', () => {
    const onAppointmentClick = vi.fn();
    const { container } = renderList(twelve(), onAppointmentClick);

    fireEvent.click(screen.getAllByText('appointments.session.participants:12')[0]);

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Trainee 1')).toBeTruthy();
    expect(within(dialog).getByText('Trainee 12')).toBeTruthy();
    expect(onAppointmentClick).not.toHaveBeenCalled();
    // The card's backdrop-filter would trap a fixed panel rendered inside it.
    expect(container.contains(dialog)).toBe(false);
  });

  it('shows a walk-in in the open roster once the list is fetched again', () => {
    const { rerender } = renderList(twelve());
    fireEvent.click(screen.getAllByText('appointments.session.participants:12')[0]);

    rerender(
      <DashboardAppointmentsList appointments={[...twelve(), booking('13', 'Walk In')]} onAppointmentClick={vi.fn()} />
    );

    expect(within(screen.getByRole('dialog')).getByText('Walk In')).toBeTruthy();
    expect(screen.getAllByText('appointments.session.participants:13').length).toBeGreaterThan(0);
  });

  it('keeps a lone booking of a class as a single row that opens the booking', () => {
    const onAppointmentClick = vi.fn();
    const solo = booking('1', 'Solo Trainee');
    renderList([solo], onAppointmentClick);

    expect(screen.getByText('1 dashboardList.total')).toBeTruthy();
    expect(screen.getAllByText('Solo Trainee')).toHaveLength(2);
    expect(screen.queryByText(/appointments\.session\.participants/)).toBeNull();

    fireEvent.click(screen.getAllByText('Solo Trainee')[0]);
    expect(onAppointmentClick).toHaveBeenCalledWith(solo);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('leaves ordinary appointments as they were: one row each, with their call buttons', () => {
    const onAppointmentClick = vi.fn();
    const first = booking('21', 'Dana Cohen', { type: haircut, timestamp: String(Date.now() + 24 * HOUR) });
    const second = booking('22', 'Avi Levi', { type: haircut, timestamp: String(Date.now() + 26 * HOUR) });
    renderList([second, ...twelve(), first], onAppointmentClick);

    expect(screen.getByText('3 dashboardList.total')).toBeTruthy();
    expect(screen.getAllByText('Dana Cohen')).toHaveLength(2);
    expect(screen.getAllByText('Avi Levi')).toHaveLength(2);
    expect(screen.getAllByText('appointments.currencySymbol80')).toHaveLength(4);
    expect(screen.getAllByTitle('appointments.call')).toHaveLength(2);

    // Still in start order: the two haircuts come before the class.
    const names = screen.getAllByText(/Dana Cohen|Avi Levi|Group training/).map((el) => el.textContent);
    expect([...new Set(names)]).toEqual(['Dana Cohen', 'Avi Levi', 'Group training']);

    fireEvent.click(screen.getAllByText('Avi Levi')[0]);
    expect(onAppointmentClick).toHaveBeenCalledWith(second);
  });

  it("filters a class by its session's status, as the calendar does", () => {
    renderList([...twelve(), booking('99', 'Gone Away', { status: 'cancelled' })]);

    // One live session with a cancelled booking in it is not a cancelled row.
    fireEvent.click(screen.getByRole('button', { name: 'appointments.cancelled' }));
    expect(screen.getByText('0 dashboardList.total')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'appointments.scheduled' }));
    expect(screen.getByText('1 dashboardList.total')).toBeTruthy();
    // The headcount and the takings leave the cancelled booking out.
    expect(screen.getAllByText('appointments.session.participants:12')).toHaveLength(2);
    expect(screen.getAllByText('appointments.currencySymbol720')).toHaveLength(2);
  });
});
