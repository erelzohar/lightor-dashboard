import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import AiBuilder from '../../pages/AiBuilder';
import { aiService } from '../../services/aiApi';
import { updateWebConfig, createWebConfig } from '../../store/slices/webConfigSlice';
import { createAppointmentType } from '../../services/appointmentsApi';
import { createVacation } from '../../services/vacationsApi';

const { t } = vi.hoisted(() => ({ t: (key: string) => key }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t, i18n: { language: 'en' } }) }));
const toastMock = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('react-hot-toast', () => ({ default: toastMock }));
const navigateMock = vi.hoisted(() => vi.fn());
vi.mock('react-router-dom', () => ({ useNavigate: () => navigateMock, useLocation: () => ({ state: null as unknown }) }));
vi.mock('../../contexts/ThemeContext', () => ({ useTheme: () => ({ direction: 'ltr' }) }));
const updateUser = vi.hoisted(() => vi.fn());
const authValue = vi.hoisted(() => ({
  auth: { user: { _id: 'u1', webConfig_id: 'wc1' as string | undefined, boardingStatus: 'active' } },
  updateUser,
}));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => authValue }));
vi.mock('../../services/aiApi', () => ({
  aiService: { editSite: vi.fn(), generateSite: vi.fn() },
  trimHistory: (messages: unknown[]) => messages,
}));
vi.mock('../../services/appointmentsApi', () => ({
  createAppointmentType: vi.fn(),
  updateAppointmentType: vi.fn(),
  deleteAppointmentType: vi.fn(),
}));
vi.mock('../../services/imagesApi', () => ({ deleteImage: vi.fn() }));
vi.mock('../../services/vacationsApi', () => ({ createVacation: vi.fn() }));
vi.mock('../../store/slices/webConfigSlice', () => {
  const rejected = (type: string) => ({ match: (action: { type?: string }) => action?.type === `${type}/rejected` });
  return {
    fetchWebConfig: vi.fn(() => ({ type: 'webConfig/fetch' })),
    updateWebConfig: Object.assign(vi.fn((payload: unknown) => ({ type: 'webConfig/update', payload })), { rejected: rejected('webConfig/update') }),
    createWebConfig: Object.assign(vi.fn((payload: unknown) => ({ type: 'webConfig/create', payload })), { rejected: rejected('webConfig/create') }),
  };
});
const state = vi.hoisted(() => ({ webConfig: { data: null as unknown } }));
vi.mock('../../hooks/useAppSelector', () => ({
  useAppSelector: (selector: (s: typeof state) => unknown): unknown => selector(state),
}));
const dispatchMock = vi.hoisted(() => vi.fn());
vi.mock('../../hooks/useAppDispatch', () => ({ useAppDispatch: () => dispatchMock }));

const STORED_VACATION = { _id: 'v1', title: 'Summer', startDate: '1780000000000', endDate: '1780600000000', webConfig_id: 'wc1' };

const storedConfig = (conversion: 'book' | 'lead' = 'lead') => ({
  _id: 'wc1',
  businessName: 'Biz',
  subDomain: 'biz',
  logoImageName: '',
  conversion,
  vacations: [STORED_VACATION],
  appointmentTypes: [] as unknown[],
  leadFields: [] as unknown[],
  components: { hero: { title: 'Biz', heroImageSrc: 'hero.webp' }, portfolio: { items: [] as unknown[] } },
});

/** What the model answered: a stored vacation echoed, questions with junk in them. */
const aiDraft = (over: Record<string, unknown> = {}) => ({
  ...storedConfig(),
  vacations: [
    { title: 'Summer', startDate: STORED_VACATION.startDate, endDate: STORED_VACATION.endDate },
    { title: 'Holiday', startDate: '1790000000000', endDate: '1790200000000' },
  ],
  leadFields: [
    { label: '  Kind of job ', type: 'choice', required: true, options: ['Kitchen', ' Bath '], services: ['svc1'] },
    { label: '', type: 'text' },
    { label: 'Address', type: 'address' },
    { label: 'Second address', type: 'address' },
    { label: 'Budget', type: 'money' },
  ],
  components: { hero: { title: 'Biz', heroImageSrc: 'hero.webp', cta: '  Get a quote  ' }, portfolio: { items: [] as unknown[] } },
  ...over,
});

