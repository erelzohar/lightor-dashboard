import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import BillingSection from '../../components/account/BillingSection';
import AccountBanners from '../../components/layout/AccountBanners';
import { fetchMyEntitlements, setExtraBookings, type BookingsMeter, type ExtrasSwitch } from '../../services/entitlementsApi';

const { t } = vi.hoisted(() => ({ t: vi.fn((key: string) => key) }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t, i18n: { language: 'en' } }) }));
vi.mock('react-hot-toast', () => ({ default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));

const authState = vi.hoisted(() => ({ subscription: { status: 'active', nextBillDate: '2026-11-05' } as Record<string, unknown> }));
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    auth: { user: { _id: 'u1', role: 'user', email: 'owner@biz.co', subscription: authState.subscription } },
    refreshUser: vi.fn(),
  }),
}));
vi.mock('../../services/paddleApi', () => ({
  fetchUpgradePlans: vi.fn(() => Promise.resolve([{ priceId: 'p1', productName: 'Lightor+', formatted: '₪119', interval: 'month' }])),
  createCheckout: vi.fn(),
  openInlineCheckout: vi.fn(),
  closeCheckout: vi.fn(),
  onCheckoutEvent: vi.fn(() => () => {}),
  fetchPortalLinks: vi.fn(),
  cancelSubscription: vi.fn(),
  resumeSubscription: vi.fn(),
}));
vi.mock('../../services/entitlementsApi', () => ({ fetchMyEntitlements: vi.fn(), setExtraBookings: vi.fn() }));

const w = window as unknown as { Capacitor?: unknown };
const inApp = () => {
  w.Capacitor = { isNativePlatform: () => true, getPlatform: () => 'ios' };
};

const meter = (used: number, extras: Partial<ExtrasSwitch> = {}): BookingsMeter => ({
  kind: 'plus',
  used,
  included: 500,
  periodStart: '2026-10-05T10:00:00.000Z',
  periodEnd: '2026-11-05T10:00:00.000Z',
  extraAgorot: 35,
  extras: { chosen: false, on: false, blockedBy: null, changedAt: null, closed: used >= 500, ...extras },
});
const subscriber = (bookings: BookingsMeter): Record<string, unknown> => ({
  plan: 'plus', limits: { monthlyAppointments: null as number | null }, usage: {}, pilot: null as null, bookings,
  bookingTerms: { included: 500, extraAgorot: 35 }, paymentFailed: false,
});

beforeEach(() => {
  t.mockClear();
  authState.subscription = { status: 'active', nextBillDate: '2026-11-05' };
  vi.mocked(fetchMyEntitlements).mockReset();
  vi.mocked(setExtraBookings).mockReset();
});
afterEach(() => {
  delete w.Capacitor;
});

/**
 * LT-465 (Erel 2026-10-28): the subscriber's switch for bookings over the
 * 500, off by default. Off, the 500 close booking; on, every extra is billed.
 * The app turns it off only and says no price (LT-130).
 */
