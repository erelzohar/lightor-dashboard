import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import NotificationsCard from '../../components/account/NotificationsCard';
import { AuthProvider } from '../../contexts/AuthContext';
import { getCurrentUser } from '../../services/authApi';
import { setSessionHint } from '../../services/sessionHint';
import { updateUserInfo } from '../../services/userApi';
import { fetchMyEntitlements, MyEntitlements } from '../../services/entitlementsApi';
import { canOfferPurchases, isNativeApp } from '../../lib/platform';
import type { User } from '../../types';

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

const EVENTS = ['newBooking', 'cancellation', 'reschedule', 'morningDigest', 'newLead'];

const renderCard = async (props: { leadsSite?: boolean } = {}) => {
  // A returning visitor: the hint makes the provider probe /auth/me (LT-164).
  setSessionHint();
  render(
    <AuthProvider>
      <NotificationsCard {...props} />
    </AuthProvider>
  );
  await waitFor(() => expect(getCurrentUser).toHaveBeenCalled());
};

// The plan as /entitlements/me reports it; only the one flag matters here.
const plan = (ownerTextAlerts: boolean | undefined) =>
  ({ plan: ownerTextAlerts === false ? 'free' : 'plus', limits: { ownerTextAlerts }, usage: {} }) as unknown as MyEntitlements;

/** The web, where the owner can be shown a plan (LT-213). */
const onTheWeb = () => {
  vi.mocked(isNativeApp).mockReturnValue(false);
  vi.mocked(canOfferPurchases).mockReturnValue(true);
};

const channelButtons = () =>
  within(screen.getByTestId('notification-channel')).getAllByRole('radio');
const channelButton = (name: string) =>
  within(screen.getByTestId('notification-channel')).getByRole('radio', { name: new RegExp(name) });

/**
 * How and about what the owner hears (LT-129, LT-213): the channel — email,
 * SMS or WhatsApp — and one switch per event, each saved through the users
 * API the moment it changes.
 */
