import { describe, it, expect, vi, beforeEach } from 'vitest';
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

beforeEach(() => {
  state.webConfig.data = baseConfig({ logoImageName: 'https://cdn.example.com/logo.png' });
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

/**
 * LT-340: a logo given as a link stayed on the site after a save, but its box
 * emptied, so the owner read the logo as gone.
 */
describe('Settings: a logo given as a link', () => {
  it('stays in its box after a save', async () => {
    render(<Settings />);
    expect(screen.getByDisplayValue('https://cdn.example.com/logo.png')).toBeTruthy();

    fireEvent.change(screen.getByDisplayValue('Biz'), { target: { value: 'Biz and Co' } });
    fireEvent.click(await screen.findByText('common.save'));

    await waitFor(() => expect(updateWebConfig).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByDisplayValue('Biz and Co')).toBeTruthy());
    expect(screen.getByDisplayValue('https://cdn.example.com/logo.png')).toBeTruthy();
    expect((state.webConfig.data as WebConfig).logoImageName).toBe('https://cdn.example.com/logo.png');
  });
});