const answer = (type: string, outcome: 'fulfilled' | 'rejected', payload?: unknown) =>
  outcome === 'fulfilled' ? { type: `${type}/fulfilled`, payload } : { type: `${type}/rejected`, error: { message: 'Request failed with status code 400' } };

/** Ask Lighty for an edit, then press Save. */
const editAndSave = async () => {
  fireEvent.change(screen.getByPlaceholderText('aiBuilder.refinePlaceholder'), { target: { value: 'Add a question' } });
  fireEvent.keyDown(screen.getByPlaceholderText('aiBuilder.refinePlaceholder'), { key: 'Enter' });
  await waitFor(() => expect(aiService.editSite).toHaveBeenCalledTimes(1));
  const save = await screen.findByRole('button', { name: /aiBuilder\.save/ });
  await waitFor(() => expect(save).not.toBeDisabled());
  fireEvent.click(save);
};

beforeAll(() => {
  // jsdom has no scrollIntoView; the chat scrolls to its newest message.
  Element.prototype.scrollIntoView = vi.fn();
});

beforeEach(() => {
  toastMock.success.mockReset();
  toastMock.error.mockReset();
  navigateMock.mockReset();
  updateUser.mockReset().mockResolvedValue(undefined);
  vi.mocked(updateWebConfig).mockClear();
  vi.mocked(createWebConfig).mockClear();
  vi.mocked(createAppointmentType).mockReset().mockResolvedValue({} as never);
  vi.mocked(createVacation).mockReset().mockResolvedValue({} as never);
  vi.mocked(aiService.editSite).mockReset().mockResolvedValue({ config: aiDraft() as never, message: 'Done' });
  authValue.auth.user.webConfig_id = 'wc1';
  state.webConfig.data = storedConfig();
  dispatchMock.mockReset().mockImplementation((action: { type: string; payload?: unknown }) =>
    Promise.resolve(action.type.startsWith('webConfig/') ? answer(action.type, 'fulfilled', action.payload) : action)
  );
});

/**
 * G3 (LT-199), the client half: the AI builder saved whatever the model
 * returned and said "Saved!" even when the server refused it.
 */
