import { describe, it, expect, vi, afterEach } from 'vitest';
import axios from 'axios';
import {
  fetchOverview,
  fetchUsers,
  createUser,
  changeUserRole,
  deleteUser,
  fetchCostsSummary,
} from '../../services/adminApi';
import globals from '../../services/globals';

/**
 * The admin API client (LT-058).
 *
 * Opposite failure contract to entitlementsApi: admin pages need REAL
 * failures, so every function throws on error — the pages catch and toast.
 */
describe('adminApi', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('carries the session cookie and unwraps the envelope', async () => {
    const overview = { totals: {}, funnel: {}, mrr: {}, paddleEnv: 'sandbox' };
    const get = vi
      .spyOn(axios, 'get')
      .mockResolvedValue({ data: { success: true, data: overview } } as never);

    await expect(fetchOverview()).resolves.toEqual(overview);
    expect(get).toHaveBeenCalledWith(
      `${globals.adminUrl}overview`,
      expect.objectContaining({ withCredentials: true })
    );
  });

  it('adds the legacy Bearer shim when a token is stored (handoff sessions)', async () => {
    localStorage.setItem('lightor', 'legacy-token');
    const get = vi
      .spyOn(axios, 'get')
      .mockResolvedValue({ data: { success: true, data: {} } } as never);

    await fetchOverview();
    expect(get).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer legacy-token' }),
      })
    );
  });

  it('serializes list queries as params and returns the full paginated envelope', async () => {
    const envelope = {
      success: true,
      count: 1,
      pagination: { total: 1, page: 2, limit: 20, pages: 1 },
      data: [{ _id: 'u1' }],
    };
    const get = vi.spyOn(axios, 'get').mockResolvedValue({ data: envelope } as never);

    const result = await fetchUsers({ page: 2, search: 'acme', subscriptionStatus: 'active' });
    expect(result.pagination.page).toBe(2);
    expect(get).toHaveBeenCalledWith(
      `${globals.adminUrl}users`,
      expect.objectContaining({
        params: expect.objectContaining({ page: 2, search: 'acme', subscriptionStatus: 'active' }),
      })
    );
  });

  it('sends mutations with the right verb, path and body', async () => {
    const request = vi
      .spyOn(axios, 'request')
      .mockResolvedValue({ data: { success: true } } as never);

    await changeUserRole('u9', 'admin');
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'patch',
        url: `${globals.adminUrl}users/u9/role`,
        data: { role: 'admin' },
        withCredentials: true,
      })
    );

    await deleteUser('u9', 'owner@biz.com');
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'delete',
        url: `${globals.adminUrl}users/u9`,
        data: { confirmEmail: 'owner@biz.com' },
      })
    );
  });

  it('creates a user via POST and unwraps the created row', async () => {
    const request = vi
      .spyOn(axios, 'request')
      .mockResolvedValue({ data: { success: true, data: { _id: 'u_new' } } } as never);

    const created = await createUser({
      name: 'New Biz',
      email: 'new@biz.com',
      username: 'newbiz',
      password: 'secret123',
      isVerified: true,
    });

    expect(created._id).toBe('u_new');
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'post',
        url: `${globals.adminUrl}users`,
        data: expect.objectContaining({ username: 'newbiz', isVerified: true }),
        withCredentials: true,
      })
    );
  });

  it('propagates failures instead of swallowing them', async () => {
    vi.spyOn(axios, 'get').mockRejectedValue(new Error('403') as never);
    await expect(fetchCostsSummary('2026-08')).rejects.toThrow('403');
  });
});
