import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import AppointmentCalendar from '../../components/appointments/AppointmentCalendar';
import { Appointment, AppointmentType } from '../../types';

const { t } = vi.hoisted(() => ({ t: (key: string) => key }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t }) }));
vi.mock('../../contexts/ThemeContext', () => ({
  useTheme: () => ({ language: 'en', direction: 'ltr' }),
}));
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ auth: { user: { _id: 'u1', name: 'Owner' } } }),
}));
vi.mock('../../hooks/useAppDispatch', () => ({ useAppDispatch: () => vi.fn() }));
vi.mock('../../hooks/useAppSelector', () => ({
  useAppSelector: (selector: (s: unknown) => unknown): unknown =>
    selector({ webConfig: { data: null }, appointments: { appointmentTypes: [] } }),
}));
vi.mock('../../services/appointmentsApi', () => ({ getClassSessions: vi.fn() }));
vi.mock('../../store/slices/appointmentsSlice', () => ({
  updateAppointmentStatus: vi.fn(() => ({ type: 'noop' })),
  fetchAppointmentTypes: vi.fn(() => ({ type: 'noop' })),
  fetchAppointments: vi.fn(() => ({ type: 'noop' })),
}));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../../components/customers/OwnerBookingModal', () => ({ default: (): null => null }));
// The move window (LT-341) as a stand-in that names the booking it was opened for.
vi.mock('../../components/appointments/MoveAppointmentModal', () => ({
  default: ({ appointment }: { appointment: { name: string } | null }) =>
    appointment ? <div data-testid="moving">{appointment.name}</div> : null,
}));

// jsdom lays nothing out: the calendar's grid box, the clicked event block
// and the card's size are stubbed. placePopup only measures those three.
beforeAll(() => {
  Element.prototype.scrollTo = vi.fn();
});

const HOUR = 3_600_000;
const tomorrowAtTen = () => {
  const now = new Date();
  return String(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 10).valueOf());
};
const service: AppointmentType = { _id: 's1', name: 'Gel manicure', webConfig_id: 'w1', price: '140', durationMS: String(HOUR) };
const booking: Appointment = {
  _id: 'a1', name: 'Dana Cohen', type: service, phone: '+972500000001', status: 'scheduled', user_id: 'u1', timestamp: tomorrowAtTen(),
};

/**
 * LT-416 (Erel: "why isn't it the same component?") - a calendar booking
 * opens the booking window the list opens: on document.body (LT-244: the
 * calendar's glass card traps `position: fixed`), centred over a backdrop,
 * with the customer's card and the price, no initials circle, and a worded
 * cancel. It used to be a card of its own beside the booking.
 */
describe('the calendar booking details window', () => {
  it("is the list's window: on document.body, a dialog, no initials, a worded cancel", () => {
    const { container } = render(<AppointmentCalendar appointments={[booking]} onAppointmentClick={vi.fn()} />);
    const grid = container.querySelector('.min-h-0.overflow-y-auto') as HTMLElement;
    fireEvent.click(within(grid).getAllByText('Dana Cohen')[0]);

    const dialog = screen.getByRole('dialog', { name: 'Dana Cohen' });
    expect(container.contains(dialog)).toBe(false);
    expect(document.body.contains(dialog)).toBe(true);
    // Centred by its overlay, not placed beside the booking.
    expect(dialog.style.top).toBe('');
    expect(dialog.style.left).toBe('');
    expect(within(dialog).getByRole('button', { name: 'appointments.card.customer' })).toBeInTheDocument();
    expect(within(dialog).getByText('₪140')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'appointments.cancelAppointment' })).toBeInTheDocument();
    // The initials circle ("DC") is gone.
    expect(within(dialog).queryByText('DC')).toBeNull();

    fireEvent.click(within(dialog).getByRole('button', { name: 'appointments.session.close' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

/** LT-341 — the owner moves a booking from its window. */
describe('moving a booking from its calendar window', () => {
  const open = (appointments: Appointment[]) => {
    const { container } = render(<AppointmentCalendar appointments={appointments} onAppointmentClick={vi.fn()} />);
    const grid = container.querySelector('.min-h-0.overflow-y-auto') as HTMLElement;
    fireEvent.click(within(grid).getAllByText('Dana Cohen')[0]);
  };

  it('opens the move window on the booking', () => {
    open([booking]);
    fireEvent.click(screen.getByText('appointments.move.button'));
    expect(screen.getByTestId('moving').textContent).toBe('Dana Cohen');
  });

  it('offers no move for a booking that is over or cancelled', () => {
    open([{ ...booking, status: 'cancelled' }]);
    expect(screen.queryByText('appointments.move.button')).toBeNull();
  });
});

/**
 * LT-420 (Erel, a two-hour block with its text at the top: "it looks empty
 * and long") - a block's details sit in its middle. Auto margins in a flex
 * column: in a block too short for them they are 0, so the text stays at
 * the top rather than being cut. (jsdom lays nothing out; measured in
 * Chrome: a 176px block 60/60 around its text, a 44px one from its top.)
 */
describe("a calendar block's details", () => {
  it('are centred in the block by auto margins', () => {
    const { container } = render(<AppointmentCalendar appointments={[booking]} onAppointmentClick={vi.fn()} />);
    const block = container.querySelector('[data-testid="session-block"]') as HTMLElement;
    const body = within(block).getByTestId('session-block-body');
    expect(block.className).toMatch(/\bflex\b/);
    expect(block.className).toMatch(/\bflex-col\b/);
    expect(body.className).toMatch(/\bmy-auto\b/);
    expect(within(body).getByText('Gel manicure')).toBeInTheDocument();
  });
});
