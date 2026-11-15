import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import BillingSection from '../../components/account/BillingSection';
import { fetchMyEntitlements } from '../../services/entitlementsApi';

const { t } = vi.hoisted(() => ({ t: vi.fn((key: string, o?: Record<string, unknown>) => (o ? `${key}:${JSON.stringify(o)}` : key)) }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t, i18n: { language: 'en' } }) }));
vi.mock('react-hot-toast', () => ({ default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));
const authState = vi.hoisted(() => ({ subscription: {} as Record<string, unknown> }));
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ auth: { user: { _id: 'u1', email: 'owner@biz.co', subscription: authState.subscription } }, refreshUser: vi.fn() }),
}));
vi.mock('../../services/paddleApi', () => ({
  PLAN_NAMES: { plus: 'Lightor+', pro: 'Lightor Pro' },
  previewPlanChange: vi.fn(),
  changePlan: vi.fn(),
  fetchUpgradePlans: vi.fn(() => Promise.resolve([])),
  createCheckout: vi.fn(),
  openInlineCheckout: vi.fn(() => Promise.resolve(true)),
  closeCheckout: vi.fn(),
  onCheckoutEvent: vi.fn(() => () => {}),
  fetchPortalLinks: vi.fn(),
  cancelSubscription: vi.fn(),
  resumeSubscription: vi.fn(),
}));
vi.mock('@number-flow/react', () => ({ default: ({ value }: { value: number }) => <span>{value}</span> }));
vi.mock('../../lib/storePurchases', async (original) => ({ ...(await original<typeof import('../../lib/storePurchases')>()), storeSalesOn: () => false }));
vi.mock('../../services/entitlementsApi', () => ({ fetchMyEntitlements: vi.fn() }));

const entitlements = (plan: 'plus' | 'pro', manualPlan: { until: string | null } | null): Record<string, unknown> => ({
  plan,
  complimentary: false,
  manualPlan,
  limits: { monthlyAppointments: null as number | null },
  usage: { appointmentsThisMonth: 3 },
  pilot: null as unknown,
  bookingTerms: { included: 500, plusIncluded: 200, extraAgorot: null as number | null },
  store: { billedBy: null, products: { plus: [] as string[], pro: [] as string[], bookingPack: [] as string[] }, packBookings: 100 },
});

beforeEach(() => vi.mocked(fetchMyEntitlements).mockReset());

/**
 * LT-662 (Erel 2026-11-15: "שפשוט יראה כמו כל מנוי"): a plan the operator set
 * by hand shows on the Account page as any active plan - no "given by
 * Lightor", nothing to pay, cancel or manage, and its end when it has one.
 */
describe('the Account page on a plan set by hand (LT-662)', () => {
  it('shows the plan as active, with nothing to buy, cancel or manage', async () => {
    authState.subscription = { status: 'free' };
    vi.mocked(fetchMyEntitlements).mockResolvedValue(entitlements('pro', { until: null }) as never);
    render(<BillingSection />);
    await waitFor(() => expect(screen.getByTestId('billing-manual')).toBeInTheDocument());
    expect(screen.getByTestId('billing-plan')).toHaveTextContent('Lightor Pro');
    expect(screen.getByText('billing.statusActive')).toBeInTheDocument();
    expect(screen.queryByTestId('billing-manual-until')).toBeNull();
    expect(screen.queryByText('billing.cancelCta')).toBeNull();
    expect(screen.queryByText('billing.manageBilling')).toBeNull();
    expect(screen.queryByTestId('plan-change')).toBeNull();
    // Nothing says it was given.
    expect(document.body.textContent).not.toMatch(/gift|complimentary/i);
  });

  it('says until when, when it has an end', async () => {
    authState.subscription = { status: 'free' };
    vi.mocked(fetchMyEntitlements).mockResolvedValue(entitlements('plus', { until: '2026-12-15T21:59:59.000Z' }) as never);
    render(<BillingSection />);
    await waitFor(() => expect(screen.getByTestId('billing-manual-until')).toHaveTextContent('billing.activeUntil'));
    expect(screen.getByTestId('billing-plan')).toHaveTextContent('Lightor+');
  });

  it("a subscriber lifted by it is not offered a move to the plan it already pays for", async () => {
    authState.subscription = { status: 'active', plan: 'plus', subscriptionId: 'sub_1', nextBillDate: '2026-12-01T00:00:00Z' };
    vi.mocked(fetchMyEntitlements).mockResolvedValue(entitlements('pro', { until: null }) as never);
    render(<BillingSection />);
    await waitFor(() => expect(screen.getByTestId('billing-plan')).toHaveTextContent('Lightor Pro'));
    expect(screen.queryByTestId('billing-manual')).toBeNull();
    expect(screen.queryByTestId('plan-change')).toBeNull();
  });
});
