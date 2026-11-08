import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AppLockGate from '../../components/app/AppLockGate';
import AppLockOffer from '../../components/app/AppLockOffer';
import AppLockCard from '../../components/account/AppLockCard';
import { useAuth } from '../../contexts/AuthContext';
import type { AuthState } from '../../types';

const lock = vi.hoisted(() => ({
  native: true,
  enabled: false,
  /** The localStorage copy of the setting; false when the WebView's storage was cleared. */
  quickCopy: true,
  offered: false,
  support: { available: true, method: 'face' as const },
  authenticate: vi.fn(),
  setLockEnabled: vi.fn(),
  markOffered: vi.fn(),
  stateListener: null as null | ((state: { isActive: boolean }) => void),
}));

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../../lib/platform', () => ({ isNativeApp: () => lock.native, nativePlatform: () => (lock.native ? 'ios' : 'web') }));
vi.mock('@capacitor/app', () => ({
  App: {
    addListener: async (_event: string, listener: (state: { isActive: boolean }) => void) => {
      lock.stateListener = listener;
      return { remove: async () => { lock.stateListener = null; } };
    },
  },
}));
vi.mock('../../lib/appLock', () => ({
  AWAY_LOCK_MS: 5 * 60 * 1000,
  LOCK_CHANGED: 'lightor:applock',
  lockEnabledNow: () => lock.native && lock.enabled && lock.quickCopy,
  loadLockEnabled: async () => lock.native && lock.enabled,
  lockSupport: async () => (lock.native ? lock.support : { available: false, method: 'biometrics' }),
  wasOffered: async () => lock.offered,
  markOffered: lock.markOffered,
  authenticate: lock.authenticate,
  setLockEnabled: lock.setLockEnabled,
}));

const logout = vi.fn();
const signedIn = (state: Partial<AuthState> = {}) =>
  vi.mocked(useAuth).mockReturnValue({
    auth: { user: { isVerified: true } as never, token: null, isAuthenticated: true, isLoading: false, error: null, ...state },
    logout,
  } as never);

beforeEach(() => {
  lock.native = true;
  lock.enabled = false;
  lock.quickCopy = true;
  lock.offered = false;
  lock.support = { available: true, method: 'face' };
  lock.stateListener = null;
  lock.authenticate.mockReset().mockResolvedValue('ok');
  lock.setLockEnabled.mockReset().mockImplementation(async (on: boolean) => {
    lock.enabled = on;
    window.dispatchEvent(new CustomEvent('lightor:applock', { detail: on }));
  });
  lock.markOffered.mockReset().mockResolvedValue(undefined);
  logout.mockReset();
  signedIn();
});
afterEach(() => { vi.useRealTimers(); });

/** LT-617: the lock screen in front of a signed-in app. */
describe('AppLockGate (LT-617)', () => {
  it('opens behind the lock and asks the phone at once; a face opens it', async () => {
    lock.enabled = true;
    render(<AppLockGate />);

    expect(screen.getByTestId('app-lock')).toHaveTextContent('appLock.lockedTitle');
    await waitFor(() => expect(lock.authenticate).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.queryByTestId('app-lock')).toBeNull());
  });

  it('stays locked when the prompt is cancelled, and the button asks again', async () => {
    lock.enabled = true;
    lock.authenticate.mockResolvedValueOnce('cancelled');
    render(<AppLockGate />);
    await waitFor(() => expect(lock.authenticate).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId('app-lock')).toBeInTheDocument();

    await userEvent.click(await screen.findByRole('button', { name: 'appLock.unlock' }));
    await waitFor(() => expect(screen.queryByTestId('app-lock')).toBeNull());
    expect(lock.authenticate).toHaveBeenCalledTimes(2);
  });

  it('offers a way out: signing out', async () => {
    lock.enabled = true;
    lock.authenticate.mockResolvedValue('cancelled');
    render(<AppLockGate />);
    await waitFor(() => expect(lock.authenticate).toHaveBeenCalled());
    await userEvent.click(await screen.findByRole('button', { name: 'appLock.signOut' }));
    expect(logout).toHaveBeenCalled();
  });

  it('still locks at launch when only Preferences remembers the lock (the quick copy was cleared)', async () => {
    lock.enabled = true;
    lock.quickCopy = false;
    let answer: (value: string) => void = () => {};
    lock.authenticate.mockImplementationOnce(() => new Promise((resolve) => { answer = resolve; }));
    render(<AppLockGate />);

    expect(await screen.findByTestId('app-lock')).toBeInTheDocument();
    await waitFor(() => expect(lock.authenticate).toHaveBeenCalledTimes(1));
    await act(async () => { answer('ok'); });
    await waitFor(() => expect(screen.queryByTestId('app-lock')).toBeNull());
  });

  it('locks nothing with the lock off, on the web, or on the sign-in screen', () => {
    const { unmount } = render(<AppLockGate />);
    expect(screen.queryByTestId('app-lock')).toBeNull();
    unmount();

    lock.enabled = true;
    signedIn({ isAuthenticated: false, user: null });
    const second = render(<AppLockGate />);
    expect(screen.queryByTestId('app-lock')).toBeNull();
    expect(lock.authenticate).not.toHaveBeenCalled();
    second.unmount();

    lock.native = false;
    signedIn();
    render(<AppLockGate />);
    expect(screen.queryByTestId('app-lock')).toBeNull();
  });

  it('covers the pages in the background, and locks again only after 5 minutes away', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    lock.enabled = true;
    render(<AppLockGate />);
    await waitFor(() => expect(screen.queryByTestId('app-lock')).toBeNull());
    await waitFor(() => expect(lock.stateListener).not.toBeNull());

    act(() => lock.stateListener!({ isActive: false }));
    expect(screen.getByTestId('app-lock-cover')).toBeInTheDocument();
    vi.advanceTimersByTime(4 * 60 * 1000);
    act(() => lock.stateListener!({ isActive: true }));
    expect(screen.queryByTestId('app-lock-cover')).toBeNull();
    expect(screen.queryByTestId('app-lock')).toBeNull();

    act(() => lock.stateListener!({ isActive: false }));
    vi.advanceTimersByTime(6 * 60 * 1000);
    act(() => lock.stateListener!({ isActive: true }));
    expect(screen.getByTestId('app-lock')).toBeInTheDocument();
    await waitFor(() => expect(lock.authenticate).toHaveBeenCalledTimes(2));
  });

  it("does not count the phone's own prompt as leaving the app", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    lock.enabled = true;
    let answer: (value: string) => void = () => {};
    lock.authenticate.mockImplementationOnce(() => new Promise((resolve) => { answer = resolve; }));
    render(<AppLockGate />);
    await waitFor(() => expect(lock.stateListener).not.toBeNull());
    await waitFor(() => expect(lock.authenticate).toHaveBeenCalledTimes(1));

    // Face ID's sheet sends the app to the background and back on iOS.
    act(() => lock.stateListener!({ isActive: false }));
    vi.advanceTimersByTime(6 * 60 * 1000);
    act(() => lock.stateListener!({ isActive: true }));
    await act(async () => { answer('ok'); });

    await waitFor(() => expect(screen.queryByTestId('app-lock')).toBeNull());
    expect(screen.queryByTestId('app-lock-cover')).toBeNull();
    expect(lock.authenticate).toHaveBeenCalledTimes(1);
  });
});

