import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import toast from 'react-hot-toast';
import OwnerBookingModal from '../../components/customers/OwnerBookingModal';
import { createAppointment, getAvailability, type Availability } from '../../services/appointmentsApi';
import { fetchAddressSuggestions, loadPlaces, resolveAddressSuggestion } from '../../services/places';
import type { BookingField } from '../../types';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('../../contexts/ThemeContext', () => ({ useTheme: () => ({ language: 'en', direction: 'ltr' }) }));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ auth: { user: { _id: 'u1', webConfig_id: 'wc1' } } }),
}));
vi.mock('../../hooks/useAppDispatch', () => ({ useAppDispatch: () => vi.fn() }));
vi.mock('../../store/slices/appointmentsSlice', () => ({
  fetchAppointments: vi.fn(() => ({ type: 'noop' })),
  fetchAppointmentTypes: vi.fn(() => ({ type: 'noop' })),
}));
vi.mock('../../services/appointmentsApi', () => ({ createAppointment: vi.fn(), getAvailability: vi.fn() }));
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

// A fixed clock (only Date is faked; timers stay real for the debounces and
// waitFor): Monday 2030-03-04, 08:00. The business opens 09:00–12:00 daily,
// so today offers an hour-long service at 09:00, 10:00 and 11:00.
const NOW = new Date(2030, 2, 4, 8, 0);
const at = (day: number, hour: number, extraMs = 0) => String(new Date(2030, 2, day, hour).valueOf() + extraMs);
const FREE: Availability = { busy: [], classes: [] };
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  vi.mocked(getAvailability).mockReset().mockResolvedValue(FREE);
});
afterEach(() => {
  vi.useRealTimers();
});

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
  webConfig: {
    data: {
      subDomain: 'studio',
      workingDays: Array<string | null>(7).fill('09:00-12:00'),
      dateOverrides: [] as { date: string; hours: string | null }[],
      vacations: [] as { startDate: string; endDate: string }[],
      bookingFields: CATALOG,
    },
  },
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

const sentBody = () => vi.mocked(createAppointment).mock.calls[0][0];
const submitButton = () => screen.getByText('customers.booking.submit').closest('button') as HTMLButtonElement;
const dayButton = (day: number) => within(screen.getByTestId('booking-days')).getByText(String(day)).closest('button') as HTMLButtonElement;

/**
 * The site's flow, a step at a time (LT-211): a service card, then a day,
 * then a time, then who and the owner's questions.
 */
const chooseService = (name: string) =>
  fireEvent.click(within(screen.getByTestId('booking-services')).getByRole('button', { name: new RegExp(`^${name}`) }));
/** A day once the month's availability is in (a day's dot is in its label then). */
const chooseDay = async (day: number) => {
  await waitFor(() => expect(dayButton(day).getAttribute('aria-label')).toContain('customers.booking.day.'));
  fireEvent.click(dayButton(day));
};
const chooseTime = async (time: string) => fireEvent.click(await screen.findByRole('button', { name: time }));
const toDetails = async (service = 'Massage', day = 4, time = '10:00') => {
  chooseService(service);
  await chooseDay(day);
  await chooseTime(time);
};
const back = () => fireEvent.click(screen.getByRole('button', { name: 'customers.booking.back' }));

/**
 * The owner's manual booking asks the same questions a customer sees
 * (LT-178), or the owner's own walk-ins would arrive without the address.
 */
