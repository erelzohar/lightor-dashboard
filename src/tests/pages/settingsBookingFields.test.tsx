import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Settings from '../../pages/Settings';
import { updateWebConfig } from '../../store/slices/webConfigSlice';
import type { BookingField, WebConfig } from '../../types';

const { t } = vi.hoisted(() => ({ t: (key: string) => key }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t, i18n: { language: 'en' } }) }));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../../i18n/config', () => ({
  SUPPORTED_LANGUAGES: ['en', 'he'],
  default: { language: 'en', changeLanguage: vi.fn() },
}));
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ auth: { user: { _id: 'u1', webConfig_id: 'wc1' } } }),
}));
vi.mock('../../services/webConfigApi', () => ({ checkSubdomainAvailability: vi.fn() }));
vi.mock('../../services/imagesApi', () => ({ uploadImage: vi.fn() }));
// Both cards call the API on mount; neither is under test here.
vi.mock('../../components/settings/CalendarFeedCard', () => ({ default: (): null => null }));
vi.mock('../../components/settings/GoogleCalendarCard', () => ({ default: (): null => null }));
vi.mock('../../components/settings/WebConfigTabs', () => ({ default: (): null => null }));

// The store's saved config never changes under this test: what matters is
// what the page SENDS, and what it keeps of the server's reply.
const savedConfig = {
  _id: 'wc1',
  user_id: 'u1',
  businessName: 'Biz',
  logoImageName: '',
  vacations: [],
  appointmentTypes: [],
  subDomain: 'biz',
  minCancelTimeMS: 3_600_000,
  defaultLanguage: 'he',
  workingDays: [],
  contact: { phone: '0501234567', mail: 'a@b.co' },
  social: { instagram: '', facebook: '', x: '', tiktok: '' },
  pallete: {},
  components: { introPopup: { visible: false, value: '' } },
} as unknown as WebConfig;

const state = {
  webConfig: { data: savedConfig, loading: false, error: null as string | null },
  appointments: {
    appointmentTypes: [{ _id: 's1', name: 'Massage', webConfig_id: 'wc1', price: '100', durationMS: '3600000' }],
  },
};
vi.mock('../../hooks/useAppSelector', () => ({
  useAppSelector: (selector: (s: typeof state) => unknown): unknown => selector(state),
}));

// The thunk is mocked to a plain action; the dispatch mock plays the server
// and answers with the catalog keyed, exactly as the API would.
vi.mock('../../store/slices/webConfigSlice', () => ({
  fetchWebConfig: vi.fn(() => ({ type: 'webConfig/fetch' })),
  updateWebConfig: Object.assign(
    vi.fn((payload: unknown) => ({ type: 'webConfig/update', payload })),
    { rejected: { match: () => false } }
  ),
}));
vi.mock('../../store/slices/appointmentsSlice', () => ({
  fetchAppointmentTypes: vi.fn(() => ({ type: 'appointments/fetchTypes' })),
}));
const dispatchMock = vi.hoisted(() => vi.fn());
vi.mock('../../hooks/useAppDispatch', () => ({ useAppDispatch: () => dispatchMock }));

const keyed = (fields: BookingField[]) =>
  fields.map((f, i) => ({ ...f, key: f.key ?? `key-${i}` }));

const sentPayload = (call: number) =>
  (vi.mocked(updateWebConfig).mock.calls[call][0] as unknown) as Partial<WebConfig>;

/**
 * Settings and the booking questions (LT-178). Two of the plan's "fails
 * quietly" spots live here: a setting missing from `hasChanges` is editable
 * but never lights Save; one missing from the payload is saved as nothing.
 * And the keys are the server's — the page must keep the ones it is given.
 */
describe('Settings: booking questions', () => {
  beforeEach(() => {
    vi.mocked(updateWebConfig).mockClear();
    dispatchMock.mockReset().mockImplementation((action: { type: string; payload?: { bookingFields?: BookingField[] } }) => {
      if (action.type === 'webConfig/update') {
        const { payload } = action;
        return Promise.resolve({
          type: 'webConfig/update/fulfilled',
          payload: { ...savedConfig, ...payload, bookingFields: keyed(payload?.bookingFields ?? []) },
        });
      }
      return Promise.resolve(action);
    });
  });

  it('marks the form dirty when a question is added and sends the catalog, keyless', async () => {
    render(<Settings />);

    expect(screen.queryByText('common.save')).toBeNull();
    fireEvent.click(screen.getByText('settings.bookingFields.addQuestion'));
    fireEvent.change(screen.getByLabelText('settings.bookingFields.label'), { target: { value: ' Full address ' } });
    fireEvent.change(screen.getByLabelText('settings.bookingFields.type'), { target: { value: 'address' } });

    fireEvent.click(await screen.findByText('common.save'));

    await waitFor(() => expect(updateWebConfig).toHaveBeenCalledTimes(1));
    const payload = sentPayload(0);
    expect(payload.bookingFields).toEqual([
      { label: 'Full address', type: 'address', required: false, services: [] },
    ]);
    expect(payload.bookingFields![0]).not.toHaveProperty('key');
    // The rest of the config still travels as before.
    expect(payload).toMatchObject({ _id: 'wc1', businessName: 'Biz', subDomain: 'biz' });
  });

  it('adopts the keys the server assigned, so the next save sends them back', async () => {
    render(<Settings />);

    fireEvent.click(screen.getByText('settings.bookingFields.addQuestion'));
    fireEvent.change(screen.getByLabelText('settings.bookingFields.label'), { target: { value: 'Address' } });
    fireEvent.click(await screen.findByText('common.save'));
    await waitFor(() => expect(updateWebConfig).toHaveBeenCalledTimes(1));
    expect(sentPayload(0).bookingFields![0]).not.toHaveProperty('key');

    // Rename after the save: the field now carries the server's key.
    fireEvent.change(screen.getByLabelText('settings.bookingFields.label'), { target: { value: 'Home address' } });
    fireEvent.click(await screen.findByText('common.save'));
    await waitFor(() => expect(updateWebConfig).toHaveBeenCalledTimes(2));
    expect(sentPayload(1).bookingFields).toEqual([
      { key: 'key-0', label: 'Home address', type: 'text', required: false, services: [] },
    ]);
  });

  it('leaves the catalog out of the payload when it was not touched', async () => {
    render(<Settings />);

    fireEvent.change(screen.getByDisplayValue('Biz'), { target: { value: 'New name' } });
    fireEvent.click(await screen.findByText('common.save'));

    await waitFor(() => expect(updateWebConfig).toHaveBeenCalledTimes(1));
    expect(sentPayload(0)).not.toHaveProperty('bookingFields');
    expect(sentPayload(0).businessName).toBe('New name');
  });

  it('refuses to save a question with no label', async () => {
    const toast = (await import('react-hot-toast')).default;
    render(<Settings />);

    fireEvent.click(screen.getByText('settings.bookingFields.addQuestion'));
    fireEvent.click(await screen.findByText('common.save'));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('settings.formErrors'));
    expect(updateWebConfig).not.toHaveBeenCalled();
  });
});