describe('AppLockOffer (LT-617)', () => {
  it('asks once, a beat after sign-in, and marks the phone as asked', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(<AppLockOffer />);
    expect(screen.queryByTestId('app-lock-offer')).toBeNull();
    await act(async () => { await vi.advanceTimersByTimeAsync(3000); });

    expect(await screen.findByRole('dialog')).toHaveTextContent('appLock.offer.title.face');
    expect(lock.markOffered).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole('button', { name: 'appLock.offer.later' }));
    expect(screen.queryByTestId('app-lock-offer')).toBeNull();
    expect(lock.setLockEnabled).not.toHaveBeenCalled();
  });

  it('turns the lock on only after the phone recognised the owner', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(<AppLockOffer />);
    await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
    await userEvent.click(await screen.findByRole('button', { name: 'appLock.offer.enable' }));

    await waitFor(() => expect(lock.setLockEnabled).toHaveBeenCalledWith(true));
    expect(lock.authenticate).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('app-lock-offer')).toBeNull();
  });

  it('waits while a page tour or another dialog is open', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const tour = document.createElement('div');
    tour.setAttribute('aria-modal', 'true');
    document.body.appendChild(tour);
    render(<AppLockOffer />);
    await act(async () => { await vi.advanceTimersByTimeAsync(6000); });
    expect(screen.queryByTestId('app-lock-offer')).toBeNull();

    tour.remove();
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    expect(await screen.findByTestId('app-lock-offer')).toBeInTheDocument();
  });

  it('never asks twice, with the lock on, without biometrics, or on the web', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    for (const setup of [() => { lock.offered = true; }, () => { lock.enabled = true; }, () => { lock.support = { available: false, method: 'face' }; }, () => { lock.native = false; }]) {
      lock.offered = false; lock.enabled = false; lock.native = true; lock.support = { available: true, method: 'face' };
      setup();
      const view = render(<AppLockOffer />);
      await act(async () => { await vi.advanceTimersByTimeAsync(4000); });
      expect(screen.queryByTestId('app-lock-offer')).toBeNull();
      view.unmount();
    }
  });
});

describe('AppLockCard (LT-617)', () => {
  it('is not on the Account page without biometrics or on the web', async () => {
    lock.support = { available: false, method: 'face' };
    const { unmount } = render(<AppLockCard />);
    await act(async () => {});
    expect(screen.queryByTestId('app-lock-card')).toBeNull();
    unmount();
    lock.native = false;
    render(<AppLockCard />);
    await act(async () => {});
    expect(screen.queryByTestId('app-lock-card')).toBeNull();
  });

  it('switches on after the phone recognised the owner, and off at once', async () => {
    render(<AppLockCard />);
    expect(await screen.findByTestId('app-lock-card')).toHaveTextContent('appLock.card.title.face');
    const toggle = screen.getByRole('switch', { name: 'appLock.card.toggle' });

    lock.authenticate.mockResolvedValueOnce('cancelled');
    await userEvent.click(toggle);
    await waitFor(() => expect(lock.authenticate).toHaveBeenCalledTimes(1));
    expect(lock.setLockEnabled).not.toHaveBeenCalled();

    await userEvent.click(toggle);
    await waitFor(() => expect(lock.setLockEnabled).toHaveBeenCalledWith(true));

    await userEvent.click(screen.getByRole('switch', { name: 'appLock.card.toggle' }));
    await waitFor(() => expect(lock.setLockEnabled).toHaveBeenLastCalledWith(false));
    expect(lock.authenticate).toHaveBeenCalledTimes(2);
  });
});