describe('OwnerBookingModal: booking questions', () => {
  beforeEach(() => {
    vi.mocked(createAppointment).mockReset().mockResolvedValue({} as never);
  });

  it('asks the questions in scope for the chosen service, with required marked', async () => {
    renderModal();
    await toDetails();

    expect(screen.getByLabelText(/Address/)).toBeTruthy();
    expect(screen.getByLabelText(/Car model/)).toBeTruthy();
    expect(screen.queryByLabelText(/I have parking/)).toBeNull();
    // The required marker is shown; nothing is enforced (the server spares the owner).
    expect(screen.getByLabelText(/Address/).closest('div')?.parentElement?.textContent).toContain('*');
    expect(screen.getByLabelText(/Address/)).not.toBeRequired();
  });

  it('sends answers as key + value, re-scoped to the service picked, keeping what still applies', async () => {
    renderModal();
    await toDetails();

    fireEvent.change(screen.getByLabelText(/Address/), { target: { value: '  Herzl 12, Tel Aviv ' } });
    fireEvent.change(screen.getByLabelText(/Car model/), { target: { value: 'Mazda 3' } });

    // Back to the services for another one: the address stays, the car
    // question leaves, parking arrives.
    back();
    back();
    back();
    await toDetails('Home visit');
    expect((screen.getByLabelText(/Address/) as HTMLInputElement).value).toBe('  Herzl 12, Tel Aviv ');
    expect(screen.queryByLabelText(/Car model/)).toBeNull();
    fireEvent.click(screen.getByLabelText(/I have parking/));
    fireEvent.change(screen.getByLabelText(/Floor/), { target: { value: 'Upstairs' } });
    fireEvent.click(submitButton());

    await waitFor(() => expect(createAppointment).toHaveBeenCalledTimes(1));
    expect(sentBody()).toMatchObject({ name: 'Dana', phone: '0501234567', type_id: 't2', user_id: 'u1', timestamp: at(4, 10) });
    expect(sentBody().answers).toEqual([
      { key: 'address', value: 'Herzl 12, Tel Aviv' },
      { key: 'parking', value: 'yes' },
      { key: 'floor', value: 'Upstairs' },
    ]);
  });

  // LT-217: the details kept from the customer's last booking.
  it("fills in the customer's kept address — with its place — and the owner may change it", async () => {
    renderModal({
      customer: {
        name: 'Dana',
        phone: '0501234567',
        answers: [{ key: 'address', label: 'Address', value: 'Herzl 12, Tel Aviv', placeId: 'ChIJ_herzl', lat: 32.06, lng: 34.77 }],
      },
    });
    await toDetails();

    expect((screen.getByLabelText(/Address/) as HTMLInputElement).value).toBe('Herzl 12, Tel Aviv');
    fireEvent.change(screen.getByLabelText(/Car model/), { target: { value: 'Mazda 3' } });
    fireEvent.click(submitButton());

    await waitFor(() => expect(createAppointment).toHaveBeenCalledTimes(1));
    expect(sentBody().answers).toEqual([
      { key: 'address', value: 'Herzl 12, Tel Aviv', placeId: 'ChIJ_herzl', lat: 32.06, lng: 34.77 },
      { key: 'car', value: 'Mazda 3' },
    ]);
  });

  it('does not block on a required question left blank, and omits an unticked confirm', async () => {
    renderModal();
    await toDetails('Home visit', 4, '11:00');
    fireEvent.click(submitButton());

    await waitFor(() => expect(createAppointment).toHaveBeenCalledTimes(1));
    expect(sentBody().answers).toEqual([]);
  });
});

/**
 * The services come first, as cards (LT-211). A service without a duration
 * (LT-199) is content, not a time slot: the server refuses to book it, so the
 * owner is not offered it.
 */
