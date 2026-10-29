import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act, within } from '@testing-library/react';
import { choose } from '../helpers/dropdown';
import toast from 'react-hot-toast';
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom';
import SiteEditor from '../../pages/SiteEditor';
import BottomTabBar from '../../components/layout/BottomTabBar';
import { LeaveGuardProvider } from '../../contexts/LeaveGuardContext';
import { PhoneBarProvider, usePhoneBar } from '../../contexts/PhoneBarContext';
import { updateWebConfig } from '../../store/slices/webConfigSlice';
import { aiService } from '../../services/aiApi';
import { fetchMyEntitlements } from '../../services/entitlementsApi';
import { deleteImage, uploadImage } from '../../services/imagesApi';
import { updateAppointmentType } from '../../services/appointmentsApi';
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
vi.mock('../../pages/SiteBuilder', () => ({ default: (): null => null }));
vi.mock('../../services/entitlementsApi', () => ({ fetchMyEntitlements: vi.fn(async () => null) }));
vi.mock('../../services/imagesApi', () => ({ uploadImage: vi.fn(), deleteImage: vi.fn(async () => undefined) }));
vi.mock('../../services/appointmentsApi', () => ({ updateAppointmentType: vi.fn(async () => ({})) }));
vi.mock('../../services/aiApi', () => ({
  aiService: { editElement: vi.fn(), editSite: vi.fn(), draftSection: vi.fn(), restyle: vi.fn() },
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

const state = { webConfig: { data: saved as WebConfig, loading: false, error: null as string | null } };
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

  afterEach(() => { state.webConfig.data = saved; });

  beforeEach(() => {
    vi.mocked(updateWebConfig).mockClear();
    vi.mocked(aiService.editElement).mockReset();
    vi.mocked(aiService.draftSection).mockReset();
    vi.mocked(toast.error).mockClear();
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

  // LT-485 (Erel): the phone's home bar, drawn over the site, hid what it has
  // at its bottom. The phone preview lays nothing over the site.
  it('draws nothing over the site in the phone preview', async () => {
    renderEditor();
    fireEvent.click(screen.getByRole('button', { name: 'siteEditor.phone' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'siteEditor.phone' })).toHaveAttribute('aria-pressed', 'true'));
    await act(() => new Promise((done) => setTimeout(done, 500)));
    const screenBox = iframe().parentElement as HTMLElement;
    expect([...screenBox.children].filter((el) => el !== iframe())).toHaveLength(0);
  });

  // LT-444: the tab kept the previous page's title.
  it('names the window', () => {
    document.title = 'Gallery';
    renderEditor();
    expect(document.title).toBe('siteEditor.title');
  });

  it("waits for the site's LT_READY, then sends the draft and turns the editor on - to the site's origin only", async () => {
    renderEditor();
    expect(toSite).not.toHaveBeenCalled();
    await fromSite({ type: 'LT_READY' });
    await waitFor(() => expect(posted('PREVIEW_DATA')).toHaveLength(1));
    expect(posted('LT_EDIT')[0]).toEqual([{ type: 'LT_EDIT', on: true }, siteOrigin()]);
    expect(posted('PREVIEW_DATA')[0][1]).toBe(siteOrigin());

    // A message from anywhere else selects nothing.
    await fromSite({ type: 'LT_SELECT', kind: 'text', path: 'components.hero.title', section: 'b1', sectionType: 'hero' }, 'https://evil.example');
    expect(screen.queryByTestId('text-panel')).toBeNull();
    // A free site's draft goes as it is: its corner is the contact button.
    expect((posted('PREVIEW_DATA')[0][0] as { config: { assistant?: boolean } }).config.assistant).toBeUndefined();
  });

  it("tells the preview that a Plus site's corner is Lighty (LT-312)", async () => {
    // Both the editor and the design tab (open from the start, LT-386) ask.
    vi.mocked(fetchMyEntitlements).mockResolvedValueOnce({ plan: 'plus' } as never).mockResolvedValueOnce({ plan: 'plus' } as never);
    renderEditor();
    await fromSite({ type: 'LT_READY' });
    await waitFor(() => expect((lastPosted('PREVIEW_DATA')?.[0] as { config: { assistant?: boolean } } | undefined)?.config.assistant).toBe(true));
    expect(state.webConfig.data).not.toHaveProperty('assistant');
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
    // LT-492: the line asking the owner to check the AI's change sits under the input, before any answer.
    expect(within(screen.getByTestId('ai-box')).getByTestId('ai-review-note')).toHaveTextContent('siteEditor.ai.reviewNote');
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

    // Hidden, not deleted: the block stays with mod.hidden, and the switch says so (LT-249).
    fireEvent.click(screen.getByRole('switch', { name: 'siteEditor.section.visible' }));
    await waitFor(() => {
      const last = lastPosted('PREVIEW_DATA')?.[0] as { config: WebConfig };
      expect(last.config.blocks?.find((b) => b.id === 'b2')?.mod).toEqual({ hidden: true });
    });
    expect(screen.getByText('siteEditor.section.hiddenNote')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('switch', { name: 'siteEditor.section.visible' }));
    await waitFor(() => {
      const last = lastPosted('PREVIEW_DATA')?.[0] as { config: WebConfig };
      expect(last.config.blocks?.find((b) => b.id === 'b2')?.mod).toEqual({});
    });

    fireEvent.click(screen.getByText('siteEditor.fields.faqAnswer:1'));
    expect(await screen.findByRole('textbox', { name: 'siteEditor.fields.faqAnswer:1' })).toHaveValue('A');
    expect(lastPosted('LT_SCROLL_TO')?.[0]).toEqual({ type: 'LT_SCROLL_TO', path: 'components.faq.items.0.answer', section: null, block: 'center' });
  });

  // ── LT-252: the page's sections ──
  const lastConfig = () => (lastPosted('PREVIEW_DATA')?.[0] as { config: WebConfig }).config;
  const row = (id: string) => within(screen.getByTestId(`section-row-${id}`));
  // The panel opens on the design (LT-386); the sections are the other tab.
  const toSections = () => fireEvent.mouseDown(screen.getByRole('tab', { name: 'siteEditor.sections.tab' }));

  it("with nothing selected, lists the page's sections; a tap selects one and shows it on the site", async () => {
    renderEditor();
    await fromSite({ type: 'LT_READY' });
    expect(screen.getByRole('tab', { name: 'siteEditor.pageSettings' })).toHaveAttribute('aria-selected', 'true');
    toSections();
    expect(screen.getByRole('tab', { name: 'siteEditor.sections.tab' })).toHaveAttribute('aria-selected', 'true');
    expect(row('b1').getByText('פתיחה')).toBeInTheDocument();
    expect(row('b2').getByText('שאלות נפוצות')).toBeInTheDocument();

    fireEvent.click(row('b2').getByText('שאלות נפוצות'));
    expect(await screen.findByTestId('section-panel')).toBeInTheDocument();
    expect(lastPosted('LT_SCROLL_TO')?.[0]).toEqual({ type: 'LT_SCROLL_TO', path: null, section: 'b2', block: 'start' });

    // Back from the section is the list again.
    fireEvent.click(screen.getByLabelText('siteEditor.back'));
    expect(await screen.findByTestId('sections-panel')).toBeInTheDocument();

    // The eye hides it (the block stays, marked).
    fireEvent.click(row('b2').getByLabelText('siteEditor.sections.hide'));
    await waitFor(() => expect(lastConfig().blocks?.find((b) => b.id === 'b2')?.mod).toEqual({ hidden: true }));
    expect(row('b2').getByText('siteEditor.sections.hiddenTag')).toBeInTheDocument();
  });

  it('adds a section the AI drafts, where it belongs, and selects it', async () => {
    vi.mocked(aiService.draftSection).mockResolvedValue({ title: 'How it works', steps: [{ title: 'Pick' }, { title: 'Come in' }] });
    renderEditor();
    await fromSite({ type: 'LT_READY' });
    toSections();
    fireEvent.click(screen.getByText('siteEditor.sections.add'));
    const list = await screen.findByTestId('add-section-panel');
    // The page has an FAQ already: not offered again. A gallery without photos
    // comes empty, for the owner's photos (LT-320).
    expect(within(list).queryByText('שאלות נפוצות')).toBeNull();
    expect(within(list).getByText('גלריה').closest('button')).toBeEnabled();
    expect(within(list).getByText('siteEditor.sections.badge.photos')).toBeInTheDocument();

    fireEvent.click(within(list).getByText('שלבים'));
    expect(aiService.draftSection).toHaveBeenCalledWith('process');
    await waitFor(() => expect(lastConfig().blocks?.map((b) => b.id)).toEqual(['b1', 'b3', 'b2']));
    expect(lastConfig().blocks?.[1]).toEqual({ id: 'b3', type: 'process', variant: 'rail', props: { title: 'How it works', steps: [{ title: 'Pick' }, { title: 'Come in' }] } });
    expect(await screen.findByTestId('section-panel')).toBeInTheDocument();
    expect(lastPosted('LT_SCROLL_TO')?.[0]).toEqual({ type: 'LT_SCROLL_TO', path: null, section: 'b3', block: 'start' });
  });

  it('adds an empty gallery, then a photo uploaded from its panel (LT-320)', async () => {
    vi.mocked(uploadImage).mockResolvedValue({ imageName: 'new.webp' } as Awaited<ReturnType<typeof uploadImage>>);
    renderEditor();
    await fromSite({ type: 'LT_READY' });
    toSections();
    fireEvent.click(screen.getByText('siteEditor.sections.add'));
    fireEvent.click(within(await screen.findByTestId('add-section-panel')).getByText('גלריה'));
    const panel = await screen.findByTestId('section-panel');
    expect(within(panel).getByText('siteEditor.image.addToGallery')).toBeInTheDocument();

    const photo = new File(['x'], 'nails.jpg', { type: 'image/jpeg' });
    fireEvent.change(within(panel).getByTestId('add-photo-input'), { target: { files: [photo] } });
    await waitFor(() => expect(lastConfig().components?.portfolio?.items?.map((i) => i.url)).toEqual(['new.webp']));
    expect(uploadImage).toHaveBeenCalledWith(photo, 'photo');
    expect(lastConfig().blocks?.filter((b) => b.type === 'gallery')).toHaveLength(1);
  });

  it('a photo added from the editor stays once saved; one added and taken out again goes (LT-320 + LT-315)', async () => {
    vi.mocked(uploadImage).mockReset()
      .mockResolvedValueOnce({ imageName: 'kept.webp' } as Awaited<ReturnType<typeof uploadImage>>)
      .mockResolvedValueOnce({ imageName: 'dropped.webp' } as Awaited<ReturnType<typeof uploadImage>>);
    vi.mocked(deleteImage).mockClear();
    renderEditor();
    await fromSite({ type: 'LT_READY' });
    toSections();
    fireEvent.click(screen.getByText('siteEditor.sections.add'));
    fireEvent.click(within(await screen.findByTestId('add-section-panel')).getByText('גלריה'));
    const panel = await screen.findByTestId('section-panel');
    for (const name of ['kept.jpg', 'dropped.jpg']) {
      fireEvent.change(within(panel).getByTestId('add-photo-input'), { target: { files: [new File(['x'], name, { type: 'image/jpeg' })] } });
      await waitFor(() => expect(lastConfig().components?.portfolio?.items?.some((i) => i.url === name.replace('.jpg', '.webp'))).toBe(true));
    }
    const gallery = lastConfig().blocks?.find((b) => b.type === 'gallery')?.id;
    await fromSite({ type: 'LT_SELECT', kind: 'image', path: 'components.portfolio.items.1.url', section: gallery, sectionType: 'gallery', count: 1 });
    fireEvent.click(await screen.findByText('siteEditor.image.removeFromGallery'));
    await waitFor(() => expect(lastConfig().components?.portfolio?.items?.map((i) => i.url)).toEqual(['kept.webp']));

    fireEvent.click(screen.getByText('siteEditor.save'));
    await waitFor(() => expect(deleteImage).toHaveBeenCalledWith('dropped.webp'));
    expect(deleteImage).not.toHaveBeenCalledWith('kept.webp');
  });

  it("opens the owner's fields when the AI cannot draft, and reviews are always the owner's; Save leaves empty ones out", async () => {
    vi.mocked(aiService.draftSection).mockRejectedValue({ response: { status: 429 } });
    renderEditor();
    await fromSite({ type: 'LT_READY' });
    toSections();
    fireEvent.click(screen.getByText('siteEditor.sections.add'));
    fireEvent.click(within(await screen.findByTestId('add-section-panel')).getByText('שלבים'));
    expect(await screen.findByRole('textbox', { name: 'siteEditor.fields.stepTitle:1' })).toHaveValue('');
    expect(toast.error).toHaveBeenCalledWith('siteEditor.sections.aiBudget');

    fireEvent.click(screen.getByLabelText('siteEditor.close'));
    fireEvent.click(screen.getByText('siteEditor.sections.add'));
    fireEvent.click(within(await screen.findByTestId('add-section-panel')).getByText('המלצות'));
    expect(await screen.findByRole('textbox', { name: 'siteEditor.fields.quoteText:1' })).toHaveValue('');
    expect(aiService.draftSection).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText('siteEditor.save'));
    await waitFor(() => expect(updateWebConfig).toHaveBeenCalledTimes(1));
    const payload = vi.mocked(updateWebConfig).mock.calls[0][0] as Partial<WebConfig>;
    expect(payload.components?.testimonials?.items).toEqual([]);
    expect(payload.blocks?.find((b) => b.type === 'process')).toBeUndefined();
  });

  it('undoing an added section closes its field that was left open (LT-429)', async () => {
    renderEditor();
    await fromSite({ type: 'LT_READY' });
    toSections();
    fireEvent.click(screen.getByText('siteEditor.sections.add'));
    fireEvent.click(within(await screen.findByTestId('add-section-panel')).getByText('המלצות'));
    // Reviews are the owner's: the section opens on its first field.
    expect(await screen.findByRole('textbox', { name: 'siteEditor.fields.quoteText:1' })).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('siteEditor.undo'));
    await waitFor(() => expect(lastConfig().blocks?.map((b) => b.id)).toEqual(['b1', 'b2']));
    // Nothing left to type into: the panel is the site's again.
    await waitFor(() => expect(screen.queryByRole('textbox', { name: 'siteEditor.fields.quoteText:1' })).toBeNull());
    expect(screen.getByRole('tab', { name: 'siteEditor.sections.tab' })).toBeInTheDocument();
  });

  it("a section's service fields name their service (LT-429)", async () => {
    state.webConfig.data = {
      ...saved,
      appointmentTypes: [
        { _id: 'svc1', name: 'Gel', price: '140', durationMS: '3600000', webConfig_id: 'wc1' },
        { _id: 'svc2', name: 'Pedicure', price: '200', durationMS: '3600000', webConfig_id: 'wc1' },
      ],
    } as unknown as WebConfig;
    renderEditor();
    await fromSite({ type: 'LT_READY' });
    await fromSite({
      type: 'LT_SELECT', kind: 'section', path: null, section: 'b2', sectionType: 'faq', count: 1,
      fields: [{ path: 'services.svc1.name', kind: 'text' }, { path: 'services.svc2.name', kind: 'text' }],
    });
    expect(await screen.findByText('siteEditor.fields.serviceName - Gel')).toBeInTheDocument();
    expect(screen.getByText('siteEditor.fields.serviceName - Pedicure')).toBeInTheDocument();
  });

  it('the discard question offers to keep editing, not a second "cancel" (LT-429)', async () => {
    renderEditor();
    await fromSite({ type: 'LT_READY' });
    toSections();
    fireEvent.click(row('b2').getByLabelText('siteEditor.sections.hide'));
    fireEvent.click(await screen.findByLabelText('siteEditor.discard'));
    expect(await screen.findByText('siteEditor.discardTitle')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'siteEditor.keepEditing' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'common.cancel' })).toBeNull();
  });

  it('the sections list tells a screen reader how to reorder, in the owner\'s language (LT-429)', async () => {
    renderEditor();
    await fromSite({ type: 'LT_READY' });
    toSections();
    const handle = row('b2').getByLabelText('siteEditor.sections.drag');
    const describedBy = handle.getAttribute('aria-describedby');
    expect(describedBy && document.getElementById(describedBy)).toHaveTextContent('common.sortable.instructions');
  });

  it('a legacy page: listed as the site draws it, and turned into those blocks by the first change', async () => {
    state.webConfig.data = { ...saved, blocks: undefined };
    renderEditor();
    await fromSite({ type: 'LT_READY' });
    toSections();
    await fromSite({
      type: 'LT_LAYOUT',
      blocks: [
        { key: 'hero', type: 'hero', source: 'hero' },
        { key: 'faq', type: 'faq', source: 'faq' },
        { key: 'footer', type: 'footer', source: 'footer' },
      ],
    });
    expect(row('b3').getByText('כותרת תחתונה')).toBeInTheDocument();

    // Before any change, a section is selected by its legacy name.
    fireEvent.click(row('b2').getByText('שאלות נפוצות'));
    expect(lastPosted('LT_SCROLL_TO')?.[0]).toEqual({ type: 'LT_SCROLL_TO', path: null, section: 'faq', block: 'start' });
    fireEvent.click(screen.getByLabelText('siteEditor.back'));

    fireEvent.click(row('b2').getByLabelText('siteEditor.sections.hide'));
    await waitFor(() => expect(lastConfig().blocks).toEqual([
      { id: 'b1', type: 'hero', source: 'hero' },
      { id: 'b2', type: 'faq', source: 'faq', mod: { hidden: true } },
      { id: 'b3', type: 'footer', source: 'footer' },
    ]));
  });

  // ── LT-267: leaving the editor for another page of the dashboard ──
  /** The editor inside the dashboard's frame: its pages and the phone tab bar around them. */
  const renderInDashboard = () => {
    const view = render(
      <MemoryRouter initialEntries={['/design']}>
        <LeaveGuardProvider>
          <Routes>
            <Route element={<><Outlet /><BottomTabBar onMore={() => undefined} /></>}>
              <Route path="/design" element={<SiteEditor />} />
              <Route path="/appointments" element={<p>appointments page</p>} />
            </Route>
          </Routes>
        </LeaveGuardProvider>
      </MemoryRouter>
    );
    toSite = vi.fn();
    Object.defineProperty(iframe().contentWindow as Window, 'postMessage', { configurable: true, value: toSite });
    return view;
  };
  const hideFaq = async () => {
    await fromSite({ type: 'LT_READY' });
    toSections();
    fireEvent.click(row('b2').getByLabelText('siteEditor.sections.hide'));
    await waitFor(() => expect(screen.getByText('siteEditor.save').closest('button')).toBeEnabled());
  };
  const appointmentsTab = () => screen.getByText('common.appointments').closest('a')!;

  it('asks before a tab leaves unsaved changes; staying keeps them', async () => {
    renderInDashboard();
    await hideFaq();

    fireEvent.click(appointmentsTab());
    expect(await screen.findByText('common.unsavedLeaveTitle')).toBeInTheDocument();
    expect(screen.queryByText('appointments page')).toBeNull();

    fireEvent.click(screen.getByText('common.stay'));
    await waitFor(() => expect(screen.queryByText('common.unsavedLeaveTitle')).toBeNull());
    expect(iframe()).toBeInTheDocument();
    expect(screen.getByText('siteEditor.save').closest('button')).toBeEnabled();
    expect(row('b2').getByText('siteEditor.sections.hiddenTag')).toBeInTheDocument();

    fireEvent.click(appointmentsTab());
    fireEvent.click(await screen.findByText('common.leaveWithoutSaving'));
    expect(await screen.findByText('appointments page')).toBeInTheDocument();
    expect(updateWebConfig).not.toHaveBeenCalled();
  });

  it('leaves at once with nothing unsaved', async () => {
    renderInDashboard();
    await fromSite({ type: 'LT_READY' });

    fireEvent.click(appointmentsTab());
    expect(await screen.findByText('appointments page')).toBeInTheDocument();
    expect(screen.queryByText('common.unsavedLeaveTitle')).toBeNull();
  });

  it('asks nothing once the changes are saved', async () => {
    renderInDashboard();
    await hideFaq();
    fireEvent.click(screen.getByText('siteEditor.save'));
    await waitFor(() => expect(screen.getByText('siteEditor.saved').closest('button')).toBeDisabled());

    fireEvent.click(appointmentsTab());
    expect(await screen.findByText('appointments page')).toBeInTheDocument();
    expect(screen.queryByText('common.unsavedLeaveTitle')).toBeNull();
  });

  it('a photo taken out of the gallery is deleted only when nothing else uses it (LT-315)', async () => {
    // The hero shows a gallery photo (the image picker offers every site image).
    state.webConfig.data = {
      ...saved,
      components: { ...saved.components, portfolio: { visible: true, title: 'Work', items: [{ url: 'hero.webp' }, { url: 'old.webp' }] } },
      blocks: [...(saved.blocks ?? []), { id: 'b3', type: 'portfolio' }],
    } as unknown as WebConfig;
    vi.mocked(deleteImage).mockClear();
    renderEditor();
    await fromSite({ type: 'LT_READY' });
    for (const index of [1, 0]) {
      await fromSite({ type: 'LT_SELECT', kind: 'image', path: `components.portfolio.items.${index}.url`, section: 'b3', sectionType: 'portfolio', count: 1 });
      fireEvent.click(await screen.findByText('siteEditor.image.removeFromGallery'));
    }

    fireEvent.click(screen.getByText('siteEditor.save'));
    await waitFor(() => expect(deleteImage).toHaveBeenCalledWith('old.webp'));
    expect(deleteImage).not.toHaveBeenCalledWith('hero.webp');
  });

  // LT-426: the register's style pictures and try-on (LT-326/330).
  describe('the style pictures', () => {
    const lastConfig = () => (lastPosted('PREVIEW_DATA')?.[0] as { config: WebConfig & { design: Record<string, unknown>; pallete: Record<string, unknown>; blocks: Record<string, unknown>[] } }).config;

    it("offer the ten styles as pictures, the site's own first, and a tap dresses the site in one", async () => {
      vi.mocked(aiService.restyle).mockReset().mockResolvedValue({ design: { stylePreset: 'serene', headingFont: 'fraunces' }, pallete: { colorLightBg: '#f5f0e8' } });
      renderEditor();
      await fromSite({ type: 'LT_READY' });
      const cards = within(screen.getByTestId('style-cards')).getAllByRole('radio');
      expect(cards).toHaveLength(11);
      // "boutique" has no picture: offered first, as the site's.
      expect(cards[0]).toHaveAttribute('data-style', 'boutique');
      expect(cards[0]).toHaveAttribute('aria-checked', 'true');
      expect(cards[1].querySelector('img')).toHaveAttribute('src', '/styles/atelier.webp');

      fireEvent.click(screen.getByRole('radio', { name: /serene|רגוע/ }));
      await waitFor(() => expect(aiService.restyle).toHaveBeenCalledWith(saved.pallete, 'serene', 'wc1'));
      await waitFor(() => expect(lastConfig().design).toEqual({ stylePreset: 'serene', headingFont: 'fraunces' }));
      expect(lastConfig().pallete).toEqual({ colorPrimary: '#d71676', colorPrimaryDark: '#e5609b', colorLightBg: '#f5f0e8' });
      // The sections give up their own layouts to the style's.
      expect(lastConfig().blocks).toEqual([{ id: 'b1', type: 'hero' }, { id: 'b2', type: 'faq' }]);
    });

    it('says so when the style could not be fetched, and leaves the site as it was', async () => {
      vi.mocked(aiService.restyle).mockReset().mockRejectedValue(new Error('down'));
      renderEditor();
      await fromSite({ type: 'LT_READY' });
      await waitFor(() => expect(posted('PREVIEW_DATA').length).toBeGreaterThan(0));
      fireEvent.click(screen.getByRole('radio', { name: /serene|רגוע/ }));
      expect(await screen.findByRole('alert')).toHaveTextContent('siteEditor.theme.styleFailed');
      expect(lastConfig().design).toEqual({ stylePreset: 'boutique' });
    });
  });

  // LT-426: pictures in Lighty's chat, as in the register (LT-381).
  describe("the chat's pictures", () => {
    const picture = (name: string, type = 'image/png') => new File([new Uint8Array(1)], name, { type });
    const pick = (...files: File[]) => fireEvent.change(screen.getByTestId('site-chat-file'), { target: { files } });

    it('go with the message, up to three; the AI places them, and a service picture is saved on the service', async () => {
      const placed = {
        ...saved,
        components: { ...saved.components, hero: { ...saved.components.hero, heroImageSrc: 'https://api.lightor.app/api/images/tmp-ai-1.webp' } },
        appointmentTypes: [{ _id: 'svc1', name: 'Gel', image: 'https://api.lightor.app/api/images/tmp-ai-2.webp' }],
      };
      vi.mocked(aiService.editSite).mockReset().mockResolvedValue({ config: placed, message: 'Placed them' } as never);
      vi.mocked(updateAppointmentType).mockClear();
      renderEditor();
      await fromSite({ type: 'LT_READY' });
      const [a, b, c] = [picture('a.png'), picture('b.jpg', 'image/jpeg'), picture('c.webp', 'image/webp')];
      pick(a, b);
      pick(c, picture('d.png'));
      expect(screen.getByTestId('site-chat-images').querySelectorAll('img')).toHaveLength(3);
      expect(screen.getByRole('status')).toHaveTextContent('siteEditor.chat.imagesLimit');
      fireEvent.click(screen.getAllByLabelText('siteEditor.chat.removeImage')[0]); // a.png
      pick(c);

      // Pictures alone are a request: put them on the site.
      expect(within(screen.getByTestId('site-chat')).getByTestId('ai-review-note')).toHaveTextContent('siteEditor.ai.reviewNote'); // LT-492
      fireEvent.click(screen.getByRole('button', { name: 'siteEditor.ai.send' }));
      await waitFor(() => expect(aiService.editSite).toHaveBeenCalledTimes(1));
      const [ask, , sent] = vi.mocked(aiService.editSite).mock.calls[0];
      expect(ask).toBe('siteEditor.chat.picturesOnly');
      expect((sent as File[]).map((f) => f.name)).toEqual(['b.jpg', 'c.webp', 'c.webp']);
      expect(screen.queryByTestId('site-chat-images')).toBeNull();

      await waitFor(() => expect(lastConfig().components.hero.heroImageSrc).toBe('https://api.lightor.app/api/images/tmp-ai-1.webp'));
      fireEvent.click(screen.getByText('siteEditor.save'));
      await waitFor(() => expect(updateAppointmentType).toHaveBeenCalledWith('svc1', expect.objectContaining({ image: 'https://api.lightor.app/api/images/tmp-ai-2.webp' })));
    });

    const lastConfig = () => (lastPosted('PREVIEW_DATA')?.[0] as { config: WebConfig }).config;
  });

  describe('answers that land late (LT-315)', () => {
    const renderWithRequest = (floatingMessage: string) => {
      render(
        <MemoryRouter initialEntries={[{ pathname: '/design', state: { floatingMessage } }]}>
          <SiteEditor />
        </MemoryRouter>
      );
      toSite = vi.fn();
      Object.defineProperty(iframe().contentWindow as Window, 'postMessage', { configurable: true, value: toSite });
    };
    const warmer = { ...saved, components: { ...saved.components, hero: { ...saved.components.hero, title: 'Warm title' } } };

    it("Lighty's whole-site answer keeps what the owner changed while he was thinking", async () => {
      let answer!: (value: unknown) => void;
      vi.mocked(aiService.editSite).mockReset().mockImplementation(() => new Promise((resolve) => { answer = resolve; }) as never);
      renderWithRequest('Warmer headline');
      await fromSite({ type: 'LT_READY' });
      await waitFor(() => expect(aiService.editSite).toHaveBeenCalledTimes(1));

      choose(screen.getByLabelText('siteEditor.theme.headingFont'), 'playfair');
      await act(async () => answer({ config: warmer, message: 'Done' }));

      await waitFor(() => {
        const last = lastPosted('PREVIEW_DATA')?.[0] as { config: WebConfig };
        expect(last.config.components.hero.title).toBe('Warm title');
        expect((last.config.design as Record<string, unknown>).headingFont).toBe('playfair');
      });
    });

    it("the floating Lighty's request is sent once, however often the design tab re-mounts", async () => {
      vi.mocked(aiService.editSite).mockReset().mockResolvedValue({ config: warmer, message: 'Done' } as never);
      renderWithRequest('Warmer headline');
      await fromSite({ type: 'LT_READY' });
      await waitFor(() => expect(aiService.editSite).toHaveBeenCalledTimes(1));

      for (let i = 0; i < 2; i++) {
        // Radix tabs switch on mouse down.
        fireEvent.mouseDown(screen.getByRole('tab', { name: 'siteEditor.sections.tab' }));
        expect(await screen.findByTestId('sections-panel')).toBeInTheDocument();
        fireEvent.mouseDown(screen.getByRole('tab', { name: 'siteEditor.pageSettings' }));
        expect(await screen.findByTestId('page-panel')).toBeInTheDocument();
        await act(async () => {});
      }
      expect(screen.getByTestId('page-panel')).toBeInTheDocument();
      expect(aiService.editSite).toHaveBeenCalledTimes(1);
    });

    it('edits made while Save runs stay, still unsaved', async () => {
      let stored!: () => void;
      dispatchMock.mockImplementation((action: { type: string; payload?: Record<string, unknown> }) => (action.type === 'webConfig/update'
        ? new Promise((resolve) => { stored = () => resolve({ type: 'webConfig/update/fulfilled', payload: { ...saved, ...action.payload } }); })
        : Promise.resolve(action)));
      renderEditor();
      await fromSite({ type: 'LT_READY' });
      await fromSite({ type: 'LT_SELECT', kind: 'text', path: 'components.hero.title', section: 'b1', sectionType: 'hero', count: 1 });
      const field = await screen.findByRole('textbox', { name: 'siteEditor.fields.heroTitle' });
      fireEvent.change(field, { target: { value: 'First' } });
      fireEvent.click(screen.getByText('siteEditor.save'));
      await waitFor(() => expect(updateWebConfig).toHaveBeenCalledTimes(1));

      fireEvent.change(field, { target: { value: 'First, then more' } });
      await act(async () => stored());

      await waitFor(() => expect(screen.getByText('siteEditor.save').closest('button')).toBeEnabled());
      expect(screen.getByRole('textbox', { name: 'siteEditor.fields.heroTitle' })).toHaveValue('First, then more');
    });
  });
});

