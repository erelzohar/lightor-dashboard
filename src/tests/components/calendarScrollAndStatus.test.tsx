import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react';
import toast from 'react-hot-toast';
import AppointmentCalendar from '../../components/appointments/AppointmentCalendar';
import SessionParticipants from '../../components/appointments/SessionParticipants';
import AppointmentDetails from '../../components/appointments/AppointmentDetails';
import { Appointment, AppointmentType } from '../../types';
import type { Session } from '../../utils/sessions';

/**
 * LT-315 — the calendar scrolls to now on opening, a new day and "Today",
 * not on every minute's tick (H5); and cancel / complete / remove say
 * "updated" only once the server agrees (M2).
 */
const { t } = vi.hoisted(() => ({ t: (key: string) => key }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t }) }));
vi.mock('../../contexts/ThemeContext', () => ({ useTheme: () => ({ language: 'en', direction: 'ltr' }) }));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ auth: { user: { _id: 'u1', name: 'Owner' } } }) }));
const { dispatch, unwrap } = vi.hoisted(() => {
  const unwrap = vi.fn();
  return { unwrap, dispatch: vi.fn(() => ({ unwrap })) };
});
vi.mock('../../hooks/useAppDispatch', () => ({ useAppDispatch: () => dispatch }));
vi.mock('../../hooks/useAppSelector', () => ({
  useAppSelector: (selector: (s: unknown) => unknown): unknown =>
    selector({ webConfig: { data: null }, appointments: { appointmentTypes: [] } }),
}));
vi.mock('../../services/appointmentsApi', () => ({ getClassSessions: vi.fn() }));
vi.mock('../../store/slices/appointmentsSlice', () => ({
  updateAppointmentStatus: vi.fn((args: unknown) => ({ type: 'status', args })),
  fetchAppointmentTypes: vi.fn(() => ({ type: 'noop' })),
}));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../../components/customers/OwnerBookingModal', () => ({ default: (): null => null }));
vi.mock('../../lib/haptics', () => ({ lightTick: vi.fn(), impact: vi.fn() }));

const HOUR = 3_600_000;
const service: AppointmentType = { _id: 's1', name: 'Gel manicure', webConfig_id: 'w1', price: '140', durationMS: String(HOUR) };
const tomorrowAt = (hour: number) => {
  const now = new Date();
  return String(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, hour).valueOf());
};
const booking = (id: string, name: string, timestamp = tomorrowAt(10)): Appointment => ({
  _id: id, name, type: service, phone: '+972500000001', status: 'scheduled', user_id: 'u1', timestamp,
});

// jsdom lays nothing out: the grid's box and the clicked block are stubbed
// so the details card sees its booking inside the grid and stays open.
const rect = (top: number, bottom: number) =>
  ({ top, bottom, left: 100, right: 300, x: 100, y: top, width: 200, height: bottom - top, toJSON: () => ({}) }) as DOMRect;
const originalRect = Element.prototype.getBoundingClientRect;
beforeAll(() => {
  Element.prototype.scrollTo = vi.fn();
  Element.prototype.getBoundingClientRect = function (this: Element) {
    return this.classList.contains('min-h-0') && this.classList.contains('overflow-y-auto') ? rect(0, 760) : rect(100, 160);
  };
});
afterAll(() => {
  Element.prototype.getBoundingClientRect = originalRect;
});
beforeEach(() => {
  vi.mocked(Element.prototype.scrollTo).mockClear();
  dispatch.mockClear();
  unwrap.mockReset();
  vi.mocked(toast.success).mockClear();
  vi.mocked(toast.error).mockClear();
});

describe('calendar auto-scroll (LT-315, H5)', () => {
  afterEach(() => vi.useRealTimers());

  it('scrolls to now on opening and on "Today", never on the minute tick', () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });
    const today = new Date();
    vi.setSystemTime(new Date(today.getFullYear(), today.getMonth(), today.getDate(), 10, 0));
    const scroll = vi.mocked(Element.prototype.scrollTo);

    render(<AppointmentCalendar appointments={[]} onAppointmentClick={vi.fn()} />);
    // 10:00 is 4 hours of 88px below the 06:00 top; 160px of it shows above.
    expect(scroll).toHaveBeenCalledTimes(1);
    expect(scroll).toHaveBeenLastCalledWith({ top: 4 * 88 - 160 });

    // The owner scrolls to the evening; ten minutes of ticks leave them there.
    act(() => { vi.advanceTimersByTime(10 * 60_000); });
    expect(scroll).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText('Today'));
    expect(scroll).toHaveBeenCalledTimes(2);
  });
});

describe('status changes wait for the server (LT-315, M2)', () => {
  const openPopup = () => {
    const { container } = render(<AppointmentCalendar appointments={[booking('a1', 'Dana Cohen')]} onAppointmentClick={vi.fn()} />);
    const grid = container.querySelector('.min-h-0.overflow-y-auto') as HTMLElement;
    fireEvent.click(within(grid).getAllByText('Dana Cohen')[0]);
  };

  it('calendar: a refused "completed" says so and keeps the card open', async () => {
    unwrap.mockRejectedValue(new Error('offline'));
    openPopup();
    fireEvent.click(screen.getByText('appointments.markCompleted'));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('appointments.updateError'));
    expect(toast.success).not.toHaveBeenCalled();
    expect(screen.getByText('appointments.markCompleted')).toBeInTheDocument();
  });

  it('calendar: an accepted one says "updated" and closes; the button waits meanwhile', async () => {
    let done!: () => void;
    unwrap.mockReturnValue(new Promise<void>((resolve) => { done = resolve; }));
    openPopup();
    const button = screen.getByText('appointments.markCompleted').closest('button')!;
    fireEvent.click(button);
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(dispatch).toHaveBeenCalledTimes(1);
    await act(async () => done());
    expect(toast.success).toHaveBeenCalledWith('appointments.updateSuccess');
    await waitFor(() => expect(screen.queryByText('appointments.markCompleted')).toBeNull());
  });

  it('roster: "Remove from class" that fails leaves the person in, and says so', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    unwrap.mockRejectedValue(new Error('500'));
    const onUpdate = vi.fn();
    const classType = { ...service, kind: 'class', capacity: 10 } as AppointmentType;
    const person = { ...booking('p1', 'Avi'), type: classType };
    const session: Session = {
      id: 's1|x', type: classType, timestamp: person.timestamp, startMs: Number(person.timestamp), durationMS: HOUR, participants: [person],
    } as Session;
    render(<SessionParticipants session={session} onClose={vi.fn()} onUpdate={onUpdate} />);
    fireEvent.click(screen.getByRole('button', { name: 'appointments.session.remove' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('appointments.updateError'));
    expect(toast.success).not.toHaveBeenCalled();
    expect(onUpdate).not.toHaveBeenCalled();
    confirm.mockRestore();
  });

  it('details card: a refused cancel says so and stays open', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    unwrap.mockRejectedValue(new Error('409'));
    const onClose = vi.fn();
    const onUpdate = vi.fn();
    render(<AppointmentDetails appointment={booking('a2', 'Noa')} onClose={onClose} onUpdate={onUpdate} />);
    fireEvent.click(screen.getByTitle('appointments.cancelAppointment'));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('appointments.updateError'));
    expect(onClose).not.toHaveBeenCalled();
    expect(onUpdate).not.toHaveBeenCalled();
    confirm.mockRestore();
  });
});
