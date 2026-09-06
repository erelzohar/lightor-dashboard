import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import NotificationsCard from '../../components/account/NotificationsCard';
import { AuthProvider } from '../../contexts/AuthContext';
import { getCurrentUser } from '../../services/authApi';
import { updateUserInfo } from '../../services/userApi';
import { isNativeApp } from '../../lib/platform';
import type { User } from '../../types';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../../contexts/ThemeContext', () => ({ useTheme: () => ({ direction: 'ltr' }) }));
vi.mock('../../lib/platform', () => ({ isNativeApp: vi.fn(() => true), nativePlatform: () => 'ios' }));
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

const EVENTS = ['newBooking', 'cancellation', 'reschedule', 'morningDigest'];

const renderCard = async () => {
  render(
    <AuthProvider>
      <NotificationsCard />
    </AuthProvider>
  );
  await waitFor(() => expect(getCurrentUser).toHaveBeenCalled());
};

/**
 * Per-event push toggles on the Account page (LT-129). Native only; each
 * toggle saves the full merged prefs object through the users API.
 */
describe('NotificationsCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isNativeApp).mockReturnValue(true);
  });

  it('renders the four event toggles, all on by default', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(user());
    await renderCard();
    await screen.findByTestId('notification-prefs');

    for (const e of EVENTS) expect(screen.getByText(`account.notifications.${e}`)).toBeInTheDocument();
    const switches = screen.getAllByRole('switch');
    expect(switches).toHaveLength(4);
    for (const s of switches) expect(s).toHaveAttribute('aria-checked', 'true');
  });

  it('reflects saved prefs', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(
      user({ notificationPrefs: { newBooking: true, cancellation: false, reschedule: true, morningDigest: false } })
    );
    await renderCard();
    await screen.findByTestId('notification-prefs');
    const checked = screen.getAllByRole('switch').map((s) => s.getAttribute('aria-checked'));
    expect(checked).toEqual(['true', 'false', 'true', 'false']);
  });

  it('saves the merged prefs object when a toggle flips', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(user());
    vi.mocked(updateUserInfo).mockImplementation(async (_id, data) => user(data));
    await renderCard();
    await screen.findByTestId('notification-prefs');

    fireEvent.click(screen.getAllByRole('switch')[1]); // cancellation
    await waitFor(() =>
      expect(updateUserInfo).toHaveBeenCalledWith('u1', {
        notificationPrefs: { newBooking: true, cancellation: false, reschedule: true, morningDigest: true },
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

  it('is not rendered on the web', async () => {
    vi.mocked(isNativeApp).mockReturnValue(false);
    vi.mocked(getCurrentUser).mockResolvedValue(user());
    await renderCard();
    expect(screen.queryByTestId('notification-prefs')).not.toBeInTheDocument();
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
  });
});
