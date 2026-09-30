import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import toast from 'react-hot-toast';
import OwnerBookingModal from '../../components/customers/OwnerBookingModal';
import { createAppointment, getClassSessions } from '../../services/appointmentsApi';
import { fetchAddressSuggestions, loadPlaces, resolveAddressSuggestion } from '../../services/places';
import type { BookingField } from '../../types';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ auth: { user: { _id: 'u1', webConfig_id: 'wc1' } } }),
}));
vi.mock('../../hooks/useAppDispatch', () => ({ useAppDispatch: () => vi.fn() }));
vi.mock('../../store/slices/appointmentsSlice', () => ({
  fetchAppointments: vi.fn(() => ({ type: 'noop' })),
  fetchAppointmentTypes: vi.fn(() => ({ type: 'noop' })),
}));
vi.mock('../../services/appointmentsApi', () => ({ createAppointment: vi.fn(), getClassSessions: vi.fn() }));
// Google's side of the address suggestions (LT-206); the key stays real, so
// the widget is off unless a test stubs VITE_GOOGLE_MAPS_KEY.
vi.mock('../../services/places', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../services/places')>()),
  loadPlaces: vi.fn(),
  fetchAddressSuggestions: vi.fn(),
  resolveAddressSuggestion: vi.fn(),
}));
// The real readers of a refusal's status and code (LT-204).
vi.mock('../../services/customersApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/customersApi')>();
  return { apiErrorStatus: actual.apiErrorStatus, isApiErrorCode: actual.isApiErrorCode };
});
// Opening hours are not under test: two slots, always in the future.
vi.mock('../../utils/bookingSlots', () => ({
  generateSlots: () => ['10:00', '11:00'],
  localDateKey: (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
  slotTimestamp: () => Date.now() + 86_400_000,
}));

const CATALOG: BookingField[] = [
  { key: 'address', label: 'Address', type: 'address', required: true, services: [] },
  { key: 'car', label: 'Car model', type: 'text', required: false, services: ['t1'] },
  { key: 'parking', label: 'I have parking', type: 'confirm', required: false, services: ['t2'] },
  { key: 'floor', label: 'Floor', type: 'choice', required: false, options: ['Ground', 'Upstairs'], services: ['t2'] },
];
const state = {
  appointments: {
    appointmentTypes: [
      { _id: 't1', name: 'Massage', webConfig_id: 'wc1', price: '100', durationMS: '3600000' },
      { _id: 't2', name: 'Home visit', webConfig_id: 'wc1', price: '200', durationMS: '3600000' },
      // Saved on a leads site (LT-199): no duration, so it cannot be booked.
      { _id: 't3', name: 'Kitchen renovation', webConfig_id: 'wc1', price: '' },
      // A group class (LT-204): its times are its sessions, not opening hours.
      {
        _id: 'c1',
        name: 'Yoga',
        webConfig_id: 'wc1',
        price: '50',
        durationMS: '3600000',
        kind: 'class',
        capacity: 12,
        sessions: [{ weekday: 0, time: '19:00' }],
      },
    ],
  },
  webConfig: { data: { subDomain: 'studio', workingDays: [] as (string | null)[], bookingFields: CATALOG } },
};
vi.mock('../../hooks/useAppSelector', () => ({
  useAppSelector: (selector: (s: typeof state) => unknown): unknown => selector(state),
}));

const renderModal = (props: Partial<React.ComponentProps<typeof OwnerBookingModal>> = {}) =>
  render(
    <OwnerBookingModal
      open
      customer={{ name: 'Dana', phone: '0501234567' }}
      onClose={vi.fn()}
      onBooked={vi.fn()}
      {...props}
    />
  );

const serviceSelect = () => screen.getAllByRole('combobox')[0];
const sentBody = () => vi.mocked(createAppointment).mock.calls[0][0];

/**
 * The owner's manual booking asks the same questions a customer sees
 * (LT-178), or the owner's own walk-ins would arrive without the address.
 */
describe('OwnerBookingModal: booking questions', () => {
  beforeEach(() => {
    vi.mocked(createAppointment).mockReset().mockResolvedValue({} as never);
  });

  it('asks the questions in scope for the chosen service, with required marked', () => {
    renderModal();

    expect(screen.getByLabelText(/Address/)).toBeTruthy();
    expect(screen.getByLabelText(/Car model/)).toBeTruthy();
    expect(screen.queryByLabelText(/I have parking/)).toBeNull();
    // The required marker is shown; nothing is enforced (the server spares the owner).
    expect(screen.getByLabelText(/Address/).closest('div')?.parentElement?.textContent).toContain('*');
    expect(screen.getByLabelText(/Address/)).not.toBeRequired();
  });

  it('sends answers as key + value, re-scoped to the service picked, keeping what still applies', async () => {
    renderModal();

    fireEvent.change(screen.getByLabelText(/Address/), { target: { value: '  Herzl 12, Tel Aviv ' } });
    fireEvent.change(screen.getByLabelText(/Car model/), { target: { value: 'Mazda 3' } });

    // Switching service: the address stays, the car question leaves, parking arrives.
    fireEvent.change(serviceSelect(), { target: { value: 't2' } });
    expect((screen.getByLabelText(/Address/) as HTMLInputElement).value).toBe('  Herzl 12, Tel Aviv ');
    expect(screen.queryByLabelText(/Car model/)).toBeNull();
    fireEvent.click(screen.getByLabelText(/I have parking/));
    fireEvent.change(screen.getByLabelText(/Floor/), { target: { value: 'Upstairs' } });

    fireEvent.change(screen.getByTestId('slot-select'), { target: { value: '10:00' } });
    fireEvent.click(screen.getByText('customers.booking.submit'));

    await waitFor(() => expect(createAppointment).toHaveBeenCalledTimes(1));
    expect(sentBody()).toMatchObject({ name: 'Dana', phone: '0501234567', type_id: 't2', user_id: 'u1' });
    expect(sentBody().answers).toEqual([
      { key: 'address', value: 'Herzl 12, Tel Aviv' },
      { key: 'parking', value: 'yes' },
      { key: 'floor', value: 'Upstairs' },
    ]);
  });

  it('does not block on a required question left blank, and omits an unticked confirm', async () => {
    renderModal();

    fireEvent.change(serviceSelect(), { target: { value: 't2' } });
    fireEvent.change(screen.getByTestId('slot-select'), { target: { value: '11:00' } });
    fireEvent.click(screen.getByText('customers.booking.submit'));

    await waitFor(() => expect(createAppointment).toHaveBeenCalledTimes(1));
    expect(sentBody().answers).toEqual([]);
  });
});

/**
 * A service without a duration (LT-199) is content, not a time slot: the
 * server refuses to book it, so the owner is not offered it.
 */
describe('OwnerBookingModal: services without a duration', () => {
  it('offers only the services that can be booked', () => {
    renderModal();

    const options = Array.from(serviceSelect().querySelectorAll('option')).map((o) => o.value);
    expect(options).toEqual(['t1', 't2', 'c1']);
    expect(serviceSelect().textContent).not.toContain('NaN');
  });
});


/**
 * LT-206: the address question offers Google's suggestions, as the public
 * form does (LT-191); a chosen one sends the place it stands for. Without a
 * key, or with Google failing, it is the plain field it always was.
 */
describe('OwnerBookingModal: address suggestions', () => {
  const SUGGESTION = {
    placeId: 'ChIJ-herzl-12',
    text: 'הרצל 12, תל אביב-יפו',
    mainText: 'הרצל 12',
    secondaryText: 'תל אביב-יפו',
    prediction: {},
  };

  beforeEach(() => {
    vi.mocked(createAppointment).mockReset().mockResolvedValue({} as never);
    vi.mocked(loadPlaces).mockReset().mockResolvedValue(undefined as never);
    vi.mocked(fetchAddressSuggestions).mockReset().mockResolvedValue([SUGGESTION] as never);
    vi.mocked(resolveAddressSuggestion).mockReset().mockResolvedValue({ placeId: 'ChIJ-herzl-12', lat: 32.06, lng: 34.77 });
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  const book = async () => {
    fireEvent.change(screen.getByTestId('slot-select'), { target: { value: '10:00' } });
    fireEvent.click(screen.getByText('customers.booking.submit'));
    await waitFor(() => expect(createAppointment).toHaveBeenCalledTimes(1));
    return sentBody().answers?.find((a) => a.key === 'address');
  };

  it('sends the chosen suggestion with its place, credited to Google Maps', async () => {
    vi.stubEnv('VITE_GOOGLE_MAPS_KEY', 'test-key');
    renderModal();
    const input = screen.getByLabelText(/Address/);
    await waitFor(() => expect(input).toHaveAttribute('role', 'combobox'));

    fireEvent.change(input, { target: { value: 'הרצ' } });
    const option = await screen.findByRole('option', { name: /הרצל 12/ });
    // Google's attribution (LT-207): the logo from Google's asset pack.
    expect(screen.getByRole('img', { name: 'Google Maps' }).tagName.toLowerCase()).toBe('svg');
    fireEvent.click(option);
    await waitFor(() => expect(resolveAddressSuggestion).toHaveBeenCalled());
    await waitFor(() => expect((input as HTMLInputElement).value).toBe('הרצל 12, תל אביב-יפו'));

    expect(await book()).toEqual({ key: 'address', value: 'הרצל 12, תל אביב-יפו', placeId: 'ChIJ-herzl-12', lat: 32.06, lng: 34.77 });
  });

  it('typing after a choice sends plain text again', async () => {
    vi.stubEnv('VITE_GOOGLE_MAPS_KEY', 'test-key');
    renderModal();
    const input = screen.getByLabelText(/Address/);
    await waitFor(() => expect(input).toHaveAttribute('role', 'combobox'));
    fireEvent.change(input, { target: { value: 'הרצ' } });
    fireEvent.click(await screen.findByRole('option', { name: /הרצל 12/ }));
    await waitFor(() => expect(resolveAddressSuggestion).toHaveBeenCalled());

    fireEvent.change(input, { target: { value: 'הרצל 12, דירה 4' } });
    expect(await book()).toEqual({ key: 'address', value: 'הרצל 12, דירה 4' });
  });

  it('without a key it never loads Google, and the field is plain text', async () => {
    renderModal();
    const input = screen.getByLabelText(/Address/);
    expect(input).not.toHaveAttribute('role', 'combobox');
    fireEvent.change(input, { target: { value: 'Herzl 12' } });
    expect(loadPlaces).not.toHaveBeenCalled();
    expect(await book()).toEqual({ key: 'address', value: 'Herzl 12' });
  });

  it('when Google cannot be reached, typed text is accepted', async () => {
    vi.stubEnv('VITE_GOOGLE_MAPS_KEY', 'test-key');
    vi.mocked(loadPlaces).mockRejectedValue(new Error('blocked'));
    renderModal();
    const input = screen.getByLabelText(/Address/);
    await waitFor(() => expect(loadPlaces).toHaveBeenCalled());
    fireEvent.change(input, { target: { value: 'Herzl 12' } });
    expect(fetchAddressSuggestions).not.toHaveBeenCalled();
    expect(await book()).toEqual({ key: 'address', value: 'Herzl 12' });
  });
});


/**
 * LT-204: a group class books into one of its sessions. The server expands
 * the timetable and counts the seats; the modal lists that day's sessions of
 * the chosen class and sends the session's timestamp exactly as received —
 * a timestamp rebuilt from "HH:mm" in the browser is a different number.
 */
describe('OwnerBookingModal: a group class', () => {
  // Never on a round minute: only a client that sends the server's own string
  // sends these.
  const at = (daysAhead: number, hour: number) => {
    const now = new Date();
    return String(new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysAhead, hour).valueOf() + 123);
  };
  const EVENING = at(0, 19);
  const MORNING = at(0, 8);
  const OTHER_CLASS = at(0, 12);
  const SESSIONS = [
    { type_id: 'c1', timestamp: EVENING, durationMS: '3600000', capacity: 12, booked: 3 },
    { type_id: 'c1', timestamp: MORNING, durationMS: '3600000', capacity: 12, booked: 12 },
    { type_id: 'c2', timestamp: OTHER_CLASS, durationMS: '3600000', capacity: 8, booked: 1 },
  ];

  const sessionSelect = () => screen.getByTestId('session-select') as HTMLSelectElement;
  const submitButton = () => screen.getByText('customers.booking.submit').closest('button') as HTMLButtonElement;
  const pickYoga = async () => {
    fireEvent.change(serviceSelect(), { target: { value: 'c1' } });
    await screen.findByRole('option', { name: '19:00 · 3/12' });
  };
  const refusal = (status: number, data: Record<string, string>) => ({ response: { status, data } });

  beforeEach(() => {
    vi.mocked(createAppointment).mockReset().mockResolvedValue({} as never);
    vi.mocked(getClassSessions).mockReset().mockResolvedValue(SESSIONS);
    vi.mocked(toast.error).mockClear();
  });

  it("lists that day's sessions of the class with their seats, a full one shown but not offered", async () => {
    renderModal();
    const yoga = Array.from(serviceSelect().querySelectorAll('option')).find((o) => o.value === 'c1');
    expect(yoga?.textContent).toBe('Yoga · appointmentTypes.class.toggle · 60 appointments.minutes');

    await pickYoga();

    // The owner's local day, midnight to midnight, addressed by subdomain.
    const now = new Date();
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).valueOf();
    const nextDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).valueOf();
    expect(getClassSessions).toHaveBeenLastCalledWith('studio', String(dayStart), String(nextDay - 1));

    const labels = Array.from(sessionSelect().querySelectorAll('option')).map((o) => o.textContent);
    expect(labels).toEqual(['customers.booking.pickSession', '08:00 · 12/12', '19:00 · 3/12']);
    expect(screen.getByRole('option', { name: '08:00 · 12/12' })).toBeDisabled();
    expect(screen.getByRole('option', { name: '19:00 · 3/12' })).not.toBeDisabled();
    // Opening hours play no part in a class.
    expect(screen.queryByTestId('slot-select')).toBeNull();
    expect(submitButton()).toBeDisabled();
  });

  it("books the session with the server's own timestamp", async () => {
    renderModal();
    await pickYoga();

    fireEvent.change(sessionSelect(), { target: { value: EVENING } });
    fireEvent.click(submitButton());

    await waitFor(() => expect(createAppointment).toHaveBeenCalledTimes(1));
    expect(sentBody()).toMatchObject({ name: 'Dana', phone: '0501234567', type_id: 'c1', timestamp: EVENING });
  });

  it('says when the class has no session that day, or the sessions could not be read', async () => {
    vi.mocked(getClassSessions).mockResolvedValue([]);
    renderModal();
    fireEvent.change(serviceSelect(), { target: { value: 'c1' } });
    expect(await screen.findByRole('option', { name: 'customers.booking.noSessions' })).toBeTruthy();
    expect(sessionSelect()).toBeDisabled();

    vi.mocked(getClassSessions).mockRejectedValue(new Error('offline'));
    fireEvent.change(document.querySelector('input[type="date"]') as HTMLInputElement, { target: { value: '2099-01-05' } });
    expect(await screen.findByRole('option', { name: 'customers.booking.sessionsFailed' })).toBeTruthy();
  });

  it.each([
    ['CLASS_FULL', 'customers.booking.classFull'],
    ['ALREADY_BOOKED', 'customers.booking.alreadyBooked'],
    ['NOT_A_SESSION', 'customers.booking.notASession'],
  ])('answers the refusal %s in its own words and reads the seats again', async (code, message) => {
    vi.mocked(createAppointment).mockRejectedValue(refusal(409, { code, error: 'Refused' }));
    renderModal();
    await pickYoga();
    const fetches = vi.mocked(getClassSessions).mock.calls.length;

    fireEvent.change(sessionSelect(), { target: { value: EVENING } });
    fireEvent.click(submitButton());

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(message));
    await waitFor(() => expect(getClassSessions).toHaveBeenCalledTimes(fetches + 1));
  });

  it('keeps "slot taken" for an ordinary appointment refused with a 409', async () => {
    vi.mocked(createAppointment).mockRejectedValue(refusal(409, { code: 'CLASS_IN_THE_WAY', error: 'Teaching a class then' }));
    renderModal();

    fireEvent.change(screen.getByTestId('slot-select'), { target: { value: '10:00' } });
    fireEvent.click(submitButton());

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('customers.booking.slotTaken'));
    expect(getClassSessions).not.toHaveBeenCalled();
  });
});

