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

const openSiteTab = () => fireEvent.click(screen.getByText('settings.tabs.site'));
const modeCard = (key: 'settings.site.modeBook' | 'settings.site.modeLead') =>
  screen.getByRole('radio', { name: new RegExp(key.replace(/\./g, '\\.')) });

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
 * Settings → Site (LT-199): what the site does and its main button's text.
 * Both are drafts like every other setting — the save bar commits them — and
 * the server's answer is adopted, so a saved form reads as saved.
 */
describe('Settings: the Site tab', () => {
  it('asks before switching to inquiries, says nothing is deleted, and saves the mode alone', async () => {
    render(<Settings />);
    openSiteTab();

    expect(modeCard('settings.site.modeBook')).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(modeCard('settings.site.modeLead'));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('settings.site.switchToLeadTitle')).toBeInTheDocument();
    expect(within(dialog).getByText('settings.site.nothingDeleted')).toBeInTheDocument();
    // Nothing changes until the owner confirms.
    expect(modeCard('settings.site.modeBook')).toHaveAttribute('aria-checked', 'true');
    expect(screen.queryByText('common.save')).toBeNull();

    fireEvent.click(within(dialog).getByRole('button', { name: 'settings.site.switchConfirm' }));
    expect(modeCard('settings.site.modeLead')).toHaveAttribute('aria-checked', 'true');
    // The placeholder is the new mode's default text.
    expect(screen.getByLabelText('settings.site.ctaLabel')).toHaveAttribute('placeholder', 'settings.site.ctaDefaultLead');

    fireEvent.click(await screen.findByText('common.save'));
    await waitFor(() => expect(updateWebConfig).toHaveBeenCalledTimes(1));
    expect(sentPayload().conversion).toBe('lead');
    // Nothing in `components` changed, so none of it travels.
    expect(sentPayload()).not.toHaveProperty('components');

    // The server's answer is adopted: the form is saved, not dirty.
    await waitFor(() => expect(screen.queryByText('common.save')).toBeNull());
    expect(modeCard('settings.site.modeLead')).toHaveAttribute('aria-checked', 'true');
  });

  it('leaves everything as it was when the switch is cancelled', async () => {
    render(<Settings />);
    openSiteTab();

    fireEvent.click(modeCard('settings.site.modeLead'));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'common.cancel' }));

    expect(modeCard('settings.site.modeBook')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByLabelText('settings.site.ctaLabel')).toHaveAttribute('placeholder', 'settings.site.ctaDefaultBook');
    expect(screen.queryByText('common.save')).toBeNull();
  });

  it('asks before switching a leads site back to bookings', async () => {
    state.webConfig.data = { ...baseConfig(), conversion: 'lead' };
    render(<Settings />);
    openSiteTab();

    expect(modeCard('settings.site.modeLead')).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(modeCard('settings.site.modeBook'));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('settings.site.switchToBookTitle')).toBeInTheDocument();
    expect(within(dialog).getByText('settings.site.nothingDeleted')).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'settings.site.switchConfirm' }));

    fireEvent.click(await screen.findByText('common.save'));
    await waitFor(() => expect(updateWebConfig).toHaveBeenCalledTimes(1));
    expect(sentPayload().conversion).toBe('book');
  });

  it('sends a new button text with the whole stored hero, trimmed, and adopts what was stored', async () => {
    render(<Settings />);
    openSiteTab();

    const input = screen.getByLabelText('settings.site.ctaLabel');
    expect(input).toHaveAttribute('maxLength', '24');
    expect(input).toHaveAttribute('placeholder', 'settings.site.ctaDefaultBook');
    fireEvent.change(input, { target: { value: '  Get a quote ' } });

    fireEvent.click(await screen.findByText('common.save'));
    await waitFor(() => expect(updateWebConfig).toHaveBeenCalledTimes(1));
    const payload = sentPayload();
    // LT-183: a section replaces its stored copy wholesale — never `{ cta }` alone.
    expect(payload.components?.hero).toEqual({ ...HERO, cta: 'Get a quote' });
    expect(payload.components?.introPopup).toEqual({ visible: false, value: '' });
    expect(payload.components).toHaveProperty('about');
    expect(payload).not.toHaveProperty('conversion');

    // The stored, trimmed text replaces the draft's, and nothing is left unsaved.
    await waitFor(() => expect(screen.getByLabelText('settings.site.ctaLabel')).toHaveValue('Get a quote'));
    // (The bar animates out.)
    await waitFor(() => expect(screen.queryByText('common.save')).toBeNull());
  });

  it('clears the button text back to the default', async () => {
    state.webConfig.data = baseConfig();
    (state.webConfig.data as WebConfig).components.hero.cta = 'Book a lesson';
    render(<Settings />);
    openSiteTab();

    fireEvent.change(screen.getByLabelText('settings.site.ctaLabel'), { target: { value: '' } });
    fireEvent.click(await screen.findByText('common.save'));
    await waitFor(() => expect(updateWebConfig).toHaveBeenCalledTimes(1));
    expect(sentPayload().components?.hero).toEqual({ ...HERO, cta: '' });
  });

  it('does not count whitespace around an unchanged text as a change', () => {
    (state.webConfig.data as WebConfig).components.hero.cta = 'Book a lesson';
    render(<Settings />);
    openSiteTab();

    fireEvent.change(screen.getByLabelText('settings.site.ctaLabel'), { target: { value: 'Book a lesson  ' } });
    expect(screen.queryByText('common.save')).toBeNull();
  });

  it('sends the intro popup and the button text together in one components payload', async () => {
    render(<Settings />);

    fireEvent.change(screen.getByPlaceholderText('settings.popupPlaceholder'), { target: { value: 'Closed for the holidays' } });
    openSiteTab();
    fireEvent.change(screen.getByLabelText('settings.site.ctaLabel'), { target: { value: 'Get a quote' } });

    fireEvent.click(await screen.findByText('common.save'));
    await waitFor(() => expect(updateWebConfig).toHaveBeenCalledTimes(1));
    const { components } = sentPayload();
    expect(components?.introPopup).toEqual({ visible: false, value: 'Closed for the holidays' });
    expect(components?.hero).toEqual({ ...HERO, cta: 'Get a quote' });
  });

  it('still sends a changed intro popup alone, as before', async () => {
    render(<Settings />);

    fireEvent.change(screen.getByPlaceholderText('settings.popupPlaceholder'), { target: { value: 'Back on Sunday' } });
    fireEvent.click(await screen.findByText('common.save'));
    await waitFor(() => expect(updateWebConfig).toHaveBeenCalledTimes(1));
    const { components } = sentPayload();
    expect(components?.introPopup).toEqual({ visible: false, value: 'Back on Sunday' });
    // The hero goes back exactly as stored.
    expect(components?.hero).toEqual(HERO);
  });
});

