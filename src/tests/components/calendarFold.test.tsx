import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import toast from 'react-hot-toast';
import AppointmentCalendar from '../../components/appointments/AppointmentCalendar';
import { moveAppointment, swapAppointments } from '../../services/appointmentsApi';
import { Appointment, AppointmentType } from '../../types';

/**
 * LT-359: hours nothing is in fold into thin bands; a booking dragged over
 * one opens it to full height. LT-358: placeholders while the bookings load.
 */
const { t } = vi.hoisted(() => ({ t: (key: string) => key }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t }) }));
vi.mock('../../contexts/ThemeContext', () => ({ useTheme: () => ({ language: 'en', direction: 'ltr' }) }));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ auth: { user: { _id: 'u1', name: 'Owner' } } }) }));
vi.mock('../../hooks/useAppDispatch', () => ({ useAppDispatch: () => vi.fn() }));
vi.mock('../../hooks/useAppSelector', () => ({
  useAppSelector: (selector: (s: unknown) => unknown): unknown =>
    selector({ webConfig: { data: null }, appointments: { appointmentTypes: [] } }),
}));
vi.mock('../../services/appointmentsApi', () => ({
  getClassSessions: vi.fn(),
  moveAppointment: vi.fn(),
  swapAppointments: vi.fn(),
}));
vi.mock('../../store/slices/appointmentsSlice', () => ({
  updateAppointmentStatus: vi.fn(() => ({ type: 'noop' })),
  fetchAppointmentTypes: vi.fn(() => ({ type: 'noop' })),
  fetchAppointments: vi.fn(() => ({ type: 'noop' })),
}));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../../components/customers/OwnerBookingModal', () => ({ default: (): null => null }));
vi.mock('../../components/appointments/MoveAppointmentModal', () => ({ default: (): null => null }));
vi.mock('../../lib/haptics', () => ({ lightTick: vi.fn(), impact: vi.fn() }));

const HOUR = 3_600_000;
const HOUR_PX = 88;
const COLUMN_W = 100;
const GRID_TOP = 16;

// jsdom lays nothing out. Columns sit side by side, 100px wide, starting at
// x=60; a booking sits in its column at its top. That is all dnd-kit and the
// calendar measure.
const original = Element.prototype.getBoundingClientRect;
const box = (left: number, top: number, width: number, height: number) =>
  ({ left, top, right: left + width, bottom: top + height, width, height, x: left, y: top, toJSON: () => ({}) }) as DOMRect;
const isColumn = (el: Element) =>
  el.classList.contains('border-l') && el.classList.contains('relative') && !!el.querySelector(':scope > div.absolute.border-t');
beforeAll(() => {
  Element.prototype.scrollTo = vi.fn();
  Element.prototype.getBoundingClientRect = function (this: Element) {
    if (isColumn(this)) {
      const index = Array.from(this.parentElement!.children).filter(isColumn).indexOf(this);
      return box(60 + index * COLUMN_W, GRID_TOP, COLUMN_W, 16 * HOUR_PX);
    }
    const column = this.parentElement && isColumn(this.parentElement) ? this.parentElement : null;
    if (column && (this as HTMLElement).style.top) {
      const c = Element.prototype.getBoundingClientRect.call(column);
      return box(c.left + 4, c.top + parseFloat((this as HTMLElement).style.top), COLUMN_W - 8, parseFloat((this as HTMLElement).style.height));
    }
    return box(0, 0, 1024, 768);
  };
});
afterAll(() => {
  Element.prototype.getBoundingClientRect = original;
});
beforeEach(() => {
  vi.mocked(moveAppointment).mockReset().mockResolvedValue({} as never);
  vi.mocked(swapAppointments).mockReset().mockResolvedValue([] as never);
  vi.mocked(toast.error).mockClear();
});