/**
 * LT-380 — Erel: on the phone the tab bar itself should become the editing
 * menu and grow with the panel, as "More" grows it (LT-378).
 */
describe('the site editor on a phone (LT-380)', () => {
  const realMatchMedia = window.matchMedia;
  beforeEach(() => {
    window.matchMedia = ((query: string) => ({
      matches: query.includes('max-width'),
      media: query,
      addEventListener: (): void => undefined,
      removeEventListener: (): void => undefined,
      addListener: (): void => undefined,
      removeListener: (): void => undefined,
    })) as unknown as typeof window.matchMedia;
  });
  afterEach(() => {
    window.matchMedia = realMatchMedia;
  });

  /** The layout's bar, wired to the shared state as Sidebar wires it. */
  const Bar = () => {
    const bar = usePhoneBar()!;
    return (
      <BottomTabBar
        onMore={() => bar.setMenuOpen((open) => !open)}
        menuOpen={bar.menuOpen}
        menu={<div key="pages" data-testid="pages-menu" />}
        editing={bar.editing}
        rowRef={bar.setRowEl}
        panelRef={bar.setPanelEl}
      />
    );
  };
  const renderOnPhone = () =>
    render(
      <MemoryRouter initialEntries={['/design']}>
        <LeaveGuardProvider>
          <PhoneBarProvider>
            <SiteEditor />
            <Bar />
          </PhoneBarProvider>
        </LeaveGuardProvider>
      </MemoryRouter>
    );
  const bar = () => within(screen.getByTestId('bottom-tab-bar'));
  const tab = (id: string) => screen.getByTestId(`edit-tab-${id}`);
  const panel = () => screen.queryByTestId('editor-panel');
  const shut = () => waitFor(() => expect(panel()).toBeNull());

  it("puts the editor's tabs in the bar's row instead of the pages, and keeps More", () => {
    renderOnPhone();
    expect(bar().getAllByRole('button').map((b) => b.getAttribute('data-testid') ?? b.getAttribute('aria-label'))).toEqual([
      'edit-tab-sections', 'edit-tab-design', 'edit-tab-add', 'sidebar.openMenu',
    ]);
    expect(bar().queryByRole('link')).toBeNull();
    // No second panel beside or over the preview: it lives in the bar.
    expect(screen.queryByRole('complementary')).toBeNull();
    expect(screen.queryByLabelText('siteEditor.site')).toBeNull();
  });

  it('grows the bar with the panel: the sections, the design, the add list; the same tab closes it', async () => {
    renderOnPhone();
    expect(panel()).toBeNull();

    fireEvent.click(tab('sections'));
    expect(screen.getByTestId('bottom-tab-bar')).toContainElement(panel());
    expect(tab('sections')).toHaveAttribute('aria-pressed', 'true');
    expect(within(panel()!).getByRole('heading', { name: 'siteEditor.site' })).toBeInTheDocument();
    expect(within(panel()!).getByRole('tab', { name: 'siteEditor.sections.tab' })).toHaveAttribute('aria-selected', 'true');

    fireEvent.click(tab('design'));
    expect(tab('design')).toHaveAttribute('aria-pressed', 'true');
    expect(tab('sections')).toHaveAttribute('aria-pressed', 'false');
    expect(within(panel()!).getByRole('tab', { name: 'siteEditor.pageSettings' })).toHaveAttribute('aria-selected', 'true');

    fireEvent.click(tab('add'));
    expect(within(panel()!).getByRole('heading', { name: 'siteEditor.sections.add' })).toBeInTheDocument();

    fireEvent.click(tab('add'));
    await shut();
  });

  it('opens what was tapped on the site inside the bar, and its X closes it', async () => {
    renderOnPhone();
    await fromSite({ type: 'LT_READY' });
    await fromSite({ type: 'LT_SELECT', kind: 'text', path: 'components.hero.title', section: 'b1', sectionType: 'hero', count: 1 });
    expect(screen.getByTestId('bottom-tab-bar')).toContainElement(panel());
    expect(within(panel()!).getByDisplayValue('Old title')).toBeInTheDocument();
    // A section is being edited: the sections tab is the lit one.
    expect(tab('sections')).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(within(panel()!).getByLabelText('siteEditor.close'));
    await shut();
  });

  it('More shows the pages over the panel and keeps what is in it; an editor tab brings it back', async () => {
    renderOnPhone();
    fireEvent.click(tab('sections'));
    fireEvent.click(bar().getByRole('button', { name: 'sidebar.openMenu' }));
    expect(screen.getByTestId('pages-menu')).toBeInTheDocument();
    // Out of sight, still mounted.
    expect(screen.getByTestId('phone-bar-panel')).not.toBeVisible();
    expect(panel()).not.toBeNull();

    fireEvent.click(tab('design'));
    await waitFor(() => expect(screen.queryByTestId('pages-menu')).toBeNull());
    expect(screen.getByTestId('phone-bar-panel')).toBeVisible();
    expect(within(panel()!).getByRole('tab', { name: 'siteEditor.pageSettings' })).toHaveAttribute('aria-selected', 'true');
  });
});
