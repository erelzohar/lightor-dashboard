import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, fireEvent, within } from '@testing-library/react';
import AppointmentCalendar from '../../components/appointments/AppointmentCalendar';
import { Appointment, AppointmentType } from '../../types';

const { t, theme } = vi.hoisted(() => ({
  t: (key: string) => key,
  theme: { language: 'en', direction: 'ltr' as 'ltr' | 'rtl' },
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t }) }));
vi.mock('../../contexts/ThemeContext', () => ({ useTheme: () => theme }));
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
}));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../../components/customers/OwnerBookingModal', () => ({ default: (): null => null }));

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

const swipe = (el: HTMLElement, dx: number, dy = 0) => {
  fireEvent.touchStart(el, { touches: [{ clientX: 200, clientY: 300 }] });
  fireEvent.touchEnd(el, { changedTouches: [{ clientX: 200 + dx, clientY: 300 + dy }] });
};

/**
 * LT-246 — on a phone the calendar shows one day; a sideways swipe on the
 * grid pages to the next or previous day. Today is shown first and the
 * booking is tomorrow, so it appears only after a forward swipe.
 */
describe('swiping the calendar grid', () => {
  beforeEach(() => {
    window.innerWidth = 375;
  });

  const setup = () => {
    const { container } = render(<AppointmentCalendar appointments={[booking]} onAppointmentClick={vi.fn()} />);
    const grid = container.querySelector('.min-h-0.overflow-y-auto') as HTMLElement;
    const shows = () => within(grid).queryAllByText('Dana Cohen').length > 0;
    return { grid, shows };
  };

  it('pages a day forward on a right-to-left swipe and back on left-to-right (LTR)', () => {
    theme.direction = 'ltr';
    const { grid, shows } = setup();
    expect(shows()).toBe(false);
    swipe(grid, -120);
    expect(shows()).toBe(true);
    swipe(grid, 120);
    expect(shows()).toBe(false);
  });

  it('mirrors the gesture in Hebrew, where tomorrow sits to the left', () => {
    theme.direction = 'rtl';
    const { grid, shows } = setup();
    swipe(grid, 120);
    expect(shows()).toBe(true);
    swipe(grid, -120);
    expect(shows()).toBe(false);
    theme.direction = 'ltr';
  });

  it('leaves the day alone for a short or mostly vertical stroke (scrolling the hours)', () => {
    theme.direction = 'ltr';
    const { grid, shows } = setup();
    swipe(grid, -40);
    expect(shows()).toBe(false);
    swipe(grid, -90, 200);
    expect(shows()).toBe(false);
  });
});