/**
 * LT-204: a walk-in, seated from a class roster. There is no customer yet,
 * so the owner types a name and a phone (sent as typed: the server
 * normalizes the phone), and the roster's session comes preset.
 */
describe('OwnerBookingModal: a walk-in', () => {
  const tomorrowEvening = () => {
    const now = new Date();
    return String(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 19).valueOf() + 123);
  };
  const submitButton = () => screen.getByText('customers.booking.submit').closest('button') as HTMLButtonElement;

  beforeEach(() => {
    vi.mocked(createAppointment).mockReset().mockResolvedValue({} as never);
    vi.mocked(getClassSessions).mockReset().mockResolvedValue([]);
  });

  it('asks for a name and a phone, and books only once both are filled', async () => {
    renderModal({ customer: undefined });
    expect(screen.queryByText(/0501234567/)).toBeNull();

    fireEvent.change(screen.getByTestId('slot-select'), { target: { value: '10:00' } });
    expect(submitButton()).toBeDisabled();
    fireEvent.change(screen.getByLabelText('customers.add.name'), { target: { value: '  Walk In ' } });
    fireEvent.change(screen.getByLabelText('customers.add.phone'), { target: { value: '   ' } });
    expect(submitButton()).toBeDisabled();
    fireEvent.change(screen.getByLabelText('customers.add.phone'), { target: { value: '050-123 4567' } });
    expect(submitButton()).not.toBeDisabled();

    fireEvent.click(submitButton());
    await waitFor(() => expect(createAppointment).toHaveBeenCalledTimes(1));
    expect(sentBody()).toMatchObject({ name: 'Walk In', phone: '050-123 4567', type_id: 't1', channelType: 'sms' });
  });

  it("opens on the roster's session: its class, its date, that session", async () => {
    const TOMORROW = tomorrowEvening();
    vi.mocked(getClassSessions).mockResolvedValue([
      { type_id: 'c1', timestamp: TOMORROW, durationMS: '3600000', capacity: 12, booked: 5 },
    ]);
    renderModal({ customer: undefined, preset: { typeId: 'c1', timestamp: TOMORROW } });

    expect(screen.getByText('appointments.session.addParticipant')).toBeTruthy();
    expect((serviceSelect() as HTMLSelectElement).value).toBe('c1');
    const day = new Date(Number(TOMORROW));
    const dayKey = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
    expect((document.querySelector('input[type="date"]') as HTMLInputElement).value).toBe(dayKey);
    await waitFor(() => expect((screen.getByTestId('session-select') as HTMLSelectElement).value).toBe(TOMORROW));

    fireEvent.change(screen.getByLabelText('customers.add.name'), { target: { value: 'Walk In' } });
    fireEvent.change(screen.getByLabelText('customers.add.phone'), { target: { value: '0529876543' } });
    fireEvent.click(submitButton());

    await waitFor(() => expect(createAppointment).toHaveBeenCalledTimes(1));
    expect(sentBody()).toMatchObject({ name: 'Walk In', phone: '0529876543', type_id: 'c1', timestamp: TOMORROW });
  });

  it('does not choose a preset session that has filled up', async () => {
    const TOMORROW = tomorrowEvening();
    vi.mocked(getClassSessions).mockResolvedValue([
      { type_id: 'c1', timestamp: TOMORROW, durationMS: '3600000', capacity: 12, booked: 12 },
    ]);
    renderModal({ customer: undefined, preset: { typeId: 'c1', timestamp: TOMORROW } });

    expect(await screen.findByRole('option', { name: '19:00 · 12/12' })).toBeDisabled();
    expect((screen.getByTestId('session-select') as HTMLSelectElement).value).toBe('');
    expect(submitButton()).toBeDisabled();
  });
});
