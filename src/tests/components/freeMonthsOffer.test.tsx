import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { FreeMonthsOfferProvider } from '../../components/onboarding/FreeMonthsOffer';
import { forgetFreeMonthsOfferHere } from '../../components/onboarding/freeMonthsMemory';
import AccountBanners from '../../components/layout/AccountBanners';
import { fetchMyEntitlements } from '../../services/entitlementsApi';
import { sendPhoneCode, verifyPhoneCode } from '../../services/phoneCodeApi';
import type { User } from '../../types';

/**
 * LT-724 (Erel 2026-11-25): the phone is offered, not demanded. An account
 * waiting for its phone, with a site, is offered the two free months once
 * (a popup with "later"); after "later" a banner stands in the layout's slot
 * until the phone is proven, and its button opens the popup on the phone.
 */
const { t, toastFn, store } = vi.hoisted(() => {
  let user: Record<string, unknown> = {};
  const subs = new Set<() => void>();
  const toastFn = Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() });
  return {
    t: (key: string) => key,
    toastFn,
    store: {
      get: () => user,
      set: (next: Record<string, unknown>) => {
        user = next;
        subs.forEach((f) => f());
      },
      sub: (f: () => void) => {
        subs.add(f);
        return () => {
          subs.delete(f);
        };
      },
      webConfig: { businessName: 'Studio' } as Record<string, unknown> | null,
      /** What the server decides when the phone is proven. */
      decides: 'granted' as 'granted' | 'withheld',
      updateUser: vi.fn(),
    },
  };
});
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t, i18n: { language: 'he' } }) }));
vi.mock('react-hot-toast', () => ({ default: toastFn }));
vi.mock('../../contexts/ThemeContext', () => ({ useTheme: () => ({ language: 'he', direction: 'rtl' }) }));
vi.mock('../../contexts/AuthContext', async () => {
  const React = await import('react');
  return {
    useAuth: () => {
      const user = React.useSyncExternalStore(store.sub, store.get);
      return { auth: { user }, updateUser: store.updateUser };
    },
  };
});
vi.mock('../../hooks/useAppSelector', () => ({
  useAppSelector: (selector: (s: unknown) => unknown) => selector({ webConfig: { data: store.webConfig } }),
}));
vi.mock('../../services/entitlementsApi', () => ({ fetchMyEntitlements: vi.fn() }));
vi.mock('../../services/phoneCodeApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../services/phoneCodeApi')>()),
  sendPhoneCode: vi.fn(),
  verifyPhoneCode: vi.fn(),
}));

const pending = (more: Partial<User> = {}) =>
  ({ _id: 'u1', name: 'Dana', role: 'user', freePeriod: { state: 'pending' }, subscription: { status: 'free' }, ...more }) as unknown as Record<string, unknown>;

const view = (path = '/', enabled = true) => (
  <MemoryRouter initialEntries={[path]}>
    <FreeMonthsOfferProvider enabled={enabled} delayMs={0}>
      <AccountBanners go={vi.fn()} />
    </FreeMonthsOfferProvider>
  </MemoryRouter>
);

/** Past the popup's own wait (0 here) and the entitlements read. */
const settle = () => act(async () => {
  await new Promise((r) => setTimeout(r, 20));
});

const dialog = () => screen.queryByTestId('free-months-offer');
const banner = () => screen.queryByTestId('free-months-banner');

const proveThePhone = async () => {
  fireEvent.change(screen.getByLabelText(/onboarding\.phoneGate\.label/), { target: { value: '0541234567' } });
  fireEvent.click(screen.getByText('onboarding.phoneGate.send'));
  fireEvent.change(await screen.findByLabelText('account.phoneCode.label'), { target: { value: '123456' } });
};

