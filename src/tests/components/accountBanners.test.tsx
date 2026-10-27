import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AccountBanners from '../../components/layout/AccountBanners';
import { fetchMyEntitlements } from '../../services/entitlementsApi';

const { t } = vi.hoisted(() => ({ t: vi.fn((key: string) => key) }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t, i18n: { language: 'en' } }) }));

const authState = vi.hoisted(() => ({ subscription: { status: 'free' } as Record<string, unknown>, role: 'user' }));
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ auth: { user: { _id: 'u1', role: authState.role, subscription: authState.subscription } } }),
}));
vi.mock('../../services/entitlementsApi', () => ({ fetchMyEntitlements: vi.fn() }));

const w = window as unknown as { Capacitor?: unknown };
const inApp = () => {
  w.Capacitor = { isNativePlatform: () => true, getPlatform: () => 'ios' };
};
const freePeriod = (used: number) => ({
  plan: 'plus', limits: {}, usage: {},
  pilot: { until: '2026-11-21T10:00:00.000Z', upgradeFrom: '2026-11-14T10:00:00.000Z' },
  bookings: { kind: 'freePeriod', used, included: 200, periodStart: '2026-10-05T10:00:00.000Z', periodEnd: '2026-11-04T10:00:00.000Z', extraAgorot: null as number | null },
  paymentFailed: false,
});

beforeEach(() => {
  authState.subscription = { status: 'free' };
  authState.role = 'user';
  t.mockClear();
  vi.mocked(fetchMyEntitlements).mockReset();
});
afterEach(() => {
  delete w.Capacitor;
});

/**
 * LT-458: over the owner's pages, what stops the site taking bookings - a
 * failed payment (red) or a free month's 200 bookings (amber). The way to
 * pay is a call to buy, so the app states the fact only (LT-130).
 */
describe('AccountBanners', () => {
  it('a failed payment: red, with the way to the payment method on the web', async () => {
    authState.subscription = { status: 'past_due' };
    vi.mocked(fetchMyEntitlements).mockResolvedValue({ plan: 'free', limits: {}, usage: {}, paymentFailed: true } as never);
    const go = vi.fn();
    render(<AccountBanners go={go} />);
    expect(await screen.findByTestId('payment-failed-banner')).toHaveTextContent('accountBanner.paymentFailed.body');
    fireEvent.click(screen.getByRole('button', { name: 'accountBanner.paymentFailed.cta' }));
    expect(go).toHaveBeenCalledWith('/account');
  });

  it('a failed payment in the app: the fact, no button', async () => {
    inApp();
    authState.subscription = { status: 'past_due' };
    vi.mocked(fetchMyEntitlements).mockResolvedValue({ plan: 'free', limits: {}, usage: {}, paymentFailed: true } as never);
    render(<AccountBanners go={vi.fn()} />);
    expect(await screen.findByTestId('payment-failed-banner')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('trusts the subscription when the server cannot be read, but never for the operator', async () => {
    authState.subscription = { status: 'past_due' };
    vi.mocked(fetchMyEntitlements).mockResolvedValue(null);
    const { unmount } = render(<AccountBanners go={vi.fn()} />);
    expect(await screen.findByTestId('payment-failed-banner')).toBeInTheDocument();
    unmount();

    authState.role = 'admin';
    render(<AccountBanners go={vi.fn()} />);
    await vi.waitFor(() => expect(fetchMyEntitlements).toHaveBeenCalledTimes(2));
    expect(screen.queryByTestId('payment-failed-banner')).not.toBeInTheDocument();
  });

  it('a full free month asks for a card on the web: nothing charged before the free days end', async () => {
    vi.mocked(fetchMyEntitlements).mockResolvedValue(freePeriod(200) as never);
    const go = vi.fn();
    render(<AccountBanners go={go} />);
    expect(await screen.findByTestId('free-month-full-banner')).toBeInTheDocument();
    expect(t).toHaveBeenCalledWith('accountBanner.freeMonthFull.title', { included: 200 });
    expect(t).toHaveBeenCalledWith('accountBanner.freeMonthFull.body', { date: new Date('2026-11-21T10:00:00.000Z').toLocaleDateString('en-GB') });
    fireEvent.click(screen.getByRole('button', { name: 'accountBanner.freeMonthFull.cta' }));
    expect(go).toHaveBeenCalledWith('/account');
  });

  it('in the app a full free month says until when the site is closed', async () => {
    inApp();
    vi.mocked(fetchMyEntitlements).mockResolvedValue(freePeriod(205) as never);
    render(<AccountBanners go={vi.fn()} />);
    expect(await screen.findByTestId('free-month-full-banner')).toBeInTheDocument();
    expect(t).toHaveBeenCalledWith('accountBanner.freeMonthFull.bodyApp', { date: new Date('2026-11-04T10:00:00.000Z').toLocaleDateString('en-GB') });
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('says nothing while the site takes bookings', async () => {
    vi.mocked(fetchMyEntitlements).mockResolvedValue(freePeriod(150) as never);
    const { container } = render(<AccountBanners go={vi.fn()} />);
    await vi.waitFor(() => expect(fetchMyEntitlements).toHaveBeenCalled());
    await Promise.resolve();
    expect(container).toBeEmptyDOMElement();
  });
});
