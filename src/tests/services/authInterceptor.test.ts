import { describe, it, expect, vi } from 'vitest';
import type { AxiosError, AxiosInstance } from 'axios';
import { install401Handler, setUnauthorizedHandler } from '../../services/authInterceptor';

// A minimal axios-like instance that captures the rejection handler passed to
// interceptors.response.use, so we can drive it with synthetic errors.
function mockInstance() {
  let onRejected: ((e: AxiosError) => unknown) | undefined;
  const instance = {
    interceptors: {
      response: {
        use: (_ok: unknown, err: (e: AxiosError) => unknown) => {
          onRejected = err;
        },
      },
    },
  } as unknown as AxiosInstance;
  return { instance, throwWith: (e: Partial<AxiosError>) => onRejected!(e as AxiosError) };
}

const errWith = (status?: number): Partial<AxiosError> => ({
  response: status ? ({ status } as AxiosError['response']) : undefined,
});

describe('authInterceptor', () => {
  it('reports a 401 to the registered handler and still rejects', async () => {
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    const { instance, throwWith } = mockInstance();
    install401Handler(instance);

    const original = errWith(401);
    await expect(throwWith(original) as Promise<never>).rejects.toBe(original);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('ignores non-401 responses', async () => {
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    const { instance, throwWith } = mockInstance();
    install401Handler(instance);

    await expect(throwWith(errWith(500)) as Promise<never>).rejects.toBeDefined();
    await expect(throwWith(errWith(403)) as Promise<never>).rejects.toBeDefined();
    await expect(throwWith(errWith(undefined)) as Promise<never>).rejects.toBeDefined(); // network error, no response
    expect(handler).not.toHaveBeenCalled();
  });

  it('stops reporting after the handler is unsubscribed', async () => {
    const handler = vi.fn();
    const unsubscribe = setUnauthorizedHandler(handler);
    const { instance, throwWith } = mockInstance();
    install401Handler(instance);

    unsubscribe();
    await expect(throwWith(errWith(401)) as Promise<never>).rejects.toBeDefined();
    expect(handler).not.toHaveBeenCalled();
  });
});
