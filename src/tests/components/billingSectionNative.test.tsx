import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import BillingSection from '../../components/account/BillingSection';
import { fetchUpgradePlans } from '../../services/paddleApi';

const { t } = vi.hoisted(() => ({ t: (key: string) => key }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t }) }));
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
vi.mock('../../services/entitlementsApi', () => ({
  fetchMyEntitlements: vi.fn(() =>
    Promise.resolve({ limits: { monthlyAppointments: 30 }, usage: { appointmentsThisMonth: 12 } })
  ),
}));

const w = window as unknown as { Capacitor?: unknown };
const inApp = () => {
  w.Capacitor = { isNativePlatform: () => true, getPlatform: () => 'ios' };
};

beforeEach(() => {
  vi.mocked(fetchUpgradePlans).mockClear();
  authState.subscription = { status: 'free' };
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
