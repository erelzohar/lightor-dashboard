import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
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
    dispatchMock.mockReset().mockImplementation((action: { type: string; payload?: { bookingFields?: BookingField[]; leadFields?: BookingField[] } }) => {
      if (action.type === 'webConfig/update') {
        const { payload } = action;
        return Promise.resolve({
          type: 'webConfig/update/fulfilled',
          payload: {
            ...savedConfig,
            ...payload,
            bookingFields: keyed(payload?.bookingFields ?? []),
            leadFields: keyed((payload as { leadFields?: BookingField[] })?.leadFields ?? []),
          },
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
    // A new address question starts remembered (the editor shows it on), and
    // what the editor shows is what goes out.
    expect(payload.bookingFields).toEqual([
      { label: 'Full address', type: 'address', required: false, services: [], remember: true },
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

  it('sends a switch the owner turned on, so it stays on after the save (LT-217)', async () => {
    // Erel 2026-10-04: on a stored question, "show in the new-booking message"
    // went back to off after every save — the payload never carried it.
    const stored: BookingField = {
      key: 'q', label: 'Address', type: 'address', required: true, services: [], important: false, remember: false,
    };
    state.webConfig.data = { ...savedConfig, bookingFields: [stored] } as WebConfig;
    try {
      render(<Settings />);
      const important = () => screen.getByTestId('field-important-0') as HTMLInputElement;
      expect(important().checked).toBe(false);
      fireEvent.click(important());

      fireEvent.click(await screen.findByText('common.save'));
      await waitFor(() => expect(updateWebConfig).toHaveBeenCalledTimes(1));
      expect(sentPayload(0).bookingFields).toEqual([{ ...stored, important: true }]);
      // The reply is what the editor shows next: still on.
      await waitFor(() => expect(important().checked).toBe(true));
    } finally {
      state.webConfig.data = savedConfig;
    }
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

/**
 * The contact form's questions (LT-197): a second editor on the same
 * mechanism, sent as `leadFields` with no service scope, keys adopted like
 * the booking list's.
 */
describe('Settings: contact form questions', () => {
  beforeEach(() => {
    vi.mocked(updateWebConfig).mockClear();
    dispatchMock.mockReset().mockImplementation((action: { type: string; payload?: { leadFields?: BookingField[] } }) => {
      if (action.type === 'webConfig/update') {
        const { payload } = action;
        return Promise.resolve({
          type: 'webConfig/update/fulfilled',
          payload: { ...savedConfig, ...payload, leadFields: keyed(payload?.leadFields ?? []) },
        });
      }
      return Promise.resolve(action);
    });
  });

  const leadEditor = () => {
    const title = screen.getByText('settings.leadFields.title');
    return within(title.closest('div.rounded-2xl') as HTMLElement);
  };

  it('adds a question with no per-service scope, sends it as leadFields, and adopts the key', async () => {
    render(<Settings />);

    fireEvent.click(screen.getByText('settings.leadFields.addQuestion'));
    const editor = leadEditor();
    // A lead has no service: no applies-to chips.
    expect(editor.queryByText('settings.bookingFields.appliesTo')).toBeNull();
    fireEvent.change(editor.getByLabelText('settings.bookingFields.label'), { target: { value: 'Project type' } });

    fireEvent.click(await screen.findByText('common.save'));
    await waitFor(() => expect(updateWebConfig).toHaveBeenCalledTimes(1));
    expect(sentPayload(0).leadFields).toEqual([{ label: 'Project type', type: 'text', required: false, services: [] }]);
    expect(sentPayload(0)).not.toHaveProperty('bookingFields');

    fireEvent.change(leadEditor().getByLabelText('settings.bookingFields.label'), { target: { value: 'Kind of project' } });
    fireEvent.click(await screen.findByText('common.save'));
    await waitFor(() => expect(updateWebConfig).toHaveBeenCalledTimes(2));
    expect(sentPayload(1).leadFields).toEqual([
      { key: 'key-0', label: 'Kind of project', type: 'text', required: false, services: [] },
    ]);
  });
});