beforeEach(() => {
  vi.clearAllMocks();
  forgetFreeMonthsOfferHere();
  window.localStorage.clear();
  store.set(pending());
  store.webConfig = { businessName: 'Studio' };
  store.decides = 'granted';
  vi.mocked(fetchMyEntitlements).mockResolvedValue({ plan: 'free', limits: {}, usage: {}, paymentFailed: false } as never);
  vi.mocked(sendPhoneCode).mockResolvedValue(undefined);
  vi.mocked(verifyPhoneCode).mockResolvedValue('proof');
  store.updateUser.mockImplementation(async (data: { phone: string }) => {
    store.set({ ...store.get(), phone: data.phone, freePeriod: { state: store.decides } });
  });
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('the two free months offer (LT-724)', () => {
  it('a pending account with a site sees the popup once; "later" closes it for good and the banner stands', async () => {
    const first = render(view('/'));
    expect(await screen.findByTestId('free-months-offer')).toBeTruthy();
    expect(screen.getByRole('dialog', { name: 'onboarding.freeMonths.title' })).toBeTruthy();
    expect(screen.getByText('onboarding.freeMonths.note')).toBeTruthy();
    // Not while the popup itself is up.
    expect(banner()).toBeNull();

    fireEvent.click(screen.getByText('onboarding.freeMonths.later'));
    expect(dialog()).toBeNull();
    expect(banner()).toBeTruthy();
    expect(window.localStorage.getItem('lightor.freeMonthsLater.u1')).toBe('1');

    // The next render, and a fresh mount: no popup again.
    first.rerender(view('/appointments'));
    await settle();
    expect(dialog()).toBeNull();
    first.unmount();
    forgetFreeMonthsOfferHere();
    render(view('/'));
    await settle();
    expect(dialog()).toBeNull();
    expect(banner()).toBeTruthy();
  });

  it('Escape and the close control say "later" too', async () => {
    const { unmount } = render(view('/'));
    await screen.findByTestId('free-months-offer');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(dialog()).toBeNull();
    expect(window.localStorage.getItem('lightor.freeMonthsLater.u1')).toBe('1');
    unmount();

    window.localStorage.clear();
    forgetFreeMonthsOfferHere();
    render(view('/'));
    await screen.findByTestId('free-months-offer');
    fireEvent.click(screen.getByRole('button', { name: 'onboarding.freeMonths.close' }));
    expect(dialog()).toBeNull();
    expect(window.localStorage.getItem('lightor.freeMonthsLater.u1')).toBe('1');
  });

  it('with no storage, the popup still comes once per page load', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const first = render(view('/'));
    await screen.findByTestId('free-months-offer');
    fireEvent.click(screen.getByText('onboarding.freeMonths.later'));
    first.unmount();
    render(view('/'));
    await settle();
    expect(dialog()).toBeNull();
    expect(banner()).toBeTruthy();
  });

  it('the banner stands on every page, and its button opens the popup on the phone step', async () => {
    window.localStorage.setItem('lightor.freeMonthsLater.u1', '1');
    for (const path of ['/', '/appointments', '/settings']) {
      const { unmount } = render(view(path));
      await settle();
      expect(banner()).toBeTruthy();
      expect(dialog()).toBeNull();
      unmount();
    }
    render(view('/customers'));
    await settle();
    fireEvent.click(screen.getByText('onboarding.freeMonths.verifyNow'));
    expect(dialog()?.getAttribute('data-step')).toBe('phone');
    expect(screen.getByLabelText(/onboarding\.phoneGate\.label/)).toBeTruthy();
    expect(banner()).toBeNull();
  });

  it('"verify now" in the popup goes on to the phone and its code', async () => {
    render(view('/'));
    await screen.findByTestId('free-months-offer');
    fireEvent.click(screen.getByText('onboarding.freeMonths.verifyNow'));
    expect(dialog()?.getAttribute('data-step')).toBe('phone');
    expect(document.activeElement?.tagName).toBe('INPUT');
  });

  it('a proven phone with the months granted: popup and banner go, with the good news', async () => {
    render(view('/'));
    await screen.findByTestId('free-months-offer');
    fireEvent.click(screen.getByText('onboarding.freeMonths.verifyNow'));
    await proveThePhone();
    await waitFor(() => expect(toastFn.success).toHaveBeenCalledWith('onboarding.freeMonths.started'));
    expect(store.updateUser).toHaveBeenCalledWith({ phone: '+972541234567', phoneToken: 'proof' });
    expect(dialog()).toBeNull();
    expect(banner()).toBeNull();
    expect(toastFn).not.toHaveBeenCalled();
  });

  it('a proven phone with the months withheld: the existing notice, and popup and banner go', async () => {
    store.decides = 'withheld';
    window.localStorage.setItem('lightor.freeMonthsLater.u1', '1');
    render(view('/'));
    await settle();
    fireEvent.click(screen.getByText('onboarding.freeMonths.verifyNow'));
    await proveThePhone();
    await waitFor(() => expect(toastFn).toHaveBeenCalledWith('billing.freePeriodUsed'));
    expect(toastFn.success).not.toHaveBeenCalled();
    expect(dialog()).toBeNull();
    expect(banner()).toBeNull();
  });

  it.each([
    ['granted', pending({ freePeriod: { state: 'granted' } } as Partial<User>)],
    ['withheld', pending({ freePeriod: { state: 'withheld' } } as Partial<User>)],
    ['an admin', pending({ role: 'admin' } as Partial<User>)],
  ])('%s: never the popup nor the banner', async (_name, user) => {
    store.set(user);
    render(view('/'));
    await settle();
    expect(dialog()).toBeNull();
    expect(banner()).toBeNull();
  });

  it('no site yet: no popup and no banner', async () => {
    store.webConfig = null;
    render(view('/design'));
    await settle();
    expect(dialog()).toBeNull();
    expect(banner()).toBeNull();
  });

  it('not in the site editor, nor under the welcome card', async () => {
    const editor = render(view('/design'));
    await settle();
    expect(dialog()).toBeNull();
    editor.unmount();
    render(view('/', false));
    await settle();
    expect(dialog()).toBeNull();
  });

  it('waits for an open dialog or a page tour to close', async () => {
    const tour = document.createElement('div');
    tour.setAttribute('aria-modal', 'true');
    document.body.appendChild(tour);
    render(view('/'));
    await settle();
    expect(dialog()).toBeNull();
    tour.remove();
    expect(await screen.findByTestId('free-months-offer', {}, { timeout: 3000 })).toBeTruthy();
  });

  it('the payment banner keeps its place over the offer', async () => {
    vi.mocked(fetchMyEntitlements).mockResolvedValue({ plan: 'free', limits: {}, usage: {}, paymentFailed: true } as never);
    window.localStorage.setItem('lightor.freeMonthsLater.u1', '1');
    render(view('/'));
    expect(await screen.findByTestId('payment-failed-banner')).toBeTruthy();
    expect(banner()).toBeNull();
  });
});
