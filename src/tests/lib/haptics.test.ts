import { describe, it, expect, vi, beforeEach } from 'vitest';

const { native, impact } = vi.hoisted(() => ({ native: { on: false }, impact: vi.fn() }));
vi.mock('../../lib/platform', () => ({ isNativeApp: () => native.on }));
vi.mock('@capacitor/haptics', () => ({
  Haptics: { impact },
  ImpactStyle: { Light: 'LIGHT', Medium: 'MEDIUM', Heavy: 'HEAVY' },
}));

import { lightTick } from '../../lib/haptics';

const flush = () => new Promise((r) => setTimeout(r, 0));

/** LT-268 — a light tap in the app, nothing in a browser, never a throw. */
describe('lightTick', () => {
  beforeEach(() => {
    impact.mockReset().mockResolvedValue(undefined);
  });

  it('does nothing in a browser', async () => {
    native.on = false;
    lightTick();
    await flush();
    expect(impact).not.toHaveBeenCalled();
  });

  it('plays a light impact in the app', async () => {
    native.on = true;
    lightTick();
    await flush();
    expect(impact).toHaveBeenCalledWith({ style: 'LIGHT' });
  });

  it('swallows a failure (an app build without the plugin, haptics off)', async () => {
    native.on = true;
    impact.mockRejectedValue(new Error('not implemented'));
    expect(() => lightTick()).not.toThrow();
    await flush();
    expect(impact).toHaveBeenCalled();
  });
});
