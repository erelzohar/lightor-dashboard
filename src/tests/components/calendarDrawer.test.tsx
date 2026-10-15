import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import AppointmentCalendar from '../../components/appointments/AppointmentCalendar';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
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

/**
 * LT-355 — on a phone the side panel is a drawer: its button stands out,
 * the month opens it too, and a day picked in it closes it on that day.
 */
describe('the calendar drawer on a phone', () => {
  beforeEach(() => {
    window.innerWidth = 375;
  });

  const drawer = () => (screen.queryByText('Calendar')?.closest('div.fixed') ?? null) as HTMLElement | null;
  const shownDay = (container: HTMLElement) =>
    container.querySelector('section .sticky span.text-2xl')?.textContent;

  it('opens from its button, and closes on the day picked in it', async () => {
    const { container } = render(<AppointmentCalendar appointments={[]} onAppointmentClick={vi.fn()} />);
    const open = screen.getByRole('button', { name: 'Open calendar menu' });
    expect(open.className).toContain('bg-primary/10');

    fireEvent.click(open);
    expect(drawer()).toBeTruthy();

    // Tomorrow, unless it is next month's first: then the day before today.
    const today = new Date();
    const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    const pick = tomorrow.getMonth() === today.getMonth()
      ? tomorrow
      : new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
    const dayButtons = within(drawer()!).getAllByRole('button', { name: String(pick.getDate()) });
    // The month's own day, not a neighbour month's with the same number.
    fireEvent.click(dayButtons.find((b) => (b as HTMLElement).style.color !== 'rgb(55, 65, 81)')!);

    await waitFor(() => expect(drawer()).toBeNull());
    expect(shownDay(container)).toBe(String(pick.getDate()));
  });

  it('opens from the month at the top too', () => {
    render(<AppointmentCalendar appointments={[]} onAppointmentClick={vi.fn()} />);
    fireEvent.click(screen.getByTestId('month-opens-drawer'));
    expect(drawer()).toBeTruthy();
  });
});
