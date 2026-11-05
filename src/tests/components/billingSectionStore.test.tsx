import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import toast from 'react-hot-toast';
import BillingSection from '../../components/account/BillingSection';
import { fetchUpgradePlans } from '../../services/paddleApi';

const { t } = vi.hoisted(() => ({ t: vi.fn((key: string) => key) }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t, i18n: { language: 'en' } }) }));
vi.mock('react-hot-toast', () => ({ default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));

const authState = vi.hoisted(() => ({
  subscription: { status: 'free' } as Record<string, unknown>,
  refreshUser: vi.fn(),
}));
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    auth: { user: { _id: 'u1', email: 'owner@biz.co', subscription: authState.subscription } },
    refreshUser: authState.refreshUser,
  }),
}));
// The embedded checkout's events (LT-303): the test plays Paddle.
const checkoutEvents = vi.hoisted(() => ({ emit: (() => {}) as (event: { name: string; data?: unknown }) => void }));
vi.mock('../../services/paddleApi', () => ({
  PLAN_NAMES: { plus: 'Lightor+', pro: 'Lightor Pro' },
  previewPlanChange: vi.fn(),
  changePlan: vi.fn(),
  fetchUpgradePlans: vi.fn(() =>
    Promise.resolve([{ plan: 'pro', priceId: 'p1', productName: 'Plus', formatted: '₪49', interval: 'month' }])
  ),
  createCheckout: vi.fn(),
  openInlineCheckout: vi.fn(() => Promise.resolve(true)),
  closeCheckout: vi.fn(),
  onCheckoutEvent: vi.fn((listener: (event: { name: string; data?: unknown }) => void) => {
    checkoutEvents.emit = listener;
    return () => {};
  }),
  fetchPortalLinks: vi.fn(),
  cancelSubscription: vi.fn(),
  resumeSubscription: vi.fn(),
}));
// What /entitlements/me answers: a free account with no pilot grant unless a
// test says otherwise.
const entitlementsState = vi.hoisted(() => ({ data: {} as Record<string, unknown> }));
const freeEntitlements = (): Record<string, unknown> => ({
  plan: 'free',
  limits: { monthlyAppointments: 30 },
  usage: { appointmentsThisMonth: 12 },
  pilot: null,
});
// A custom element jsdom cannot run: its update throws. The number itself is what matters here.
vi.mock('@number-flow/react', () => ({ default: ({ value }: { value: number }) => <span>{value}</span> }));

// LT-580: the stores, played by the test.
const store = vi.hoisted(() => ({
  on: true,
  offers: {
    plans: { plus: { identifier: 'plus_m', priceString: '₪89.90' }, pro: { identifier: 'pro_m', priceString: '₪119.90' } },
    pack: { identifier: 'pack_100', priceString: '₪34.90' },
  } as Record<string, unknown>,
}));
vi.mock('../../lib/storePurchases', () => ({
  storeSalesOn: () => store.on,
  loadStoreOffers: vi.fn(async () => store.offers),
  buyStoreProduct: vi.fn(async () => 'done'),
  restoreStore: vi.fn(async () => undefined),
  manageStoreUrl: vi.fn(async () => 'https://apps.apple.com/account/subscriptions'),
}));

vi.mock('../../services/entitlementsApi', () => ({
  fetchMyEntitlements: vi.fn(() => Promise.resolve(entitlementsState.data)),
}));

const w = window as unknown as { Capacitor?: unknown };
const inApp = () => {
  w.Capacitor = { isNativePlatform: () => true, getPlatform: () => 'ios' };
};

import { buyStoreProduct, loadStoreOffers, restoreStore } from '../../lib/storePurchases';

const products = { plus: ['plus_m'], pro: ['pro_m'], bookingPack: ['pack_100'] };

beforeEach(() => {
  vi.mocked(fetchUpgradePlans).mockClear();
  vi.mocked(buyStoreProduct).mockClear();
  vi.mocked(loadStoreOffers).mockClear();
  vi.mocked(restoreStore).mockClear();
  vi.mocked(toast.success).mockClear();
  authState.refreshUser.mockReset().mockResolvedValue({});
  authState.subscription = { status: 'free' };
  entitlementsState.data = { ...freeEntitlements(), bookingTerms: { included: 500, plusIncluded: 200, extraAgorot: 35 }, store: { billedBy: null, products, packBookings: 100 } };
  store.on = true;
  inApp();
});
afterEach(() => {
  delete w.Capacitor;
});

