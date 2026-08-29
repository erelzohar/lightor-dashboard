import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthProvider, useAuth } from '../../contexts/AuthContext';
import {
  loginUser,
  googleLogin,
  facebookLogin,
  getCurrentUser,
  cookieSync,
  serverLogout,
  changePassword,
} from '../../services/authApi';
import { updateUserInfo } from '../../services/userApi';
import i18n from '../../i18n/config';
import type { User } from '../../types';

const navigate = vi.fn();
const dispatch = vi.fn();

vi.mock('../../services/authApi', () => ({
  loginUser: vi.fn(),
  googleLogin: vi.fn(),
  facebookLogin: vi.fn(),
  getCurrentUser: vi.fn(),
  cookieSync: vi.fn(),
  serverLogout: vi.fn(),
  changePassword: vi.fn(),
}));
vi.mock('../../services/userApi', () => ({ updateUserInfo: vi.fn() }));
vi.mock('react-router-dom', () => ({ useNavigate: () => navigate }));
vi.mock('../../hooks/useAppDispatch', () => ({ useAppDispatch: () => dispatch }));
vi.mock('../../i18n/config', () => ({ default: { changeLanguage: vi.fn() } }));

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

/** Renders the context's state and exposes its actions as buttons. */
const Consumer: React.FC = () => {
  const { auth, login, loginWithGoogle, loginWithFacebook, logout, refreshUser, updateUser, updatePassword } =
    useAuth();

  return (
    <div>
      <span data-testid="state">
        {auth.isLoading ? 'loading' : auth.isAuthenticated ? 'in' : 'out'}
      </span>
      <span data-testid="email">{auth.user?.email ?? '-'}</span>
      <span data-testid="plan">{auth.user?.subscription?.status ?? '-'}</span>
      <span data-testid="error">{auth.error ?? '-'}</span>
      <span data-testid="token">{auth.token === null ? 'null' : String(auth.token)}</span>
      <button onClick={() => login('jane', 'secret', true)}>login</button>
      <button onClick={() => loginWithGoogle('g-cred')}>google</button>
      <button onClick={() => loginWithFacebook('fb-token')}>facebook</button>
      <button onClick={() => void refreshUser()}>refresh</button>
      <button onClick={logout}>logout</button>
      <button onClick={() => void updateUser({ name: 'Jane Cohen' }).catch(() => {})}>update</button>
      <button onClick={() => void updatePassword('old', 'new', 'new').catch(() => {})}>
        change-password
      </button>
    </div>
  );
};

const renderAuth = () => render(<AuthProvider><Consumer /></AuthProvider>);
const settled = () => waitFor(() => expect(screen.getByTestId('state')).not.toHaveTextContent('loading'));

/**
 * The dashboard's session (LT-009).
 *
 * Since the session became an HttpOnly cookie this context holds no session
 * material at all — it asks the server who the caller is and believes the
 * answer. That makes two things worth pinning: that nothing here ever writes
 * a token back into JavaScript's reach, and that the boot sequence resolves
 * to *some* terminal state, because a context stuck on `isLoading` renders a
 * spinner over the whole product.
 */
describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe('on first load', () => {
    it('signs in from the cookie alone', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(user());

      renderAuth();

      await settled();
      expect(screen.getByTestId('state')).toHaveTextContent('in');
      expect(screen.getByTestId('email')).toHaveTextContent('jane@biz.com');
    });

    it('resolves to signed-out when there is no session', async () => {
      // Not an error state: arriving without a cookie is the normal case for
      // a visitor, and surfacing it as an error would render a failure banner
      // over the login page.
      vi.mocked(getCurrentUser).mockRejectedValue(new Error('Invalid token'));

      renderAuth();

      await settled();
      expect(screen.getByTestId('state')).toHaveTextContent('out');
      expect(screen.getByTestId('error')).toHaveTextContent('-');
    });

    it('adopts the account language', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(user({ defaultLanguage: 'en' }));

      renderAuth();

      await waitFor(() => expect(i18n.changeLanguage).toHaveBeenCalledWith('en'));
    });

    it('never exposes a token to JavaScript', async () => {
      // The whole point of LT-009: an XSS that reads everything this context
      // holds still finds nothing it can replay.
      vi.mocked(getCurrentUser).mockResolvedValue(user());

      renderAuth();

      await settled();
      expect(screen.getByTestId('token')).toHaveTextContent('null');
      expect(localStorage.getItem('lightor')).toBeNull();
    });
  });

  describe('the pre-cookie migration shim', () => {
    it('trades a legacy token for a cookie and deletes it', async () => {
      localStorage.setItem('lightor', 'legacy-jwt');
      vi.mocked(cookieSync).mockResolvedValue(undefined);
      vi.mocked(getCurrentUser).mockResolvedValue(user());

      renderAuth();

      await settled();
      expect(cookieSync).toHaveBeenCalledWith('legacy-jwt');
      expect(localStorage.getItem('lightor')).toBeNull();
    });

    it('deletes a legacy token the server rejects', async () => {
      // Expired or forged — either way it has no business persisting, and
      // leaving it would send a doomed Bearer on every request from here on.
      localStorage.setItem('lightor', 'forged');
      vi.mocked(cookieSync).mockRejectedValue(new Error('Cookie sync failed'));
      vi.mocked(getCurrentUser).mockRejectedValue(new Error('Invalid token'));

      renderAuth();

      await settled();
      expect(localStorage.getItem('lightor')).toBeNull();
      expect(screen.getByTestId('state')).toHaveTextContent('out');
    });

    it('does not run when there is nothing to migrate', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(user());

      renderAuth();

      await settled();
      expect(cookieSync).not.toHaveBeenCalled();
    });
  });

  describe('signing in', () => {
    it('reads the user from the server, not from the login response', async () => {
      // Token payloads carry only { id, role } since LT-002, so there is
      // nothing in the response to unpack — /auth/me is the only source.
      vi.mocked(getCurrentUser).mockRejectedValueOnce(new Error('Invalid token'));
      vi.mocked(loginUser).mockResolvedValue({ token: 'jwt', user: user() });
      vi.mocked(getCurrentUser).mockResolvedValue(user());

      renderAuth();
      await settled();
      await userEvent.click(screen.getByText('login'));

      await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('in'));
      expect(loginUser).toHaveBeenCalledWith('jane', 'secret', true);
      expect(getCurrentUser).toHaveBeenCalledTimes(2);
      expect(navigate).toHaveBeenCalledWith('/dashboard', { replace: true });
    });

    it('reports bad credentials without navigating', async () => {
      vi.mocked(getCurrentUser).mockRejectedValue(new Error('Invalid token'));
      vi.mocked(loginUser).mockRejectedValue(new Error('Invalid credentials'));

      renderAuth();
      await settled();
      await userEvent.click(screen.getByText('login'));

      await waitFor(() => expect(screen.getByTestId('error')).toHaveTextContent('Invalid credentials'));
      expect(screen.getByTestId('state')).toHaveTextContent('out');
      expect(navigate).not.toHaveBeenCalled();
    });

    it('signs in with Google', async () => {
      vi.mocked(getCurrentUser).mockRejectedValueOnce(new Error('Invalid token'));
      vi.mocked(googleLogin).mockResolvedValue({ token: 'jwt', user: user() });
      vi.mocked(getCurrentUser).mockResolvedValue(user());

      renderAuth();
      await settled();
      await userEvent.click(screen.getByText('google'));

      await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('in'));
      expect(googleLogin).toHaveBeenCalledWith('g-cred');
      expect(navigate).toHaveBeenCalledWith('/dashboard', { replace: true });
    });

    it('signs in with Facebook', async () => {
      vi.mocked(getCurrentUser).mockRejectedValueOnce(new Error('Invalid token'));
      vi.mocked(facebookLogin).mockResolvedValue({ token: 'jwt', user: user() });
      vi.mocked(getCurrentUser).mockResolvedValue(user());

      renderAuth();
      await settled();
      await userEvent.click(screen.getByText('facebook'));

      await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('in'));
      expect(facebookLogin).toHaveBeenCalledWith('fb-token');
    });

    it('reports a failed social login distinctly', async () => {
      vi.mocked(getCurrentUser).mockRejectedValue(new Error('Invalid token'));
      vi.mocked(googleLogin).mockRejectedValue(new Error('Google login failed'));

      renderAuth();
      await settled();
      await userEvent.click(screen.getByText('google'));

      await waitFor(() => expect(screen.getByTestId('error')).toHaveTextContent('Google login failed'));
    });
  });

  describe('refreshUser', () => {
    it('picks up a subscription the webhook activated (LT-004)', async () => {
      // Billing polls this after checkout. The badge flips when the server
      // record does — that is the entire mechanism.
      vi.mocked(getCurrentUser).mockResolvedValueOnce(user({ subscription: { status: 'free' } }));

      renderAuth();
      await settled();
      expect(screen.getByTestId('plan')).toHaveTextContent('free');

      vi.mocked(getCurrentUser).mockResolvedValueOnce(user({ subscription: { status: 'active' } }));
      await userEvent.click(screen.getByText('refresh'));

      await waitFor(() => expect(screen.getByTestId('plan')).toHaveTextContent('active'));
    });

    it('keeps the session alive when a poll fails', async () => {
      // A transient /me failure mid-poll must not eject the user; the next
      // attempt covers it. Signing them out here would log people out at
      // random during a checkout.
      vi.mocked(getCurrentUser).mockResolvedValueOnce(user());

      renderAuth();
      await settled();

      vi.mocked(getCurrentUser).mockRejectedValueOnce(new Error('502'));
      await userEvent.click(screen.getByText('refresh'));

      await waitFor(() => expect(getCurrentUser).toHaveBeenCalledTimes(2));
      expect(screen.getByTestId('state')).toHaveTextContent('in');
      expect(screen.getByTestId('email')).toHaveTextContent('jane@biz.com');
    });

    it('does not call the server when nobody is signed in', async () => {
      vi.mocked(getCurrentUser).mockRejectedValue(new Error('Invalid token'));

      renderAuth();
      await settled();
      await userEvent.click(screen.getByText('refresh'));

      expect(getCurrentUser).toHaveBeenCalledTimes(1);
    });
  });

  describe('signing out', () => {
    it('clears the cookie server-side and resets everything local', async () => {
      localStorage.setItem('lightor', 'legacy-jwt');
      vi.mocked(cookieSync).mockResolvedValue(undefined);
      vi.mocked(getCurrentUser).mockResolvedValue(user());
      vi.mocked(serverLogout).mockResolvedValue(undefined);

      renderAuth();
      await settled();
      await userEvent.click(screen.getByText('logout'));

      expect(serverLogout).toHaveBeenCalled();
      expect(screen.getByTestId('state')).toHaveTextContent('out');
      expect(localStorage.getItem('lightor')).toBeNull();
      expect(dispatch).toHaveBeenCalled();
      expect(navigate).toHaveBeenCalledWith('/', { replace: true });
    });

    it('signs out locally even when the server call fails', async () => {
      // Fire-and-forget by design: the JWT dies at its own expiry, and a user
      // who clicked sign-out must not be left looking at their own dashboard.
      vi.mocked(getCurrentUser).mockResolvedValue(user());
      vi.mocked(serverLogout).mockRejectedValue(new Error('offline'));

      renderAuth();
      await settled();
      await act(async () => {
        await userEvent.click(screen.getByText('logout'));
      });

      expect(screen.getByTestId('state')).toHaveTextContent('out');
    });
  });

  describe('account updates', () => {
    it('merges the server response into the session', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(user());
      vi.mocked(updateUserInfo).mockResolvedValue(user({ email: 'new@biz.com' }));

      renderAuth();
      await settled();
      await userEvent.click(screen.getByText('update'));

      await waitFor(() => expect(screen.getByTestId('email')).toHaveTextContent('new@biz.com'));
      expect(updateUserInfo).toHaveBeenCalledWith('u1', { name: 'Jane Cohen' });
    });

    it('leaves the session untouched when the update fails', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(user());
      vi.mocked(updateUserInfo).mockRejectedValue(new Error('Failed to update account'));

      renderAuth();
      await settled();
      await userEvent.click(screen.getByText('update'));

      await waitFor(() => expect(updateUserInfo).toHaveBeenCalled());
      expect(screen.getByTestId('email')).toHaveTextContent('jane@biz.com');
      expect(screen.getByTestId('state')).toHaveTextContent('in');
    });

    it('re-reads the user after a password change rather than decoding a token', async () => {
      // The response rotates the session cookie server-side. Unpacking the
      // returned token would yield only { id, role } (LT-002).
      vi.mocked(getCurrentUser).mockResolvedValueOnce(user());
      vi.mocked(changePassword).mockResolvedValue({ success: true, token: 'rotated', message: 'ok' });
      vi.mocked(getCurrentUser).mockResolvedValueOnce(user({ email: 'jane@biz.com' }));

      renderAuth();
      await settled();
      await userEvent.click(screen.getByText('change-password'));

      await waitFor(() => expect(getCurrentUser).toHaveBeenCalledTimes(2));
      expect(screen.getByTestId('token')).toHaveTextContent('null');
    });

    it('does not re-read the user when the change was refused', async () => {
      vi.mocked(getCurrentUser).mockResolvedValueOnce(user());
      vi.mocked(changePassword).mockResolvedValue({ success: false, message: 'wrong password' });

      renderAuth();
      await settled();
      await userEvent.click(screen.getByText('change-password'));

      await waitFor(() => expect(changePassword).toHaveBeenCalled());
      expect(getCurrentUser).toHaveBeenCalledTimes(1);
    });
  });

  it('refuses to be used outside its provider', () => {
    // A component rendered outside the tree would otherwise read undefined and
    // fail somewhere far from the cause.
    const Orphan = (): null => {
      useAuth();
      return null;
    };
    // React re-reports a render-time throw to console and to window.onerror;
    // both are expected here and would otherwise bury the run in stack traces.
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const swallow = (event: ErrorEvent) => event.preventDefault();
    window.addEventListener('error', swallow);

    expect(() => render(<Orphan />)).toThrow('useAuth must be used within an AuthProvider');

    window.removeEventListener('error', swallow);
    consoleError.mockRestore();
  });
});
