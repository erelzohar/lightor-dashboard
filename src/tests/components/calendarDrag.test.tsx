import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import toast from 'react-hot-toast';
import AppointmentCalendar from '../../components/appointments/AppointmentCalendar';
import { moveAppointment, swapAppointments } from '../../services/appointmentsApi';
import { Appointment, AppointmentType } from '../../types';

/**
 * Every hour at full height here (`foldFreeHours={false}`): these tests read
 * places off a plain 88px-an-hour grid; folding has its own tests (LT-359).
 *
 * LT-345 — a booking dragged in the week view: to another time (a window
 * asks, then the move is sent), or onto another booking (a swap).
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
const tomorrowAt = (hour: number) => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, hour).valueOf();
};
const booking = (id: string, start: number): Appointment => ({
  _id: id, name: id, type: service, phone: '+972500000001', status: 'scheduled', user_id: 'u1', timestamp: String(start),
});

/** A mouse drag of the booking named `name` by (dx, dy), from its middle. */
const blockOf = (name: string) =>
  screen.getAllByTestId('session-block').find((b) => b.textContent?.includes(name)) as HTMLElement;
const drag = async (name: string, dx: number, dy: number) => {
  const block = blockOf(name);
  const r = block.getBoundingClientRect();
  const x = r.left + r.width / 2;
  const y = r.top + r.height / 2;
  await act(async () => { fireEvent.mouseDown(block, { button: 0, clientX: x, clientY: y }); });
  await act(async () => { fireEvent.mouseMove(document, { clientX: x, clientY: y + 10 }); });
  await act(async () => { fireEvent.mouseMove(document, { clientX: x + dx, clientY: y + dy }); });
  await act(async () => { fireEvent.mouseUp(document, { clientX: x + dx, clientY: y + dy }); });
  // The click a browser fires where the mouse came up — on the dragged block,
  // which went along — and which the drag swallows for 50ms; a person's next
  // click comes later than that.
  await act(async () => { fireEvent.click(block); });
  await act(async () => { await new Promise((r) => setTimeout(r, 60)); });
};

describe('dragging a booking in the calendar (LT-345)', () => {
  it('asks before moving it, then sends the new start', async () => {
    render(<AppointmentCalendar appointments={[booking('Dana', tomorrowAt(10))]} onAppointmentClick={vi.fn()} foldFreeHours={false} />);

    await drag('Dana', 0, HOUR_PX + HOUR_PX / 2);

    expect(await screen.findByText('appointments.drag.moveTitle')).toBeTruthy();
    expect(moveAppointment).not.toHaveBeenCalled();
    // LT-422: its time now, and the new one from start to end, in bold.
    expect(screen.getByTestId('drop-confirm').textContent).toContain('appointments.drag.now');
    expect(screen.getByTestId('drop-confirm').textContent).toContain('10:00–11:00');
    expect(screen.getByTestId('drop-new-time').textContent).toContain('11:30–12:30');
    // LT-497: on the dialog's middle line, the buttons too.
    expect(screen.getByTestId('drop-confirm').closest('.text-center')).toBeTruthy();
    expect(screen.getByText('appointments.drag.move').closest('.justify-center')).toBeTruthy();
    fireEvent.click(screen.getByText('appointments.drag.move'));
    await waitFor(() => expect(moveAppointment).toHaveBeenCalledWith('Dana', String(tomorrowAt(11) + 30 * 60_000)));
  });

  it('swaps when dropped onto another booking', async () => {
    render(
      <AppointmentCalendar
        appointments={[booking('Dana', tomorrowAt(10)), booking('Avi', tomorrowAt(14))]}
        onAppointmentClick={vi.fn()} foldFreeHours={false}
      />
    );

    await drag('Dana', 0, 4 * HOUR_PX);

    expect(await screen.findByText('appointments.drag.swapTitle')).toBeTruthy();
    fireEvent.click(screen.getByText('appointments.drag.swap'));
    await waitFor(() => expect(swapAppointments).toHaveBeenCalledWith('Dana', 'Avi'));
  });

  // LT-422 (Erel): a 45-minute and a two-hour booking back to back trade
  // places in the same span, and the confirm says the real new hours.
  it('says where each of two bookings of different lengths will really be', async () => {
    const short = { ...booking('Tomer', tomorrowAt(10) + 30 * 60_000), type: { ...service, _id: 's45', name: 'Russian manicure', durationMS: String(45 * 60_000) } };
    const long = { ...booking('Maya', tomorrowAt(11) + 15 * 60_000), type: { ...service, _id: 's120', name: 'Gel build', durationMS: String(2 * HOUR) } };
    render(<AppointmentCalendar appointments={[short, long]} onAppointmentClick={vi.fn()} foldFreeHours={false} />);

    await drag('Maya', 0, -HOUR_PX);

    expect(await screen.findByText('appointments.drag.swapTitle')).toBeTruthy();
    const times = screen.getAllByTestId('drop-new-time').map((el) => el.textContent);
    // In the order they will run: Maya 10:30-12:30, then Tomer 12:30-13:15.
    expect(times[0]).toContain('10:30–12:30');
    expect(times[1]).toContain('12:30–13:15');
    expect(screen.getAllByTestId('drop-card')[0].textContent).toContain('Maya');
  });

  it('refuses a drop partly over another booking, and sends nothing', async () => {
    render(
      <AppointmentCalendar
        appointments={[booking('Dana', tomorrowAt(10)), booking('Avi', tomorrowAt(14))]}
        onAppointmentClick={vi.fn()} foldFreeHours={false}
      />
    );

    // Dana to 13:30, the pointer just above Avi's block: her hour would reach into his.
    await drag('Dana', 0, 3.5 * HOUR_PX - 3);

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('appointments.drag.taken'));
    expect(screen.queryByText('appointments.drag.moveTitle')).toBeNull();
  });

  it('does nothing when the mouse barely moves: a click stays a click', async () => {
    const onClick = vi.fn();
    render(<AppointmentCalendar appointments={[booking('Dana', tomorrowAt(10))]} onAppointmentClick={onClick} foldFreeHours={false} />);
    const block = blockOf('Dana');

    fireEvent.mouseDown(block, { button: 0, clientX: 100, clientY: 100 });
    fireEvent.mouseUp(document, { clientX: 101, clientY: 101 });
    fireEvent.click(block);

    expect(screen.getByText('appointments.markCompleted')).toBeTruthy();
    expect(screen.queryByText('appointments.drag.moveTitle')).toBeNull();
  });
});

