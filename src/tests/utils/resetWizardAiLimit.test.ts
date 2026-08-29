import { describe, it, expect } from 'vitest';
import { resetWizardAiLimit } from '../../utils/resetWizardAiLimit';
import globals from '../../services/globals';

/**
 * LT-077: the hidden-iframe bridge that lets the admin "Reset AI test quota"
 * button clear the register wizard's client-side counter on another origin.
 * jsdom never loads the iframe, so the ack is dispatched synthetically.
 */

const ack = (origin: string, data: unknown) =>
  window.dispatchEvent(new MessageEvent('message', { origin, data }));

describe('resetWizardAiLimit', () => {
  it('resolves true on the register page ack and removes the iframe', async () => {
    const pending = resetWizardAiLimit(1000);
    expect(document.querySelector(`iframe[src="${globals.registerOrigin}/reset-ai.html"]`)).toBeTruthy();

    ack(globals.registerOrigin, { type: 'LIGHTOR_AI_LIMIT_RESET', ok: true });

    await expect(pending).resolves.toBe(true);
    expect(document.querySelector('iframe')).toBeNull();
  });

  it('ignores messages from other origins and times out false', async () => {
    const pending = resetWizardAiLimit(60);

    ack('https://evil.example', { type: 'LIGHTOR_AI_LIMIT_RESET', ok: true });

    await expect(pending).resolves.toBe(false);
    expect(document.querySelector('iframe')).toBeNull();
  });

  it('resolves false when the page reports a failed clear', async () => {
    const pending = resetWizardAiLimit(1000);

    ack(globals.registerOrigin, { type: 'LIGHTOR_AI_LIMIT_RESET', ok: false });

    await expect(pending).resolves.toBe(false);
  });
});