const service: AppointmentType = { _id: 's1', name: 'Massage', webConfig_id: 'w1', price: '100', durationMS: String(HOUR) };
const dayAt = (days: number, hour: number, minute = 0) => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + days, hour, minute).valueOf();
};
const booking = (id: string, start: number): Appointment => ({
  _id: id, name: id, type: service, phone: '+972500000001', status: 'scheduled', user_id: 'u1', timestamp: String(start),
});
/** The hour labels down the side of the grid. */
const axis = () => Array.from(document.querySelectorAll('.overflow-x-clip > div:first-child span')).map((span) => span.textContent);
const blockOf = (name: string) =>
  screen.getAllByTestId('session-block').find((b) => b.textContent?.includes(name)) as HTMLElement;
// Three days ahead, alone on show: no "now" hour kept open.
const DAY = () => new Date(dayAt(3, 0));

describe('folding the empty hours (LT-359)', () => {
  it('draws each empty hour shorter, its label kept, and the booking whole', () => {
    render(<AppointmentCalendar appointments={[booking('Dana', dayAt(3, 10))]} onAppointmentClick={vi.fn()} openDay={DAY()} />);

    // Every hour but Dana's, in the one column on show.
    expect(screen.getAllByTestId('folded-hour')).toHaveLength(15);
    expect(axis()).toHaveLength(16);
    expect(axis().slice(0, 6)).toEqual(['06:00', '07:00', '08:00', '09:00', '10:00', '11:00']);
    // Four folded hours of 34px above her; her hour at full height.
    expect(blockOf('Dana').style.top).toBe('136px');
    expect(blockOf('Dana').style.height).toBe(`${HOUR_PX}px`);
  });

  it('opens the hours a booking is dragged over, gliding, and lands it at the time shown there', async () => {
    render(<AppointmentCalendar appointments={[booking('Dana', dayAt(3, 10))]} onAppointmentClick={vi.fn()} openDay={DAY()} />);
    const block = blockOf('Dana');
    const r = block.getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;

    await act(async () => { fireEvent.mouseDown(block, { button: 0, clientX: x, clientY: y }); });
    await act(async () => { fireEvent.mouseMove(document, { clientX: x, clientY: y + 10 }); });
    // Down past her hour, into the folded 11:00 and 12:00: they open.
    await act(async () => { fireEvent.mouseMove(document, { clientX: x, clientY: y + HOUR_PX + 10 }); });
    await waitFor(() => expect(screen.getAllByTestId('folded-hour')).toHaveLength(13));
    // Opened from its top, 11:00 is under the pointer: 11:05.
    expect(screen.getByTestId('drag-landing').textContent).toContain('11:05');
    expect(blockOf('Dana').style.transition).toContain('top 240ms');

    await act(async () => { fireEvent.mouseUp(document, { clientX: x, clientY: y + HOUR_PX + 10 }); });
    await act(async () => { fireEvent.click(block); });
    await act(async () => { await new Promise((done) => setTimeout(done, 60)); });
    // Dropped: the hours fold again behind the window that asks.
    expect(screen.getAllByTestId('folded-hour')).toHaveLength(15);
    fireEvent.click(await screen.findByText('appointments.drag.move'));
    await waitFor(() => expect(moveAppointment).toHaveBeenCalledWith('Dana', String(dayAt(3, 11, 5))));
  });

  it('jumps rather than glides when nothing is held', () => {
    render(<AppointmentCalendar appointments={[booking('Dana', dayAt(3, 10))]} onAppointmentClick={vi.fn()} openDay={DAY()} />);
    expect(blockOf('Dana').style.transition).toBe('');
  });

  it('draws every hour while the bookings load, as placeholders', () => {
    const { rerender } = render(
      <AppointmentCalendar appointments={[]} onAppointmentClick={vi.fn()} openDay={DAY()} loading />
    );
    expect(screen.getAllByTestId('calendar-skeleton').length).toBeGreaterThan(0);
    expect(screen.queryAllByTestId('folded-hour')).toHaveLength(0);
    expect(screen.getByText('appointments.loading').getAttribute('role')).toBe('status');

    rerender(<AppointmentCalendar appointments={[booking('Dana', dayAt(3, 10))]} onAppointmentClick={vi.fn()} openDay={DAY()} />);
    expect(screen.queryAllByTestId('calendar-skeleton')).toHaveLength(0);
    expect(blockOf('Dana')).toBeTruthy();
  });
});