describe('OwnerBookingModal: the services', () => {
  it('offers the bookable services as cards, each with its length and price', () => {
    renderModal();

    const cards = within(screen.getByTestId('booking-services')).getAllByRole('button');
    expect(cards.map((card) => card.textContent)).toEqual([
      'Massage60 appointments.minutes · appointments.currencySymbol100',
      'Home visit60 appointments.minutes · appointments.currencySymbol200',
      'Yoga60 appointments.minutes · appointments.currencySymbol50 · appointmentTypes.class.toggle',
    ]);
    // Nothing is picked for the owner, and nothing is booked from here.
    expect(screen.queryByTestId('booking-calendar')).toBeNull();
    expect(screen.queryByText('customers.booking.submit')).toBeNull();
  });

  it('shows a class with no timetable but does not offer it', () => {
    state.appointments.appointmentTypes.push({
      _id: 'c9', name: 'Pilates', webConfig_id: 'wc1', price: '60', durationMS: '3600000', kind: 'class', capacity: 8, sessions: [],
    });
    renderModal();
    const pilates = within(screen.getByTestId('booking-services')).getByRole('button', { name: /^Pilates/ });
    expect(pilates).toBeDisabled();
    expect(pilates.textContent).toContain('customers.booking.noTimetable');
    state.appointments.appointmentTypes.pop();
  });

  it('goes back a step at a time', async () => {
    renderModal();
    chooseService('Massage');
    await chooseDay(4);
    expect(await screen.findByTestId('booking-times')).toBeTruthy();

    back();
    expect(screen.getByTestId('booking-calendar')).toBeTruthy();
    back();
    expect(screen.getByTestId('booking-services')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'customers.booking.back' })).toBeNull();
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
    fireEvent.click(submitButton());
    await waitFor(() => expect(createAppointment).toHaveBeenCalledTimes(1));
    return sentBody().answers?.find((a) => a.key === 'address');
  };

  it('sends the chosen suggestion with its place, credited to Google Maps', async () => {
    vi.stubEnv('VITE_GOOGLE_MAPS_KEY', 'test-key');
    renderModal();
    await toDetails();
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
    await toDetails();
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
    await toDetails();
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
    await toDetails();
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
  const EVENING = at(4, 19, 123);
  const MORNING = at(4, 7, 123);
  const OTHER_CLASS = at(4, 12, 123);
  const SESSIONS = [
    { type_id: 'c1', timestamp: EVENING, durationMS: '3600000', capacity: 12, booked: 3 },
    { type_id: 'c1', timestamp: MORNING, durationMS: '3600000', capacity: 12, booked: 12 },
    { type_id: 'c2', timestamp: OTHER_CLASS, durationMS: '3600000', capacity: 8, booked: 1 },
  ];

  const pickYoga = async () => {
    chooseService('Yoga');
    await chooseDay(4);
    return screen.findByRole('button', { name: '19:00 · 3/12' });
  };
  const refusal = (status: number, data: Record<string, string>) => ({ response: { status, data } });

  beforeEach(() => {
    vi.mocked(createAppointment).mockReset().mockResolvedValue({} as never);
    vi.mocked(getAvailability).mockResolvedValue({ busy: [], classes: SESSIONS });
    vi.mocked(toast.error).mockClear();
  });

  it("lists that day's sessions of the class with their seats, a full one shown but not offered", async () => {
    renderModal();
    await pickYoga();

    // The month on show, first to last millisecond, addressed by subdomain.
    expect(getAvailability).toHaveBeenLastCalledWith(
      'studio',
      String(new Date(2030, 2, 1).valueOf()),
      String(new Date(2030, 3, 1).valueOf() - 1)
    );
    const offered = within(screen.getByRole('group', { name: 'customers.booking.pickSession' }))
      .getAllByRole('button')
      .map((b) => b.getAttribute('aria-label'));
    expect(offered).toEqual(['07:00 · 12/12', '19:00 · 3/12']);
    expect(screen.getByRole('button', { name: '07:00 · 12/12' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '19:00 · 3/12' })).not.toBeDisabled();
    // Opening hours play no part in a class, and nothing is booked yet.
    expect(screen.queryByRole('button', { name: '10:00' })).toBeNull();
    expect(screen.queryByText('customers.booking.submit')).toBeNull();
  });

  it("books the session with the server's own timestamp", async () => {
    renderModal();
    fireEvent.click(await pickYoga());
    fireEvent.click(submitButton());

    await waitFor(() => expect(createAppointment).toHaveBeenCalledTimes(1));
    expect(sentBody()).toMatchObject({ name: 'Dana', phone: '0501234567', type_id: 'c1', timestamp: EVENING });
  });

  it('draws a session the server listed twice once (LT-211: the day the clock went back)', async () => {
    vi.mocked(getAvailability).mockResolvedValue({ busy: [], classes: [...SESSIONS, SESSIONS[0], SESSIONS[0]] });
    renderModal();
    await pickYoga();

    expect(screen.getAllByRole('button', { name: '19:00 · 3/12' })).toHaveLength(1);
  });

  it('marks the days a session still has a seat, and closes the rest', async () => {
    vi.mocked(getAvailability).mockResolvedValue({
      busy: [],
      classes: [
        { type_id: 'c1', timestamp: at(5, 19), durationMS: '3600000', capacity: 12, booked: 3 },
        { type_id: 'c1', timestamp: at(6, 19), durationMS: '3600000', capacity: 12, booked: 10 },
        { type_id: 'c1', timestamp: at(7, 19), durationMS: '3600000', capacity: 12, booked: 12 },
      ],
    });
    renderModal();
    chooseService('Yoga');

    await waitFor(() => expect(dayButton(5).getAttribute('aria-label')).toContain('customers.booking.day.full'));
    expect(dayButton(6).getAttribute('aria-label')).toContain('customers.booking.day.limited');
    expect(dayButton(7)).toBeDisabled();
    expect(dayButton(3)).toBeDisabled();
    fireEvent.click(dayButton(6));
    expect(await screen.findByRole('button', { name: '19:00 · 10/12' })).toBeTruthy();
  });

  it('says so when the sessions could not be read, rather than showing a closed month', async () => {
    vi.mocked(getAvailability).mockRejectedValue(new Error('offline'));
    renderModal();
    chooseService('Yoga');

    expect(await screen.findByText('customers.booking.sessionsFailed')).toBeTruthy();
  });

  it.each([
    ['CLASS_FULL', 'customers.booking.classFull'],
    ['ALREADY_BOOKED', 'customers.booking.alreadyBooked'],
    ['NOT_A_SESSION', 'customers.booking.notASession'],
  ])('answers the refusal %s in its own words, reads the seats again and goes back to them', async (code, message) => {
    vi.mocked(createAppointment).mockRejectedValue(refusal(409, { code, error: 'Refused' }));
    renderModal();
    fireEvent.click(await pickYoga());
    const fetches = vi.mocked(getAvailability).mock.calls.length;

    fireEvent.click(submitButton());

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(message));
    await waitFor(() => expect(getAvailability).toHaveBeenCalledTimes(fetches + 1));
    expect(await screen.findByRole('button', { name: '19:00 · 3/12' })).toBeTruthy();
  });

  it('keeps "slot taken" for an ordinary appointment refused with a 409, back to the day read again', async () => {
    vi.mocked(createAppointment).mockRejectedValue(refusal(409, { code: 'CLASS_IN_THE_WAY', error: 'Teaching a class then' }));
    vi.mocked(getAvailability).mockResolvedValue(FREE);
    renderModal();
    await toDetails();
    const fetches = vi.mocked(getAvailability).mock.calls.length;

    fireEvent.click(submitButton());

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('customers.booking.slotTaken'));
    await waitFor(() => expect(getAvailability).toHaveBeenCalledTimes(fetches + 1));
    expect(await screen.findByRole('button', { name: '09:00' })).toBeTruthy();
  });
});

