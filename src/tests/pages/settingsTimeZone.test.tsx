import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import Settings from '../../pages/Settings';
import { updateWebConfig } from '../../store/slices/webConfigSlice';
import { timeZoneCity, timeZoneOptions } from '../../utils/timeZoneOptions';
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
const picker = () => screen.getByLabelText('settings.timeZone') as HTMLSelectElement;

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
 * Settings → Business (LT-318): the business's time zone. Every booking
 * time, reminder and message is read on it, so it sits with who the business
 * is — not on the Bookings tab, which a leads site hides.
 */
describe('Settings: the time zone', () => {
  it("is on the Business tab, reads the server's default for a config without one, and is not a change", () => {
    render(<Settings />);

    expect(picker().value).toBe('Asia/Jerusalem');
    expect(within(picker()).getByRole('option', { name: 'Jerusalem (GMT+3)' })).toBeTruthy();
    expect(within(picker()).getByRole('option', { name: 'New York (GMT-4)' })).toBeTruthy();
    expect(screen.getByText('settings.timeZoneHelp')).toBeInTheDocument();
    // An untouched form has nothing to save.
    expect(screen.queryByText('common.save')).toBeNull();
  });

  it('shows the saved zone, and the default in place of one this browser does not know', () => {
    state.webConfig.data = baseConfig({ timeZone: 'Asia/Dubai' });
    const { unmount } = render(<Settings />);
    expect(picker().value).toBe('Asia/Dubai');
    unmount();

    state.webConfig.data = baseConfig({ timeZone: 'Mars/Olympus_Mons' });
    render(<Settings />);
    expect(picker().value).toBe('Asia/Jerusalem');
    expect(screen.queryByText('common.save')).toBeNull();
  });

  it('saves the zone chosen, and reads as saved once the server has it', async () => {
    render(<Settings />);

    fireEvent.change(picker(), { target: { value: 'America/New_York' } });
    fireEvent.click(await screen.findByText('common.save'));

    await waitFor(() => expect(updateWebConfig).toHaveBeenCalledTimes(1));
    expect(sentPayload().timeZone).toBe('America/New_York');
    await waitFor(() => expect(screen.queryByText('common.save')).toBeNull());
    expect(picker().value).toBe('America/New_York');
  });

  it('sends a zone the server knows with any other change, never an unknown one', async () => {
    state.webConfig.data = baseConfig({ timeZone: 'Mars/Olympus_Mons' });
    render(<Settings />);

    fireEvent.change(screen.getByDisplayValue('Biz'), { target: { value: 'Biz and Co' } });
    fireEvent.click(await screen.findByText('common.save'));

    await waitFor(() => expect(updateWebConfig).toHaveBeenCalledTimes(1));
    expect(sentPayload()).toMatchObject({ businessName: 'Biz and Co', timeZone: 'Asia/Jerusalem' });
  });
});

describe('the time zone options', () => {
  it('names each zone by its city and its offset, west to east, with the current one always there', () => {
    const now = Date.UTC(2030, 6, 1);
    const options = timeZoneOptions('Asia/Dubai', now);
    const values = options.map((o) => o.value);
    expect(values).toContain('Asia/Jerusalem');
    expect(values).toContain('Asia/Dubai');
    expect(new Set(values).size).toBe(values.length);
    // July is winter in Adelaide: half an hour off the hour.
    expect(options.find((o) => o.value === 'Australia/Adelaide')?.label).toBe('Adelaide (GMT+9:30)');
    expect(values.indexOf('America/Los_Angeles')).toBeLessThan(values.indexOf('America/New_York'));
    expect(values.indexOf('America/New_York')).toBeLessThan(values.indexOf('Europe/London'));
    expect(values.indexOf('Europe/London')).toBeLessThan(values.indexOf('Asia/Jerusalem'));
    expect(timeZoneCity('America/Argentina/Buenos_Aires')).toBe('Buenos Aires');
  });
});
