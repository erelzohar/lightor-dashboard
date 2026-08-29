import globals from '../services/globals';

/**
 * LT-077: the wizard's free-generation gate lives in register.lightor.app's
 * localStorage — a different origin, unreachable from dashboard code. But the
 * two are the same SITE (lightor.app), so a hidden iframe of the register's
 * static /reset-ai.html sees the real, unpartitioned storage: the page clears
 * every lightor_gen_ counter on load and acks with postMessage. This makes
 * the admin "Reset AI test quota" button clear BOTH sides — server Redis
 * budgets (via the API) and this browser's wizard counter (via this iframe).
 *
 * Resolves true on ack, false on timeout or a reported failure — never
 * rejects, so the caller can always finish the server-side toast flow.
 */
export const resetWizardAiLimit = (timeoutMs = 5000): Promise<boolean> =>
  new Promise((resolve) => {
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';

    let done = false;
    const finish = (ok: boolean) => {
      if (done) return;
      done = true;
      window.removeEventListener('message', onMessage);
      clearTimeout(timer);
      iframe.remove();
      resolve(ok);
    };

    const onMessage = (event: MessageEvent) => {
      if (event.origin !== globals.registerOrigin) return;
      const data = event.data as { type?: string; ok?: boolean } | null;
      if (data?.type === 'LIGHTOR_AI_LIMIT_RESET') finish(data.ok === true);
    };

    const timer = setTimeout(() => finish(false), timeoutMs);
    window.addEventListener('message', onMessage);
    iframe.src = `${globals.registerOrigin}/reset-ai.html`;
    document.body.appendChild(iframe);
  });