/**
 * LT-211: the owner books on the site's own calendar — the same free times a
 * customer would be offered: the opening hours less the bookings, the
 * classes and the vacations, day by day with the site's dots.
 */
describe("OwnerBookingModal: the site's calendar", () => {
  beforeEach(() => {
    vi.mocked(createAppointment).mockReset().mockResolvedValue({} as never);
  });
  afterEach(() => {
    state.webConfig.data.vacations = [];
    state.webConfig.data.workingDays = Array<string | null>(7).fill('09:00-12:00');
  });

  it('offers only what is free on the day: a booking and a class take their hours', async () => {
    vi.mocked(getAvailability).mockResolvedValue({
      busy: [{ timestamp: at(4, 10), durationMS: '3600000' }],
      classes: [{ type_id: 'c1', timestamp: at(4, 11), durationMS: '3600000', capacity: 12, booked: 0 }],
    });
    renderModal();
    chooseService('Massage');
    await chooseDay(4);

    expect(await screen.findByRole('button', { name: '09:00' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: '10:00' })).toBeNull();
    expect(screen.queryByRole('button', { name: '11:00' })).toBeNull();
  });

  it('marks each day as the site does — closed, on vacation, past, open — with its legend', async () => {
    state.webConfig.data.workingDays = ['09:00-12:00', ...Array<string | null>(5).fill('09:00-12:00'), null];
    state.webConfig.data.vacations = [{ startDate: at(6, 0), endDate: at(6, 23) }];
    renderModal();
    chooseService('Massage');

    await waitFor(() => expect(dayButton(5).getAttribute('aria-label')).toContain('customers.booking.day.full'));
    // Saturday the 9th is closed, the 6th is a vacation, the 3rd is past.
    expect(dayButton(9)).toBeDisabled();
    expect(dayButton(6)).toBeDisabled();
    expect(dayButton(6).getAttribute('aria-label')).toContain('customers.booking.day.vacation');
    expect(dayButton(3)).toBeDisabled();
    for (const status of ['full', 'limited', 'vacation', 'none']) {
      expect(within(screen.getByTestId('booking-calendar')).getByText(`customers.booking.day.${status}`)).toBeTruthy();
    }

    fireEvent.click(dayButton(5));
    await chooseTime('11:00');
    fireEvent.click(submitButton());
    await waitFor(() => expect(createAppointment).toHaveBeenCalledTimes(1));
    expect(sentBody()).toMatchObject({ type_id: 't1', timestamp: at(5, 11) });
  });

  it('turns the month and reads that month', async () => {
    renderModal();
    chooseService('Massage');
    await chooseDay(4);
    back();

    fireEvent.click(screen.getByRole('button', { name: 'customers.booking.nextMonth' }));

    await waitFor(() =>
      expect(getAvailability).toHaveBeenLastCalledWith(
        'studio',
        String(new Date(2030, 3, 1).valueOf()),
        String(new Date(2030, 4, 1).valueOf() - 1)
      )
    );
    expect(screen.getByRole('button', { name: 'customers.booking.prevMonth' })).not.toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'customers.booking.prevMonth' }));
    expect(screen.getByRole('button', { name: 'customers.booking.prevMonth' })).toBeDisabled();
  });

  it('moves to next month by itself when this one has no day left, and lets the owner turn back', async () => {
    vi.setSystemTime(new Date(2030, 2, 31, 20, 0));
    renderModal();
    chooseService('Massage');

    await waitFor(() =>
      expect(getAvailability).toHaveBeenLastCalledWith(
        'studio',
        String(new Date(2030, 3, 1).valueOf()),
        String(new Date(2030, 4, 1).valueOf() - 1)
      )
    );
    fireEvent.click(screen.getByRole('button', { name: 'customers.booking.prevMonth' }));
    await waitFor(() => expect(dayButton(31).getAttribute('aria-label')).toContain('customers.booking.day.none'));
    expect(within(screen.getByTestId('booking-days')).getByText('31')).toBeTruthy();
  });

  it('falls back to the opening hours when the day cannot be read — degrade, never block', async () => {
    vi.mocked(getAvailability).mockRejectedValue(new Error('offline'));
    renderModal();
    chooseService('Massage');
    await chooseDay(4);

    expect(await screen.findByRole('button', { name: '09:00' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '10:00' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '11:00' })).toBeTruthy();
  });
});

