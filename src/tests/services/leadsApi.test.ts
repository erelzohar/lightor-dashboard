import { describe, it, expect, vi, afterEach } from 'vitest';
import apiClient from '../../services/apiClient';
import { fetchLeadStats, type LeadStats } from '../../services/leadsApi';
import globals from '../../services/globals';

/**
 * The leads home's numbers (LT-274): `/api/leads/stats`, with the same
 * session as every leads call — the cookie, plus the legacy Bearer shim —
 * unwrapped from `{ success, data }`.
 */
describe('fetchLeadStats', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('reads /api/leads/stats with the session and unwraps the numbers', async () => {
    localStorage.setItem('lightor', 'legacy-token');
    const stats: LeadStats = {
      thisMonth: 3, lastMonth: 1, waiting: 1, last30: { total: 3, handled: 2 }, avgResponseMs: null,
      perDay: [{ date: '2026-10-13', count: 3 }], topic: null,
    };
    const get = vi.spyOn(apiClient, 'get').mockResolvedValue({ data: { success: true, data: stats } } as never);

    await expect(fetchLeadStats()).resolves.toEqual(stats);
    expect(get).toHaveBeenCalledWith(
      `${globals.leadsUrl}stats`,
      expect.objectContaining({
        withCredentials: true,
        headers: expect.objectContaining({ Authorization: 'Bearer legacy-token' }),
      })
    );
  });

  it('throws on failure, so the home can leave the numbers out', async () => {
    vi.spyOn(apiClient, 'get').mockRejectedValue(new Error('Network Error'));
    await expect(fetchLeadStats()).rejects.toThrow('Network Error');
  });
});
