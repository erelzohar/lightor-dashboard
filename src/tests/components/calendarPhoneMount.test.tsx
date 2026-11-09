import React from 'react';
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import AppointmentCalendar from '../../components/appointments/AppointmentCalendar';
import { Appointment, AppointmentType } from '../../types';

const { t } = vi.hoisted(() => ({ t: (key: string) => key }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t }) }));
vi.mock('../../contexts/ThemeContext', () => ({ useTheme: () => ({ language: 'en', direction: 'ltr' }) }));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ auth: { user: { _id: 'u1', name: 'Owner' } } }) }));
vi.mock('../../hooks/useAppDispatch', () => ({ useAppDispatch: () => vi.fn() }));
vi.mock('../../hooks/useAppSelector', () => ({
  useAppSelector: (selector: (s: unknown) => unknown): unknown => selector({ webConfig: { data: null }, appointments: { appointmentTypes: [] } }),
}));
vi.mock('../../services/appointmentsApi', () => ({ getClassSessions: vi.fn(async () => []), moveAppointment: vi.fn(), swapAppointments: vi.fn() }));
vi.mock('../../store/slices/appointmentsSlice', () => ({
  updateAppointmentStatus: vi.fn(() => ({ type: 'noop' })), fetchAppointmentTypes: vi.fn(() => ({ type: 'noop' })), fetchAppointments: vi.fn(() => ({ type: 'noop' })),
}));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../../components/customers/OwnerBookingModal', () => ({ default: (): null => null }));
vi.mock('../../components/appointments/MoveAppointmentModal', () => ({ default: (): null => null }));
vi.mock('../../lib/haptics', () => ({ lightTick: vi.fn(), impact: vi.fn() }));

const HOUR = 3_600_000;
const cleaning: AppointmentType = { _id: 's1', name: 'Cleaning', webConfig_id: 'w1', price: '250', durationMS: String(HOUR) };
const book: Appointment[] = Array.from({ length: 60 }, (_, i) => ({
  _id: `a${i}`, name: `Customer ${i}`, phone: '+972500000000', type: cleaning, status: 'scheduled', user_id: 'u1',
  timestamp: String(Date.now() + (i - 30) * 24 * HOUR),
} as Appointment));

const width = (px: number) => Object.defineProperty(window, 'innerWidth', { value: px, configurable: true, writable: true });
beforeAll(() => { Element.prototype.scrollTo = vi.fn(); });
afterEach(() => { width(1024); });

/**
 * LT-627: a phone draws the calendar it shows - one day, no desktop panel -
 * from the first render. It drew the whole week first and then one day, and
 * the desktop side panel (the month, the filters, counted over every booking)
 * hidden by CSS.
 */
describe('the calendar on a phone draws only what it shows (LT-627)', () => {
  it('one day and no side panel on a phone, from the first render', () => {
    width(390);
    // What the first commit drew, before any effect could change the days on show.
    const first: string[] = [];
    const Probe = (): null => {
      React.useLayoutEffect(() => {
        first.push((document.querySelector('.sticky.top-0') as HTMLElement | null)?.style.gridTemplateColumns ?? '');
      }, []);
      return null;
    };
    const { container } = render(<><AppointmentCalendar appointments={book} onAppointmentClick={vi.fn()} /><Probe /></>);
    expect(first[0]).toContain('repeat(1, 1fr)');
    expect((container.querySelector('.sticky.top-0') as HTMLElement).style.gridTemplateColumns).toContain('repeat(1, 1fr)');
    expect(screen.queryByTestId('calendar-aside')).toBeNull();
  });

  it('three days on a tablet, the week and the side panel on a desktop', () => {
    width(800);
    const tablet = render(<AppointmentCalendar appointments={book} onAppointmentClick={vi.fn()} />);
    expect((tablet.container.querySelector('.sticky.top-0') as HTMLElement).style.gridTemplateColumns).toContain('repeat(3, 1fr)');
    expect(screen.queryByTestId('calendar-aside')).toBeNull();
    tablet.unmount();

    width(1280);
    const desktop = render(<AppointmentCalendar appointments={book} onAppointmentClick={vi.fn()} />);
    expect((desktop.container.querySelector('.sticky.top-0') as HTMLElement).style.gridTemplateColumns).toContain('repeat(7, 1fr)');
    expect(screen.getByTestId('calendar-aside')).toBeInTheDocument();
  });
});
