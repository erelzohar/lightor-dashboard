import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import NotificationsCard from '../../components/account/NotificationsCard';
import { AuthProvider } from '../../contexts/AuthContext';
import { getCurrentUser } from '../../services/authApi';
import { setSessionHint } from '../../services/sessionHint';
import { updateUserInfo } from '../../services/userApi';
import { fetchMyEntitlements, MyEntitlements } from '../../services/entitlementsApi';
import { canOfferPurchases, isNativeApp } from '../../lib/platform';
import { pushPermission } from '../../services/pushClient';
import type { EventChannels, NotifyChannels, NotifyEvent, User } from '../../types';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../../contexts/ThemeContext', () => ({ useTheme: () => ({ direction: 'ltr' }) }));
vi.mock('../../lib/platform', () => ({
  isNativeApp: vi.fn(() => true),
  canOfferPurchases: vi.fn(() => false),
  nativePlatform: () => 'ios',
}));
vi.mock('../../services/entitlementsApi', () => ({ fetchMyEntitlements: vi.fn() }));
vi.mock('../../services/nativeSession', () => ({
  loadSession: vi.fn().mockResolvedValue(null),
  saveSession: vi.fn(),
  clearSession: vi.fn(),
}));
vi.mock('../../services/pushClient', () => ({
  registerForPush: vi.fn().mockResolvedValue(undefined),
  unregisterPush: vi.fn().mockResolvedValue(undefined),
  pushPermission: vi.fn().mockResolvedValue('granted'),
}));
vi.mock('../../services/authApi', () => ({
  loginUser: vi.fn(),
  googleLogin: vi.fn(),
  googleLoginWithIdToken: vi.fn(),
  facebookLogin: vi.fn(),
  getCurrentUser: vi.fn(),
  cookieSync: vi.fn(),
  serverLogout: vi.fn(),
  changePassword: vi.fn(),
}));
vi.mock('../../services/userApi', () => ({ updateUserInfo: vi.fn() }));
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }));
vi.mock('../../hooks/useAppDispatch', () => ({ useAppDispatch: () => vi.fn() }));
vi.mock('../../i18n/config', () => ({ default: { changeLanguage: vi.fn(), language: 'he' } }));

const user = (overrides: Partial<User> = {}): User =>
  ({
    _id: 'u1',
    email: 'jane@biz.com',
    phone: '0501234567',
    name: 'Jane',
    defaultLanguage: 'he',
    isVerified: true,
    subscription: { status: 'free' },
    role: 'user',
    boardingStatus: 'active',
    ...overrides,
  }) as User;

const on = (app: boolean, email: boolean, phone = false): EventChannels => ({ app, email, phone });
const channelsOf = (overrides: Partial<NotifyChannels> = {}): NotifyChannels => ({
  newBooking: on(true, true),
  cancellation: on(true, true),
  reschedule: on(true, true),
  morningDigest: on(true, true),
  newLead: on(true, true),
  ...overrides,
});

/** The server's merge of a partial `notifyBy` write over what the user had (LT-455). */
const answerWith = (current: NotifyChannels) =>
  vi.mocked(updateUserInfo).mockImplementation(async (_id, data) => {
    const next = { ...current } as NotifyChannels;
    for (const [event, channels] of Object.entries(data.notifyBy ?? {})) {
      next[event as NotifyEvent] = { ...next[event as NotifyEvent], ...channels };
    }
    Object.assign(current, next);
    return user({ notifyChannels: next });
  });

const renderCard = async (props: { leadsSite?: boolean } = {}) => {
  // A returning visitor: the hint makes the provider probe /auth/me (LT-164).
  setSessionHint();
  render(
    <AuthProvider>
      <NotificationsCard {...props} />
    </AuthProvider>
  );
  await waitFor(() => expect(getCurrentUser).toHaveBeenCalled());
  await screen.findByTestId('notification-summary');
};

// The plan as /entitlements/me reports it; only the one flag matters here.
const plan = (ownerTextAlerts: boolean | undefined) =>
  ({ plan: ownerTextAlerts === false ? 'free' : 'plus', limits: { ownerTextAlerts }, usage: {} }) as unknown as MyEntitlements;

