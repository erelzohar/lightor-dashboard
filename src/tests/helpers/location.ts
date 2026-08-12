import { vi } from 'vitest';

/**
 * jsdom's `window.location` is a live object with no navigation behind it:
 * `replace` and `assign` log "Not implemented" and do nothing, and its members
 * cannot be spied on. The property itself *is* configurable, so swapping the
 * whole object is the way to both control the URL a component reads and
 * observe where it tried to send the browser.
 */
const original = window.location;

export const stubLocation = (url: string) => {
  const parsed = new URL(url);
  const replace = vi.fn();
  const assign = vi.fn();

  Object.defineProperty(window, 'location', {
    configurable: true,
    value: {
      href: parsed.href,
      origin: parsed.origin,
      protocol: parsed.protocol,
      host: parsed.host,
      hostname: parsed.hostname,
      port: parsed.port,
      pathname: parsed.pathname,
      search: parsed.search,
      hash: parsed.hash,
      replace,
      assign,
      reload: vi.fn(),
      toString: () => parsed.href,
    },
  });

  return { replace, assign };
};

export const restoreLocation = () => {
  Object.defineProperty(window, 'location', { configurable: true, value: original });
};
