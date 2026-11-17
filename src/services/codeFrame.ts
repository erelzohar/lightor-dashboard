/**
 * LT-677: a phone code for a number outside Israel.
 *
 * Abroad a code is sent and checked by Firebase phone sign-in, and Firebase
 * sends one only from lightor.app itself. So the sign-in runs in a frame
 * there (`https://lightor.app/__lt-code`, lightor-edge), and this is the
 * page's side of it: it owns the frame, talks to it with `postMessage`, and
 * hands back Firebase's `idToken`, which the API turns into the usual phone
 * proof (services/phoneCodeApi). No Firebase code, key or config is here.
 *
 *   page -> frame   { type: "lt-code-send", phone: "+1...", lang }
 *                   { type: "lt-code-confirm", code: "123456" }
 *   frame -> page   { type: "lt-code-ready" } · { type: "lt-code-sent" }
 *                   { type: "lt-code-verified", idToken }
 *                   { type: "lt-code-error", stage: "send" | "confirm", code }
 *                   { type: "lt-code-attention", on: boolean }
 *
 * The frame has nothing to look at and stays unseen, unless it asks for
 * attention (Google's check has something to show): then it sits in a small
 * panel over the page until the check is done.
 *
 * It lives from a send to the code's confirmation: the code can only be
 * confirmed in the frame that sent it. A failed send, an expired code, ten
 * idle minutes or `closeCodeFrame` take it away. Nothing here asks for a
 * code by itself or tries again: one call, one message to the frame.
 */

const DEFAULT_FRAME_URL = 'https://lightor.app/__lt-code';

const READY_MS = 20_000;
/** Long: Google's check may be waiting for the person. */
const SEND_MS = 180_000;
const CONFIRM_MS = 30_000;
const IDLE_MS = 10 * 60_000;

/** What the frame takes; anything else it drops without a word. */
const PHONE_RE = /^\+[1-9]\d{6,14}$/;
const CODE_RE = /^\d{4,8}$/;

export type CodeFrameStage = 'send' | 'confirm';

/**
 * A refusal from the frame. `code` is Firebase's ("auth/invalid-verification-code",
 * "auth/code-expired", "auth/too-many-requests", ...), the frame's own
 * ("lt/home-number", "lt/no-code-sent"), or this helper's: "lt/frame" (the
 * frame did not load), "lt/timeout", "lt/busy", "lt/cancelled", "lt/wait".
 */
export class CodeFrameError extends Error {
  readonly code: string;
  readonly stage: CodeFrameStage;

  constructor(code: string, stage: CodeFrameStage) {
    super(`Phone code ${stage} failed: ${code}`);
    this.name = 'CodeFrameError';
    this.code = code;
    this.stage = stage;
  }
}

/** The codes after which the frame holds no code to confirm. */
const CODE_GONE = new Set(['auth/code-expired', 'auth/session-expired', 'lt/no-code-sent', 'lt/timeout']);

const HIDDEN_CLASS = 'pointer-events-none fixed inset-0 z-[10150] flex items-center justify-center p-4 opacity-0';
const SHOWN_CLASS = 'fixed inset-0 z-[10150] flex items-center justify-center bg-black/60 p-4 overlay-safe';

interface Frame {
  root: HTMLDivElement;
  heading: HTMLSpanElement;
  closeButton: HTMLButtonElement;
  iframe: HTMLIFrameElement;
  origin: string;
  ready: Promise<void>;
  settleReady: (error?: CodeFrameError) => void;
  idle: ReturnType<typeof setTimeout> | null;
  shown: boolean;
  returnFocus: Element | null;
}

interface Waiting {
  stage: CodeFrameStage;
  resolve: (value?: string) => void;
  reject: (error: CodeFrameError) => void;
}

let frame: Frame | null = null;
let waiting: Waiting | null = null;
let texts = { title: 'Phone code', close: 'Close' };

const frameUrl = (): URL => {
  try {
    return new URL((import.meta.env?.VITE_CODE_FRAME_URL as string | undefined) || DEFAULT_FRAME_URL);
  } catch {
    return new URL(DEFAULT_FRAME_URL);
  }
};