/**
 * LT-580 (Erel 2026-11-05): in the apps the plans and the booking packs are
 * the stores', with their own prices, the subscription's terms and a restore;
 * Paddle is never fetched there.
 */
describe('BillingSection with the stores (LT-580)', () => {
  it("offers both plans at the store's prices, with the renewal terms, and buys one", async () => {
    render(<BillingSection />);
    expect(await screen.findByTestId('store-plan-plus')).toHaveTextContent('₪89.90');
    expect(screen.getByTestId('store-plan-pro')).toHaveTextContent('₪119.90');
    expect(screen.getByTestId('store-plan-plus')).toHaveTextContent('billing.store.bookingsAMonth');
    expect(screen.getByTestId('store-terms')).toHaveTextContent('billing.store.renewal');
    expect(loadStoreOffers).toHaveBeenCalledWith('u1', products);
    expect(fetchUpgradePlans).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('store-buy-pro'));
    await waitFor(() => expect(buyStoreProduct).toHaveBeenCalledWith('u1', expect.objectContaining({ identifier: 'pro_m' })));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('billing.activated', expect.anything()));
    expect(authState.refreshUser).toHaveBeenCalled();
  });

  it('says nothing was bought when the owner cancels the store sheet', async () => {
    vi.mocked(buyStoreProduct).mockResolvedValueOnce('cancelled');
    render(<BillingSection />);
    fireEvent.click(await screen.findByTestId('store-buy-plus'));
    await waitFor(() => expect(buyStoreProduct).toHaveBeenCalled());
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("opens in the free days' last week only, since the store charges at once", async () => {
    entitlementsState.data = { ...entitlementsState.data, pilot: { until: new Date(Date.now() + 20 * 864e5).toISOString(), upgradeFrom: new Date(Date.now() + 13 * 864e5).toISOString() } };
    render(<BillingSection />);
    expect(await screen.findByTestId('store-not-yet')).toHaveTextContent('billing.store.opensOn');
    expect(loadStoreOffers).not.toHaveBeenCalled();
    expect(screen.queryByTestId('store-plans')).toBeNull();
  });

  it('restores purchases on request', async () => {
    render(<BillingSection />);
    fireEvent.click(await screen.findByTestId('store-restore'));
    await waitFor(() => expect(restoreStore).toHaveBeenCalledWith('u1'));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('billing.store.restored', expect.anything()));
  });

  it('sends an app subscription to its store, and sells a pack when the bookings are used', async () => {
    authState.subscription = { status: 'active', plan: 'plus', provider: 'apple' };
    entitlementsState.data = {
      ...entitlementsState.data,
      plan: 'plus',
      store: { billedBy: 'apple', products, packBookings: 100 },
      bookings: { kind: 'plus', used: 200, included: 200, periodStart: new Date().toISOString(), periodEnd: new Date(Date.now() + 9 * 864e5).toISOString(), extraAgorot: null, billedBy: 'apple', packs: { left: 0, size: 100, closed: true } },
    };
    render(<BillingSection />);
    expect(await screen.findByTestId('store-subscribed')).toHaveTextContent('billing.store.billedBy');
    expect(screen.getByTestId('store-packs')).toHaveTextContent('billing.store.packsClosed');
    expect(screen.getByTestId('store-manage')).toBeInTheDocument();
    // Nothing of Paddle's: no plan change, no cancel.
    expect(screen.queryByTestId('plan-change')).toBeNull();
    expect(screen.queryByText('billing.cancelCta')).toBeNull();
    await waitFor(() => expect(screen.getByTestId('store-buy-pack')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('store-buy-pack'));
    await waitFor(() => expect(buyStoreProduct).toHaveBeenCalledWith('u1', expect.objectContaining({ identifier: 'pack_100' })));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('billing.store.packBought', expect.anything()));
  });

  it('keeps a subscription paid on the web to the web', async () => {
    authState.subscription = { status: 'active', plan: 'pro', subscriptionId: 'sub_1' };
    entitlementsState.data = { ...entitlementsState.data, plan: 'pro' };
    render(<BillingSection />);
    await screen.findByText('billing.activeDesc');
    expect(screen.queryByTestId('store-subscribed')).toBeNull();
    expect(screen.queryByTestId('store-plans')).toBeNull();
  });

  it('sells nothing in the app when the stores are off', async () => {
    store.on = false;
    render(<BillingSection />);
    expect(await screen.findByText('billing.freeDescNative')).toBeInTheDocument();
    expect(screen.queryByTestId('store-plans')).toBeNull();
    expect(loadStoreOffers).not.toHaveBeenCalled();
  });
});
