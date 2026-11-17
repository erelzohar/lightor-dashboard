import { describe, it, expect, vi, afterEach } from 'vitest';
import { CodeFrameError, closeCodeFrame, confirmFrameCode, sendFrameCode, setCodeFrameTexts } from '../../services/codeFrame';
import { FRAME_ORIGIN, frameElement, frameRoot, frameSays, settle, watchFrame } from '../helpers/codeFrame';

/**
 * LT-677: the page's side of the code frame. One hidden frame on
 * lightor.app, told to send and to confirm with `postMessage`, answered the
 * same way; only the frame itself, from its own origin, is listened to.
 */
const PHONE = '+12125550123';

/** A send as far as the frame being asked: the frame says it is ready, and the page posts. */
const startSend = async (phone = PHONE, lang = 'en') => {
  const onAsked = vi.fn();
  const sending = sendFrameCode(phone, lang, onAsked);
  // Its failures are the test's to look at, when it looks.
  sending.catch(() => {});
  const posted = watchFrame();
  frameSays({ type: 'lt-code-ready' });
  await settle();
  return { sending, posted, onAsked };
};

const sendCode = async () => {
  const { sending, posted } = await startSend();
  frameSays({ type: 'lt-code-sent' });
  await sending;
  return posted;
};

afterEach(() => {
  closeCodeFrame();
  vi.useRealTimers();
  vi.unstubAllEnvs();
  setCodeFrameTexts({ title: 'Phone code', close: 'Close' });
});

