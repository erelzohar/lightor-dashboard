import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import toast from 'react-hot-toast';
import Settings from '../../pages/Settings';
import { fetchWebConfig } from '../../store/slices/webConfigSlice';
import { checkDomain, connectDomain, disconnectDomain, fetchDomain, type DomainAnswer, type DomainState } from '../../services/domainApi';
import type { WebConfig } from '../../types';

/**
 * LT-661 (phase 2): the Settings page with the owner's own domain - the row
 * in the Site tab, the page's own links (copy, open, the accessibility
 * statement) on the domain while the site is served on it, the tour's
 * anchors, and the site's config read again when an action changes the
 * address the site is served on.
 */
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
vi.mock('../../components/settings/CategoryFields', () => ({ default: () => <div data-testid="category-fields" /> }));
vi.mock('../../services/domainApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../services/domainApi')>()),
  fetchDomain: vi.fn(),
  connectDomain: vi.fn(),
  checkDomain: vi.fn(),
  disconnectDomain: vi.fn(),
}));

const HOST = 'www.dana-studio.co.il';
const baseConfig = (over: Partial<WebConfig> = {}): WebConfig =>
  ({
    _id: 'wc1',
    user_id: 'u1',
    businessName: 'Dana Studio',
    logoImageName: '',
    vacations: [],
    appointmentTypes: [],
    subDomain: 'dana',
    minCancelTimeMS: 3_600_000,
    defaultLanguage: 'he',
    workingDays: [],
    contact: { phone: '0501234567', mail: 'a@b.co' },
    social: { instagram: null, facebook: null, x: null, tiktok: null },
    pallete: {},
    components: {
      hero: { visible: true, title: 'Dana', subtitle: '', description: '' },
      about: { visible: true, title: 'About', description: 'Us' },
      contact: { visible: false, title: 'Contact', description: 'Write to us' },
      introPopup: { visible: false, value: '' },
    },
    ...over,
  }) as unknown as WebConfig;

