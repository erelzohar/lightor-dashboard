import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, waitFor, fireEvent } from '@testing-library/react';
import SiteBuilder from '../../pages/SiteBuilder';
import { builderPass } from '../../services/authApi';
import { fetchWebConfig } from '../../store/slices/webConfigSlice';
import globals from '../../services/globals';

/**
 * LT-388 — a business with no site yet builds it with the signup wizard,
 * framed: the frame gets a builder pass and the owner's phone and email on
 * asking, and once it saved the site the account is reloaded so the editor
 * opens. Only the frame, on the register's origin, is listened to.
 */
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'he' } }) }));
const auth = vi.hoisted(() => ({
  user: { _id: 'u1', phone: '0584006014', email: 'owner@example.com' } as Record<string, unknown>,
  refreshUser: vi.fn(),
}));
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ auth: { user: auth.user }, refreshUser: auth.refreshUser }),
}));
vi.mock('../../services/authApi', () => ({ builderPass: vi.fn() }));
vi.mock('../../store/slices/webConfigSlice', () => ({
  fetchWebConfig: vi.fn((id: string) => ({ type: 'webConfig/fetch', id })),
}));
const dispatchMock = vi.hoisted(() => vi.fn());
vi.mock('../../hooks/useAppDispatch', () => ({ useAppDispatch: () => dispatchMock }));

const frame = () => screen.getByTitle('siteBuilder.frameTitle') as HTMLIFrameElement;
const fromFrame = (data: unknown, origin = globals.registerOrigin, source: Window | null = frame().contentWindow) =>
  act(async () => {
    window.dispatchEvent(new MessageEvent('message', { data, origin, source }));
  });

describe('SiteBuilder', () => {
  beforeEach(() => {
    vi.mocked(builderPass).mockReset();
    auth.refreshUser.mockReset();
    dispatchMock.mockReset();
    vi.mocked(fetchWebConfig).mockClear();
  });

  it("frames the signup wizard in the owner's language, with a spinner until it loads", () => {
    render(<SiteBuilder />);
    expect(frame().src).toBe(`${globals.registerOrigin}/?embed=app&lang=he`);
    expect(screen.getByRole('status')).toBeInTheDocument();
    fireEvent.load(frame());
    expect(screen.queryByRole('status')).toBeNull();
  });

  it("hands the frame a pass and the owner's phone and email, on the register's origin only", async () => {
    vi.mocked(builderPass).mockResolvedValue('pass-1');
    render(<SiteBuilder />);
    const post = vi.spyOn(frame().contentWindow!, 'postMessage');

    await fromFrame({ type: 'LT_BUILDER_NEED_PASS' });
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(
        { type: 'LT_BUILDER_PASS', token: 'pass-1', phone: '0584006014', email: 'owner@example.com' },
        globals.registerOrigin,
      ),
    );
  });

  it('ignores another origin, and any window but the frame', async () => {
    vi.mocked(builderPass).mockResolvedValue('pass-1');
    render(<SiteBuilder />);
    await fromFrame({ type: 'LT_BUILDER_NEED_PASS' }, 'https://evil.example');
    await fromFrame({ type: 'LT_BUILDER_NEED_PASS' }, globals.registerOrigin, window);
    await fromFrame({ type: 'LT_BUILDER_DONE', webConfigId: 'wc-1' }, 'https://evil.example');
    expect(builderPass).not.toHaveBeenCalled();
    expect(auth.refreshUser).not.toHaveBeenCalled();
  });

  it('reloads the account once the site is saved, so the editor opens on it', async () => {
    auth.refreshUser.mockResolvedValue({ _id: 'u1', webConfig_id: 'wc-1' });
    render(<SiteBuilder />);
    await fromFrame({ type: 'LT_BUILDER_DONE', webConfigId: 'wc-1' });
    expect(auth.refreshUser).toHaveBeenCalled();
    // The editor's page fetches the site the account now names.
    expect(dispatchMock).not.toHaveBeenCalled();
  });

  it('loads the saved site itself when the account does not reload', async () => {
    auth.refreshUser.mockResolvedValue(null);
    render(<SiteBuilder />);
    await fromFrame({ type: 'LT_BUILDER_DONE', webConfigId: 'wc-1' });
    await waitFor(() => expect(fetchWebConfig).toHaveBeenCalledWith('wc-1'));
    expect(dispatchMock).toHaveBeenCalledWith({ type: 'webConfig/fetch', id: 'wc-1' });
  });

  // LT-485 (Erel's iPhone): the room kept for the tab bar stayed while the
  // keyboard was up (the bar hides then), a black band right above the keys.
  it('keeps room for the tab bar, but not while the keyboard is up', () => {
    const viewport = { height: 800, addEventListener: vi.fn(), removeEventListener: vi.fn() };
    const had = Object.getOwnPropertyDescriptor(window, 'visualViewport');
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: viewport });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 });
    try {
      const { unmount } = render(<SiteBuilder />);
      expect(screen.getByTestId('site-builder').className).toContain('pb-[calc(4.5rem+env(safe-area-inset-bottom))]');
      unmount();

      viewport.height = 420;
      render(<SiteBuilder />);
      const page = screen.getByTestId('site-builder');
      expect(page.className).not.toContain('pb-[calc(4.5rem');
      expect(page.className).toContain('pb-0');
    } finally {
      if (had) Object.defineProperty(window, 'visualViewport', had);
      else delete (window as { visualViewport?: unknown }).visualViewport;
    }
  });
});
