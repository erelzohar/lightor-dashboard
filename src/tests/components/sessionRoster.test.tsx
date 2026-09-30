import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import AppointmentsList from '../../components/appointments/AppointmentsList';
import { Appointment, AppointmentType } from '../../types';
import { getClassSessions } from '../../services/appointmentsApi';
import { updateAppointmentStatus } from '../../store/slices/appointmentsSlice';

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
// AnswersList (LT-178) reads the booking-questions catalog off the saved
// config; the list asks the server for the class sessions nobody has booked
// yet (LT-211) only when the store knows a class and the site's subdomain.
const store = vi.hoisted(() => ({
  state: {
    webConfig: { data: null as null | { _id: string; subDomain: string } },
    appointments: { appointmentTypes: [] as unknown[] },
  },
}));
vi.mock('../../hooks/useAppSelector', () => ({
  useAppSelector: (selector: (s: typeof store.state) => unknown): unknown => selector(store.state),
}));
vi.mock('../../services/appointmentsApi', () => ({ getClassSessions: vi.fn() }));
vi.mock('../../store/slices/appointmentsSlice', () => ({
  updateAppointmentStatus: vi.fn(() => ({ type: 'noop' })),
  fetchAppointmentTypes: vi.fn(() => ({ type: 'noop' })),
}));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));
// The walk-in's booking (LT-204) is OwnerBookingModal's own business, tested
// in its file. Here it stands in as a stub that keeps what the roster asked of
// it and, on a click, books the way the real one does: onBooked, then onClose.
interface BookingModalProps {
  open: boolean;
  customer?: unknown;
  preset?: { typeId: string; timestamp: string };
  onClose: () => void;
  onBooked: () => void;
}
const bookingModal = vi.hoisted(() => ({ last: null as BookingModalProps | null }));
vi.mock('../../components/customers/OwnerBookingModal', () => ({
  default: (props: BookingModalProps) => {
    bookingModal.last = props;
    return props.open ? (
      <button type="button" onClick={() => { props.onBooked(); props.onClose(); }}>
        stub: book the walk-in
      </button>
    ) : null;
  },
}));

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

  it("opens the roster for a class's only participant too (LT-211): that is where the next is added", () => {
    const onAppointmentClick = vi.fn();
    render(<AppointmentsList appointments={[attendee('solo', 'Single Client', '+972500000009')]} onAppointmentClick={onAppointmentClick} />);

    expect(screen.getByText('appointments.session.participants:1')).toBeTruthy();
    fireEvent.click(screen.getByText('Group training'));

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Single Client')).toBeTruthy();
    expect(within(dialog).getByRole('button', { name: 'appointments.session.addParticipant' })).toBeTruthy();
    expect(onAppointmentClick).not.toHaveBeenCalled();
  });

  it('does not open a roster for a lone ordinary booking, and still selects it', () => {
    const onAppointmentClick = vi.fn();
    const haircut: AppointmentType = { _id: 't2', name: 'Haircut', webConfig_id: 'w1', price: '80', durationMS: String(HOUR) };
    const solo = [{ ...attendee('solo', 'Single Client', '+972500000009'), type: haircut }];

    render(<AppointmentsList appointments={solo} onAppointmentClick={onAppointmentClick} />);

    expect(screen.getByText('Single Client')).toBeTruthy();
    fireEvent.click(screen.getByText('Single Client'));

    expect(onAppointmentClick).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it("offers one action per person in a class: taking them out of it, the cancel underneath (LT-211)", () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.mocked(updateAppointmentStatus).mockClear();
    render(
      <AppointmentsList
        appointments={[...klass, attendee('d', 'Gone Away', '+972500000004', 'cancelled')]}
        onAppointmentClick={vi.fn()}
      />
    );
    fireEvent.click(screen.getByText('Group training'));
    const dialog = screen.getByRole('dialog');

    // Three people in, three buttons; the one who left has none.
    const removes = within(dialog).getAllByRole('button', { name: 'appointments.session.remove' });
    expect(removes).toHaveLength(3);
    expect(within(dialog).queryByRole('button', { name: 'appointments.markCompleted' })).toBeNull();
    expect(within(dialog).queryByRole('button', { name: 'appointments.cancelAppointment' })).toBeNull();

    const avi = within(dialog).getByText('Avi Levi').closest('li') as HTMLElement;
    fireEvent.click(within(avi).getByRole('button', { name: 'appointments.session.remove' }));

    expect(confirm).toHaveBeenCalledWith('appointments.session.removeConfirm');
    expect(updateAppointmentStatus).toHaveBeenCalledWith({ id: 'b', status: 'cancelled' });
    confirm.mockRestore();
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

/**
 * A walk-in joins a class from its roster (LT-204). The list keeps the open
 * session's id, not a copy, so once the appointments are fetched again the
 * new person is in the roster that is still open.
 */
describe('adding a walk-in from a class roster', () => {
  const klass = () => [
    attendee('a', 'Dana Cohen', '+972500000001'),
    attendee('b', 'Avi Levi', '+972500000002'),
    attendee('c', 'Noa Bar', '+972500000003'),
  ];
  const addButton = () =>
    within(screen.getByRole('dialog')).queryByRole('button', { name: 'appointments.session.addParticipant' });

  beforeEach(() => {
    bookingModal.last = null;
  });

  it('opens the booking on this session, with no customer yet', () => {
    render(<AppointmentsList appointments={klass()} onAppointmentClick={vi.fn()} />);
    fireEvent.click(screen.getByText('Group training'));
    expect(bookingModal.last?.open).toBe(false);

    fireEvent.click(addButton() as HTMLElement);

    expect(bookingModal.last?.open).toBe(true);
    expect(bookingModal.last?.preset).toEqual({ typeId: 't1', timestamp: AT });
    expect(bookingModal.last?.customer).toBeUndefined();
  });

  it('shows the walk-in in the open roster once the appointments are fetched again', () => {
    const { rerender } = render(<AppointmentsList appointments={klass()} onAppointmentClick={vi.fn()} />);
    fireEvent.click(screen.getByText('Group training'));
    fireEvent.click(addButton() as HTMLElement);
    fireEvent.click(screen.getByText('stub: book the walk-in'));

    // What the modal's refetch brings back: the same session, one more in it.
    rerender(
      <AppointmentsList
        appointments={[...klass(), attendee('d', 'Walk In', '+972500000004')]}
        onAppointmentClick={vi.fn()}
      />
    );

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Walk In')).toBeTruthy();
    expect(within(dialog).getByText('appointments.session.participants:4')).toBeTruthy();
    expect(screen.queryByText('stub: book the walk-in')).toBeNull();
  });

  it('says the class is full rather than offering a seat', () => {
    const small = { ...type, capacity: 3 };
    render(
      <AppointmentsList appointments={klass().map((a) => ({ ...a, type: small }))} onAppointmentClick={vi.fn()} />
    );
    fireEvent.click(screen.getByText('Group training'));

    const full = within(screen.getByRole('dialog')).getByRole('button', { name: 'appointments.session.full' });
    expect(full).toBeDisabled();
    expect(addButton()).toBeNull();
  });

  it('is not offered for an ordinary service, nor for a session that began over a day ago', () => {
    const ordinary: AppointmentType = { _id: 't2', name: 'Haircut', webConfig_id: 'w1', price: '80', durationMS: String(HOUR) };
    const { unmount } = render(
      <AppointmentsList appointments={klass().map((a) => ({ ...a, type: ordinary }))} onAppointmentClick={vi.fn()} />
    );
    fireEvent.click(screen.getByText('Haircut'));
    expect(addButton()).toBeNull();
    // Not a class: each booking keeps its own complete and cancel.
    expect(within(screen.getByRole('dialog')).getAllByRole('button', { name: 'appointments.markCompleted' })).toHaveLength(3);
    expect(within(screen.getByRole('dialog')).queryByRole('button', { name: 'appointments.session.remove' })).toBeNull();
    unmount();

    const lastWeek = String(Date.now() - 30 * HOUR);
    render(
      <AppointmentsList appointments={klass().map((a) => ({ ...a, timestamp: lastWeek }))} onAppointmentClick={vi.fn()} />
    );
    fireEvent.click(screen.getByText('Group training'));
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(addButton()).toBeNull();
  });

  it('opens on document.body, out of the glass card it was opened from', () => {
    const { container } = render(<AppointmentsList appointments={klass()} onAppointmentClick={vi.fn()} />);
    fireEvent.click(screen.getByText('Group training'));

    expect(container.contains(screen.getByRole('dialog'))).toBe(false);
  });

  it('closes for good when its session leaves the list, and does not spring open when it returns', () => {
    const { rerender } = render(<AppointmentsList appointments={klass()} onAppointmentClick={vi.fn()} />);
    fireEvent.click(screen.getByText('Group training'));
    expect(screen.getByRole('dialog')).toBeTruthy();

    rerender(<AppointmentsList appointments={[]} onAppointmentClick={vi.fn()} />);
    rerender(<AppointmentsList appointments={klass()} onAppointmentClick={vi.fn()} />);

    return waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
});

/**
 * A class nobody has booked into holds no appointment, so it used to show
 * nowhere — and its roster, the one place to add a participant, could not
 * be opened (LT-211). The list now asks the server for the coming week's
 * sessions and shows the empty ones too.
 */
describe('a class nobody has booked yet', () => {
  const listing = (timestamp: string) => ({
    type_id: 't1',
    timestamp,
    durationMS: String(HOUR),
    capacity: 12,
    booked: 0,
  });

  beforeEach(() => {
    bookingModal.last = null;
    store.state.webConfig.data = { _id: 'w1', subDomain: 'studio' };
    store.state.appointments.appointmentTypes = [type];
    vi.mocked(getClassSessions).mockReset().mockResolvedValue([listing(AT)]);
  });

  afterEach(() => {
    store.state.webConfig.data = null;
    store.state.appointments.appointmentTypes = [];
  });

  it("shows the coming week's empty session and seats its first participant from the roster", async () => {
    render(<AppointmentsList appointments={[]} onAppointmentClick={vi.fn()} />);

    expect(await screen.findByText('appointments.session.empty')).toBeTruthy();
    const [, from, to] = vi.mocked(getClassSessions).mock.calls[0];
    expect(Number(to) - Number(from)).toBe(7 * 24 * HOUR);

    fireEvent.click(screen.getByText('Group training'));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getAllByText('appointments.session.empty').length).toBeGreaterThan(0);
    fireEvent.click(within(dialog).getByRole('button', { name: 'appointments.session.addParticipant' }));

    expect(bookingModal.last?.open).toBe(true);
    expect(bookingModal.last?.preset).toEqual({ typeId: 't1', timestamp: AT });
  });

  it('shows a booked session once, with its people, not beside an empty copy', async () => {
    const later = String(Number(AT) + 24 * HOUR);
    vi.mocked(getClassSessions).mockResolvedValue([listing(AT), listing(later)]);
    render(<AppointmentsList appointments={[attendee('a', 'Dana Cohen', '+972500000001')]} onAppointmentClick={vi.fn()} />);

    // The later session, empty, arrives; the booked one stays one card.
    expect(await screen.findByText('appointments.session.empty')).toBeTruthy();
    expect(screen.getAllByText('Group training')).toHaveLength(2);
    expect(screen.getByText('appointments.session.participants:1')).toBeTruthy();
  });

  it('asks nothing of the server when the business teaches no class', () => {
    store.state.appointments.appointmentTypes = [{ ...type, kind: undefined }];
    render(<AppointmentsList appointments={[]} onAppointmentClick={vi.fn()} />);

    expect(getClassSessions).not.toHaveBeenCalled();
    expect(screen.getByText('appointments.noAppointments')).toBeTruthy();
  });
});
