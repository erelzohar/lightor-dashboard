import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Settings from '../../pages/Settings';
import { updateWebConfig } from '../../store/slices/webConfigSlice';
import type { WebConfig } from '../../types';

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
vi.mock('../../components/settings/CalendarFeedCard', () => ({ default: () => <div data-testid="calendar-feed-card" /> }));
vi.mock('../../components/settings/GoogleCalendarCard', () => ({ default: () => <div data-testid="google-calendar-card" /> }));

const baseConfig = (over: Partial<WebConfig> = {}): WebConfig =>
  ({
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
    social: { instagram: null, facebook: null, x: null, tiktok: null },
    pallete: {},
    components: { introPopup: { visible: false, value: '' } },
    ...over,
  }) as unknown as WebConfig;

// The store: `data` is what the page reads as saved; the dispatch mock plays
// the server and the reducer, storing what it is sent.
const state = vi.hoisted(() => ({
  webConfig: { data: null as unknown, loading: false, error: null as string | null },
  appointments: { appointmentTypes: [] as unknown[] },
}));
vi.mock('../../hooks/useAppSelector', () => ({
  useAppSelector: (selector: (s: typeof state) => unknown): unknown => selector(state),
}));
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

const sentPayload = () => vi.mocked(updateWebConfig).mock.calls[0][0] as unknown as Partial<WebConfig>;

beforeEach(() => {
  // Midsummer: Jerusalem is GMT+3, New York GMT-4. Only Date is faked.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(Date.UTC(2030, 6, 1, 9, 0)));
  state.webConfig.data = baseConfig();
  vi.mocked(updateWebConfig).mockClear();
  dispatchMock.mockReset().mockImplementation((action: { type: string; payload?: Partial<WebConfig> }) => {
    if (action.type === 'webConfig/update') {
      const answer = { ...(state.webConfig.data as WebConfig), ...(action.payload ?? {}) } as WebConfig;
      state.webConfig.data = answer;
      return Promise.resolve({ type: 'webConfig/update/fulfilled', payload: answer });
    }
    return Promise.resolve(action);
  });
});
afterEach(() => {
  vi.useRealTimers();
});

/**
 * LT-334 (Erel: "the owner should not deal with it"): the business's time
 * zone (LT-318) is set once, when the site is made — the signing-up device's
 * zone, else the server's default — and the settings page neither shows it
 * nor sends it, so a save leaves whatever is stored.
 */
describe('Settings: the time zone stays out of sight', () => {
  it('is on no tab', () => {
    render(<Settings />);
    for (const tab of screen.getAllByRole('tab')) {
      fireEvent.mouseDown(tab);
      expect(screen.queryByLabelText('settings.timeZone')).toBeNull();
    }
  });

  it('is never sent, so a save keeps the stored zone', async () => {
    state.webConfig.data = baseConfig({ timeZone: 'Asia/Dubai' });
    render(<Settings />);

    fireEvent.change(screen.getByDisplayValue('Biz'), { target: { value: 'Biz and Co' } });
    fireEvent.click(await screen.findByText('common.save'));

    await waitFor(() => expect(updateWebConfig).toHaveBeenCalledTimes(1));
    expect(sentPayload()).toMatchObject({ businessName: 'Biz and Co' });
    expect(sentPayload()).not.toHaveProperty('timeZone');
    expect((state.webConfig.data as WebConfig).timeZone).toBe('Asia/Dubai');
  });
});
