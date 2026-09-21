import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import BillingSection from '../../components/account/BillingSection';
import { fetchUpgradePlans } from '../../services/paddleApi';

const { t } = vi.hoisted(() => ({ t: vi.fn((key: string) => key) }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t, i18n: { language: 'en' } }) }));
vi.mock('react-hot-toast', () => ({ default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));

const authState = vi.hoisted(() => ({ subscription: { status: 'free' } as Record<string, unknown> }));
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ auth: { user: { subscription: authState.subscription } }, refreshUser: vi.fn() }),
}));
vi.mock('../../services/paddleApi', () => ({
  fetchUpgradePlans: vi.fn(() =>
    Promise.resolve([{ priceId: 'p1', productName: 'Plus', formatted: '₪49', interval: 'month' }])
  ),
  openUpgradeCheckout: vi.fn(),
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
vi.mock('../../services/entitlementsApi', () => ({
  fetchMyEntitlements: vi.fn(() => Promise.resolve(entitlementsState.data)),
}));

const w = window as unknown as { Capacitor?: unknown };
const inApp = () => {
  w.Capacitor = { isNativePlatform: () => true, getPlatform: () => 'ios' };
};

beforeEach(() => {
  vi.mocked(fetchUpgradePlans).mockClear();
  authState.subscription = { status: 'free' };
  entitlementsState.data = freeEntitlements();
});
afterEach(() => {
  delete w.Capacitor;
});

/**
 * In the app the subscription card only reports the plan (LT-130, App Store
 * 3.1.1): no prices, no upgrade, no cancel or resume. On the web every one of
 * those stays.
 */
describe('BillingSection', () => {
  it('offers plans and checkout on the web', async () => {
    render(<BillingSection />);
    expect(await screen.findByText('billing.upgrade')).toBeInTheDocument();
    expect(screen.getByText('₪49')).toBeInTheDocument();
    expect(fetchUpgradePlans).toHaveBeenCalled();
  });

  it('shows a free account its plan and usage in the app, and nothing to buy', async () => {
    inApp();
    render(<BillingSection />);
    expect(await screen.findByText('billing.usageMeter')).toBeInTheDocument();
    expect(screen.getByText('billing.freeDescNative')).toBeInTheDocument();
    expect(screen.queryByText('billing.freeDesc')).not.toBeInTheDocument();
    expect(screen.queryByText('billing.upgrade')).not.toBeInTheDocument();
    expect(screen.queryByText('₪49')).not.toBeInTheDocument();
    // Prices are never even fetched in the app.
    expect(fetchUpgradePlans).not.toHaveBeenCalled();
  });

  it('shows a paying account its plan in the app without cancel', async () => {
    inApp();
    authState.subscription = { status: 'active', nextBillDate: '2026-10-01' };
    render(<BillingSection />);
    expect(screen.getByText('billing.activeDesc')).toBeInTheDocument();
    expect(screen.queryByText('billing.cancelCta')).not.toBeInTheDocument();
    await waitFor(() => expect(fetchUpgradePlans).not.toHaveBeenCalled());
  });

  it('offers no resume in the app when a cancellation is scheduled', () => {
    inApp();
    authState.subscription = { status: 'active', cancelAtPeriodEnd: true, nextBillDate: '2026-10-01' };
    render(<BillingSection />);
    expect(screen.queryByText('billing.resumeCta')).not.toBeInTheDocument();
  });
});

/**
 * Pilot grant (LT-187): the server resolves a fresh account to Plus and says
 * until when. The card then states that in place of the free-plan copy —
 * which would claim a cap the account does not have — dated in the UI's
 * language. A statement about the account, not an offer, so it shows in the
 * app as well.
 */
describe('BillingSection pilot grant', () => {
  const PILOT_UNTIL = '2026-11-21T10:00:00.000Z';
  const pilotEntitlements = (): Record<string, unknown> => ({
    plan: 'plus',
    limits: { monthlyAppointments: null },
    usage: { appointmentsThisMonth: 12 },
    pilot: { until: PILOT_UNTIL },
  });

  it('says nothing about a pilot when the server reports none', async () => {
    render(<BillingSection />);
    expect(await screen.findByText('billing.usageMeter')).toBeInTheDocument();
    expect(screen.getByText('billing.freeDesc')).toBeInTheDocument();
    expect(screen.queryByText('billing.pilotLine')).not.toBeInTheDocument();
  });

  it('shows the dated pilot line instead of the free-plan copy while the grant applies', async () => {
    entitlementsState.data = pilotEntitlements();
    render(<BillingSection />);
    expect(await screen.findByText('billing.pilotLine')).toBeInTheDocument();
    expect(t).toHaveBeenCalledWith('billing.pilotLine', {
      date: new Date(PILOT_UNTIL).toLocaleDateString('en-GB'),
    });
    expect(screen.queryByText('billing.freeDesc')).not.toBeInTheDocument();
    // No cap under the grant, so no meter either.
    expect(screen.queryByText('billing.usageMeter')).not.toBeInTheDocument();
  });

  it('offers nothing to buy on the web either while the grant applies', async () => {
    entitlementsState.data = pilotEntitlements();
    render(<BillingSection />);
    expect(await screen.findByText('billing.pilotLine')).toBeInTheDocument();
    expect(screen.queryByText('billing.upgrade')).not.toBeInTheDocument();
    expect(screen.queryByText('₪49')).not.toBeInTheDocument();
    expect(screen.queryByText('billing.loadingPlans')).not.toBeInTheDocument();
  });

  it('shows the pilot line in the app too, still with nothing to buy', async () => {
    inApp();
    entitlementsState.data = pilotEntitlements();
    render(<BillingSection />);
    expect(await screen.findByText('billing.pilotLine')).toBeInTheDocument();
    expect(screen.queryByText('billing.freeDescNative')).not.toBeInTheDocument();
    expect(screen.queryByText('billing.upgrade')).not.toBeInTheDocument();
    expect(fetchUpgradePlans).not.toHaveBeenCalled();
  });
});