describe('the extra bookings switch', () => {
  it('off at 500: says booking is closed and asks before switching on', async () => {
    vi.mocked(fetchMyEntitlements).mockResolvedValue(subscriber(meter(500)) as never);
    vi.mocked(setExtraBookings).mockResolvedValue(meter(500, { chosen: true, on: true, closed: false }));
    render(<BillingSection />);

    expect(await screen.findByTestId('extras-closed')).toHaveTextContent('billing.extras.closedDesc');
    expect(screen.getByText('billing.extras.offDesc')).toBeInTheDocument();
    expect(screen.getByText('billing.extras.closedShort')).toBeInTheDocument();
    expect(screen.getByTestId('plan-includes')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('switch'));
    expect(setExtraBookings).not.toHaveBeenCalled();
    expect(await screen.findByText('billing.extras.confirmOnBody')).toBeInTheDocument();
    fireEvent.click(screen.getByText('billing.extras.confirmOn'));
    await waitFor(() => expect(setExtraBookings).toHaveBeenCalledWith(true));
    expect(await screen.findByText('billing.extras.onDesc')).toBeInTheDocument();
    expect(screen.queryByTestId('extras-closed')).not.toBeInTheDocument();
  });

  it('on below 500: switches off without asking', async () => {
    vi.mocked(fetchMyEntitlements).mockResolvedValue(subscriber(meter(120, { chosen: true, on: true })) as never);
    vi.mocked(setExtraBookings).mockResolvedValue(meter(120));
    render(<BillingSection />);
    fireEvent.click(await screen.findByRole('switch'));
    await waitFor(() => expect(setExtraBookings).toHaveBeenCalledWith(false));
  });

  it('on over 500: switching off says it closes at once and the extras are billed', async () => {
    vi.mocked(fetchMyEntitlements).mockResolvedValue(subscriber(meter(512, { chosen: true, on: true, closed: false })) as never);
    render(<BillingSection />);
    fireEvent.click(await screen.findByRole('switch'));
    expect(await screen.findByText('billing.extras.confirmOffBodyExtra')).toBeInTheDocument();
    expect(t).toHaveBeenCalledWith('billing.extras.confirmOffBodyExtra', expect.objectContaining({ n: 12 }));
  });

  it('in the app: off is a statement, with no switch and no price', async () => {
    inApp();
    vi.mocked(fetchMyEntitlements).mockResolvedValue(subscriber(meter(500)) as never);
    render(<BillingSection />);
    expect(await screen.findByTestId('extras-closed')).toHaveTextContent('billing.extras.closedDescNative');
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
    expect(screen.getByText('billing.extras.offDescNative')).toBeInTheDocument();
    expect(screen.queryByText('billing.extras.offDesc')).not.toBeInTheDocument();
  });

  it('in the app: on can be switched off', async () => {
    inApp();
    vi.mocked(fetchMyEntitlements).mockResolvedValue(subscriber(meter(100, { chosen: true, on: true })) as never);
    vi.mocked(setExtraBookings).mockResolvedValue(meter(100));
    render(<BillingSection />);
    fireEvent.click(await screen.findByRole('switch'));
    await waitFor(() => expect(setExtraBookings).toHaveBeenCalledWith(false));
  });

  it('a scheduled cancel holds it, and nothing offers to switch on', async () => {
    authState.subscription = { status: 'active', cancelAtPeriodEnd: true, nextBillDate: '2026-11-05' };
    vi.mocked(fetchMyEntitlements).mockResolvedValue(
      subscriber(meter(500, { chosen: true, on: false, blockedBy: 'cancelScheduled', closed: true })) as never
    );
    render(<BillingSection />);
    expect(await screen.findByText('billing.extras.heldByCancel')).toBeInTheDocument();
    expect(screen.getByTestId('extras-closed')).toHaveTextContent('billing.extras.closedDescNative');
  });

  it('nothing to choose with the charge off for everyone', async () => {
    vi.mocked(fetchMyEntitlements).mockResolvedValue(subscriber(meter(10, { blockedBy: 'billingOff' })) as never);
    render(<BillingSection />);
    await screen.findByTestId('bookings-meter');
    expect(screen.queryByTestId('extras-switch')).not.toBeInTheDocument();
  });
});

describe('Free and Lightor+ side by side', () => {
  it('beside the plans on offer, on the web only', async () => {
    authState.subscription = { status: 'free' };
    vi.mocked(fetchMyEntitlements).mockResolvedValue({
      plan: 'free', limits: { monthlyAppointments: 30 }, usage: { appointmentsThisMonth: 3 }, pilot: null,
      bookingTerms: { included: 500, extraAgorot: 35 },
    } as never);
    const { unmount } = render(<BillingSection />);
    expect(await screen.findByTestId('plan-compare')).toBeInTheDocument();
    expect(screen.getAllByRole('row')).toHaveLength(12);
    unmount();

    inApp();
    render(<BillingSection />);
    await screen.findByText('billing.freeDescNative');
    expect(screen.queryByTestId('plan-compare')).not.toBeInTheDocument();
  });
});

describe('the 500 banner', () => {
  it('on the web it points to the Account page', async () => {
    vi.mocked(fetchMyEntitlements).mockResolvedValue(subscriber(meter(500)) as never);
    const go = vi.fn();
    render(<AccountBanners go={go} />);
    expect(await screen.findByTestId('included-used-banner')).toBeInTheDocument();
    expect(screen.getByText('accountBanner.includedUsed.body')).toBeInTheDocument();
    fireEvent.click(screen.getByText('accountBanner.includedUsed.cta'));
    expect(go).toHaveBeenCalledWith('/account');
  });

  it('in the app it states the fact', async () => {
    inApp();
    vi.mocked(fetchMyEntitlements).mockResolvedValue(subscriber(meter(500)) as never);
    render(<AccountBanners go={vi.fn()} />);
    expect(await screen.findByText('accountBanner.includedUsed.bodyApp')).toBeInTheDocument();
    expect(screen.queryByText('accountBanner.includedUsed.cta')).not.toBeInTheDocument();
  });

  it('none with the extras on', async () => {
    vi.mocked(fetchMyEntitlements).mockResolvedValue(subscriber(meter(600, { chosen: true, on: true, closed: false })) as never);
    render(<AccountBanners go={vi.fn()} />);
    await waitFor(() => expect(fetchMyEntitlements).toHaveBeenCalled());
    expect(screen.queryByTestId('included-used-banner')).not.toBeInTheDocument();
  });
});