/**
 * LT-204: a walk-in, seated from a class roster. There is no customer yet,
 * so the owner types a name and a phone (sent as typed: the server
 * normalizes the phone), and the roster's session comes preset. LT-211: the
 * appointments page's "New appointment" opens it the same way, for any
 * service.
 */
describe('OwnerBookingModal: a walk-in', () => {
  const TOMORROW = at(5, 19, 123);

  beforeEach(() => {
    vi.mocked(createAppointment).mockReset().mockResolvedValue({} as never);
  });

  it('asks for a name and a phone, and books only once both are filled', async () => {
    renderModal({ customer: undefined });
    expect(screen.queryByText(/0501234567/)).toBeNull();

    await toDetails();
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

  it("opens on the roster's session and asks only who: no service, no calendar, no time (LT-211)", async () => {
    renderModal({ customer: undefined, preset: { typeId: 'c1', timestamp: TOMORROW } });

    expect(screen.getByText('appointments.session.addParticipant')).toBeTruthy();
    // The session the owner clicked, shown rather than picked again.
    const summary = screen.getByTestId('booking-summary');
    expect(within(summary).getByText('Yoga')).toBeTruthy();
    expect(within(summary).getByText('19:00 – 20:00')).toHaveAttribute('dir', 'ltr');
    expect(screen.queryByTestId('booking-services')).toBeNull();
    expect(screen.queryByTestId('booking-calendar')).toBeNull();
    expect(screen.queryByRole('button', { name: 'customers.booking.back' })).toBeNull();
    expect(getAvailability).not.toHaveBeenCalled();
    expect(submitButton()).toBeDisabled();

    fireEvent.change(screen.getByLabelText('customers.add.name'), { target: { value: 'Walk In' } });
    fireEvent.change(screen.getByLabelText('customers.add.phone'), { target: { value: '0529876543' } });
    expect(submitButton()).not.toBeDisabled();
    fireEvent.click(submitButton());

    await waitFor(() => expect(createAppointment).toHaveBeenCalledTimes(1));
    expect(sentBody()).toMatchObject({ name: 'Walk In', phone: '0529876543', type_id: 'c1', timestamp: TOMORROW });
  });

  it('leaves a preset session that filled meanwhile to the server to refuse, in its words', async () => {
    vi.mocked(toast.error).mockClear();
    vi.mocked(createAppointment).mockRejectedValue({ response: { status: 409, data: { code: 'CLASS_FULL', error: 'Full' } } });
    renderModal({ customer: undefined, preset: { typeId: 'c1', timestamp: TOMORROW } });

    fireEvent.change(screen.getByLabelText('customers.add.name'), { target: { value: 'Walk In' } });
    fireEvent.change(screen.getByLabelText('customers.add.phone'), { target: { value: '0529876543' } });
    fireEvent.click(submitButton());

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('customers.booking.classFull'));
    // Still on the one session: there is nothing to go back to.
    expect(screen.getByTestId('booking-summary')).toBeTruthy();
  });
});