/**
 * Settings → Site (LT-208): the owner keeps the site out of search engines.
 * A draft like every other setting: flipping it marks the form unsaved, the
 * save sends it only when it changed, and the server's answer is adopted.
 */
describe('Settings: hiding the site from search engines', () => {
  const searchSwitch = () => screen.getByRole('switch', { name: 'settings.site.hideFromSearch' });

  it('marks the form unsaved and sends hideFromSearch on save', async () => {
    render(<Settings />);
    openSiteTab();

    expect(searchSwitch()).not.toBeChecked();
    expect(searchSwitch()).toHaveAccessibleDescription('settings.site.hideFromSearchHelp');
    expect(screen.queryByText('common.save')).toBeNull();

    fireEvent.click(searchSwitch());
    expect(searchSwitch()).toBeChecked();

    fireEvent.click(await screen.findByText('common.save'));
    await waitFor(() => expect(updateWebConfig).toHaveBeenCalledTimes(1));
    expect(sentPayload().hideFromSearch).toBe(true);
    // Nothing else on the tab changed, so nothing else of it travels.
    expect(sentPayload()).not.toHaveProperty('conversion');
    expect(sentPayload()).not.toHaveProperty('components');

    // Stored and adopted: the switch stays on and nothing is left unsaved.
    await waitFor(() => expect(screen.queryByText('common.save')).toBeNull());
    expect(searchSwitch()).toBeChecked();
  });

  it('shows a hidden site as hidden, and sends false to bring it back', async () => {
    state.webConfig.data = { ...baseConfig(), hideFromSearch: true };
    render(<Settings />);
    openSiteTab();

    expect(searchSwitch()).toBeChecked();
    fireEvent.click(searchSwitch());

    fireEvent.click(await screen.findByText('common.save'));
    await waitFor(() => expect(updateWebConfig).toHaveBeenCalledTimes(1));
    expect(sentPayload().hideFromSearch).toBe(false);
  });

  it('is not sent when untouched, and flipped back it is no change', async () => {
    render(<Settings />);
    openSiteTab();

    fireEvent.click(searchSwitch());
    fireEvent.click(searchSwitch());
    // (The bar animates out.)
    await waitFor(() => expect(screen.queryByText('common.save')).toBeNull());

    fireEvent.change(screen.getByLabelText('settings.site.ctaLabel'), { target: { value: 'Get a quote' } });
    fireEvent.click(await screen.findByText('common.save'));
    await waitFor(() => expect(updateWebConfig).toHaveBeenCalledTimes(1));
    expect(sentPayload()).not.toHaveProperty('hideFromSearch');
  });
});

/**
 * A leads site's Settings (LT-199): no cancellation window, booking horizon,
 * booking questions, or calendar sync — there is no calendar. The contact
 * form's questions stay: they are the site's conversion.
 */
describe('Settings: booking-only controls by site mode', () => {
  it('shows them on a booking site', () => {
    render(<Settings />);

    expect(screen.getByText('settings.minCancelTime')).toBeInTheDocument();
    expect(screen.getByText('settings.bookingHorizon')).toBeInTheDocument();
    expect(screen.getByText('settings.bookingFields.title')).toBeInTheDocument();
    expect(screen.getByText('settings.leadFields.title')).toBeInTheDocument();
    expect(screen.getByTestId('google-calendar-card')).toBeInTheDocument();
    expect(screen.getByTestId('calendar-feed-card')).toBeInTheDocument();
  });

  it('hides them on a leads site and keeps the contact-form questions', () => {
    state.webConfig.data = { ...baseConfig(), conversion: 'lead' };
    render(<Settings />);

    expect(screen.queryByText('settings.minCancelTime')).not.toBeInTheDocument();
    expect(screen.queryByText('settings.bookingHorizon')).not.toBeInTheDocument();
    expect(screen.queryByText('settings.bookingFields.title')).not.toBeInTheDocument();
    expect(screen.queryByTestId('google-calendar-card')).not.toBeInTheDocument();
    expect(screen.queryByTestId('calendar-feed-card')).not.toBeInTheDocument();
    expect(screen.getByText('settings.leadFields.title')).toBeInTheDocument();
    expect(screen.getByText('settings.websiteLanguage')).toBeInTheDocument();
  });
});
