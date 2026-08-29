import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import apiClient from '../../services/apiClient';
import {
  loginUser,
  googleLogin,
  facebookLogin,
  getCurrentUser,
  handoffLogin,
  cookieSync,
  serverLogout,
  deleteAccount,
  changePassword,
  resendVerification,
} from '../../services/authApi';
import globals from '../../services/globals';

/**
 * Every authenticated call in the dashboard (LT-009).
 *
 * The session is an HttpOnly cookie, which means `withCredentials: true` is
 * the entire authentication mechanism for these requests — omit it on one
 * call and that endpoint returns 401 forever, with nothing in the client to
 * suggest why. That is the shape of the bug that killed anonymous signup for
 * weeks (LT-025) and the contact form for months (LT-035), so it is asserted
 * call by call rather than assumed.
 */
describe('authApi', () => {
  const authUrl = globals.authUrl;

  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const ok = (data: unknown = { success: true, data: { _id: 'u1' }, token: 'jwt' }) =>
    ({ data }) as never;

  describe('carries the session cookie', () => {
    it('on login', async () => {
      const post = vi.spyOn(apiClient, 'post').mockResolvedValue(ok());

      await loginUser('jane@biz.com', 'secret');

      expect(post).toHaveBeenCalledWith(
        `${authUrl}login`,
        { email: 'jane@biz.com', password: 'secret', staySignedIn: false },
        { withCredentials: true }
      );
    });

    it('forwards the remember-me flag when set', async () => {
      const post = vi.spyOn(apiClient, 'post').mockResolvedValue(ok());

      await loginUser('jane@biz.com', 'secret', true);

      expect(post).toHaveBeenCalledWith(
        `${authUrl}login`,
        { email: 'jane@biz.com', password: 'secret', staySignedIn: true },
        { withCredentials: true }
      );
    });

    it('on google login', async () => {
      const post = vi.spyOn(apiClient, 'post').mockResolvedValue(ok());

      await googleLogin('g-credential');

      expect(post).toHaveBeenCalledWith(
        `${authUrl}google`,
        { token: 'g-credential' },
        { withCredentials: true }
      );
    });

    it('on facebook login', async () => {
      const post = vi.spyOn(apiClient, 'post').mockResolvedValue(ok());

      await facebookLogin('fb-access-token');

      expect(post).toHaveBeenCalledWith(
        `${authUrl}facebook`,
        { accessToken: 'fb-access-token' },
        { withCredentials: true }
      );
    });

    it('on /me', async () => {
      const get = vi.spyOn(apiClient, 'get').mockResolvedValue(ok());

      await getCurrentUser();

      expect(get).toHaveBeenCalledWith(
        `${authUrl}me`,
        expect.objectContaining({ withCredentials: true })
      );
    });

    it('on logout', async () => {
      const get = vi.spyOn(apiClient, 'get').mockResolvedValue(ok());

      await serverLogout();

      expect(get).toHaveBeenCalledWith(`${authUrl}logout`, { withCredentials: true });
    });

    it('on account deletion', async () => {
      const del = vi.spyOn(apiClient, 'delete').mockResolvedValue(ok({ success: true }));

      await deleteAccount({ password: 'secret' });

      expect(del).toHaveBeenCalledWith(
        `${authUrl}me`,
        expect.objectContaining({ withCredentials: true, data: { password: 'secret' } })
      );
    });

    it('on a password change', async () => {
      const put = vi.spyOn(apiClient, 'put').mockResolvedValue(ok({ success: true, message: 'ok' }));

      await changePassword('old', 'new', 'new');

      expect(put).toHaveBeenCalledWith(
        `${authUrl}change-password`,
        { currentPassword: 'old', newPassword: 'new', confirmNewPassword: 'new' },
        expect.objectContaining({ withCredentials: true })
      );
    });
  });

  describe('the pre-cookie Bearer shim', () => {
    // Sessions created before LT-009 live in localStorage. The header is added
    // only when one exists — sending `Bearer null` would be worse than sending
    // nothing, because it is a token the API must reject.
    it('is absent when no legacy token is stored', async () => {
      const get = vi.spyOn(apiClient, 'get').mockResolvedValue(ok());

      await getCurrentUser();

      expect(get.mock.calls[0][1]).not.toHaveProperty('headers');
    });

    it('is attached when a legacy token is stored', async () => {
      localStorage.setItem('lightor', 'legacy-jwt');
      const get = vi.spyOn(apiClient, 'get').mockResolvedValue(ok());

      await getCurrentUser();

      expect(get.mock.calls[0][1]).toMatchObject({
        headers: { Authorization: 'Bearer legacy-jwt' },
      });
    });
  });

  describe('handoff', () => {
    it('posts the token and returns the new user', async () => {
      const post = vi.spyOn(apiClient, 'post').mockResolvedValue(
        ok({ success: true, token: 'jwt', data: { _id: 'u9', email: 'new@biz.com' } })
      );

      const result = await handoffLogin('ho_abc');

      expect(post).toHaveBeenCalledWith(
        `${authUrl}handoff`,
        { token: 'ho_abc' },
        { withCredentials: true }
      );
      expect(result.user).toMatchObject({ _id: 'u9' });
    });

    it('throws on an unsuccessful exchange', async () => {
      // An expired handoff token answers 200 with success:false. Treating that
      // as a session would leave the browser on whatever stale account it had.
      vi.spyOn(apiClient, 'post').mockResolvedValue(ok({ success: false }));

      await expect(handoffLogin('ho_expired')).rejects.toThrow('Handoff failed');
    });
  });

  describe('cookieSync', () => {
    it('proves the legacy session with a Bearer and asks for a cookie', async () => {
      const post = vi.spyOn(apiClient, 'post').mockResolvedValue(ok({ success: true }));

      await cookieSync('legacy-jwt');

      expect(post).toHaveBeenCalledWith(
        `${authUrl}cookie-sync`,
        {},
        { withCredentials: true, headers: { Authorization: 'Bearer legacy-jwt' } }
      );
    });

    it('throws when the server refuses', async () => {
      vi.spyOn(apiClient, 'post').mockResolvedValue(ok({ success: false }));

      await expect(cookieSync('forged')).rejects.toThrow('Cookie sync failed');
    });
  });

  describe('failure handling', () => {
    it('reports bad credentials as such', async () => {
      vi.spyOn(apiClient, 'post').mockRejectedValue(new Error('401'));

      await expect(loginUser('jane', 'wrong')).rejects.toThrow('Invalid credentials');
    });

    it('rejects /me rather than returning undefined', async () => {
      // AuthContext treats a rejection as "not signed in". Returning undefined
      // instead would mark the session authenticated with a null user.
      vi.spyOn(apiClient, 'get').mockRejectedValue(new Error('401'));

      await expect(getCurrentUser()).rejects.toThrow('Invalid token');
    });

    it('never blocks logout on a network failure', async () => {
      // Only the server can clear an HttpOnly cookie, but a user who clicked
      // sign-out must still end up signed out locally.
      vi.spyOn(apiClient, 'get').mockRejectedValue(new Error('offline'));

      await expect(serverLogout()).resolves.toBeUndefined();
    });

    it('surfaces the server message when deletion fails', async () => {
      // Deletion aborts if the Paddle subscription cannot be cancelled, so the
      // reason matters: "nothing was deleted" is a different instruction to the
      // user than a generic failure (LT-031).
      vi.spyOn(apiClient, 'delete').mockRejectedValue({
        response: { data: { error: 'Could not cancel your subscription' } },
      });

      await expect(deleteAccount({ password: 'secret' })).rejects.toThrow(
        'Could not cancel your subscription'
      );
    });

    it('falls back to a generic message when the server sends none', async () => {
      vi.spyOn(apiClient, 'delete').mockRejectedValue(new Error('network'));

      await expect(deleteAccount({ confirmEmail: 'a@b.com' })).rejects.toThrow(
        'Account deletion failed'
      );
    });

    it('surfaces the server message when a password change fails', async () => {
      vi.spyOn(apiClient, 'put').mockRejectedValue({
        response: { data: { error: 'Current password is incorrect' } },
      });

      await expect(changePassword('wrong', 'new', 'new')).rejects.toThrow(
        'Current password is incorrect'
      );
    });
  });

  it('resends verification without credentials', async () => {
    // Deliberately unauthenticated: the whole point is that the account cannot
    // yet prove anything, and the email address is the only identifier.
    const post = vi.spyOn(apiClient, 'post').mockResolvedValue(ok({ success: true }));

    await resendVerification('jane@biz.com');

    expect(post).toHaveBeenCalledWith(`${authUrl}resend-verification`, { email: 'jane@biz.com' });
  });
});
