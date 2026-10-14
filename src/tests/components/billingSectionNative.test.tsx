import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import toast from 'react-hot-toast';
import BillingSection from '../../components/account/BillingSection';
import {
  fetchUpgradePlans,
  createCheckout,
  openInlineCheckout,
  closeCheckout,
  fetchPortalLinks,
  type PortalLinks,
} from '../../services/paddleApi';
import { stubLocation } from '../helpers/location';

const { t } = vi.hoisted(() => ({ t: vi.fn((key: string) => key) }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t, i18n: { language: 'en' } }) }));
vi.mock('react-hot-toast', () => ({ default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));

const authState = vi.hoisted(() => ({
  subscription: { status: 'free' } as Record<string, unknown>,
  refreshUser: vi.fn(),
}));
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    auth: { user: { email: 'owner@biz.co', subscription: authState.subscription } },
    refreshUser: authState.refreshUser,
  }),
}));
// The embedded checkout's events (LT-303): the test plays Paddle.
const checkoutEvents = vi.hoisted(() => ({ emit: (() => {}) as (event: { name: string; data?: unknown }) => void }));
vi.mock('../../services/paddleApi', () => ({
  fetchUpgradePlans: vi.fn(() =>
    Promise.resolve([{ priceId: 'p1', productName: 'Plus', formatted: '₪49', interval: 'month' }])
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
vi.mock('../../services/entitlementsApi', () => ({
  fetchMyEntitlements: vi.fn(() => Promise.resolve(entitlementsState.data)),
}));

const w = window as unknown as { Capacitor?: unknown };
const inApp = () => {
  w.Capacitor = { isNativePlatform: () => true, getPlatform: () => 'ios' };
};

beforeEach(() => {
  vi.mocked(fetchUpgradePlans).mockClear();
  vi.mocked(createCheckout).mockReset();
  vi.mocked(openInlineCheckout).mockClear();
  vi.mocked(closeCheckout).mockClear();
  vi.mocked(fetchPortalLinks).mockReset();
  vi.mocked(toast).mockClear();
  vi.mocked(toast.error).mockClear();
  authState.refreshUser.mockReset();
  authState.subscription = { status: 'free' };
  entitlementsState.data = freeEntitlements();
});
afterEach(() => {
  delete w.Capacitor;
  vi.restoreAllMocks();
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
  // LT-290: the plans open a week before the grant ends; `open` puts today in that week.
  const pilotEntitlements = (open = false): Record<string, unknown> => ({
    plan: 'plus',
    limits: { monthlyAppointments: null },
    usage: { appointmentsThisMonth: 12 },
    pilot: {
      until: PILOT_UNTIL,
      upgradeFrom: open ? new Date(Date.now() - 60_000).toISOString() : new Date(Date.now() + 86_400_000).toISOString(),
    },
  });

  it('says nothing about a pilot when the server reports none', async () => {
    render(<BillingSection />);
    expect(await screen.findByText('billing.usageMeter')).toBeInTheDocument();
    expect(screen.getByText('billing.freeDesc')).toBeInTheDocument();
    expect(screen.queryByText('billing.pilotLine')).not.toBeInTheDocument();
    expect(screen.queryByText('billing.pilotSubscribeNote')).not.toBeInTheDocument();
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

  /**
   * LT-290: the free period is the system's own — nothing to buy, and Paddle
   * not even loaded, until its last week.
   */
  it('offers nothing before the last week, saying a reminder will come', async () => {
    entitlementsState.data = pilotEntitlements(false);
    render(<BillingSection />);
    expect(await screen.findByText('billing.pilotUpgradeLater')).toBeInTheDocument();
    expect(screen.queryByText('billing.pilotSubscribeNote')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'billing.subscribe' })).not.toBeInTheDocument();
    expect(fetchUpgradePlans).not.toHaveBeenCalled();
  });

  /**
   * LT-265 + LT-290: in the last week an owner may subscribe; the first charge
   * comes when the free period ends. So the plans are on offer, under a line
   * saying when the first charge is.
   */
  it('offers the plans on the web in the last week, saying when the first charge comes', async () => {
    entitlementsState.data = pilotEntitlements(true);
    render(<BillingSection />);
    expect(await screen.findByText('billing.pilotSubscribeNote')).toBeInTheDocument();
    expect(t).toHaveBeenCalledWith('billing.pilotSubscribeNote', {
      date: new Date(PILOT_UNTIL).toLocaleDateString('en-GB'),
    });
    expect(screen.getByText('₪49')).toBeInTheDocument();
    // "Subscribe", not "Upgrade": the account has Plus already.
    expect(screen.getByRole('button', { name: 'billing.subscribe' })).toBeInTheDocument();
    expect(screen.queryByText('billing.upgrade')).not.toBeInTheDocument();
  });

  it('shows the pilot line in the app too, still with nothing to buy', async () => {
    inApp();
    entitlementsState.data = pilotEntitlements();
    render(<BillingSection />);
    expect(await screen.findByText('billing.pilotLine')).toBeInTheDocument();
    expect(screen.queryByText('billing.freeDescNative')).not.toBeInTheDocument();
    expect(screen.queryByText('billing.upgrade')).not.toBeInTheDocument();
    expect(screen.queryByText('billing.subscribe')).not.toBeInTheDocument();
    expect(screen.queryByText('billing.pilotSubscribeNote')).not.toBeInTheDocument();
    expect(fetchUpgradePlans).not.toHaveBeenCalled();
  });
});

/** The leads meter (LT-197): a second meter on a capped plan, none on Plus. */
describe('BillingSection leads meter', () => {
  it('shows the month’s leads against the cap on a free plan', async () => {
    entitlementsState.data = {
      ...freeEntitlements(),
      limits: { monthlyAppointments: 30, monthlyLeads: 15 },
      usage: { appointmentsThisMonth: 12, leadsThisMonth: 15 },
    };
    render(<BillingSection />);
    expect(await screen.findByTestId('leads-meter')).toBeInTheDocument();
    expect(t).toHaveBeenCalledWith('billing.leadsMeter', { used: 15, cap: 15 });
    expect(screen.getByText('billing.leadsFull')).toBeInTheDocument();
  });

  it('hides it when leads are unlimited', async () => {
    entitlementsState.data = { ...freeEntitlements(), limits: { monthlyAppointments: 30, monthlyLeads: null } };
    render(<BillingSection />);
    expect(await screen.findByText('billing.usageMeter')).toBeInTheDocument();
    expect(screen.queryByTestId('leads-meter')).not.toBeInTheDocument();
  });
});

/**
 * A leads site (LT-199) takes no bookings: its card measures the plan by the
 * leads meter alone, in copy that fits either kind of site.
 */
describe('BillingSection on a leads site', () => {
  const capped = (): Record<string, unknown> => ({
    ...freeEntitlements(),
    limits: { monthlyAppointments: 30, monthlyLeads: 15 },
    usage: { appointmentsThisMonth: 12, leadsThisMonth: 4 },
  });

  it('shows the leads meter and no appointments meter', async () => {
    entitlementsState.data = capped();
    render(<BillingSection leadsSite />);
    expect(await screen.findByTestId('leads-meter')).toBeInTheDocument();
    expect(t).toHaveBeenCalledWith('billing.leadsMeter', { used: 4, cap: 15 });
    expect(screen.queryByTestId('appointments-meter')).not.toBeInTheDocument();
    expect(screen.queryByText('billing.usageMeter')).not.toBeInTheDocument();
    expect(screen.getByText('billing.freeDesc')).toBeInTheDocument();
  });

  it('keeps both meters on a booking site', async () => {
    entitlementsState.data = capped();
    render(<BillingSection />);
    expect(await screen.findByTestId('leads-meter')).toBeInTheDocument();
    expect(screen.getByTestId('appointments-meter')).toBeInTheDocument();
  });
});

/**
 * The checkout (LT-265, LT-303): the server prepares the transaction, the card
 * makes room and Paddle draws the checkout into it, with the order summary
 * beside it in Paddle's own numbers; the card says what a refusal means.
 */
describe('BillingSection checkout', () => {
  const trial = { transactionId: 'txn_1', trialDays: 5, firstChargeAt: '2026-10-18T13:48:00.000Z' };
  const loaded = {
    name: 'checkout.loaded',
    data: {
      currency_code: 'ILS',
      totals: { subtotal: 0, tax: 0, discount: 0, total: 0 },
      recurring_totals: { subtotal: 119, tax: 0, discount: 0, total: 119 },
      items: [] as unknown[],
    },
  };

  it('draws the checkout into the card for the chosen plan, the signed-in owner and the dashboard language', async () => {
    vi.mocked(createCheckout).mockResolvedValue({ transactionId: 'txn_1', trialDays: 0, firstChargeAt: null });
    render(<BillingSection />);
    fireEvent.click(await screen.findByRole('button', { name: 'billing.upgrade' }));

    expect(await screen.findByTestId('inline-checkout')).toBeInTheDocument();
    expect(createCheckout).toHaveBeenCalledWith('p1');
    await waitFor(() => expect(openInlineCheckout).toHaveBeenCalledTimes(1));
    expect(openInlineCheckout).toHaveBeenCalledWith(
      expect.objectContaining({
        transactionId: 'txn_1',
        email: 'owner@biz.co',
        language: 'en',
        frameTarget: 'paddle-checkout-frame',
        theme: 'light',
      })
    );
    expect(document.querySelector('.paddle-checkout-frame')).not.toBeNull();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("sums the order up in Paddle's numbers, with the first charge on the server's date", async () => {
    vi.mocked(createCheckout).mockResolvedValue(trial);
    render(<BillingSection />);
    fireEvent.click(await screen.findByRole('button', { name: 'billing.upgrade' }));
    await waitFor(() => expect(openInlineCheckout).toHaveBeenCalled());
    expect(screen.getByText('billing.checkout.loading')).toBeInTheDocument();

    act(() => checkoutEvents.emit(loaded));
    expect(screen.getByTestId('checkout-due-today')).toHaveTextContent(/0\.00/);
    expect(screen.getByTestId('checkout-first-charge')).toHaveTextContent(/119\.00/);
    expect(t).toHaveBeenCalledWith('billing.checkout.firstCharge', { date: '18/10/2026' });
    expect(t).toHaveBeenCalledWith('billing.checkout.cancelBefore', { date: '18/10/2026' });
  });

  it('goes back to the plans and closes the checkout', async () => {
    vi.mocked(createCheckout).mockResolvedValue(trial);
    render(<BillingSection />);
    fireEvent.click(await screen.findByRole('button', { name: 'billing.upgrade' }));
    fireEvent.click(await screen.findByRole('button', { name: 'billing.checkout.back' }));

    expect(screen.queryByTestId('inline-checkout')).toBeNull();
    expect(closeCheckout).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'billing.upgrade' })).toBeInTheDocument();
  });

  it('waits for the webhook once the payment is done', async () => {
    vi.mocked(createCheckout).mockResolvedValue(trial);
    render(<BillingSection />);
    fireEvent.click(await screen.findByRole('button', { name: 'billing.upgrade' }));
    await waitFor(() => expect(openInlineCheckout).toHaveBeenCalled());

    const { onCompleted } = vi.mocked(openInlineCheckout).mock.calls[0][0];
    act(() => onCompleted?.());
    expect(screen.queryByTestId('inline-checkout')).toBeNull();
    expect(screen.getByText('billing.processingHint')).toBeInTheDocument();
  });

  it('says so and re-reads the account when it is subscribed already (409)', async () => {
    vi.mocked(createCheckout).mockRejectedValue({ response: { status: 409 } });
    render(<BillingSection />);
    fireEvent.click(await screen.findByRole('button', { name: 'billing.upgrade' }));
    await waitFor(() => expect(toast).toHaveBeenCalledWith('billing.alreadySubscribed'));
    expect(authState.refreshUser).toHaveBeenCalled();
    expect(openInlineCheckout).not.toHaveBeenCalled();
  });

  it('reports an unavailable checkout when billing is down (503)', async () => {
    vi.mocked(createCheckout).mockRejectedValue({ response: { status: 503 } });
    render(<BillingSection />);
    fireEvent.click(await screen.findByRole('button', { name: 'billing.upgrade' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('billing.checkoutUnavailable'));
    // The button is free again for another try.
    await waitFor(() => expect(screen.getByRole('button', { name: 'billing.upgrade' })).toBeEnabled());
  });
});

/**
 * Paddle's customer portal (LT-265): payment method and invoices for an
 * account Paddle knows. Its links are fresh per visit, so the new tab is
 * opened inside the click and sent on when the link arrives.
 */
describe('BillingSection payment management', () => {
  const OVERVIEW = 'https://customer-portal.paddle.com/cpl_1?action=overview';
  const UPDATE = 'https://customer-portal.paddle.com/cpl_1?action=update';
  const blankTab = () => ({ opener: window as unknown, location: { href: '' }, close: vi.fn() });

  it('opens the portal in a new tab opened inside the click', async () => {
    authState.subscription = { status: 'active', customerId: 'ctm_1', nextBillDate: '2026-11-21' };
    let answer!: (links: PortalLinks) => void;
    vi.mocked(fetchPortalLinks).mockReturnValue(new Promise((resolve) => { answer = resolve; }));
    const tab = blankTab();
    const open = vi.spyOn(window, 'open').mockReturnValue(tab as unknown as Window);
    render(<BillingSection />);

    fireEvent.click(screen.getByRole('button', { name: 'billing.manageBilling' }));
    // Before the link exists: the click is the one moment a popup is allowed.
    expect(open).toHaveBeenCalledWith('', '_blank');
    expect(tab.opener).toBeNull();
    expect(fetchPortalLinks).toHaveBeenCalledTimes(1);

    answer({ overview: OVERVIEW, updatePaymentMethod: UPDATE });
    await waitFor(() => expect(tab.location.href).toBe(OVERVIEW));
  });

  it('opens the portal in this tab when the popup is blocked', async () => {
    authState.subscription = { status: 'canceled', customerId: 'ctm_1' };
    vi.mocked(fetchPortalLinks).mockResolvedValue({ overview: OVERVIEW });
    vi.spyOn(window, 'open').mockReturnValue(null);
    const { assign } = stubLocation('https://dashboard.lightor.app/account');
    render(<BillingSection />);

    // A plan that ended still has its invoices.
    fireEvent.click(await screen.findByRole('button', { name: 'billing.manageBilling' }));
    await waitFor(() => expect(assign).toHaveBeenCalledWith(OVERVIEW));
  });

  it('says when Paddle has no customer for the account yet (400), and closes the blank tab', async () => {
    authState.subscription = { status: 'active' };
    vi.mocked(fetchPortalLinks).mockRejectedValue({ response: { status: 400 } });
    const tab = blankTab();
    vi.spyOn(window, 'open').mockReturnValue(tab as unknown as Window);
    render(<BillingSection />);

    fireEvent.click(screen.getByRole('button', { name: 'billing.manageBilling' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('billing.portalNoAccount'));
    expect(tab.close).toHaveBeenCalled();
    expect(tab.location.href).toBe('');
  });

  it('is not offered to an account that never paid', async () => {
    render(<BillingSection />);
    expect(await screen.findByText('billing.upgrade')).toBeInTheDocument();
    expect(screen.queryByText('billing.manageBilling')).not.toBeInTheDocument();
  });

  it('warns a past-due account and opens the payment-method update', async () => {
    authState.subscription = { status: 'past_due', customerId: 'ctm_1' };
    vi.mocked(fetchPortalLinks).mockResolvedValue({ overview: OVERVIEW, updatePaymentMethod: UPDATE });
    const tab = blankTab();
    vi.spyOn(window, 'open').mockReturnValue(tab as unknown as Window);
    render(<BillingSection />);

    expect(screen.getByText('billing.pastDueDesc')).toBeInTheDocument();
    expect(screen.getByText('billing.statusPastDue')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'billing.manageBilling' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'billing.updatePaymentMethod' }));
    await waitFor(() => expect(tab.location.href).toBe(UPDATE));
    // Buying again is not the way back: no plans while a payment is due.
    await waitFor(() => expect(fetchUpgradePlans).toHaveBeenCalled());
    expect(screen.queryByText('billing.upgrade')).not.toBeInTheDocument();
    expect(screen.queryByText('billing.freeDesc')).not.toBeInTheDocument();
  });

  it('offers no payment management in the app, past due or paying', async () => {
    inApp();
    authState.subscription = { status: 'past_due', customerId: 'ctm_1' };
    const { unmount } = render(<BillingSection />);
    expect(await screen.findByText('billing.freeDescNative')).toBeInTheDocument();
    expect(screen.queryByText('billing.pastDueDesc')).not.toBeInTheDocument();
    expect(screen.queryByText('billing.updatePaymentMethod')).not.toBeInTheDocument();
    expect(screen.queryByText('billing.manageBilling')).not.toBeInTheDocument();
    unmount();

    authState.subscription = { status: 'active', customerId: 'ctm_1', nextBillDate: '2026-11-21' };
    render(<BillingSection />);
    expect(screen.getByText('billing.activeDesc')).toBeInTheDocument();
    expect(screen.queryByText('billing.manageBilling')).not.toBeInTheDocument();
  });
});

/**
 * LT-310 — the operator's account is Plus for good: the card says so and
 * offers nothing to buy, cancel or manage, even over an old subscription
 * record left from the sandbox days.
 */
describe('BillingSection for the admin account', () => {
  it('shows Plus and nothing to buy, cancel or manage', async () => {
    entitlementsState.data = { ...freeEntitlements(), plan: 'plus', complimentary: true, limits: { monthlyAppointments: null } };
    authState.subscription = { status: 'active', subscriptionId: 'sub_old', customerId: 'ctm_old' };
    render(<BillingSection />);

    expect(await screen.findByTestId('billing-complimentary')).toHaveTextContent('billing.complimentary');
    expect(screen.getByText('Plus')).toBeInTheDocument();
    expect(fetchUpgradePlans).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'billing.upgrade' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'billing.subscribe' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'billing.manageBilling' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'billing.cancelCta' })).toBeNull();
  });
});

/** LT-315 (M6 and a Low): Paddle.js or the plan failing to load never leaves a spinner, or an offer. */
describe('BillingSection when something fails to load', () => {
  it('says the plans are unavailable when Paddle.js does not load', async () => {
    vi.mocked(fetchUpgradePlans).mockRejectedValueOnce(new Error('Failed to load Paddle.js'));
    render(<BillingSection />);
    expect(await screen.findByText('billing.plansUnavailable')).toBeInTheDocument();
    expect(screen.queryByText('billing.loadingPlans')).not.toBeInTheDocument();
  });

  it('offers nothing when the account plan could not be read', async () => {
    entitlementsState.data = null as unknown as Record<string, unknown>;
    render(<BillingSection />);
    await waitFor(() => expect(screen.queryByText('billing.loadingPlans')).not.toBeInTheDocument());
    expect(fetchUpgradePlans).not.toHaveBeenCalled();
    expect(screen.queryByText('₪49')).not.toBeInTheDocument();
  });

  it('does not call a 409 TOO_EARLY "already subscribed"', async () => {
    vi.mocked(createCheckout).mockRejectedValue(
      Object.assign(new Error('Conflict'), { response: { status: 409, data: { code: 'TOO_EARLY' } } })
    );
    render(<BillingSection />);
    fireEvent.click(await screen.findByText('billing.upgrade'));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('billing.checkoutUnavailable'));
    expect(toast).not.toHaveBeenCalledWith('billing.alreadySubscribed');
    expect(authState.refreshUser).not.toHaveBeenCalled();
  });
});

