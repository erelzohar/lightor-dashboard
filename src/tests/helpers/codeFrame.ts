import { vi } from 'vitest';

/**
 * LT-677: the code frame, faked. jsdom loads nothing into the frame the
 * helper makes, so the test plays its part: it reads what the page posted
 * to it and answers as the real frame on lightor.app would.
 */
export const FRAME_ORIGIN = 'https://lightor.app';

export const frameRoot = (): HTMLElement | null => document.querySelector('[data-testid="phone-code-frame"]');
export const frameElement = (): HTMLIFrameElement | null => frameRoot()?.querySelector('iframe') ?? null;

/** The messages the page posted to the frame, with the origin each was aimed at. */
export const watchFrame = () => {
  const iframe = frameElement();
  if (!iframe?.contentWindow) throw new Error('The code frame is not on the page');
  const posted = vi.fn();
  iframe.contentWindow.postMessage = posted as never;
  return posted;
};

/** A message as the frame sends it; `from` fakes another sender. */
export const frameSays = (data: unknown, from: { origin?: string; source?: MessageEventSource | null } = {}) => {
  window.dispatchEvent(
    new MessageEvent('message', {
      data,
      origin: from.origin ?? FRAME_ORIGIN,
      source: from.source === undefined ? frameElement()?.contentWindow ?? null : from.source,
    })
  );
};

/** Lets the page's awaits run. */
export const settle = async () => {
  for (let i = 0; i < 10; i += 1) await Promise.resolve();
};
