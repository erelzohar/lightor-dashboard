import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SiteEditor from '../../pages/SiteEditor';
import { updateWebConfig } from '../../store/slices/webConfigSlice';
import { aiService } from '../../services/aiApi';
import type { WebConfig } from '../../types';

/**
 * LT-249 — the site editor page: the bridge with the site in the preview,
 * a click there selecting a field here, hand and AI edits landing in the
 * draft (and the preview), undo, and one Save carrying only what the editor
 * edits.
 */

const { t } = vi.hoisted(() => ({
  t: (key: string, vars?: Record<string, unknown>) => (vars && 'n' in vars && vars.n ? `${key}:${vars.n}` : key),
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t, i18n: { language: 'he' } }) }));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ auth: { user: { _id: 'u1', webConfig_id: 'wc1' } } }) }));
vi.mock('../../contexts/ThemeContext', () => ({ useTheme: () => ({ direction: 'rtl' }) }));
vi.mock('../../pages/AiBuilder', () => ({ default: (): null => null }));
vi.mock('../../services/entitlementsApi', () => ({ fetchMyEntitlements: vi.fn(async () => null) }));
vi.mock('../../services/imagesApi', () => ({ uploadImage: vi.fn(), deleteImage: vi.fn(async () => undefined) }));
vi.mock('../../services/appointmentsApi', () => ({ updateAppointmentType: vi.fn(async () => ({})) }));
vi.mock('../../services/aiApi', () => ({
  aiService: { editElement: vi.fn(), editSite: vi.fn() },
  trimHistory: (m: unknown[]) => m,
}));

const saved = {
  _id: 'wc1',
  user_id: 'u1',
  businessName: 'Nails',
  logoImageName: 'logo.webp',
  subDomain: 'nails',
  defaultLanguage: 'he',
  workingDays: [],
  vacations: [],
  appointmentTypes: [{ _id: 'svc1', name: 'Gel', price: '140', durationMS: '3600000', webConfig_id: 'wc1' }],
  contact: { phone: '050', mail: 'a@b.co' },
  social: { instagram: '', facebook: '', x: '', tiktok: '' },
  pallete: { colorPrimary: '#d71676', colorPrimaryDark: '#e5609b' },
  components: {
    hero: { visible: true, title: 'Old title', subtitle: 'Sub', description: 'Desc', heroImageSrc: 'hero.webp' },
    faq: { visible: true, title: 'FAQ', items: [{ question: 'Q', answer: 'A' }] },
  },
  design: { stylePreset: 'boutique' },
  blocks: [{ id: 'b1', type: 'hero' }, { id: 'b2', type: 'faq', variant: 'lines' }],
} as unknown as WebConfig;

const state = { webConfig: { data: saved, loading: false, error: null as string | null } };
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
const dispatchMock = vi.hoisted(() => vi.fn());
vi.mock('../../hooks/useAppDispatch', () => ({ useAppDispatch: () => dispatchMock }));

const iframe = () => screen.getByTitle('siteEditor.previewTitle') as HTMLIFrameElement;
const siteOrigin = () => new URL(iframe().src).origin;
const fromSite = (data: unknown, origin = siteOrigin()) =>
  act(() => {
    window.dispatchEvent(new MessageEvent('message', { data, origin, source: iframe().contentWindow }));
  });