/** The words of the panel the frame shows in (its name and its close button), in the owner's language. */
export const setCodeFrameTexts = (next: { title: string; close: string }): void => {
  texts = next;
  if (!frame) return;
  frame.heading.textContent = next.title;
  frame.iframe.title = next.title;
  frame.closeButton.setAttribute('aria-label', next.close);
  if (frame.shown) frame.root.setAttribute('aria-label', next.title);
};

const onKeyDown = (event: KeyboardEvent) => {
  if (event.key === 'Escape' && frame?.shown) {
    event.stopPropagation();
    closeCodeFrame();
  }
};

/** Shows the frame in its panel while Google's check has something to show, and hides it again. */
const show = (on: boolean) => {
  if (!frame || frame.shown === on) return;
  frame.shown = on;
  const { root, iframe, closeButton } = frame;
  root.className = on ? SHOWN_CLASS : HIDDEN_CLASS;
  iframe.tabIndex = on ? 0 : -1;
  closeButton.tabIndex = on ? 0 : -1;
  if (on) {
    root.removeAttribute('aria-hidden');
    root.removeAttribute('inert');
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-label', texts.title);
    frame.returnFocus = document.activeElement;
    document.addEventListener('keydown', onKeyDown, true);
    iframe.focus();
  } else {
    root.setAttribute('aria-hidden', 'true');
    root.setAttribute('inert', '');
    root.removeAttribute('role');
    root.removeAttribute('aria-modal');
    root.removeAttribute('aria-label');
    document.removeEventListener('keydown', onKeyDown, true);
    const back = frame.returnFocus;
    frame.returnFocus = null;
    if (back instanceof HTMLElement && back.isConnected) back.focus();
  }
};

const onMessage = (event: MessageEvent) => {
  // Only the frame itself, from its own origin.
  if (!frame || event.origin !== frame.origin || event.source !== frame.iframe.contentWindow) return;
  const data = event.data as { type?: unknown; idToken?: unknown; stage?: unknown; code?: unknown; on?: unknown } | null;
  if (!data || typeof data !== 'object') return;
  switch (data.type) {
    case 'lt-code-ready':
      frame.settleReady();
      break;
    case 'lt-code-sent':
      if (waiting?.stage === 'send') waiting.resolve();
      break;
    case 'lt-code-verified':
      if (waiting?.stage === 'confirm' && typeof data.idToken === 'string' && data.idToken) waiting.resolve(data.idToken);
      break;
    case 'lt-code-error':
      if (waiting && waiting.stage === data.stage) waiting.reject(new CodeFrameError(String(data.code || 'unknown'), waiting.stage));
      break;
    case 'lt-code-attention':
      show(data.on === true);
      break;
  }
};

const open = (lang: string): Frame => {
  const url = frameUrl();
  url.searchParams.set('parent', window.location.origin);
  if (lang) url.searchParams.set('lang', lang);

  const root = document.createElement('div');
  root.className = HIDDEN_CLASS;
  root.dataset.testid = 'phone-code-frame';
  root.setAttribute('aria-hidden', 'true');
  root.setAttribute('inert', '');

  // About 320 x 480, the frame filling it under a slim bar: the panel's name and a way out.
  const panel = document.createElement('div');
  panel.className = 'flex h-[30rem] max-h-full w-80 max-w-full flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-800';

  const bar = document.createElement('div');
  bar.className = 'flex shrink-0 items-center justify-between gap-3 px-4 py-2.5';
  const heading = document.createElement('span');
  heading.className = 'min-w-0 text-sm font-semibold text-gray-800 dark:text-gray-100';
  heading.textContent = texts.title;
  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.tabIndex = -1;
  closeButton.setAttribute('aria-label', texts.close);
  closeButton.className =
    'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xl leading-none text-gray-500 hover:bg-gray-100 ' +
    'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 dark:text-gray-300 dark:hover:bg-white/10';
  closeButton.textContent = '×';
  closeButton.addEventListener('click', () => closeCodeFrame());
  bar.append(heading, closeButton);

  const iframe = document.createElement('iframe');
  iframe.src = url.toString();
  iframe.title = texts.title;
  iframe.tabIndex = -1;
  iframe.className = 'block min-h-0 w-full flex-1 border-0 bg-white';

  panel.append(bar, iframe);
  root.append(panel);

  let settleReady: Frame['settleReady'] = () => {};
  const ready = new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new CodeFrameError('lt/frame', 'send')), READY_MS);
    settleReady = (error) => {
      clearTimeout(timer);
      if (error) reject(error);
      else resolve();
    };
  });
  // Whoever asked for the send hears of it; nobody else has to.
  ready.catch(() => {});

  const made: Frame = { root, heading, closeButton, iframe, origin: url.origin, ready, settleReady, idle: null, shown: false, returnFocus: null };
  window.addEventListener('message', onMessage);
  document.body.appendChild(root);
  frame = made;
  return made;
};

