import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { InternalAxiosRequestConfig } from 'axios';
import apiClient from '../../services/apiClient';
import { setUnauthorizedHandler } from '../../services/authInterceptor';
import { changePassword, deleteAccount, getCurrentUser, AuthRequestError } from '../../services/authApi';

vi.mock('../../services/nativeSession', () => ({ getCachedToken: vi.fn(() => null) }));

/**
 * LT-315 (H6) — a wrong password in "Change password" or "Delete account"
 * logged the owner out: the API answered 401 and the interceptor took every
 * 401 for an expired session. Driven through the real apiClient, so the
 * per-request flag is proven to survive axios's config merge.
 */
const answer = (status: number, data: unknown) => {
  apiClient.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
    if (status < 400) return { data, status, statusText: 'OK', headers: {}, config };
    // What axios's own adapters reject with: the config rides on the error.
    throw Object.assign(new Error(`Request failed with status code ${status}`), {
      isAxiosError: true,
      config,
      response: { data, status, statusText: '', headers: {}, config },
    });
  };
};

describe('credential checks are not session failures (LT-315)', () => {
  const expired = vi.fn();
  let unsubscribe: () => void;
  const originalAdapter = apiClient.defaults.adapter;

  beforeEach(() => {
    expired.mockReset();
    unsubscribe = setUnauthorizedHandler(expired);
  });
  afterEach(() => {
    unsubscribe();
    apiClient.defaults.adapter = originalAdapter;
  });

  it('a 401 "Current password is incorrect" on change-password stays the form\'s error', async () => {
    answer(401, { success: false, error: 'Current password is incorrect' });
    const error = await changePassword('typo', 'new1pass', 'new1pass').catch((e) => e);
    expect(error).toBeInstanceOf(AuthRequestError);
    expect(error.message).toBe('Current password is incorrect');
    expect(error.status).toBe(401);
    expect(expired).not.toHaveBeenCalled();
  });

  it('a 401 "Incorrect password" on delete-account stays the dialog\'s error', async () => {
    answer(401, { success: false, error: 'Incorrect password' });
    await expect(deleteAccount({ password: 'typo' })).rejects.toThrow('Incorrect password');
    expect(expired).not.toHaveBeenCalled();
  });

  it('the new 400 WRONG_PASSWORD carries its code', async () => {
    answer(400, { success: false, error: 'Incorrect password', code: 'WRONG_PASSWORD' });
    const error = await deleteAccount({ password: 'typo' }).catch((e) => e);
    expect(error.code).toBe('WRONG_PASSWORD');
    expect(error.status).toBe(400);
    expect(expired).not.toHaveBeenCalled();
  });

  it("the auth middleware's own 401 on a credential check still ends the session", async () => {
    answer(401, { success: false, error: 'Not authorized, token failed' });
    await expect(deleteAccount({ password: 'secret' })).rejects.toBeInstanceOf(AuthRequestError);
    expect(expired).toHaveBeenCalledTimes(1);
  });

  it('any 401 elsewhere still ends the session', async () => {
    answer(401, { success: false, error: 'Current password is incorrect' });
    await expect(getCurrentUser()).rejects.toThrow();
    expect(expired).toHaveBeenCalledTimes(1);
  });
});