describe('AI builder save', () => {
  it('stays, says the save failed, and creates nothing when the server refuses the config', async () => {
    dispatchMock.mockImplementation((action: { type: string }) =>
      Promise.resolve(action.type === 'webConfig/update' ? answer('webConfig/update', 'rejected') : action)
    );
    vi.mocked(aiService.editSite).mockResolvedValue({
      config: aiDraft({ appointmentTypes: [{ _id: 'new1', name: 'Kitchen', price: '' }] }) as never,
      message: 'Done',
    });
    render(<AiBuilder />);

    await editAndSave();

    await waitFor(() => expect(toastMock.error).toHaveBeenCalledWith('aiBuilder.saveFailed'));
    expect(screen.queryByText('aiBuilder.saved')).not.toBeInTheDocument();
    expect(createAppointmentType).not.toHaveBeenCalled();
    expect(createVacation).not.toHaveBeenCalled();
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 1300));
    });
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it('stays when a first site is refused on creation', async () => {
    authValue.auth.user.webConfig_id = undefined;
    state.webConfig.data = null;
    dispatchMock.mockImplementation((action: { type: string }) =>
      Promise.resolve(action.type === 'webConfig/create' ? answer('webConfig/create', 'rejected') : action)
    );
    vi.mocked(aiService.generateSite).mockResolvedValue({ config: aiDraft() as never, message: 'Built' });
    render(<AiBuilder />);

    fireEvent.change(screen.getByPlaceholderText('aiBuilder.firstPromptPlaceholder'), { target: { value: 'A renovation business' } });
    fireEvent.keyDown(screen.getByPlaceholderText('aiBuilder.firstPromptPlaceholder'), { key: 'Enter' });
    const save = await screen.findByRole('button', { name: /aiBuilder\.save/ });
    await waitFor(() => expect(save).not.toBeDisabled());
    fireEvent.click(save);

    await waitFor(() => expect(toastMock.error).toHaveBeenCalledWith('aiBuilder.saveFailed'));
    expect(updateUser).not.toHaveBeenCalled();
    expect(screen.queryByText('aiBuilder.saved')).not.toBeInTheDocument();
  });

  it("stores the owner's own description with a first site built here (LT-202)", async () => {
    authValue.auth.user.webConfig_id = undefined;
    state.webConfig.data = null;
    vi.mocked(aiService.generateSite).mockResolvedValue({
      config: aiDraft({ businessDescription: 'Renovations in Haifa, kitchens and bathrooms.' }) as never,
      message: 'Built',
    });
    render(<AiBuilder />);

    fireEvent.change(screen.getByPlaceholderText('aiBuilder.firstPromptPlaceholder'), { target: { value: 'Renovations in Haifa, kitchens and bathrooms.' } });
    fireEvent.keyDown(screen.getByPlaceholderText('aiBuilder.firstPromptPlaceholder'), { key: 'Enter' });
    const save = await screen.findByRole('button', { name: /aiBuilder\.save/ });
    await waitFor(() => expect(save).not.toBeDisabled());
    fireEvent.click(save);

    expect(await screen.findByText('aiBuilder.saved')).toBeInTheDocument();
    const payload = vi.mocked(createWebConfig).mock.calls[0][0] as unknown as Record<string, unknown>;
    expect(payload.businessDescription).toBe('Renovations in Haifa, kitchens and bathrooms.');
  });

  it('cleans the contact-form questions, keeps the mode and a trimmed button text, and re-creates no vacation', async () => {
    render(<AiBuilder />);

    await editAndSave();

    expect(await screen.findByText('aiBuilder.saved')).toBeInTheDocument();
    const payload = vi.mocked(updateWebConfig).mock.calls[0][0] as unknown as Record<string, unknown> & {
      components: { hero: { cta: string } };
    };
    // Like the booking questions: trimmed, junk dropped, one address — and never scoped to a service.
    expect(payload.leadFields).toEqual([
      { label: 'Kind of job', type: 'choice', required: true, services: [], options: ['Kitchen', 'Bath'] },
      { label: 'Address', type: 'address', required: false, services: [] },
    ]);
    expect(payload.conversion).toBe('lead');
    expect(payload.components.hero.cta).toBe('Get a quote');
    // The stored vacation the answer echoed is not created again.
    expect(createVacation).toHaveBeenCalledTimes(1);
    expect(vi.mocked(createVacation).mock.calls[0][0]).toMatchObject({ title: 'Holiday', startDate: '1790000000000', webConfig_id: 'wc1' });
    expect(toastMock.error).not.toHaveBeenCalled();
  });

  it('leaves an unknown mode off the request and falls back to the default for an over-long button text', async () => {
    vi.mocked(aiService.editSite).mockResolvedValue({
      config: aiDraft({
        conversion: 'both',
        components: { hero: { title: 'Biz', heroImageSrc: 'hero.webp', cta: 'Call us today for a free quote on anything' } },
      }) as never,
      message: 'Done',
    });
    render(<AiBuilder />);

    await editAndSave();

    expect(await screen.findByText('aiBuilder.saved')).toBeInTheDocument();
    const payload = vi.mocked(updateWebConfig).mock.calls[0][0] as unknown as Record<string, unknown> & {
      components: { hero: { cta: string } };
    };
    expect(payload).not.toHaveProperty('conversion');
    expect(payload.components.hero.cta).toBe('');
  });
});

/** The suggestions a returning owner sees, by what the site does (LT-199). */
describe('AI builder suggestions', () => {
  it('suggests leads edits on a leads site', () => {
    render(<AiBuilder />);
    expect(screen.getByText('"aiBuilder.suggestion_lead_1"')).toBeInTheDocument();
    expect(screen.queryByText('"aiBuilder.suggestion_edit_1"')).not.toBeInTheDocument();
  });

  it('keeps the booking suggestions on a booking site', () => {
    state.webConfig.data = storedConfig('book');
    render(<AiBuilder />);
    expect(screen.getByText('"aiBuilder.suggestion_edit_1"')).toBeInTheDocument();
    expect(screen.queryByText('"aiBuilder.suggestion_lead_1"')).not.toBeInTheDocument();
  });
});
