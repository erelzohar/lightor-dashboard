import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { Provider } from 'react-redux';
import { combineReducers, configureStore } from '@reduxjs/toolkit';
import AppointmentTypes from '../../pages/AppointmentTypes';
import appointmentsReducer from '../../store/slices/appointmentsSlice';
import webConfigReducer from '../../store/slices/webConfigSlice';
import {
  getAppointmentTypes,
  createAppointmentType,
  updateAppointmentType,
} from '../../services/appointmentsApi';
import type { AppointmentType, WebConfig } from '../../types';

const { t } = vi.hoisted(() => ({ t: (key: string) => key }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t, i18n: { language: 'en' } }) }));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));
vi.mock('browser-image-compression', () => ({ default: vi.fn() }));
vi.mock('../../services/imagesApi', () => ({ uploadImage: vi.fn() }));
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ auth: { user: { _id: 'u1', webConfig_id: 'wc1' } } }),
}));
vi.mock('../../services/appointmentsApi', () => ({
  getAppointmentTypes: vi.fn(),
  createAppointmentType: vi.fn(),
  updateAppointmentType: vi.fn(),
  deleteAppointmentType: vi.fn(),
  getAppointments: vi.fn(),
  updateAppointmentStatus: vi.fn(),
}));

/**
 * The real store, so the page sees what the reducer really does: every
 * answer from the API — an empty one too — is stored as a new array.
 */
const renderPage = (conversion?: 'book' | 'lead') => {
  const store = configureStore({
    reducer: combineReducers({ appointments: appointmentsReducer, webConfig: webConfigReducer }),
    preloadedState: {
      webConfig: { data: { _id: 'wc1', conversion } as WebConfig, loading: false, error: null },
    },
  });
  render(
    <Provider store={store}>
      <AppointmentTypes />
    </Provider>
  );
  return store;
};

const service = (over: Partial<AppointmentType> = {}): AppointmentType => ({
  _id: 's1',
  name: 'Kitchen renovation',
  webConfig_id: 'wc1',
  price: '',
  ...over,
});

const input = (name: string) => document.querySelector<HTMLInputElement>(`input[name="${name}"]`);

/**
 * The API as a loop would meet it: it answers the first few calls, then goes
 * quiet, so a refetch loop stops and the call count tells, instead of the
 * loop hanging the run.
 */
const answerTypes = (types: () => AppointmentType[]) =>
  vi.mocked(getAppointmentTypes).mockImplementation(() =>
    vi.mocked(getAppointmentTypes).mock.calls.length > 3 ? new Promise(() => {}) : Promise.resolve(types())
  );

beforeEach(() => {
  window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
  vi.mocked(getAppointmentTypes).mockReset();
  answerTypes(() => []);
  vi.mocked(createAppointmentType).mockReset().mockImplementation(async (data) => ({ _id: 'n1', ...data }) as AppointmentType);
  vi.mocked(updateAppointmentType).mockReset().mockImplementation(async (id, data) => ({ ...service(), _id: id, ...data }) as AppointmentType);
});

/**
 * G4 (LT-199): the fetch effect depended on the list, and each empty answer
 * stored a new [] — a business with no services refetched forever.
 */
describe('Services page — fetching', () => {
  it('fetches once when the business has no services', async () => {
    renderPage();

    expect(await screen.findByText('appointmentTypes.noServices')).toBeInTheDocument();
    // Give a loop every chance to show itself.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    expect(getAppointmentTypes).toHaveBeenCalledTimes(1);
    expect(getAppointmentTypes).toHaveBeenCalledWith('wc1');
  });

  it('fetches once when it has services', async () => {
    answerTypes(() => [service({ price: '100', durationMS: '3600000' })]);
    renderPage();

    expect(await screen.findByText('Kitchen renovation')).toBeInTheDocument();
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    expect(getAppointmentTypes).toHaveBeenCalledTimes(1);
  });
});

/**
 * A leads site's services are content (LT-199): a name, a picture and an
 * optional price. No duration and no class — and none of it on the wire.
 */
