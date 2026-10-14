import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import AppUrlOpenListener from '../../components/routing/AppUrlOpenListener';
import { useDeepLinkLeaveGuard } from '../../hooks/useAppUrlOpen';

/**
 * LT-315 — native deep links are heard on every route. The listener lived in
 * the signed-in Layout, so a universal link that opened a signed-out app
 * (handoff, verify, a password reset) went nowhere.
 */
const { listeners, isNative, confirmLeave } = vi.hoisted(() => ({
  listeners: {} as Record<string, (event: unknown) => void>,
  isNative: { value: true },
  confirmLeave: vi.fn((leave: () => void) => leave()),
}));
vi.mock('@capacitor/app', () => ({
  App: {
    addListener: vi.fn(async (name: string, fn: (event: unknown) => void) => {
      listeners[name] = fn;
      return { remove: vi.fn() };
    }),
    exitApp: vi.fn(),
  },
}));
vi.mock('../../lib/platform', () => ({ isNativeApp: () => isNative.value }));
vi.mock('../../contexts/LeaveGuardContext', () => ({
  useLeaveGuard: () => ({ confirmLeave, guardLinkClick: vi.fn(), register: () => (): void => undefined }),
}));

const Where = () => <p data-testid="where">{useLocation().pathname + useLocation().hash}</p>;
const SignedIn = () => {
  useDeepLinkLeaveGuard();
  return <Where />;
};

const open = (url: string) => act(() => listeners.appUrlOpen({ url }));

describe('native deep links (LT-315)', () => {
  beforeEach(() => {
    for (const k of Object.keys(listeners)) delete listeners[k];
    confirmLeave.mockClear();
    isNative.value = true;
  });

  it('route a signed-out app to the reset page', async () => {
    render(
      <MemoryRouter initialEntries={['/login']}>
        <AppUrlOpenListener />
        <Routes>
          <Route path="*" element={<Where />} />
        </Routes>
      </MemoryRouter>
    );
    await act(async () => {});
    open('https://dashboard.lightor.app/reset-password/tok123');
    expect(screen.getByTestId('where')).toHaveTextContent('/reset-password/tok123');
    open('https://dashboard.lightor.app/handoff#t=ho_1');
    expect(screen.getByTestId('where')).toHaveTextContent('/handoff#t=ho_1');
    expect(confirmLeave).not.toHaveBeenCalled();
  });

  it('go through the unsaved-work guard while the signed-in layout is up', async () => {
    render(
      <MemoryRouter initialEntries={['/design']}>
        <AppUrlOpenListener />
        <Routes>
          <Route path="*" element={<SignedIn />} />
        </Routes>
      </MemoryRouter>
    );
    await act(async () => {});
    open('https://dashboard.lightor.app/appointments?date=2026-10-20');
    expect(confirmLeave).toHaveBeenCalledWith(expect.any(Function), '/appointments?date=2026-10-20');
    expect(screen.getByTestId('where')).toHaveTextContent('/appointments');
  });

  it('listen for nothing on the web', async () => {
    isNative.value = false;
    render(
      <MemoryRouter>
        <AppUrlOpenListener />
      </MemoryRouter>
    );
    await act(async () => {});
    expect(listeners.appUrlOpen).toBeUndefined();
  });
});