describe('NotificationsCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isNativeApp).mockReturnValue(true);
    vi.mocked(canOfferPurchases).mockReturnValue(false);
    vi.mocked(fetchMyEntitlements).mockResolvedValue(plan(true));
  });

  it('renders the four event toggles, all on by default', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(user());
    await renderCard();
    await screen.findByTestId('notification-prefs');

    for (const e of EVENTS) expect(screen.getByText(`account.notifications.${e}`)).toBeInTheDocument();
    const switches = screen.getAllByRole('switch');
    expect(switches).toHaveLength(5);
    for (const s of switches) expect(s).toHaveAttribute('aria-checked', 'true');
  });

  it('reflects saved prefs', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(
      user({ notificationPrefs: { newBooking: true, cancellation: false, reschedule: true, morningDigest: false } })
    );
    await renderCard();
    await screen.findByTestId('notification-prefs');
    const checked = screen.getAllByRole('switch').map((s) => s.getAttribute('aria-checked'));
    // newLead absent on the stored prefs reads as on (LT-197).
    expect(checked).toEqual(['true', 'false', 'true', 'false', 'true']);
  });

  it('saves the merged prefs object when a toggle flips', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(user());
    vi.mocked(updateUserInfo).mockImplementation(async (_id, data) => user(data));
    await renderCard();
    await screen.findByTestId('notification-prefs');

    fireEvent.click(screen.getAllByRole('switch')[1]); // cancellation
    await waitFor(() =>
      expect(updateUserInfo).toHaveBeenCalledWith('u1', {
        notificationPrefs: { newBooking: true, cancellation: false, reschedule: true, morningDigest: true, newLead: true },
      })
    );
    await waitFor(() => expect(screen.getAllByRole('switch')[1]).toHaveAttribute('aria-checked', 'false'));
  });

  it('keeps the old value when the save fails', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(user());
    vi.mocked(updateUserInfo).mockRejectedValue(new Error('500'));
    await renderCard();
    await screen.findByTestId('notification-prefs');

    fireEvent.click(screen.getAllByRole('switch')[0]);
    await waitFor(() => expect(updateUserInfo).toHaveBeenCalled());
    await waitFor(() => expect(screen.getAllByRole('switch')[0]).not.toBeDisabled());
    expect(screen.getAllByRole('switch')[0]).toHaveAttribute('aria-checked', 'true');
  });

  // A leads site (LT-199) takes no bookings: its phone hears about new leads only.
  it('offers a leads site the new-lead toggle only, and still saves the whole prefs object', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(user());
    vi.mocked(updateUserInfo).mockImplementation(async (_id, data) => user(data));
    await renderCard({ leadsSite: true });
    await screen.findByTestId('notification-prefs');

    expect(screen.getByText('account.notifications.newLead')).toBeInTheDocument();
    for (const e of ['newBooking', 'cancellation', 'reschedule', 'morningDigest']) {
      expect(screen.queryByText(`account.notifications.${e}`)).not.toBeInTheDocument();
    }
    const switches = screen.getAllByRole('switch');
    expect(switches).toHaveLength(1);

    fireEvent.click(switches[0]);
    await waitFor(() =>
      expect(updateUserInfo).toHaveBeenCalledWith('u1', {
        notificationPrefs: { newBooking: true, cancellation: true, reschedule: true, morningDigest: true, newLead: false },
      })
    );
  });

  it('is on the web too — only the app mentions push', async () => {
    onTheWeb();
    vi.mocked(getCurrentUser).mockResolvedValue(user());
    await renderCard();
    await screen.findByTestId('notification-prefs');
    expect(screen.getAllByRole('switch')).toHaveLength(5);
    expect(screen.queryByText('account.notifications.pushNote')).not.toBeInTheDocument();
  });

  it('says in the app that push follows the same switches', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(user());
    await renderCard();
    await screen.findByTestId('notification-prefs');
    expect(screen.getByText('account.notifications.pushNote')).toBeInTheDocument();
  });

  it('names each switch after its event', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(user());
    await renderCard();
    await screen.findByTestId('notification-prefs');
    expect(screen.getByRole('switch', { name: 'account.notifications.cancellation' })).toBeInTheDocument();
  });

  describe('the channel', () => {
    it('is email by default, sent to the account address', async () => {
      onTheWeb();
      vi.mocked(getCurrentUser).mockResolvedValue(user());
      await renderCard();
      await screen.findByTestId('notification-channel');

      expect(channelButtons()).toHaveLength(3);
      expect(channelButton('channels.email')).toHaveAttribute('aria-checked', 'true');
      expect(channelButton('channels.sms')).toHaveAttribute('aria-checked', 'false');
      expect(screen.getByTestId('notification-channel-hint')).toHaveTextContent('jane@biz.com');
    });

    it('saves the pick, and the hint follows it to the phone', async () => {
      onTheWeb();
      vi.mocked(getCurrentUser).mockResolvedValue(user());
      vi.mocked(updateUserInfo).mockImplementation(async (_id, data) => user(data));
      await renderCard();
      await screen.findByTestId('notification-channel');
      await waitFor(() => expect(fetchMyEntitlements).toHaveBeenCalled());

      fireEvent.click(channelButton('channels.whatsapp'));

      await waitFor(() => expect(updateUserInfo).toHaveBeenCalledWith('u1', { channelType: 'whatsapp' }));
      await waitFor(() => expect(channelButton('channels.whatsapp')).toHaveAttribute('aria-checked', 'true'));
      expect(screen.getByTestId('notification-channel-hint')).toHaveTextContent('0501234567');
    });

    it('keeps the old channel when the save fails', async () => {
      onTheWeb();
      vi.mocked(getCurrentUser).mockResolvedValue(user({ channelType: 'sms' }));
      vi.mocked(updateUserInfo).mockRejectedValue(new Error('500'));
      await renderCard();
      await screen.findByTestId('notification-channel');

      fireEvent.click(channelButton('channels.email'));

      await waitFor(() => expect(updateUserInfo).toHaveBeenCalled());
      await waitFor(() => expect(channelButton('channels.email')).not.toBeDisabled());
      expect(channelButton('channels.sms')).toHaveAttribute('aria-checked', 'true');
    });

    it('locks the phone on the free plan and says why — on the web', async () => {
      onTheWeb();
      vi.mocked(fetchMyEntitlements).mockResolvedValue(plan(false));
      // Picked on Plus, then the plan lapsed: the alerts go by email now.
      vi.mocked(getCurrentUser).mockResolvedValue(user({ channelType: 'sms' }));
      await renderCard();
      await screen.findByText('account.notifications.plusOnly');

      expect(channelButton('channels.sms')).toBeDisabled();
      expect(channelButton('channels.whatsapp')).toBeDisabled();
      expect(channelButton('channels.email')).toHaveAttribute('aria-checked', 'true');
      expect(screen.getByTestId('notification-channel-hint')).toHaveTextContent('jane@biz.com');
    });

    it('in the app, the free plan simply offers email (no call to buy)', async () => {
      vi.mocked(fetchMyEntitlements).mockResolvedValue(plan(false));
      vi.mocked(getCurrentUser).mockResolvedValue(user());
      await renderCard();
      await waitFor(() => expect(channelButtons()).toHaveLength(1));

      expect(channelButton('channels.email')).toHaveAttribute('aria-checked', 'true');
      expect(screen.queryByText('account.notifications.plusOnly')).not.toBeInTheDocument();
    });

    it('asks for a phone number before offering SMS or WhatsApp', async () => {
      onTheWeb();
      vi.mocked(getCurrentUser).mockResolvedValue(user({ phone: '' }));
      await renderCard();
      await screen.findByText('account.notifications.needsPhone');

      expect(channelButton('channels.sms')).toBeDisabled();
      expect(channelButton('channels.whatsapp')).toBeDisabled();
      expect(channelButton('channels.email')).not.toBeDisabled();
    });

    it('offers the phone while the plan is still loading, or when it cannot be read', async () => {
      onTheWeb();
      vi.mocked(fetchMyEntitlements).mockResolvedValue(null);
      vi.mocked(getCurrentUser).mockResolvedValue(user());
      await renderCard();
      await screen.findByTestId('notification-channel');
      await waitFor(() => expect(fetchMyEntitlements).toHaveBeenCalled());

      expect(channelButton('channels.sms')).not.toBeDisabled();
      expect(screen.queryByText('account.notifications.plusOnly')).not.toBeInTheDocument();
    });
  });
});
