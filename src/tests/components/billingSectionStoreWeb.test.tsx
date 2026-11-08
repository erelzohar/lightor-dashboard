import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import BillingSection from '../../components/account/BillingSection';
import { fetchMyEntitlements } from '../../services/entitlementsApi';

const lang = vi.hoisted(() => ({ value: 'en' }));
const { t } = vi.hoisted(() => ({ t: vi.fn((key: string, o?: Record<string, unknown>) => (o ? `${key}:${JSON.stringify(o)}` : key)) }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t, i18n: { language: lang.value } }) }));
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
// The website: the stores sell nothing here.
vi.mock('../../lib/storePurchases', async (original) => ({ ...(await original<typeof import('../../lib/storePurchases')>()), storeSalesOn: () => false }));
vi.mock('../../services/entitlementsApi', () => ({ fetchMyEntitlements: vi.fn() }));

const proFromStore = (billedBy: 'apple' | 'google' | null): Record<string, unknown> => ({
  plan: 'pro',
  complimentary: false,
  limits: { monthlyAppointments: null as number | null },
  usage: { appointmentsThisMonth: 3 },
  pilot: null as unknown,
  bookingTerms: { included: 500, plusIncluded: 200, extraAgorot: null as number | null },
  store: { billedBy, products: { plus: [] as string[], pro: [] as string[], bookingPack: [] as string[] }, packBookings: 100 },
});

/** The plan's answer held back: what the card shows before it loads, then after. */
const heldBack = () => {
  let release: (value: unknown) => void = () => {};
  vi.mocked(fetchMyEntitlements).mockImplementation(() => new Promise((resolve) => { release = resolve as typeof release; }) as never);
  return (value: unknown) => release(value);
};

beforeEach(() => {
  vi.mocked(fetchMyEntitlements).mockReset();
  lang.value = 'en';
});

/**
 * LT-612 (Erel 2026-11-08, a Pro bought in the iPhone app): on the website the
 * card offered Paddle's "manage payments" and "cancel" before the plan loaded -
 * buttons that lead nowhere for a subscription the App Store bills - and once
 * it loaded said nothing about where the subscription is managed.
 */
describe("the website's card for a subscription a store bills (LT-612)", () => {
  it('says where it is managed and links to the App Store, before the plan loads and after, with none of Paddle\'s buttons', async () => {
    authState.subscription = { status: 'active', provider: 'apple', nextBillDate: '2026-11-08T12:00:00Z' };
    const release = heldBack();
    render(<BillingSection />);
    // Before the plan: the account already says who bills it.
    expect(screen.getByTestId('store-billed-web')).toHaveTextContent('billing.store.billedBy:{"store":"billing.store.appStore"}');
    const link = screen.getByTestId('store-manage-web');
    expect(link).toHaveAttribute('href', 'https://apps.apple.com/account/subscriptions');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveTextContent('billing.store.manage:{"store":"billing.store.appStore"}');
    expect(screen.queryByText('billing.manageBilling')).toBeNull();
    expect(screen.queryByText('billing.cancelCta')).toBeNull();
    // After it: the same, beside the plan.
    release(proFromStore('apple'));
    await waitFor(() => expect(screen.getByTestId('billing-plan')).toHaveTextContent('Lightor Pro'));
    expect(screen.getByTestId('store-manage-web')).toHaveAttribute('href', 'https://apps.apple.com/account/subscriptions');
    expect(screen.queryByText('billing.manageBilling')).toBeNull();
    expect(screen.queryByText('billing.cancelCta')).toBeNull();
    expect(screen.queryByTestId('plan-change')).toBeNull();
  });

  it('sends a Google Play subscription to Google Play', async () => {
    authState.subscription = { status: 'active', provider: 'google' };
    vi.mocked(fetchMyEntitlements).mockResolvedValue(proFromStore('google') as never);
    render(<BillingSection />);
    await waitFor(() => expect(screen.getByTestId('billing-plan')).toBeInTheDocument());
    expect(screen.getByTestId('store-billed-web')).toHaveTextContent('billing.store.googlePlay');
    expect(screen.getByTestId('store-manage-web')).toHaveAttribute('href', 'https://play.google.com/store/account/subscriptions');
  });

  it("follows the server once the plan is read: a store subscription that ended is not the store's", async () => {
    authState.subscription = { status: 'active', provider: 'apple' };
    vi.mocked(fetchMyEntitlements).mockResolvedValue(proFromStore(null) as never);
    render(<BillingSection />);
    await waitFor(() => expect(screen.getByTestId('billing-plan')).toBeInTheDocument());
    expect(screen.queryByTestId('store-billed-web')).toBeNull();
  });

  it("keeps Paddle's own buttons for a subscription paid on the website", () => {
    authState.subscription = { status: 'active', provider: 'paddle', customerId: 'ctm_1' };
    heldBack();
    render(<BillingSection />);
    expect(screen.getByText('billing.manageBilling')).toBeInTheDocument();
    expect(screen.getByText('billing.cancelCta')).toBeInTheDocument();
    expect(screen.queryByTestId('store-billed-web')).toBeNull();
  });

  it("dates the next charge in the page's language", async () => {
    lang.value = 'he';
    authState.subscription = { status: 'active', provider: 'apple', nextBillDate: '2026-11-08T12:00:00Z' };
    vi.mocked(fetchMyEntitlements).mockResolvedValue(proFromStore('apple') as never);
    render(<BillingSection />);
    expect(await screen.findByText(/8\.11\.2026/)).toBeInTheDocument();
  });
});
