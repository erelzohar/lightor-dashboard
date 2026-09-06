import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AxiosRequestConfig } from 'axios';
import apiClient from '../../services/apiClient';
import { getCachedToken } from '../../services/nativeSession';

vi.mock('../../services/nativeSession', () => ({ getCachedToken: vi.fn(() => null) }));

/** Swap the network for an adapter that echoes the outgoing config. */
const sentHeaders = async (): Promise<Record<string, unknown>> => {
  let captured: AxiosRequestConfig | undefined;
  apiClient.defaults.adapter = async (config) => {
    captured = config;
    return { data: {}, status: 200, statusText: 'OK', headers: {}, config };
  };
  await apiClient.get('https://api.test/x');
  return { ...(captured!.headers as Record<string, unknown>) };
};

/**
 * The request interceptor (LT-128): inside the app the session is a Bearer
 * from nativeSession; on the web it is the cookie, with the LT-009
 * localStorage shim as the only remaining Bearer source.
 */
describe('apiClient Bearer', () => {
  beforeEach(() => {
    vi.mocked(getCachedToken).mockReturnValue(null);
    localStorage.clear();
  });

  it('sends nothing when there is no token anywhere (cookie session)', async () => {
    expect((await sentHeaders()).Authorization).toBeUndefined();
  });

  it('attaches the native session as a Bearer', async () => {
    vi.mocked(getCachedToken).mockReturnValue('native-jwt');
    expect((await sentHeaders()).Authorization).toBe('Bearer native-jwt');
  });

  it('keeps the web-only localStorage shim', async () => {
    localStorage.setItem('lightor', 'legacy-jwt');
    expect((await sentHeaders()).Authorization).toBe('Bearer legacy-jwt');
  });

  it('prefers the native session over a stray legacy token', async () => {
    vi.mocked(getCachedToken).mockReturnValue('native-jwt');
    localStorage.setItem('lightor', 'legacy-jwt');
    expect((await sentHeaders()).Authorization).toBe('Bearer native-jwt');
  });
});
