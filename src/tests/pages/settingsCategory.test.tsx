import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Settings from '../../pages/Settings';
import { updateWebConfig } from '../../store/slices/webConfigSlice';
import type { WebConfig } from '../../types';
import { choose } from '../helpers/dropdown';

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
vi.mock('../../services/categoriesApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../services/categoriesApi')>()),
  fetchCategories: vi.fn(async () => ({
    mains: [
      { key: 'beauty', names: { he: 'יופי', en: 'Beauty', ar: 'a', fr: 'f', es: 'e' } },
      { key: 'fitness', names: { he: 'כושר', en: 'Fitness', ar: 'a', fr: 'f', es: 'e' } },
    ],
    subs: [
      { key: 'nails', main: 'beauty', names: { he: 'ציפורניים', en: 'Nails', ar: 'a', fr: 'f', es: 'e' } },
      { key: 'barber', main: 'beauty', names: { he: 'מספרה', en: 'Barbershop', ar: 'a', fr: 'f', es: 'e' } },
      { key: 'pilates', main: 'fitness', names: { he: 'פילאטיס', en: 'Pilates', ar: 'a', fr: 'f', es: 'e' } },
    ],
  })),
}));
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

/** The dropdown's trigger (its list is labelled by the same text). */
const trigger = (label: string) => screen.getAllByLabelText(label).find((el) => el.tagName === 'BUTTON')!;
const findTrigger = async (label: string) => waitFor(() => {
  const el = trigger(label);
  expect(el).toBeTruthy();
  return el;
});

const sentPayload = (call = 0) => vi.mocked(updateWebConfig).mock.calls[call][0] as unknown as Partial<WebConfig>;


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
 * LT-453: the site's category and keywords in Settings > General - what the
 * AI chose at the build, changed here, sent only when changed.
 */
describe('Settings: the category and keywords', () => {
  it("shows the build's choice, offers only the main category's sub-categories, and saves both", async () => {
    state.webConfig.data = { ...baseConfig(), category: { main: 'beauty', sub: 'nails' }, keywords: ['gel'] } as WebConfig;
    render(<Settings />);

    await waitFor(async () => expect(await findTrigger('settings.category.sub')).toHaveTextContent('Nails'));
    expect(screen.queryByText('common.save')).toBeNull();

    choose(trigger('settings.category.main'), 'fitness');
    // A new main clears the sub-category; only its own are offered.
    await waitFor(() => expect(trigger('settings.category.sub')).not.toHaveTextContent('Nails'));
    expect(() => choose(trigger('settings.category.sub'), 'nails')).toThrow();
    choose(trigger('settings.category.sub'), 'pilates');

    const input = screen.getByLabelText('settings.category.keywords');
    fireEvent.change(input, { target: { value: 'reformer' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.change(input, { target: { value: 'Gel' } });
    fireEvent.keyDown(input, { key: 'Enter' }); // the same word again: ignored
    // The first chip is "gel" (the build's), the second the one just added.
    fireEvent.click(screen.getAllByRole('button', { name: 'settings.category.removeKeyword' })[0]);

    fireEvent.click(await screen.findByText('common.save'));
    await waitFor(() => expect(updateWebConfig).toHaveBeenCalledTimes(1));
    expect(sentPayload()).toMatchObject({ category: { main: 'fitness', sub: 'pilates' }, keywords: ['reformer'] });
  });

  it('sends neither when untouched', async () => {
    state.webConfig.data = { ...baseConfig(), category: { main: 'beauty', sub: 'nails' }, keywords: ['gel'] } as WebConfig;
    render(<Settings />);
    await findTrigger('settings.category.sub');
    fireEvent.change(screen.getByDisplayValue('Biz'), { target: { value: 'Biz 2' } });
    fireEvent.click(await screen.findByText('common.save'));
    await waitFor(() => expect(updateWebConfig).toHaveBeenCalledTimes(1));
    expect(sentPayload()).not.toHaveProperty('category');
    expect(sentPayload()).not.toHaveProperty('keywords');
  });
});