describe('the code frame (LT-677)', () => {
  it('puts one unseen frame on the page, at lightor.app, for this page and language', async () => {
    expect(frameRoot()).toBeNull();
    const { posted } = await startSend(PHONE, 'he');
    const iframe = frameElement()!;
    const url = new URL(iframe.src);
    expect(`${url.origin}${url.pathname}`).toBe('https://lightor.app/__lt-code');
    expect(url.searchParams.get('parent')).toBe(window.location.origin);
    expect(url.searchParams.get('lang')).toBe('he');
    expect(document.querySelectorAll('[data-testid="phone-code-frame"]')).toHaveLength(1);

    // Unseen and out of reach.
    const root = frameRoot()!;
    expect(root).toHaveAttribute('aria-hidden', 'true');
    expect(root).toHaveAttribute('inert');
    expect(root.className).toContain('opacity-0');
    expect(root.className).toContain('pointer-events-none');
    expect(iframe.tabIndex).toBe(-1);
    expect(posted).toHaveBeenCalledTimes(1);
  });

  it('takes its address from VITE_CODE_FRAME_URL when one is set', async () => {
    vi.stubEnv('VITE_CODE_FRAME_URL', 'http://localhost:8787/__lt-code');
    const sending = sendFrameCode(PHONE, 'en');
    sending.catch(() => {});
    expect(frameElement()!.src.startsWith('http://localhost:8787/__lt-code?parent=')).toBe(true);
    const posted = watchFrame();
    // The frame's origin is now that address's: lightor.app is nobody here.
    frameSays({ type: 'lt-code-ready' });
    await settle();
    expect(posted).not.toHaveBeenCalled();
    frameSays({ type: 'lt-code-ready' }, { origin: 'http://localhost:8787' });
    await settle();
    expect(posted).toHaveBeenCalledWith({ type: 'lt-code-send', phone: PHONE, lang: 'en' }, 'http://localhost:8787');
  });

  it('asks nothing of the frame until it says it is ready, then posts the send to its origin', async () => {
    const onAsked = vi.fn();
    const sending = sendFrameCode(PHONE, 'en', onAsked);
    const posted = watchFrame();
    await settle();
    expect(posted).not.toHaveBeenCalled();
    expect(onAsked).not.toHaveBeenCalled();

    frameSays({ type: 'lt-code-ready' });
    await settle();
    expect(posted).toHaveBeenCalledTimes(1);
    expect(posted).toHaveBeenCalledWith({ type: 'lt-code-send', phone: PHONE, lang: 'en' }, FRAME_ORIGIN);
    expect(onAsked).toHaveBeenCalledTimes(1);

    frameSays({ type: 'lt-code-sent' });
    await expect(sending).resolves.toBeUndefined();
    // The frame stays: the code is confirmed where it was sent.
    expect(frameRoot()).not.toBeNull();
  });

  it('confirms the code in the same frame, hands back the idToken, and takes the frame away', async () => {
    const posted = await sendCode();
    const confirming = confirmFrameCode('123456');
    expect(posted).toHaveBeenLastCalledWith({ type: 'lt-code-confirm', code: '123456' }, FRAME_ORIGIN);
    frameSays({ type: 'lt-code-verified', idToken: 'firebase-id-token' });
    await expect(confirming).resolves.toBe('firebase-id-token');
    expect(frameRoot()).toBeNull();
    expect(posted).toHaveBeenCalledTimes(2);
  });

  it('listens only to the frame itself, from its own origin', async () => {
    const { sending } = await startSend();
    let done = false;
    void sending.then(() => {
      done = true;
    });
    // Another origin, even from the frame's window.
    frameSays({ type: 'lt-code-sent' }, { origin: 'https://evil.example' });
    // The right origin from another window, and from nowhere.
    frameSays({ type: 'lt-code-sent' }, { source: window });
    frameSays({ type: 'lt-code-sent' }, { source: null });
    // Not a message at all.
    frameSays('lt-code-sent');
    frameSays(null);
    await settle();
    expect(done).toBe(false);

    frameSays({ type: 'lt-code-sent' });
    await settle();
    expect(done).toBe(true);
  });

  it("hands on the frame's refusal of a send, takes the frame away, and does not try again", async () => {
    const { sending, posted } = await startSend();
    frameSays({ type: 'lt-code-error', stage: 'send', code: 'auth/too-many-requests' });
    await expect(sending).rejects.toMatchObject({ name: 'CodeFrameError', code: 'auth/too-many-requests', stage: 'send' });
    await expect(sending).rejects.toBeInstanceOf(CodeFrameError);
    expect(frameRoot()).toBeNull();
    await settle();
    expect(posted).toHaveBeenCalledTimes(1);
  });

  it('lets a wrong code be typed again, and lets go of an expired one', async () => {
    const posted = await sendCode();
    const wrong = confirmFrameCode('000000');
    frameSays({ type: 'lt-code-error', stage: 'confirm', code: 'auth/invalid-verification-code' });
    await expect(wrong).rejects.toMatchObject({ code: 'auth/invalid-verification-code', stage: 'confirm' });
    expect(frameRoot()).not.toBeNull();

    const expired = confirmFrameCode('123456');
    frameSays({ type: 'lt-code-error', stage: 'confirm', code: 'auth/code-expired' });
    await expect(expired).rejects.toMatchObject({ code: 'auth/code-expired' });
    expect(frameRoot()).toBeNull();
    expect(posted).toHaveBeenCalledTimes(3);

    // No frame, no code to confirm: nothing is made for it.
    await expect(confirmFrameCode('123456')).rejects.toMatchObject({ code: 'lt/no-code-sent', stage: 'confirm' });
    expect(frameRoot()).toBeNull();
  });

  it('sends again in the frame that is already there', async () => {
    const posted = await sendCode();
    const again = sendFrameCode(PHONE, 'en');
    await settle();
    expect(document.querySelectorAll('[data-testid="phone-code-frame"]')).toHaveLength(1);
    expect(posted).toHaveBeenLastCalledWith({ type: 'lt-code-send', phone: PHONE, lang: 'en' }, FRAME_ORIGIN);
    frameSays({ type: 'lt-code-sent' });
    await expect(again).resolves.toBeUndefined();
  });

  it('does one thing at a time', async () => {
    const { sending, posted } = await startSend();
    await expect(sendFrameCode(PHONE, 'en')).rejects.toMatchObject({ code: 'lt/busy' });
    await expect(confirmFrameCode('123456')).rejects.toMatchObject({ code: 'lt/busy' });
    expect(posted).toHaveBeenCalledTimes(1);
    // The send that is on its way is not hurt by it.
    frameSays({ type: 'lt-code-sent' });
    await expect(sending).resolves.toBeUndefined();
  });

  it('refuses what the frame would drop without a word, before any frame is made', async () => {
    await expect(sendFrameCode('0501234567', 'en')).rejects.toMatchObject({ code: 'auth/invalid-phone-number' });
    expect(frameRoot()).toBeNull();
    await sendCode();
    await expect(confirmFrameCode('12ab')).rejects.toMatchObject({ code: 'auth/invalid-verification-code' });
  });

  it('gives up on a frame that never loads, and on a send that is never answered', async () => {
    vi.useFakeTimers();
    const sending = sendFrameCode(PHONE, 'en');
    const failed = expect(sending).rejects.toMatchObject({ code: 'lt/frame', stage: 'send' });
    await vi.advanceTimersByTimeAsync(20_000);
    await failed;
    expect(frameRoot()).toBeNull();

    const second = sendFrameCode(PHONE, 'en');
    const posted = watchFrame();
    frameSays({ type: 'lt-code-ready' });
    const timedOut = expect(second).rejects.toMatchObject({ code: 'lt/timeout', stage: 'send' });
    await vi.advanceTimersByTimeAsync(180_000);
    await timedOut;
    expect(frameRoot()).toBeNull();
    expect(posted).toHaveBeenCalledTimes(1);
  });

  it('lets go of a code nobody confirmed after ten minutes', async () => {
    vi.useFakeTimers();
    const sending = sendFrameCode(PHONE, 'en');
    watchFrame();
    frameSays({ type: 'lt-code-ready' });
    await vi.advanceTimersByTimeAsync(0);
    frameSays({ type: 'lt-code-sent' });
    await sending;
    await vi.advanceTimersByTimeAsync(9 * 60_000);
    expect(frameRoot()).not.toBeNull();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(frameRoot()).toBeNull();
  });

  describe("when Google's check has something to show", () => {
    it('shows the frame in a small named panel until the check is done', async () => {
      setCodeFrameTexts({ title: 'A quick check', close: 'Close it' });
      const opener = document.createElement('button');
      document.body.appendChild(opener);
      opener.focus();

      const { sending } = await startSend();
      frameSays({ type: 'lt-code-attention', on: true });
      const root = frameRoot()!;
      expect(root).toHaveAttribute('role', 'dialog');
      expect(root).toHaveAttribute('aria-modal', 'true');
      expect(root).toHaveAttribute('aria-label', 'A quick check');
      expect(root).not.toHaveAttribute('aria-hidden');
      expect(root).not.toHaveAttribute('inert');
      expect(root.className).toContain('bg-black/60');
      expect(root.className).not.toContain('opacity-0');
      expect(root).toHaveTextContent('A quick check');
      expect(root.querySelector('button')).toHaveAttribute('aria-label', 'Close it');
      expect(frameElement()!.tabIndex).toBe(0);
      expect(frameElement()).toHaveFocus();

      frameSays({ type: 'lt-code-attention', on: false });
      expect(root).toHaveAttribute('aria-hidden', 'true');
      expect(root).not.toHaveAttribute('role');
      expect(root.className).toContain('opacity-0');
      expect(opener).toHaveFocus();

      frameSays({ type: 'lt-code-sent' });
      await expect(sending).resolves.toBeUndefined();
      opener.remove();
    });

    it.each([
      ['its close button', () => frameRoot()!.querySelector('button')!.click()],
      ['Escape', () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))],
    ])('is left by %s: the send is given up and the frame goes', async (_name, leave) => {
      const { sending, posted } = await startSend();
      frameSays({ type: 'lt-code-attention', on: true });
      leave();
      await expect(sending).rejects.toMatchObject({ code: 'lt/cancelled', stage: 'send' });
      expect(frameRoot()).toBeNull();
      expect(posted).toHaveBeenCalledTimes(1);
    });

    it('leaves Escape alone while the frame is unseen', async () => {
      const { sending } = await startSend();
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      expect(frameRoot()).not.toBeNull();
      frameSays({ type: 'lt-code-sent' });
      await expect(sending).resolves.toBeUndefined();
    });
  });

  it('is taken away with whatever waited on it', async () => {
    const { sending } = await startSend();
    closeCodeFrame();
    await expect(sending).rejects.toMatchObject({ code: 'lt/cancelled' });
    expect(frameRoot()).toBeNull();
    // Nothing is listening any more.
    frameSays({ type: 'lt-code-sent' });
    closeCodeFrame();
  });
});
