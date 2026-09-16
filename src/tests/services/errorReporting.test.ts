import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { post } = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock('../../services/apiClient', () => ({ default: { post } }));

import {
  reportClientError,
  installGlobalErrorHandlers,
  describeError,
  setErrorReportingEnabled,
  resetErrorReportingForTests,
} from '../../services/errorReporting';

/**
 * The client crash channel (LT-170): production-only, de-duplicated, capped,
 * and wired to window 'error' / 'unhandledrejection' so failures outside
 * React's render path reach the operator too.
 */
describe('errorReporting', () => {
  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    post.mockReset();
    post.mockResolvedValue({ data: { success: true } });
    resetErrorReportingForTests();
    setErrorReportingEnabled(true);
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  it('posts a full report to the messaging API tagged with the app and the kind', async () => {
    const sent = await reportClientError({
      error: 'TypeError: boom',
      stack: 'at x',
      kind: 'error',
      userInfo: { id: 'u1', email: 'owner@example.com' },
    });
    expect(sent).toBe(true);
    expect(post).toHaveBeenCalledTimes(1);
    const [url, body] = post.mock.calls[0];
    expect(url).toMatch(/\/api\/messaging\/report-error$/);
    expect(body).toMatchObject({
      error: 'TypeError: boom',
      stack: 'at x',
      app: 'dashboard',
      kind: 'error',
      userInfo: { id: 'u1', email: 'owner@example.com' },
      url: window.location.href,
      userAgent: navigator.userAgent,
    });
    expect(typeof body.timestamp).toBe('string');
  });

  it('defaults the kind to a boundary catch', async () => {
    await reportClientError({ error: 'render died' });
    expect(post.mock.calls[0][1].kind).toBe('boundary');
  });

  it('only logs outside production', async () => {
    setErrorReportingEnabled(false);
    expect(await reportClientError({ error: 'dev only' })).toBe(false);
    expect(post).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalled();
  });

  it('sends each distinct message once per page load, five at most', async () => {
    expect(await reportClientError({ error: 'same' })).toBe(true);
    expect(await reportClientError({ error: 'same', kind: 'error' })).toBe(false);
    for (let i = 0; i < 7; i++) await reportClientError({ error: `bug ${i}` });
    expect(post).toHaveBeenCalledTimes(5);
  });

  it('drops noise that is not a bug in this app', async () => {
    for (const error of [
      'ResizeObserver loop limit exceeded',
      'Script error.',
      'AxiosError: Network Error',
      'TypeError: Failed to fetch',
      'TypeError: Load failed',
      '',
    ]) {
      expect(await reportClientError({ error })).toBe(false);
    }
    expect(post).not.toHaveBeenCalled();
  });

  it('never rejects when the API is down', async () => {
    post.mockRejectedValue(new Error('offline'));
    await expect(reportClientError({ error: 'x' })).resolves.toBe(false);
  });

  it('reports uncaught errors and unhandled rejections from the window, until uninstalled', async () => {
    // A stand-in for `window`: dispatching a real ErrorEvent on the jsdom
    // window makes Vitest itself report an unhandled error.
    const page = new EventTarget();
    const uninstall = installGlobalErrorHandlers(page);

    page.dispatchEvent(new ErrorEvent('error', { error: new RangeError('too far'), message: 'too far' }));
    page.dispatchEvent(Object.assign(new Event('unhandledrejection'), { reason: new Error('nobody awaited') }));
    await Promise.resolve();
    await Promise.resolve();

    expect(post).toHaveBeenCalledTimes(2);
    expect(post.mock.calls[0][1]).toMatchObject({ error: 'RangeError: too far', kind: 'error' });
    expect(post.mock.calls[1][1]).toMatchObject({ error: 'Error: nobody awaited', kind: 'unhandledrejection' });

    uninstall();
    page.dispatchEvent(new ErrorEvent('error', { error: new Error('after'), message: 'after' }));
    await Promise.resolve();
    expect(post).toHaveBeenCalledTimes(2);
  });

  it('describes whatever a browser can throw', () => {
    expect(describeError(new TypeError('x is undefined'))).toMatchObject({ message: 'TypeError: x is undefined' });
    expect(describeError('plain string')).toEqual({ message: 'plain string' });
    expect(describeError({ message: 'object-ish' })).toEqual({ message: 'object-ish' });
    expect(describeError({ code: 42 })).toEqual({ message: 'Non-error value: {"code":42}' });
  });
});
