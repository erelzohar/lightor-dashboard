import apiClient from './apiClient';
import globals from './globals';

/**
 * Client-side crash channel (LT-170).
 *
 * Three things go wrong in a browser that nobody sees unless they are sent
 * somewhere: a render error (caught by an error boundary), an exception in an
 * event handler or timer (window 'error'), and a promise nobody awaited
 * (window 'unhandledrejection'). All three end here and become one POST to
 * /api/messaging/report-error, which logs it server-side and emails the
 * operator. The same code runs inside the native app's WebView.
 *
 * Rules that keep the reporter from becoming its own incident:
 *  - Production only. A dev build logs to the console and stops.
 *  - One report per distinct message per page load, five per page load in
 *    all — the API allows an IP five per quarter hour, and a render loop
 *    must not spend that budget on one bug.
 *  - Noise that is not ours is dropped: ResizeObserver's benign loop
 *    warning, cross-origin "Script error." with no detail, plain network
 *    failures (the API logs its own 5xx; an owner's flaky connection is not
 *    a bug in this app).
 *  - Reporting never throws and never rejects.
 */

export type ClientErrorKind = 'boundary' | 'error' | 'unhandledrejection';

export interface ClientErrorReport {
  error: string;
  stack?: string;
  componentStack?: string;
  userInfo?: { id: string; email?: string };
  url: string;
  userAgent: string;
  timestamp: string;
  app: 'dashboard';
  kind: ClientErrorKind;
}

export type ClientErrorInput = Partial<
  Pick<ClientErrorReport, 'stack' | 'componentStack' | 'userInfo' | 'kind'>
> & { error: string };

const MAX_REPORTS_PER_PAGE = 5;

const IGNORED: RegExp[] = [
  /^ResizeObserver loop/,
  /^Script error\.?$/,
  /^(AxiosError: )?Network Error$/,
  /Failed to fetch$/,
  /^TypeError: Load failed$/,
  /^AbortError/,
];

let enabled = import.meta.env.PROD;
let installed = false;
const seen = new Set<string>();
let sent = 0;

/** Tests, and a console switch for debugging a production build locally. */
export const setErrorReportingEnabled = (on: boolean): void => {
  enabled = on;
};

/** A message and, when there is one, a stack — for anything a browser can throw. */
export const describeError = (value: unknown): { message: string; stack?: string } => {
  if (value instanceof Error) {
    const message = value.message ? `${value.name}: ${value.message}` : value.name;
    return { message, stack: value.stack };
  }
  if (typeof value === 'string') return { message: value };
  if (value && typeof value === 'object' && 'message' in value) {
    return { message: String((value as { message: unknown }).message) };
  }
  let text: string;
  try {
    text = JSON.stringify(value);
  } catch {
    text = String(value);
  }
  return { message: `Non-error value: ${text}` };
};

/**
 * Send one crash report. Resolves true when it was posted, false when it was
 * a duplicate, over budget, ignored noise, or we are not in production.
 */
export const reportClientError = async (input: ClientErrorInput): Promise<boolean> => {
  try {
    const message = String(input.error ?? '').trim();
    if (!message || IGNORED.some((pattern) => pattern.test(message))) return false;
    if (seen.has(message) || sent >= MAX_REPORTS_PER_PAGE) return false;
    seen.add(message);
    sent += 1;

    const report: ClientErrorReport = {
      error: message.slice(0, 2000),
      stack: input.stack?.slice(0, 20000),
      componentStack: input.componentStack?.slice(0, 20000),
      userInfo: input.userInfo,
      url: window.location.href,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString(),
      app: 'dashboard',
      kind: input.kind ?? 'boundary',
    };

    if (!enabled) {
      console.error('[lightor] error report (only sent from a production build):', report);
      return false;
    }

    await apiClient.post(`${globals.messagingUrl}report-error`, report);
    return true;
  } catch (err) {
    console.error('Failed to report error to backend:', err);
    return false;
  }
};

/** The two events a page can subscribe to; `window` in the app, a fake in tests. */
export type ErrorEventTarget = Pick<Window, 'addEventListener' | 'removeEventListener'>;

/**
 * Catch what error boundaries cannot: event handlers, timers, async code.
 * Idempotent; returns the uninstaller.
 */
export const installGlobalErrorHandlers = (
  target: ErrorEventTarget | undefined = typeof window === 'undefined' ? undefined : window
): (() => void) => {
  if (!target || installed) return () => {};

  const onError = (event: ErrorEvent) => {
    const { message, stack } = describeError(event.error ?? event.message);
    void reportClientError({
      error: message,
      stack: stack ?? (event.filename ? `${event.filename}:${event.lineno}:${event.colno}` : undefined),
      kind: 'error',
    });
  };
  const onRejection = (event: PromiseRejectionEvent) => {
    const { message, stack } = describeError(event.reason);
    void reportClientError({ error: message, stack, kind: 'unhandledrejection' });
  };

  target.addEventListener('error', onError as EventListener);
  target.addEventListener('unhandledrejection', onRejection as EventListener);
  installed = true;

  return () => {
    target.removeEventListener('error', onError as EventListener);
    target.removeEventListener('unhandledrejection', onRejection as EventListener);
    installed = false;
  };
};

/** Tests only. */
export const resetErrorReportingForTests = (): void => {
  seen.clear();
  sent = 0;
};
