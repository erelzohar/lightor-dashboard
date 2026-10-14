import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import toast from 'react-hot-toast';
import MoveAppointmentModal from '../../components/appointments/MoveAppointmentModal';
import { getAvailability, moveAppointment, type Availability } from '../../services/appointmentsApi';
import { fetchAppointments } from '../../store/slices/appointmentsSlice';
import type { Appointment } from '../../types';
import { zonedTimeToMs } from '../../utils/businessTime';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('../../contexts/ThemeContext', () => ({ useTheme: () => ({ language: 'en', direction: 'ltr' }) }));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ auth: { user: { _id: 'u1', webConfig_id: 'wc1' } } }),
}));
const dispatch = vi.hoisted(() => vi.fn());
vi.mock('../../hooks/useAppDispatch', () => ({ useAppDispatch: () => dispatch }));
vi.mock('../../store/slices/appointmentsSlice', () => ({
  fetchAppointments: vi.fn(() => ({ type: 'appointments/fetch' })),
}));
vi.mock('../../services/appointmentsApi', () => ({ getAvailability: vi.fn(), moveAppointment: vi.fn() }));
vi.mock('../../services/customersApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/customersApi')>();
  return { apiErrorStatus: actual.apiErrorStatus, isApiErrorCode: actual.isApiErrorCode };
});

// Monday 2030-03-04, 08:00 in Israel; open 09:00–13:00 every day, so an
// hour-long service starts at 09:00, 10:00, 11:00 or 12:00.
const J = 'Asia/Jerusalem';
const at = (day: number, hour: number) => String(zonedTimeToMs(2030, 2, day, hour, 0, J));
const HOUR = '3600000';
const state = {
  webConfig: {
    data: {
      timeZone: undefined as string | undefined,
      subDomain: 'studio',
      workingDays: Array<string | null>(7).fill('09:00-13:00'),
      dateOverrides: [] as { date: string; hours: string | null }[],
      vacations: [] as { startDate: string; endDate: string }[],
    },
  },
};
vi.mock('../../hooks/useAppSelector', () => ({
  useAppSelector: (selector: (s: typeof state) => unknown): unknown => selector(state),
}));

const booking = (timestamp = at(5, 10)): Appointment => ({
  _id: 'a1',
  name: 'Dana',
  phone: '0501234567',
  status: 'scheduled',
  user_id: 'u1',
  timestamp,
  type: { _id: 't1', name: 'Massage', webConfig_id: 'wc1', price: '100', durationMS: HOUR },
});

// The month as the server reads it: Dana's own 10:00 on the 5th, and
// someone else at 12:00 that day.
const MONTH: Availability = {
  busy: [
    { timestamp: at(5, 10), durationMS: HOUR },
    { timestamp: at(5, 12), durationMS: HOUR },
  ],
  classes: [],
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(Number(at(4, 8))));
  vi.mocked(getAvailability).mockReset().mockResolvedValue(MONTH);
  vi.mocked(moveAppointment).mockReset();
  vi.mocked(toast.success).mockClear();
  vi.mocked(toast.error).mockClear();
  dispatch.mockClear();
});
afterEach(() => vi.useRealTimers());

const dayButton = (day: number) =>
  within(screen.getByTestId('booking-days')).getByText(String(day)).closest('button') as HTMLButtonElement;
const chooseDay = async (day: number) => {
  await waitFor(() => expect(dayButton(day).getAttribute('aria-label')).toContain('customers.booking.day.'));
  fireEvent.click(dayButton(day));
};
const timeButtons = async () => {
  await screen.findByRole('button', { name: '09:00' });
  return screen.getAllByRole('button').map((b) => b.textContent ?? '').filter((text) => /^\d\d:\d\d$/.test(text));
};

describe('the owner moves a booking (LT-341)', () => {
  it("offers the day's free times, its own time not among them and its own hour no longer in the way", async () => {
    render(<MoveAppointmentModal appointment={booking()} onClose={vi.fn()} />);

    expect(screen.getByText(/appointments\.move\.current/)).toBeTruthy();
    await chooseDay(5);

    // 10:00 is where it is now; 12:00 is someone else's.
    expect(await timeButtons()).toEqual(['09:00', '11:00']);
  });

  it('counts its own hour as free: a booking at 10:30 may move to 10:00 or 11:00', async () => {
    const odd = String(Number(at(5, 10)) + 30 * 60_000);
    vi.mocked(getAvailability).mockResolvedValue({
      busy: [{ timestamp: odd, durationMS: HOUR }, { timestamp: at(5, 12), durationMS: HOUR }],
      classes: [],
    });
    render(<MoveAppointmentModal appointment={booking(odd)} onClose={vi.fn()} />);

    await chooseDay(5);

    expect(await timeButtons()).toEqual(['09:00', '10:00', '11:00']);
  });

  it('moves it, says so, and reads the calendar again', async () => {
    const moved = { ...booking(at(6, 11)) };
    vi.mocked(moveAppointment).mockResolvedValue(moved);
    const onClose = vi.fn();
    const onMoved = vi.fn();
    render(<MoveAppointmentModal appointment={booking()} onClose={onClose} onMoved={onMoved} />);

    await chooseDay(6);
    fireEvent.click(await screen.findByRole('button', { name: '11:00' }));
    expect(screen.getByText('appointments.move.notice')).toBeTruthy();
    fireEvent.click(screen.getByText('appointments.move.submit'));

    await waitFor(() => expect(moveAppointment).toHaveBeenCalledWith('a1', at(6, 11)));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(onMoved).toHaveBeenCalledWith(moved);
    expect(toast.success).toHaveBeenCalledWith('appointments.move.success');
    expect(fetchAppointments).toHaveBeenCalledWith({ user_id: 'u1', limit: 5000 });
  });

  it('goes back to the times, read again, when the time was taken meanwhile', async () => {
    vi.mocked(moveAppointment).mockRejectedValue({ response: { status: 409, data: { code: 'SLOT_TAKEN' } } });
    const onClose = vi.fn();
    render(<MoveAppointmentModal appointment={booking()} onClose={onClose} />);

    await chooseDay(6);
    fireEvent.click(await screen.findByRole('button', { name: '09:00' }));
    const readsBefore = vi.mocked(getAvailability).mock.calls.length;
    fireEvent.click(screen.getByText('appointments.move.submit'));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('customers.booking.slotTaken'));
    expect(onClose).not.toHaveBeenCalled();
    await screen.findByRole('button', { name: '09:00' });
    expect(screen.queryByText('appointments.move.submit')).toBeNull();
    expect(vi.mocked(getAvailability).mock.calls.length).toBeGreaterThan(readsBefore);
  });

  it('shows nothing while there is no booking to move', () => {
    render(<MoveAppointmentModal appointment={null} onClose={vi.fn()} />);
    expect(screen.queryByText('appointments.move.title')).toBeNull();
  });
});
