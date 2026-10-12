import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, waitFor, act } from '@testing-library/react';
import AiBuilder from '../../pages/AiBuilder';

const { t } = vi.hoisted(() => ({ t: (key: string) => key }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t, i18n: { language: 'en' } }) }));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn(), useLocation: () => ({ state: null as unknown }) }));
vi.mock('../../contexts/ThemeContext', () => ({ useTheme: () => ({ direction: 'ltr' }) }));
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ auth: { user: { _id: 'u1', webConfig_id: 'wc1', boardingStatus: 'active' } }, updateUser: vi.fn() }),
}));
vi.mock('../../services/aiApi', () => ({
  aiService: { editSite: vi.fn(), generateSite: vi.fn() },
  trimHistory: (messages: unknown[]) => messages,
}));
vi.mock('../../store/slices/webConfigSlice', () => ({
  fetchWebConfig: vi.fn(() => ({ type: 'webConfig/fetch' })),
  updateWebConfig: vi.fn(),
  createWebConfig: vi.fn(),
}));
const state = vi.hoisted(() => ({
  webConfig: { data: { _id: 'wc1', businessName: 'Biz', subDomain: 'biz', components: { hero: { title: 'Biz' } } } as unknown },
}));
vi.mock('../../hooks/useAppSelector', () => ({
  useAppSelector: (selector: (s: typeof state) => unknown): unknown => selector(state),
}));
vi.mock('../../hooks/useAppDispatch', () => ({ useAppDispatch: () => vi.fn() }));

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

const wait = (ms: number) => act(() => new Promise((r) => setTimeout(r, ms)));

/** The preview iframe, with a stand-in window that records what the page posts to the site. */
const setup = async () => {
  render(<AiBuilder />);
  const iframe = document.querySelector('iframe[title="Preview"]') as HTMLIFrameElement;
  expect(iframe).not.toBeNull();
  const post = vi.fn();
  const win = { postMessage: post };
  Object.defineProperty(iframe, 'contentWindow', { value: win, configurable: true });
  return { iframe, post, win };
};
const ready = (source: unknown) =>
  act(() => {
    const e = new MessageEvent('message', { data: { type: 'LT_READY' } });
    Object.defineProperty(e, 'source', { value: source });
    window.dispatchEvent(e);
  });
const previewMessages = (post: ReturnType<typeof vi.fn>) =>
  post.mock.calls.filter(([m]) => (m as { type?: string })?.type === 'PREVIEW_DATA');

/**
 * LT-255 (the register's LT-254): Safari fires the iframe's `load` for a jump
 * within the page — a button in the site that goes to #schedule — and the page
 * answered every `load` by sending the whole draft again.
 */
describe('AI builder preview bridge', () => {
  beforeEach(() => { vi.useRealTimers(); });

  it('sends the draft when the site says it is ready', async () => {
    const { post, win } = await setup();
    await ready(win);
    await waitFor(() => expect(previewMessages(post)).toHaveLength(1));
    expect(previewMessages(post)[0][0]).toMatchObject({ type: 'PREVIEW_DATA', config: { businessName: 'Biz' } });
  });

  it('leaves the site alone when Safari fires `load` for a jump within the page', async () => {
    const { iframe, post, win } = await setup();
    await ready(win);
    await waitFor(() => expect(previewMessages(post)).toHaveLength(1));
    act(() => { iframe.dispatchEvent(new Event('load')); });
    await wait(700);
    expect(previewMessages(post)).toHaveLength(1);
  });

  it('sends it again after a real reload — the site says it is ready again', async () => {
    const { post, win } = await setup();
    await ready(win);
    await ready(win);
    await waitFor(() => expect(previewMessages(post)).toHaveLength(2));
  });

  it('ignores LT_READY from any other window', async () => {
    const { post } = await setup();
    await ready({ postMessage: vi.fn() });
    await wait(100);
    expect(previewMessages(post)).toHaveLength(0);
  });

  it('still talks to an older site that never says LT_READY, after its load', async () => {
    const { iframe, post } = await setup();
    act(() => { iframe.dispatchEvent(new Event('load')); });
    await waitFor(() => expect(previewMessages(post)).toHaveLength(1), { timeout: 2000 });
  });
});