describe('the site editor (LT-249)', () => {
  let toSite: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.mocked(updateWebConfig).mockClear();
    vi.mocked(aiService.editElement).mockReset();
    dispatchMock.mockReset().mockImplementation((action: { type: string; payload?: Record<string, unknown> }) => {
      if (action.type === 'webConfig/update') {
        return Promise.resolve({ type: 'webConfig/update/fulfilled', payload: { ...saved, ...action.payload } });
      }
      return Promise.resolve(action);
    });
  });

  const renderEditor = () => {
    const view = render(<MemoryRouter><SiteEditor /></MemoryRouter>);
    toSite = vi.fn();
    Object.defineProperty(iframe().contentWindow as Window, 'postMessage', { configurable: true, value: toSite });
    return view;
  };
  const posted = (type: string) => toSite.mock.calls.filter(([m]) => (m as { type: string }).type === type);
  const lastPosted = (type: string) => { const all = posted(type); return all[all.length - 1]; };

  it("waits for the site's LT_READY, then sends the draft and turns the editor on — to the site's origin only", async () => {
    renderEditor();
    expect(toSite).not.toHaveBeenCalled();
    await fromSite({ type: 'LT_READY' });
    await waitFor(() => expect(posted('PREVIEW_DATA')).toHaveLength(1));
    expect(posted('LT_EDIT')[0]).toEqual([{ type: 'LT_EDIT', on: true }, siteOrigin()]);
    expect(posted('PREVIEW_DATA')[0][1]).toBe(siteOrigin());

    // A message from anywhere else selects nothing.
    await fromSite({ type: 'LT_SELECT', kind: 'text', path: 'components.hero.title', section: 'b1', sectionType: 'hero' }, 'https://evil.example');
    expect(screen.queryByTestId('text-panel')).toBeNull();
  });

  it('a click on the site opens the field; typing updates the draft and the preview; undo takes it back', async () => {
    renderEditor();
    await fromSite({ type: 'LT_READY' });
    await fromSite({ type: 'LT_SELECT', kind: 'text', path: 'components.hero.title', section: 'b1', sectionType: 'hero', count: 1 });

    const field = await screen.findByRole('textbox', { name: 'siteEditor.fields.heroTitle' });
    expect(field).toHaveValue('Old title');
    fireEvent.change(field, { target: { value: 'New title' } });
    await waitFor(() => {
      const last = lastPosted('PREVIEW_DATA')?.[0] as { config: WebConfig };
      expect(last.config.components.hero.title).toBe('New title');
    });

    fireEvent.click(screen.getByLabelText('siteEditor.undo'));
    expect(screen.getByRole('textbox', { name: 'siteEditor.fields.heroTitle' })).toHaveValue('Old title');
  });

  it('Save sends only what the editor edits, and the draft starts over from the stored config', async () => {
    renderEditor();
    await fromSite({ type: 'LT_READY' });
    await fromSite({ type: 'LT_SELECT', kind: 'text', path: 'components.hero.title', section: 'b1', sectionType: 'hero', count: 1 });
    fireEvent.change(await screen.findByRole('textbox', { name: 'siteEditor.fields.heroTitle' }), { target: { value: 'Saved title' } });

    fireEvent.click(screen.getByText('siteEditor.save'));
    await waitFor(() => expect(updateWebConfig).toHaveBeenCalledTimes(1));
    const payload = vi.mocked(updateWebConfig).mock.calls[0][0] as Record<string, unknown>;
    expect(Object.keys(payload).sort()).toEqual(['_id', 'blocks', 'businessName', 'components', 'design', 'logoImageName', 'pallete']);
    expect((payload.components as WebConfig['components']).hero.title).toBe('Saved title');
    // Saved: the button says so, and with nothing left to save it rests.
    await waitFor(() => expect(screen.getByText('siteEditor.saved').closest('button')).toBeDisabled());
  });

  it("the AI rewrites the selected text, and only that text", async () => {
    vi.mocked(aiService.editElement).mockResolvedValue({ values: { 'components.hero.title': 'Short' }, message: 'Shortened.' });
    renderEditor();
    await fromSite({ type: 'LT_READY' });
    await fromSite({ type: 'LT_SELECT', kind: 'text', path: 'components.hero.title', section: 'b1', sectionType: 'hero', count: 1 });
    fireEvent.click(await screen.findByText('siteEditor.ai.quick.shorter'));

    await waitFor(() => expect(screen.getByRole('textbox', { name: 'siteEditor.fields.heroTitle' })).toHaveValue('Short'));
    expect(aiService.editElement).toHaveBeenCalledWith('siteEditor.ai.ask.shorter', [
      { path: 'components.hero.title', value: 'Old title', label: 'siteEditor.fields.heroTitle', maxLength: 120 },
    ]);
    expect(screen.getByRole('status')).toHaveTextContent('Shortened.');
  });

  it("a section: its layout is the block's variant, and its field list opens a field", async () => {
    renderEditor();
    await fromSite({ type: 'LT_READY' });
    await fromSite({
      type: 'LT_SELECT', kind: 'section', path: null, section: 'b2', sectionType: 'faq', count: 1,
      fields: [{ path: 'components.faq.title', kind: 'text' }, { path: 'components.faq.items.0.answer', kind: 'text' }],
    });
    expect(await screen.findByTestId('section-panel')).toBeInTheDocument();
    expect(screen.getByRole('radio', { checked: true })).toHaveTextContent('שורות');   // 'lines', in Hebrew

    fireEvent.click(screen.getByRole('radio', { name: 'כמוסות' }));                    // 'pills'
    await waitFor(() => {
      const last = lastPosted('PREVIEW_DATA')?.[0] as { config: WebConfig };
      expect(last.config.blocks?.find((b) => b.id === 'b2')?.variant).toBe('pills');
    });

    fireEvent.click(screen.getByText('siteEditor.fields.faqAnswer:1'));
    expect(await screen.findByRole('textbox', { name: 'siteEditor.fields.faqAnswer:1' })).toHaveValue('A');
    expect(lastPosted('LT_SCROLL_TO')?.[0]).toEqual({ type: 'LT_SCROLL_TO', path: 'components.faq.items.0.answer', section: null, block: 'center' });
  });
});