const state = vi.hoisted(() => ({
  webConfig: { data: null as unknown, loading: false, error: null as string | null },
  appointments: { appointmentTypes: [] as unknown[] },
}));
vi.mock('../../hooks/useAppSelector', () => ({
  useAppSelector: (selector: (s: typeof state) => unknown): unknown => selector(state),
}));
vi.mock('../../store/slices/webConfigSlice', () => ({
  fetchWebConfig: vi.fn((id: string) => ({ type: 'webConfig/fetch', id })),
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

const answer = (domain: DomainState | null, over: Partial<DomainAnswer> = {}): DomainAnswer => ({
  configured: true,
  allowed: true,
  target: 'sites.lightor.app',
  domain,
  ...over,
});
const pending: DomainState = { host: HOST, status: 'pending', stage: 'dns', connectedAt: '2026-11-15T10:00:00.000Z', expiresAt: '2026-11-18T10:00:00.000Z' };
const active: DomainState = { host: HOST, status: 'active', stage: 'active', activeAt: '2026-11-15T10:20:00.000Z' };

const mount = () =>
  render(
    <MemoryRouter>
      <Settings />
    </MemoryRouter>
  );
// A tab is chosen on press (Radix Tabs, LT-313).
const siteTab = () => screen.getByRole('tab', { name: /settings\.tabs\.site/ });
const openSiteTab = () => fireEvent.mouseDown(siteTab());
const writeText = vi.fn();

beforeEach(() => {
  state.webConfig.data = baseConfig();
  for (const fn of [fetchDomain, connectDomain, checkDomain, disconnectDomain]) vi.mocked(fn).mockReset();
  vi.mocked(fetchDomain).mockResolvedValue(answer(null));
  vi.mocked(fetchWebConfig).mockClear();
  vi.mocked(toast.success).mockReset();
  dispatchMock.mockReset().mockImplementation((action: unknown) => Promise.resolve(action));
  writeText.mockReset().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
});
afterEach(() => {
  Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
});

describe('Settings: the own domain in the Site tab', () => {
  it('reads the domain once for the page, and shows its row where "coming soon" sat', async () => {
    mount();
    await waitFor(() => expect(fetchDomain).toHaveBeenCalledTimes(1));
    openSiteTab();
    const row = await screen.findByTestId('own-domain');
    expect(await within(row).findByTestId('domain-form')).toBeInTheDocument();
    expect(within(row).getByLabelText('settings.customDomain.form.label')).toBeInTheDocument();
    expect(screen.queryByTestId('coming-soon')).toBeNull();
    // Leaving the tab and coming back shows the same state with no second read.
    fireEvent.mouseDown(screen.getByRole('tab', { name: /settings\.tabs\.general/ }));
    openSiteTab();
    expect(await screen.findByTestId('domain-form')).toBeInTheDocument();
    expect(fetchDomain).toHaveBeenCalledTimes(1);
  });

  it('a server with no Cloudflare keeps the "coming soon" row, and the tour has nothing to point at', async () => {
    vi.mocked(fetchDomain).mockResolvedValue(answer(null, { configured: false, allowed: false }));
    mount();
    openSiteTab();
    expect(await screen.findByTestId('coming-soon')).toBeInTheDocument();
    expect(screen.getByTestId('own-domain')).not.toHaveAttribute('data-tour');
    expect(siteTab()).not.toHaveAttribute('data-tour');
  });

  it("where domains are offered, Lighty's tour can point at the Site tab and at the row, on any plan", async () => {
    vi.mocked(fetchDomain).mockResolvedValue(answer(null, { allowed: false }));
    mount();
    await waitFor(() => expect(siteTab()).toHaveAttribute('data-tour', 'settings-site-tab'));
    openSiteTab();
    expect(await screen.findByTestId('domain-locked')).toBeInTheDocument();
    expect(screen.getByTestId('own-domain')).toHaveAttribute('data-tour', 'settings-domain');
  });

  it('shows the domain with the site\'s own Lightor address in its words', async () => {
    vi.mocked(fetchDomain).mockResolvedValue(answer(pending));
    mount();
    openSiteTab();
    expect(await screen.findByTestId('domain-host')).toHaveTextContent(HOST);
    expect(screen.getByTestId('domain-value-target')).toHaveTextContent('sites.lightor.app');
  });

  it('reads the site again when an action changes the address it is served on - and only then', async () => {
    vi.mocked(fetchDomain).mockResolvedValue(answer(pending));
    mount();
    openSiteTab();
    await screen.findByTestId('domain-host');
    // The first read changes nothing by itself.
    expect(fetchWebConfig).not.toHaveBeenCalled();

    // Still waiting: the address is the same.
    vi.mocked(checkDomain).mockResolvedValueOnce(answer({ ...pending, stage: 'certificate' }));
    fireEvent.click(screen.getByRole('button', { name: 'settings.customDomain.check' }));
    await waitFor(() => expect(screen.getByTestId('domain-status')).toHaveTextContent('settings.customDomain.status.certificate'));
    expect(fetchWebConfig).not.toHaveBeenCalled();

    // Live: every link in the dashboard follows the site's config.
    vi.mocked(checkDomain).mockResolvedValueOnce(answer(active));
    await waitFor(() => expect(screen.getByRole('button', { name: 'settings.customDomain.check' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'settings.customDomain.check' }));
    await waitFor(() => expect(fetchWebConfig).toHaveBeenCalledTimes(1));
    expect(fetchWebConfig).toHaveBeenCalledWith('wc1');
    expect(dispatchMock).toHaveBeenCalledWith({ type: 'webConfig/fetch', id: 'wc1' });

    // Disconnected: back to the Lightor address.
    vi.mocked(disconnectDomain).mockResolvedValue(answer(null));
    fireEvent.click(screen.getByRole('button', { name: 'settings.customDomain.disconnect' }));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'settings.customDomain.disconnect' }));
    await waitFor(() => expect(fetchWebConfig).toHaveBeenCalledTimes(2));
  });

  it('a domain action is no unsaved change, and leaves a draft on the page alone', async () => {
    mount();
    openSiteTab();
    fireEvent.change(await screen.findByLabelText('settings.site.ctaLabel'), { target: { value: 'Get a quote' } });
    vi.mocked(connectDomain).mockResolvedValue(answer(active));
    fireEvent.change(screen.getByLabelText('settings.customDomain.form.label'), { target: { value: 'dana-studio.co.il' } });
    fireEvent.click(screen.getByRole('button', { name: 'settings.customDomain.form.connect' }));
    await screen.findByTestId('domain-host');
    await waitFor(() => expect(fetchWebConfig).toHaveBeenCalledWith('wc1'));
    expect(screen.getByLabelText('settings.site.ctaLabel')).toHaveValue('Get a quote');
  });
});

describe("Settings: the page's own links follow the domain", () => {
  it('with no domain: the Lightor address, as ever', async () => {
    mount();
    expect(await screen.findByTestId('settings-open-site')).toHaveAttribute('href', 'https://dana.lightor.app');
    expect(screen.getByTestId('settings-open-site-phone')).toHaveAttribute('href', 'https://dana.lightor.app');
    expect(screen.queryByTestId('settings-on-domain')).toBeNull();
    fireEvent.click(screen.getByTitle('settings.copyLink'));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('https://dana.lightor.app'));
    openSiteTab();
    expect(screen.getByText('settings.site.a11yStatementLink').closest('a')).toHaveAttribute('href', 'https://dana.lightor.app/#accessibility');
  });

  it('served on the domain: copy, open and the accessibility statement all go there, and the link row says so', async () => {
    state.webConfig.data = baseConfig({ customHost: HOST });
    mount();
    expect(await screen.findByTestId('settings-open-site')).toHaveAttribute('href', `https://${HOST}`);
    expect(screen.getByTestId('settings-open-site-phone')).toHaveAttribute('href', `https://${HOST}`);
    const note = screen.getByTestId('settings-on-domain');
    expect(note).toHaveTextContent('settings.customDomain.onDomain');
    const link = within(note).getByRole('link', { name: HOST });
    expect(link).toHaveAttribute('href', `https://${HOST}`);
    expect(link).toHaveAttribute('dir', 'ltr');
    // The field still edits the Lightor name: it stays the site's own, and leads to the domain.
    expect(screen.getByRole('textbox', { name: 'settings.yourLink' })).toHaveValue('dana');

    fireEvent.click(screen.getByTitle('settings.copyLink'));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(`https://${HOST}`));
    expect(toast.success).toHaveBeenCalledWith('settings.linkCopied');
    openSiteTab();
    expect(screen.getByText('settings.site.a11yStatementLink').closest('a')).toHaveAttribute('href', `https://${HOST}/#accessibility`);
  });

  it('a "domain" that is no plain host name is not used anywhere (LT-315)', async () => {
    state.webConfig.data = baseConfig({ customHost: 'evil.example/x?' });
    mount();
    expect(await screen.findByTestId('settings-open-site')).toHaveAttribute('href', 'https://dana.lightor.app');
    expect(screen.queryByTestId('settings-on-domain')).toBeNull();
    fireEvent.click(screen.getByTitle('settings.copyLink'));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('https://dana.lightor.app'));
  });
});