/** The web, where the owner can be shown a plan (LT-213). */
const onTheWeb = () => {
  vi.mocked(isNativeApp).mockReturnValue(false);
  vi.mocked(canOfferPurchases).mockReturnValue(true);
};

const chip = (testId: string) => screen.getByTestId(testId);
const pressed = (testId: string) => chip(testId).getAttribute('aria-pressed');

/**
 * Where and about what the owner hears (LT-455): a summary line per channel,
 * then bookings, the morning digest and inquiries, each with a chip per
 * channel saved on the tap as a partial `notifyBy`.
 */
describe('NotificationsCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isNativeApp).mockReturnValue(true);
    vi.mocked(canOfferPurchases).mockReturnValue(false);
    vi.mocked(fetchMyEntitlements).mockResolvedValue(plan(true));
    vi.mocked(pushPermission).mockResolvedValue('granted');
  });

  it('says what reaches the owner where, and shows each channel as a chip', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(user({ notifyChannels: channelsOf() }));
    await renderCard();

    expect(screen.getByTestId('notification-summary-app')).toHaveTextContent('account.notifications.summary.app');
    expect(screen.getByTestId('notification-summary-email')).toBeInTheDocument();
    expect(screen.queryByTestId('notification-summary-phone')).not.toBeInTheDocument();
    expect(pressed('notification-bookings-app')).toBe('true');
    expect(pressed('notification-bookings-email')).toBe('true');
    expect(pressed('notification-morningDigest-phone')).toBe('false');
    expect(pressed('notification-newLead-email')).toBe('true');
    // A new booking never goes by phone: the bookings row has no WhatsApp chip.
    expect(screen.queryByTestId('notification-bookings-phone')).not.toBeInTheDocument();
    expect(screen.queryByTestId('notification-safety-net')).not.toBeInTheDocument();
  });

  it('reads an account with no channels from the server as app and email everywhere', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(user());
    await renderCard();
    expect(pressed('notification-bookings-email')).toBe('true');
    expect(pressed('notification-newLead-phone')).toBe('false');
  });

  it('one bookings chip writes all three booking events; email off says the safety net', async () => {
    const current = channelsOf();
    vi.mocked(getCurrentUser).mockResolvedValue(user({ notifyChannels: current }));
    answerWith(current);
    await renderCard();

    fireEvent.click(chip('notification-bookings-email'));

    await waitFor(() =>
      expect(updateUserInfo).toHaveBeenCalledWith('u1', {
        notifyBy: { newBooking: { email: false }, cancellation: { email: false }, reschedule: { email: false } },
      })
    );
    await waitFor(() => expect(pressed('notification-bookings-email')).toBe('false'));
    expect(screen.getByTestId('notification-safety-net')).toHaveTextContent('account.notifications.safetyNet');
  });

  it('the last-minute switch writes the phone for cancellations and changes, and the phone line appears', async () => {
    const current = channelsOf();
    vi.mocked(getCurrentUser).mockResolvedValue(user({ notifyChannels: current }));
    answerWith(current);
    await renderCard();

    fireEvent.click(screen.getByRole('switch', { name: 'account.notifications.lastMinute' }));

    await waitFor(() =>
      expect(updateUserInfo).toHaveBeenCalledWith('u1', {
        notifyBy: { cancellation: { phone: true }, reschedule: { phone: true } },
      })
    );
    await waitFor(() => expect(screen.getByTestId('notification-summary-phone')).toBeInTheDocument());
    expect(screen.getByTestId('notification-phone-line')).toHaveTextContent('account.notifications.phoneLine');
  });

  it('sets each kind separately on request, and opens that way when they already differ', async () => {
    const current = channelsOf();
    vi.mocked(getCurrentUser).mockResolvedValue(user({ notifyChannels: current }));
    answerWith(current);
    await renderCard();
    expect(screen.queryByTestId('notification-each-kind')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('notification-each-kind-toggle'));
    fireEvent.click(chip('notification-newBooking-email'));

    await waitFor(() =>
      expect(updateUserInfo).toHaveBeenCalledWith('u1', { notifyBy: { newBooking: { email: false } } })
    );
    // They differ now: the rows stay apart, with nothing to fold them back.
    await waitFor(() => expect(pressed('notification-newBooking-email')).toBe('false'));
    expect(screen.getByTestId('notification-each-kind')).toBeInTheDocument();
    expect(screen.queryByTestId('notification-each-kind-toggle')).not.toBeInTheDocument();
  });

  // LT-478 (Erel): at the bottom of the group, under the WhatsApp switch, the
  // toggle looked unrelated to the chips it splits.
  it('puts "each kind separately" right under the bookings chips, and eases the list in once on opening', async () => {
    const current = channelsOf();
    vi.mocked(getCurrentUser).mockResolvedValue(user({ notifyChannels: current }));
    await renderCard();

    const toggle = screen.getByTestId('notification-each-kind-toggle');
    expect(toggle.previousElementSibling).toContainElement(chip('notification-bookings-email'));
    const lastMinute = screen.getByRole('switch', { name: 'account.notifications.lastMinute' });
    expect(toggle.compareDocumentPosition(lastMinute) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    fireEvent.click(toggle);
    const list = screen.getByTestId('notification-each-kind');
    expect(toggle.previousElementSibling).toBe(list);
    expect(list).toHaveClass('notif-each-kind-in');
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
  });

  it('shows the kinds apart without the opening animation when they already differ', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(user({ notifyChannels: channelsOf({ newBooking: on(true, false) }) }));
    await renderCard();
    expect(screen.getByTestId('notification-each-kind')).not.toHaveClass('notif-each-kind-in');
  });

  it('keeps the old value when the save fails', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(user({ notifyChannels: channelsOf() }));
    vi.mocked(updateUserInfo).mockRejectedValue(new Error('500'));
    await renderCard();

    fireEvent.click(chip('notification-newLead-email'));
    await waitFor(() => expect(updateUserInfo).toHaveBeenCalled());
    await waitFor(() => expect(chip('notification-newLead-email')).not.toBeDisabled());
    expect(pressed('notification-newLead-email')).toBe('true');
  });

  it('says so when everything is off', async () => {
    const off = on(false, false);
    vi.mocked(getCurrentUser).mockResolvedValue(
      user({ notifyChannels: channelsOf({ newBooking: off, cancellation: off, reschedule: off, morningDigest: off, newLead: off }) })
    );
    await renderCard();
    expect(screen.getByText('account.notifications.summary.allOff')).toBeInTheDocument();
  });

  // A leads site (LT-199) takes no bookings: it only hears about inquiries.
  it('shows a leads site its inquiries row only', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(user({ notifyChannels: channelsOf() }));
    await renderCard({ leadsSite: true });

    expect(screen.getByTestId('notification-group-leads')).toBeInTheDocument();
    expect(screen.queryByTestId('notification-group-bookings')).not.toBeInTheDocument();
    expect(screen.queryByTestId('notification-group-digest')).not.toBeInTheDocument();
  });

  describe('the phone', () => {
    it('asks for a phone number before WhatsApp can be turned on', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(user({ phone: '', notifyChannels: channelsOf() }));
      await renderCard();

      expect(chip('notification-newLead-phone')).toBeDisabled();
      expect(screen.getByRole('switch', { name: 'account.notifications.lastMinute' })).toBeDisabled();
      expect(screen.getByTestId('notification-phone-hint')).toHaveTextContent('account.notifications.needsPhone');
    });

    it('locks WhatsApp on a plan without it and says why - on the web', async () => {
      onTheWeb();
      vi.mocked(fetchMyEntitlements).mockResolvedValue(plan(false));
      vi.mocked(getCurrentUser).mockResolvedValue(user({ notifyChannels: channelsOf() }));
      await renderCard();

      await waitFor(() => expect(screen.getByTestId('notification-phone-hint')).toHaveTextContent('account.notifications.plusOnly'));
      expect(chip('notification-newLead-phone')).toBeDisabled();
    });

    it('in the app, a plan without it simply has no WhatsApp (no call to buy)', async () => {
      vi.mocked(fetchMyEntitlements).mockResolvedValue(plan(false));
      vi.mocked(getCurrentUser).mockResolvedValue(user({ notifyChannels: channelsOf() }));
      await renderCard();

      await waitFor(() => expect(screen.queryByTestId('notification-newLead-phone')).not.toBeInTheDocument());
      expect(screen.queryByRole('switch', { name: 'account.notifications.lastMinute' })).not.toBeInTheDocument();
      expect(screen.queryByText('account.notifications.plusOnly')).not.toBeInTheDocument();
    });
  });

  // LT-489 (Erel 2026-10-29): "רק סיכום בוקר בוואצפ בחינמי".
  describe('the free plan: WhatsApp for the morning digest only', () => {
    const digestOnly = () =>
      ({ plan: 'free', limits: { ownerTextAlerts: true, ownerTextDigestOnly: true }, usage: {} }) as unknown as MyEntitlements;
    const phoneEverywhere = () =>
      channelsOf({ cancellation: on(true, true, true), reschedule: on(true, true, true), morningDigest: on(true, false, true), newLead: on(true, false, true) });

    it('on the web: the digest chip works, the lead and last-minute ones are locked, and it says why', async () => {
      onTheWeb();
      vi.mocked(fetchMyEntitlements).mockResolvedValue(digestOnly());
      vi.mocked(getCurrentUser).mockResolvedValue(user({ notifyChannels: phoneEverywhere() }));
      await renderCard();

      await waitFor(() => expect(chip('notification-newLead-phone')).toBeDisabled());
      expect(pressed('notification-newLead-phone')).toBe('false');
      expect(chip('notification-morningDigest-phone')).not.toBeDisabled();
      expect(pressed('notification-morningDigest-phone')).toBe('true');
      expect(screen.getByRole('switch', { name: 'account.notifications.lastMinute' })).toBeDisabled();
      expect(screen.getByTestId('notification-digest-only-hint')).toHaveTextContent('account.notifications.plusOnlyDigest');
      // The summary promises WhatsApp for the digest only.
      expect(screen.getByTestId('notification-summary-phone')).toHaveTextContent('account.notifications.summary.whatsapp');
    });

    it('in the app: only the digest offers WhatsApp, with no word about the plans', async () => {
      vi.mocked(fetchMyEntitlements).mockResolvedValue(digestOnly());
      vi.mocked(getCurrentUser).mockResolvedValue(user({ notifyChannels: phoneEverywhere() }));
      await renderCard();

      await waitFor(() => expect(screen.queryByTestId('notification-newLead-phone')).not.toBeInTheDocument());
      expect(chip('notification-morningDigest-phone')).not.toBeDisabled();
      expect(screen.queryByRole('switch', { name: 'account.notifications.lastMinute' })).not.toBeInTheDocument();
      expect(screen.queryByTestId('notification-digest-only-hint')).not.toBeInTheDocument();
    });
  });

  describe('the app', () => {
    it('says on the web whether a phone with the app is connected', async () => {
      onTheWeb();
      vi.mocked(getCurrentUser).mockResolvedValue(user({ appConnected: true, notifyChannels: channelsOf() }));
      await renderCard();
      await waitFor(() =>
        expect(screen.getByTestId('notification-app-state')).toHaveTextContent('account.notifications.appState.connected')
      );
    });

    it("says in the app when this phone's notifications are off", async () => {
      vi.mocked(pushPermission).mockResolvedValue('denied');
      vi.mocked(getCurrentUser).mockResolvedValue(user({ appConnected: true, notifyChannels: channelsOf() }));
      await renderCard();
      await waitFor(() =>
        expect(screen.getByTestId('notification-app-state')).toHaveTextContent('account.notifications.appState.permissionOff')
      );
    });

    it('reads the account fresh on opening, after the app may have turned the booking emails off', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(user({ notifyChannels: channelsOf() }));
      await renderCard();
      await waitFor(() => expect(getCurrentUser).toHaveBeenCalledTimes(2));
    });
  });
});