describe('Services page — by site mode', () => {
  it('creates a leads site’s service with no duration and no class fields', async () => {
    renderPage('lead');
    await screen.findByText('appointmentTypes.noServices');

    fireEvent.click(screen.getByText('appointmentTypes.newService'));
    expect(input('durationMinutes')).toBeNull();
    expect(screen.queryByText('appointmentTypes.class.toggle')).not.toBeInTheDocument();
    // The price is optional, labelled so, and carries no hard-coded dollar.
    expect(input('price')).not.toBeRequired();
    expect(screen.getByText('appointmentTypes.priceOptional')).toBeInTheDocument();
    expect(screen.queryByText('$')).not.toBeInTheDocument();
    expect(screen.getByText('appointments.currencySymbol')).toBeInTheDocument();

    fireEvent.change(input('name')!, { target: { value: 'Kitchen renovation' } });
    fireEvent.click(screen.getByText('appointmentTypes.addNew'));

    await waitFor(() => expect(createAppointmentType).toHaveBeenCalledTimes(1));
    expect(vi.mocked(createAppointmentType).mock.calls[0][0]).toEqual({
      name: 'Kitchen renovation',
      price: '',
      image: '',
      webConfig_id: 'wc1',
    });
  });

  it('edits a leads site’s service without touching its stored duration or class', async () => {
    answerTypes(() => [service({ price: '900', durationMS: '3600000', kind: 'class', capacity: 8, sessions: [] })]);
    renderPage('lead');

    fireEvent.click(await screen.findByText('Kitchen renovation'));
    fireEvent.change(input('name')!, { target: { value: 'Kitchen & bath' } });
    fireEvent.click(screen.getByText('common.save'));

    await waitFor(() => expect(updateAppointmentType).toHaveBeenCalledTimes(1));
    expect(vi.mocked(updateAppointmentType).mock.calls[0]).toEqual(['s1', { name: 'Kitchen & bath', price: '900', image: '' }]);
  });

  it('lists a leads site’s services with their price only when they have one, and no duration', async () => {
    answerTypes(() => [
      service({ _id: 's1', name: 'Kitchen renovation', price: '' }),
      service({ _id: 's2', name: 'Bathroom', price: '5000', durationMS: '3600000' }),
    ]);
    renderPage('lead');

    await screen.findByText('Bathroom');
    // One price line, for the service that has a price: symbol then amount.
    expect(screen.getAllByText(/appointments\.currencySymbol/).map((el) => el.textContent)).toEqual([
      'appointments.currencySymbol5000',
    ]);
    expect(screen.queryByText('appointmentTypes.noDuration')).not.toBeInTheDocument();
    expect(screen.queryByText(/minutes|דקות/)).not.toBeInTheDocument();
  });

  it('keeps the booking form on a booking site: a required price and a duration on the wire', async () => {
    renderPage('book');
    await screen.findByText('appointmentTypes.noServices');

    fireEvent.click(screen.getByText('appointmentTypes.newService'));
    expect(input('durationMinutes')).not.toBeNull();
    expect(input('price')).toBeRequired();
    expect(screen.getByText('appointmentTypes.class.toggle')).toBeInTheDocument();

    fireEvent.change(input('name')!, { target: { value: 'Massage' } });
    fireEvent.change(input('price')!, { target: { value: '100' } });
    fireEvent.click(screen.getByText('appointmentTypes.addNew'));

    await waitFor(() => expect(createAppointmentType).toHaveBeenCalledTimes(1));
    expect(vi.mocked(createAppointmentType).mock.calls[0][0]).toEqual({
      name: 'Massage',
      price: '100',
      durationMS: '1800000',
      image: '',
      webConfig_id: 'wc1',
    });
  });

  it('marks a service saved without a duration as not bookable yet on a booking site', async () => {
    answerTypes(() => [service({ price: '100' })]);
    renderPage('book');

    expect(await screen.findByText('appointmentTypes.noDuration')).toBeInTheDocument();

    // Its duration field starts empty (not NaN) and must be filled.
    fireEvent.click(screen.getByText('Kitchen renovation'));
    expect(input('durationMinutes')).toHaveValue(null);
    expect(input('durationMinutes')).toBeRequired();
  });
});

// LT-233: the form header's second line was hard-coded English, so the Hebrew
// app read "Click to add a new service" (caught on the App Store screenshots).
describe('Services page — form header', () => {
  it('says every state through i18n', async () => {
    answerTypes(() => [service({ price: '100' })]);
    renderPage('book');

    expect(await screen.findByText('appointmentTypes.tapToAdd')).toBeInTheDocument();
    expect(screen.queryByText(/Click to add|Fill in the details|Editing "/)).toBeNull();
  });
});
