import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AppointmentDetails from '../../components/appointments/AppointmentDetails';
import type { Appointment } from '../../types';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('../../contexts/ThemeContext', () => ({ useTheme: () => ({ language: 'en', direction: 'ltr' }) }));
vi.mock('../../hooks/useAppDispatch', () => ({ useAppDispatch: () => vi.fn() }));
vi.mock('../../hooks/useAppSelector', () => ({
  useAppSelector: (selector: (s: unknown) => unknown): unknown => selector({ webConfig: { data: null } }),
}));
vi.mock('../../store/slices/appointmentsSlice', () => ({ updateAppointmentStatus: vi.fn() }));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));
// LT-416: the window opens the booking's customer card too.
vi.mock('../../components/customers/CustomerDetailDrawer', () => ({ default: (): null => null }));
vi.mock('../../services/customersApi', () => ({ fetchCustomers: vi.fn() }));
// The move window (LT-341) as a stand-in: it names its booking and can say "moved".
vi.mock('../../components/appointments/MoveAppointmentModal', () => ({
  default: ({ appointment, onMoved }: { appointment: Appointment | null; onMoved?: (a: Appointment) => void }) =>
    appointment ? <button onClick={() => onMoved?.(appointment)}>moving {appointment.name}</button> : null,
}));

const HOUR = 3_600_000;
const booking = (over: Partial<Appointment> = {}): Appointment => ({
  _id: 'a1',
  name: 'Dana',
  phone: '0501234567',
  status: 'scheduled',
  user_id: 'u1',
  timestamp: String(Date.now() + 48 * HOUR),
  type: { _id: 't1', name: 'Massage', webConfig_id: 'wc1', price: '100', durationMS: String(HOUR) },
  ...over,
});

/** LT-341 — the details window (the list, the next-booking card, a ?focus= link) moves a booking too. */
describe('moving a booking from its details window', () => {
  it('opens the move window, and closes itself once the booking moved', () => {
    const onClose = vi.fn();
    const onUpdate = vi.fn();
    render(<AppointmentDetails appointment={booking()} onClose={onClose} onUpdate={onUpdate} />);

    fireEvent.click(screen.getByText('appointments.move.button'));
    fireEvent.click(screen.getByText('moving Dana'));

    expect(onUpdate).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('offers no move for a past, a cancelled or a class booking', () => {
    const { rerender } = render(
      <AppointmentDetails appointment={booking({ timestamp: String(Date.now() - 48 * HOUR) })} onClose={vi.fn()} onUpdate={vi.fn()} />
    );
    expect(screen.queryByText('appointments.move.button')).toBeNull();

    rerender(<AppointmentDetails appointment={booking({ status: 'cancelled' })} onClose={vi.fn()} onUpdate={vi.fn()} />);
    expect(screen.queryByText('appointments.move.button')).toBeNull();

    const yoga = { _id: 'c1', name: 'Yoga', webConfig_id: 'wc1', price: '50', durationMS: String(HOUR), kind: 'class' as const, capacity: 12 };
    rerender(<AppointmentDetails appointment={booking({ type: yoga })} onClose={vi.fn()} onUpdate={vi.fn()} />);
    expect(screen.queryByText('appointments.move.button')).toBeNull();
  });
});
