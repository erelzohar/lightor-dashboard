import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { render, screen, fireEvent, waitFor, act, within } from '@testing-library/react';
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
}));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../../components/customers/OwnerBookingModal', () => ({ default: (): null => null }));

// jsdom lays nothing out: the calendar's grid box, the clicked event block
// and the card's size are stubbed. placePopup only measures those three.
const layout = vi.hoisted(() => ({
  box: { top: 0, bottom: 760 },
  anchor: { top: 700, bottom: 760, left: 100, right: 300 },
  popupHeight: 600,
}));
const rect = (r: { top: number; bottom: number; left?: number; right?: number }) =>
  ({ ...r, left: r.left ?? 0, right: r.right ?? 1000, x: r.left ?? 0, y: r.top, width: 0, height: r.bottom - r.top, toJSON: () => ({}) }) as DOMRect;
const isCard = (el: Element) => el.classList.contains('glass-modal');
const isGrid = (el: Element) => el.classList.contains('min-h-0') && el.classList.contains('overflow-y-auto');

const original = {
  rect: Element.prototype.getBoundingClientRect,
  height: Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight'),
  width: Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth'),
};
beforeAll(() => {
  Element.prototype.scrollTo = vi.fn();
  Element.prototype.getBoundingClientRect = function (this: Element) {
    return isGrid(this) ? rect(layout.box) : rect(layout.anchor);
  };
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
    configurable: true,
    get(this: HTMLElement) { return isCard(this) ? layout.popupHeight : 0; },
  });
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
    configurable: true,
    get(this: HTMLElement) { return isCard(this) ? 308 : 0; },
  });
  window.innerHeight = 768;
  window.innerWidth = 1024;
});
afterAll(() => {
  Element.prototype.getBoundingClientRect = original.rect;
  if (original.height) Object.defineProperty(HTMLElement.prototype, 'offsetHeight', original.height);
  if (original.width) Object.defineProperty(HTMLElement.prototype, 'offsetWidth', original.width);
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
 * LT-244 — the details card of a calendar booking was placed once, from a
 * guessed 380px height, inside a glass card whose backdrop-filter traps
 * `position: fixed`. Near the top or bottom of the screen part of it was
 * cut off, and scrolling carried it away from its booking.
 */
describe('the calendar booking details card', () => {
  it('lives on document.body, clamped into the viewport by its real height, and follows its booking', async () => {
    const { container } = render(<AppointmentCalendar appointments={[booking]} onAppointmentClick={vi.fn()} />);
    const grid = container.querySelector('.min-h-0.overflow-y-auto') as HTMLElement;
    fireEvent.click(within(grid).getAllByText('Dana Cohen')[0]);

    const card = screen.getByText('appointments.markCompleted').closest('.glass-modal') as HTMLElement;
    expect(card.parentElement).toBe(document.body);
    expect(container.contains(card)).toBe(false);

    // Booking low on the screen, card 600px tall: pulled up so all of it shows
    // (768 - 600 - 8), beside the block (300 + 10).
    expect(card.style.top).toBe('160px');
    expect(card.style.left).toBe('310px');

    // The grid scrolls the booking up to y=100: the card goes with it.
    layout.anchor = { ...layout.anchor, top: 100, bottom: 160 };
    act(() => { grid.dispatchEvent(new Event('scroll')); });
    expect(card.style.top).toBe('100px');

    // Scrolled out of the grid entirely: the card closes instead of floating.
    layout.anchor = { ...layout.anchor, top: -200, bottom: -140 };
    act(() => { grid.dispatchEvent(new Event('scroll')); });
    await waitFor(() => expect(screen.queryByText('appointments.markCompleted')).toBeNull());
  });
});