/**
 * Takes the frame away, and with it any code waiting to be confirmed: a
 * screen that gives up on a code (or the person closing Google's check)
 * calls it. Whatever was waiting on the frame is refused ("lt/cancelled").
 */
export const closeCodeFrame = (): void => {
  const current = frame;
  if (!current) return;
  show(false);
  frame = null;
  if (current.idle) clearTimeout(current.idle);
  window.removeEventListener('message', onMessage);
  current.settleReady(new CodeFrameError('lt/cancelled', 'send'));
  current.root.remove();
  const pending = waiting;
  waiting = null;
  pending?.reject(new CodeFrameError('lt/cancelled', pending.stage));
};

/** One message to the frame, and its answer. */
const ask = (current: Frame, stage: CodeFrameStage, message: Record<string, string>, ms: number): Promise<string | undefined> =>
  new Promise((resolve, reject) => {
    const target = current.iframe.contentWindow;
    if (!target) {
      reject(new CodeFrameError('lt/frame', stage));
      return;
    }
    const timer = setTimeout(() => {
      waiting = null;
      reject(new CodeFrameError('lt/timeout', stage));
    }, ms);
    const done = () => {
      clearTimeout(timer);
      waiting = null;
    };
    waiting = {
      stage,
      resolve: (value) => {
        done();
        resolve(value);
      },
      reject: (error) => {
        done();
        reject(error);
      },
    };
    target.postMessage(message, current.origin);
  });

/**
 * Asks the frame to send a code to `phone` (E.164, outside Israel). Resolves
 * once Firebase sent it. `onAsked` runs at the moment the frame is really
 * asked (the caller's resend clock starts there, not when the frame failed
 * to load).
 */
export const sendFrameCode = async (phone: string, lang: string, onAsked?: () => void): Promise<void> => {
  if (!PHONE_RE.test(phone)) throw new CodeFrameError('auth/invalid-phone-number', 'send');
  if (waiting) throw new CodeFrameError('lt/busy', 'send');
  const current = frame ?? open(lang);
  if (current.idle) clearTimeout(current.idle);
  current.idle = null;
  try {
    await current.ready;
    if (frame !== current) throw new CodeFrameError('lt/cancelled', 'send');
    if (waiting) throw new CodeFrameError('lt/busy', 'send');
    onAsked?.();
    await ask(current, 'send', { type: 'lt-code-send', phone, lang }, SEND_MS);
  } catch (error) {
    // A frame that did not send holds nothing worth keeping (a busy one is someone else's).
    if (frame === current && !(error instanceof CodeFrameError && error.code === 'lt/busy')) closeCodeFrame();
    throw error;
  }
  current.idle = setTimeout(() => {
    if (frame === current && !waiting) closeCodeFrame();
  }, IDLE_MS);
};

/** Checks the code the person typed in the frame that sent it. Resolves with Firebase's `idToken`. */
export const confirmFrameCode = async (code: string): Promise<string> => {
  if (!CODE_RE.test(code)) throw new CodeFrameError('auth/invalid-verification-code', 'confirm');
  const current = frame;
  if (!current) throw new CodeFrameError('lt/no-code-sent', 'confirm');
  if (waiting) throw new CodeFrameError('lt/busy', 'confirm');
  try {
    const idToken = await ask(current, 'confirm', { type: 'lt-code-confirm', code }, CONFIRM_MS);
    if (!idToken) throw new CodeFrameError('unknown', 'confirm');
    // Proven: the frame's work is done.
    if (frame === current) closeCodeFrame();
    return idToken;
  } catch (error) {
    // A wrong code can be typed again; an expired one cannot.
    if (frame === current && error instanceof CodeFrameError && CODE_GONE.has(error.code)) closeCodeFrame();
    throw error;
  }
};
