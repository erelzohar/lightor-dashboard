import { describe, it, expect, vi, afterEach } from 'vitest';
import apiClient from '../../services/apiClient';
import globals from '../../services/globals';
import {
  checkDomain,
  connectDomain,
  disconnectDomain,
  domainErrorCode,
  domainErrorKey,
  domainErrorStatus,
  domainProofOf,
  fetchDomain,
  type DomainAnswer,
} from '../../services/domainApi';
import en from '../../i18n/locales/en.json';
import he from '../../i18n/locales/he.json';
import ar from '../../i18n/locales/ar.json';
import fr from '../../i18n/locales/fr.json';
import es from '../../i18n/locales/es.json';

/**
 * LT-661 (phase 2): the owner's domain routes, on the contract's shapes -
 * `GET / PUT { host } / DELETE /api/domain` and `POST /api/domain/check`,
 * each answering `{ success, data: DomainAnswer }`; a refusal is
 * `{ success: false, error, code }`, and a taken domain adds `proof`.
 */
const answer: DomainAnswer = {
  configured: true,
  allowed: true,
  target: 'sites.lightor.app',
  domain: { host: 'www.dana-studio.co.il', status: 'pending', stage: 'dns', connectedAt: '2026-11-15T10:00:00.000Z', expiresAt: '2026-11-18T10:00:00.000Z' },
};
const ok = { data: { success: true, data: answer } } as never;
const refusal = (status: number, code?: string, extra: Record<string, unknown> = {}) => ({
  response: { status, data: { success: false, error: 'English words from the server', ...(code ? { code } : {}), ...extra } },
});

describe('the domain routes', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('is /api/domain, with no trailing slash', () => {
    expect(globals.domainUrl).toMatch(/\/api\/domain$/);
  });

  it('reads the state: GET /api/domain', async () => {
    const get = vi.spyOn(apiClient, 'get').mockResolvedValue(ok);
    await expect(fetchDomain()).resolves.toEqual(answer);
    expect(get).toHaveBeenCalledTimes(1);
    expect(get).toHaveBeenCalledWith(globals.domainUrl);
  });

  it('connects: PUT /api/domain with the host as typed', async () => {
    const put = vi.spyOn(apiClient, 'put').mockResolvedValue(ok);
    await expect(connectDomain('https://Dana-Studio.co.il/')).resolves.toEqual(answer);
    expect(put).toHaveBeenCalledWith(globals.domainUrl, { host: 'https://Dana-Studio.co.il/' });
  });

  it('checks again: POST /api/domain/check, no body', async () => {
    const post = vi.spyOn(apiClient, 'post').mockResolvedValue(ok);
    await expect(checkDomain()).resolves.toEqual(answer);
    expect(post).toHaveBeenCalledWith(`${globals.domainUrl}/check`);
  });

  it('disconnects: DELETE /api/domain', async () => {
    const del = vi.spyOn(apiClient, 'delete').mockResolvedValue({ data: { success: true, data: { ...answer, domain: null } } } as never);
    await expect(disconnectDomain()).resolves.toEqual({ ...answer, domain: null });
    expect(del).toHaveBeenCalledWith(globals.domainUrl);
  });

  it('throws what the server refused, for the screen to put in words', async () => {
    const error = refusal(403, 'PLAN_REQUIRED');
    vi.spyOn(apiClient, 'put').mockRejectedValue(error);
    await expect(connectDomain('x.co.il')).rejects.toBe(error);
  });
});

describe("a refusal's words", () => {
  const CODES = ['INVALID_DOMAIN', 'DOMAIN_TAKEN', 'PLAN_REQUIRED', 'TOO_MANY', 'CLOUDFLARE_REFUSED', 'CLOUDFLARE_UNREACHABLE', 'DOMAINS_NOT_CONFIGURED', 'NO_SITE'];

  it.each(CODES)('%s has its own text', (code) => {
    const error = refusal(400, code);
    expect(domainErrorCode(error)).toBe(code);
    expect(domainErrorKey(error)).toBe(`settings.customDomain.errors.${code}`);
  });

  it('a code it does not know, no code, and no answer at all read as the general text', () => {
    expect(domainErrorKey(refusal(500, 'SOMETHING_NEW'))).toBe('settings.customDomain.errors.generic');
    expect(domainErrorKey(refusal(500))).toBe('settings.customDomain.errors.generic');
    expect(domainErrorKey(new Error('Network Error'))).toBe('settings.customDomain.errors.generic');
    expect(domainErrorKey(undefined)).toBe('settings.customDomain.errors.generic');
    expect(domainErrorCode({ response: { data: { code: 42 } } })).toBeUndefined();
  });

  it('knows the status of a refusal, and that no answer has none', () => {
    expect(domainErrorStatus(refusal(404))).toBe(404);
    expect(domainErrorStatus(new Error('Network Error'))).toBeUndefined();
  });

  it('every code, and the general text, is written in all five languages - never the code itself', () => {
    for (const locale of [en, he, ar, fr, es]) {
      const errors = (locale as unknown as { settings: { customDomain: { errors: Record<string, string> } } }).settings.customDomain.errors;
      for (const code of [...CODES, 'generic']) {
        expect(typeof errors[code], code).toBe('string');
        expect(errors[code].trim().length, code).toBeGreaterThan(5);
        expect(errors[code]).not.toContain(code);
      }
    }
  });
});

describe('the proof of a taken domain', () => {
  const proof = { name: '_lightor.www.dana-studio.co.il', value: 'lightor-site=0123456789abcdef0123456789abcdef' };

  it('is read from a 409 DOMAIN_TAKEN', () => {
    expect(domainProofOf(refusal(409, 'DOMAIN_TAKEN', { proof }))).toEqual(proof);
  });

  it('is nothing without a whole record, or on another refusal', () => {
    expect(domainProofOf(refusal(409, 'DOMAIN_TAKEN'))).toBeNull();
    expect(domainProofOf(refusal(409, 'DOMAIN_TAKEN', { proof: { name: proof.name } }))).toBeNull();
    expect(domainProofOf(refusal(409, 'DOMAIN_TAKEN', { proof: { name: '', value: proof.value } }))).toBeNull();
    expect(domainProofOf(refusal(409, 'DOMAIN_TAKEN', { proof: 'lightor-site=x' }))).toBeNull();
    expect(domainProofOf(refusal(400, 'INVALID_DOMAIN', { proof }))).toBeNull();
    expect(domainProofOf(new Error('Network Error'))).toBeNull();
  });
});