/**
 * LT-353: held at a side, the page turns under the booking — a week ahead in
 * the week view, a day on a phone — and it lands on the day now on show.
 */
describe('dragging a booking to another week or day (LT-353)', () => {
  const dayAt = (days: number, hour: number) => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate() + days, hour).valueOf();
  };
  const settle = (ms: number) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });
  /** Picks the booking up, holds it at the far side for `holdMs`, then drops it at `dropX`, its own height. */
  const holdAhead = async (name: string, holdMs: number, dropX: number) => {
    const block = blockOf(name);
    const r = block.getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    await act(async () => { fireEvent.mouseDown(block, { button: 0, clientX: x, clientY: y }); });
    await act(async () => { fireEvent.mouseMove(document, { clientX: x, clientY: y + 10 }); });
    await act(async () => { fireEvent.mouseMove(document, { clientX: x, clientY: y }); });
    await act(async () => { fireEvent.mouseMove(document, { clientX: 1010, clientY: y }); });
    expect(screen.getByTestId('drag-edge-ahead')).toBeTruthy();
    await settle(holdMs);
    await act(async () => { fireEvent.mouseMove(document, { clientX: dropX, clientY: y }); });
    await act(async () => { fireEvent.mouseUp(document, { clientX: dropX, clientY: y }); });
    await act(async () => { fireEvent.click(block); });
    await settle(60);
  };

  it('a week ahead in the week view, with the hours left where they were', async () => {
    render(<AppointmentCalendar appointments={[booking('Dana', tomorrowAt(10))]} onAppointmentClick={vi.fn()} foldFreeHours={false} />);
    vi.mocked(Element.prototype.scrollTo).mockClear();

    // Tomorrow is the second column (x 160-260).
    await holdAhead('Dana', 700, 210);

    expect(await screen.findByText('appointments.drag.moveTitle')).toBeTruthy();
    expect(Element.prototype.scrollTo).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('appointments.drag.move'));
    await waitFor(() => expect(moveAppointment).toHaveBeenCalledWith('Dana', String(dayAt(8, 10))));
  });

  it('a day ahead on a phone, where one day is on show', async () => {
    render(
      <AppointmentCalendar appointments={[booking('Dana', tomorrowAt(10))]} onAppointmentClick={vi.fn()} foldFreeHours={false} openDay={new Date(dayAt(1, 0))} />
    );

    await holdAhead('Dana', 700, 110);

    expect(await screen.findByText('appointments.drag.moveTitle')).toBeTruthy();
    fireEvent.click(screen.getByText('appointments.drag.move'));
    await waitFor(() => expect(moveAppointment).toHaveBeenCalledWith('Dana', String(dayAt(2, 10))));
  });

  it('a moment at the side is not enough: no page turns, nothing moves', async () => {
    render(<AppointmentCalendar appointments={[booking('Dana', tomorrowAt(10))]} onAppointmentClick={vi.fn()} foldFreeHours={false} />);

    await holdAhead('Dana', 100, 210);

    expect(screen.queryByText('appointments.drag.moveTitle')).toBeNull();
    expect(moveAppointment).not.toHaveBeenCalled();
  });
});
