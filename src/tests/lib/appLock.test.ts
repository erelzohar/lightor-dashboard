import { describe, it, expect, vi, beforeEach } from 'vitest';

const env = vi.hoisted(() => ({
  native: true,
  platform: 'ios' as 'ios' | 'android' | 'web',
  pluginThere: true,
  prefs: new Map<string, string>(),
  check: vi.fn(),
  auth: vi.fn(),
}));

vi.mock('../../lib/platform', () => ({ isNativeApp: () => env.native, nativePlatform: () => (env.native ? env.platform : 'web') }));
vi.mock('@capacitor/core', () => ({ Capacitor: { isPluginAvailable: (name: string) => env.pluginThere && name === 'BiometricAuthNative' } }));
vi.mock('@capacitor/preferences', () => ({
  Preferences: {
    get: async ({ key }: { key: string }) => ({ value: env.prefs.get(key) ?? null }),
    set: async ({ key, value }: { key: string; value: string }) => { env.prefs.set(key, value); },
    remove: async ({ key }: { key: string }) => { env.prefs.delete(key); },
    // Seen in the simulator 2026-11-08: a helper that returned this plugin
    // from an async function never settled, because the real one answers `then`.
    then: (): undefined => undefined,
  },
}));
vi.mock('@aparajita/capacitor-biometric-auth', () => ({
  // Like Capacitor's proxy, the plugin answers `then`: awaiting it itself would never settle.
  BiometricAuth: { checkBiometry: env.check, authenticate: env.auth, then: (): undefined => undefined },
  BiometryType: { none: 0, touchId: 1, faceId: 2, fingerprintAuthentication: 3 },
}));

import { authenticate, LOCK_CHANGED, loadLockEnabled, lockEnabledNow, lockSupport, markOffered, setLockEnabled, wasOffered } from '../../lib/appLock';

beforeEach(() => {
  env.native = true;
  env.platform = 'ios';
  env.pluginThere = true;
  env.prefs.clear();
  localStorage.clear();
  env.check.mockReset().mockResolvedValue({ isAvailable: true, biometryType: 2 });
  env.auth.mockReset().mockResolvedValue(undefined);
});

/** LT-617: the apps' Face ID / fingerprint lock. */
describe('appLock (LT-617)', () => {
  it('names what the phone unlocks with, and is never there on the web', async () => {
    expect(await lockSupport()).toEqual({ available: true, method: 'face' });
    env.check.mockResolvedValue({ isAvailable: true, biometryType: 1 });
    expect(await lockSupport()).toEqual({ available: true, method: 'fingerprint' });
    env.platform = 'android';
    env.check.mockResolvedValue({ isAvailable: true, biometryType: 3 });
    expect(await lockSupport()).toEqual({ available: true, method: 'biometrics' });
    env.check.mockResolvedValue({ isAvailable: false, biometryType: 3 });
    expect((await lockSupport()).available).toBe(false);
    env.native = false;
    expect((await lockSupport()).available).toBe(false);
  });

  it('offers no lock on a store build from before the plugin, or when the phone cannot say', async () => {
    env.pluginThere = false;
    expect((await lockSupport()).available).toBe(false);
    expect(env.check).not.toHaveBeenCalled();
    env.pluginThere = true;
    env.check.mockRejectedValue(new Error('boom'));
    expect((await lockSupport()).available).toBe(false);
  });

  it('keeps the setting in Preferences with a copy read at once at launch, and tells the gate', async () => {
    const heard: boolean[] = [];
    window.addEventListener(LOCK_CHANGED, (event) => heard.push((event as CustomEvent<boolean>).detail));
    expect(lockEnabledNow()).toBe(false);

    await setLockEnabled(true);
    expect(env.prefs.get('lightor.appLock')).toBe('1');
    expect(lockEnabledNow()).toBe(true);

    localStorage.clear();
    expect(await loadLockEnabled()).toBe(true);
    expect(lockEnabledNow()).toBe(true);

    await setLockEnabled(false);
    expect(env.prefs.has('lightor.appLock')).toBe(false);
    expect(lockEnabledNow()).toBe(false);
    expect(heard).toEqual([true, false]);
  });

  it('remembers that this phone was asked once', async () => {
    expect(await wasOffered()).toBe(false);
    await markOffered();
    expect(await wasOffered()).toBe(true);
  });

  it("asks the phone with its passcode as the fallback, and tells a cancel from a failure", async () => {
    expect(await authenticate({ reason: 'r', cancel: 'c', title: 't' })).toBe('ok');
    expect(env.auth).toHaveBeenCalledWith(expect.objectContaining({ reason: 'r', cancelTitle: 'c', allowDeviceCredential: true }));
    env.auth.mockRejectedValueOnce(Object.assign(new Error('x'), { code: 'userCancel' }));
    expect(await authenticate({ reason: 'r', cancel: 'c', title: 't' })).toBe('cancelled');
    env.auth.mockRejectedValueOnce(Object.assign(new Error('x'), { code: 'biometryLockout' }));
    expect(await authenticate({ reason: 'r', cancel: 'c', title: 't' })).toBe('failed');
  });
});
