import { describe, it, expect, vi, afterEach } from 'vitest';
import apiClient from '../../services/apiClient';
import { fetchMyEntitlements } from '../../services/entitlementsApi';
import globals from '../../services/globals';

/**
 * The plan/usage meter (LT-032).
 *
 * This drives decoration — the usage bar and the upgrade copy — so its one
 * hard rule is that it must never throw. A rejected promise here propagates
 * into the billing screen's effects and takes the whole account page down for
 * a number nobody would have missed.
 */
describe('fetchMyEntitlements', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  const entitlements = {
    plan: 'free',
    limits: { monthlyAppointments: 30, maxServices: 3, hourlyReminder: false, aiGenerationsPerMonth: 5, aiEditsPerMonth: 10, aiTokensPerMonth: null, showBranding: true },
    usage: { appointmentsThisMonth: 4, servicesCount: 2, aiGenerationsThisMonth: 1, aiTokensThisMonth: 1234 },
  };

  it('carries the session cookie', () => {
    const get = vi.spyOn(apiClient, 'get').mockResolvedValue({ data: { success: true, data: entitlements } } as never);

    return fetchMyEntitlements().then(() => {
      expect(get).toHaveBeenCalledWith(
        `${globals.entitlementsUrl}me`,
        expect.objectContaining({ withCredentials: true })
      );
    });
  });

  it('returns the server payload', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue({ data: { success: true, data: entitlements } } as never);

    await expect(fetchMyEntitlements()).resolves.toEqual(entitlements);
  });

  it('returns null when the request fails', async () => {
    vi.spyOn(apiClient, 'get').mockRejectedValue(new Error('500'));

    await expect(fetchMyEntitlements()).resolves.toBeNull();
  });

  it('returns null when the server reports failure', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue({ data: { success: false } } as never);

    await expect(fetchMyEntitlements()).resolves.toBeNull();
  });

  it('attaches the legacy Bearer only when one exists', async () => {
    const get = vi.spyOn(apiClient, 'get').mockResolvedValue({ data: { success: true, data: entitlements } } as never);

    await fetchMyEntitlements();
    expect(get.mock.calls[0][1]).not.toHaveProperty('headers');

    localStorage.setItem('lightor', 'legacy-jwt');
    await fetchMyEntitlements();
    expect(get.mock.calls[1][1]).toMatchObject({ headers: { Authorization: 'Bearer legacy-jwt' } });
  });
});
