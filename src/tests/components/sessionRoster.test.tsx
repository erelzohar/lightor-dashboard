import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import AppointmentsList from '../../components/appointments/AppointmentsList';
import { Appointment, AppointmentType } from '../../types';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, vars?: Record<string, unknown>) =>
      vars && 'count' in vars ? `${key}:${vars.count}` : key,
  }),
}));
vi.mock('../../contexts/ThemeContext', () => ({
  useTheme: () => ({ language: 'en', direction: 'ltr' }),
}));
vi.mock('../../hooks/useAppDispatch', () => ({ useAppDispatch: () => vi.fn() }));
vi.mock('../../store/slices/appointmentsSlice', () => ({
  updateAppointmentStatus: vi.fn(() => ({ type: 'noop' })),
}));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));

const HOUR = 3_600_000;
const AT = String(Date.now() + 48 * HOUR);

const type: AppointmentType = {
  _id: 't1',
  name: 'Group training',
  webConfig_id: 'w1',
  price: '60',
  durationMS: String(HOUR),
  kind: 'class',
  capacity: 12,
  sessions: [{ weekday: 0, time: '19:00' }],
};

const attendee = (id: string, name: string, phone: string, status = 'scheduled'): Appointment => ({
  _id: id,
  name,
  type,
  phone,
  status,
  user_id: 'u1',
  timestamp: AT,
});

/**
 * A class of three used to render as three identical cards, each with its own
 * call button (LT-152). It is now one card that opens the roster.
 */
describe('the appointments list with a class in it', () => {
  const klass = [
    attendee('a', 'Dana Cohen', '+972500000001'),
    attendee('b', 'Avi Levi', '+972500000002'),
    attendee('c', 'Noa Bar', '+972500000003'),
  ];

  it('shows one card for the whole session, with a headcount', () => {
    render(<AppointmentsList appointments={klass} onAppointmentClick={vi.fn()} />);

    expect(screen.getAllByText('Group training')).toHaveLength(1);
    expect(screen.getByText('appointments.session.participants:3')).toBeTruthy();
    // No individual attendee is named on the card itself.
    expect(screen.queryByText('Dana Cohen')).toBeNull();
  });

  it('opens a roster naming everyone in the session', () => {
    render(<AppointmentsList appointments={klass} onAppointmentClick={vi.fn()} />);

    fireEvent.click(screen.getByText('Group training'));

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Dana Cohen')).toBeTruthy();
    expect(within(dialog).getByText('Avi Levi')).toBeTruthy();
    expect(within(dialog).getByText('Noa Bar')).toBeTruthy();
  });

  it('does not open a roster for a lone booking, and still selects it', () => {
    const onAppointmentClick = vi.fn();
    const solo = [attendee('solo', 'Single Client', '+972500000009')];

    render(<AppointmentsList appointments={solo} onAppointmentClick={onAppointmentClick} />);

    expect(screen.getByText('Single Client')).toBeTruthy();
    fireEvent.click(screen.getByText('Single Client'));

    expect(onAppointmentClick).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('counts a cancelled attendee out of the headcount', () => {
    render(
      <AppointmentsList
        appointments={[...klass, attendee('d', 'Gone Away', '+972500000004', 'cancelled')]}
        onAppointmentClick={vi.fn()}
      />
    );

    expect(screen.getByText('appointments.session.participants:3')).toBeTruthy();
  });
});
