import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
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

const HERO = {
  visible: true,
  title: 'Renovations that last',
  subtitle: 'Kitchens and bathrooms',
  description: 'Twenty years in Haifa',
  heroImageSrc: 'hero.webp',
  bgType: 'gradient',
  bordersType: 'round',
  stamp: 'Since 2006',
};

const baseConfig = (): WebConfig =>
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
    // As the API returns them: the page sends an empty social link as null.
    social: { instagram: null, facebook: null, x: null, tiktok: null },
    pallete: {},
    components: {
      hero: { ...HERO },
      about: { visible: true, title: 'About', description: 'Us' },
      contact: { visible: false, title: 'Contact', description: 'Write to us' },
      introPopup: { visible: false, value: '' },
    },
  }) as unknown as WebConfig;

// The store: `data` is what the page reads as saved. The dispatch mock plays
// the server AND the reducer — it answers with the stored result and puts it
// in the store, as `updateWebConfig.fulfilled` would.
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

/** What the server stores for a save: a section it is sent replaces its copy, a leads site's contact shows. */
const serverAnswer = (saved: WebConfig, payload: Partial<WebConfig>): WebConfig => {
  const components = { ...saved.components, ...(payload.components ?? {}) } as WebConfig['components'];
  const next = { ...saved, ...payload, components } as WebConfig;
  if (next.conversion === 'lead') next.components = { ...components, contact: { ...components.contact, visible: true } };
  return next;
};

const sentPayload = (call = 0) => vi.mocked(updateWebConfig).mock.calls[call][0] as unknown as Partial<WebConfig>;

// A tab is chosen on press (Radix Tabs, LT-313), as a finger or mouse goes down.
const openSiteTab = () => fireEvent.mouseDown(screen.getByRole('tab', { name: /settings\.tabs\.site/ }));

beforeEach(() => {
  state.webConfig.data = baseConfig();
  vi.mocked(updateWebConfig).mockClear();
  dispatchMock.mockReset().mockImplementation((action: { type: string; payload?: Partial<WebConfig> }) => {
    if (action.type === 'webConfig/update') {
      const answer = serverAnswer(state.webConfig.data as WebConfig, action.payload ?? {});
      state.webConfig.data = answer;
      return Promise.resolve({ type: 'webConfig/update/fulfilled', payload: answer });
    }
    return Promise.resolve(action);
  });
});

/**
 * LT-395 — the site's currency in Settings → Site: shekels for a site made
 * before it, a draft like every setting, sent only when the owner changed it.
 */
const currencyCard = (code: string) => screen.getByTestId(`currency-${code}`);

describe('Settings: the currency', () => {
  it('reads shekels for an older site, and saves a new currency alone', async () => {
    render(<Settings />);
    openSiteTab();

    expect(currencyCard('ILS')).toHaveAttribute('aria-checked', 'true');
    expect(screen.queryByText('common.save')).toBeNull();

    fireEvent.click(currencyCard('USD'));
    expect(currencyCard('USD')).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(await screen.findByText('common.save'));
    await waitFor(() => expect(updateWebConfig).toHaveBeenCalledTimes(1));
    expect(sentPayload().currency).toBe('USD');
    await waitFor(() => expect(screen.queryByText('common.save')).toBeNull());
  });

  it('shows the stored currency, and leaves it out of a save that did not touch it', async () => {
    state.webConfig.data = { ...baseConfig(), currency: 'EUR' };
    render(<Settings />);
    openSiteTab();
    expect(currencyCard('EUR')).toHaveAttribute('aria-checked', 'true');

    fireEvent.click(currencyCard('ILS'));
    expect(await screen.findByText('common.save')).toBeInTheDocument();
    // Back to the stored one: nothing to save (the bar animates out).
    fireEvent.click(currencyCard('EUR'));
    await waitFor(() => expect(screen.queryByText('common.save')).toBeNull());

    fireEvent.click(screen.getByRole('radio', { name: /settings\.site\.modeLead/ }));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'settings.site.switchConfirm' }));
    fireEvent.click(await screen.findByText('common.save'));
    await waitFor(() => expect(updateWebConfig).toHaveBeenCalledTimes(1));
    expect(sentPayload()).not.toHaveProperty('currency');
  });
});
