import { isNativeApp, nativePlatform } from './platform';

/**
 * LT-617 (Erel 2026-11-08): the apps lock with Face ID / fingerprint. Off by
 * default, offered once after sign-in (AppLockOffer) and switched on the
 * Account page (AppLockCard). When it is on, the app opens, and comes back
 * after AWAY_LOCK_MS or more, only past the phone's own biometrics, with the
 * phone's passcode as the fallback (AppLockGate).
 *
 * The setting is kept in Preferences, with a localStorage copy read at once
 * at launch, so a locked app never paints a page before its lock screen.
 * The plugin is native: an over-the-air bundle running on a store build from
 * before it (LT-608) finds it missing and simply offers no lock.
 */

/** Away this long, the app asks again on coming back. */
export const AWAY_LOCK_MS = 5 * 60 * 1000;

const KEY = 'lightor.appLock';
const OFFERED_KEY = 'lightor.appLockOffered';
/** Fired on window when the setting changes (the gate listens). */
export const LOCK_CHANGED = 'lightor:applock';
/** The plugin's registered name (@aparajita/capacitor-biometric-auth). */
const PLUGIN_NAME = 'BiometricAuthNative';

/** What the phone unlocks with, for the words: iOS says which; Android may have several. */
export type LockMethod = 'face' | 'fingerprint' | 'biometrics';

export interface LockSupport {
  available: boolean;
  method: LockMethod;
}

// The module, never the plugin object itself: a Capacitor plugin answers every
// property, `then` included, so a promise resolved with it never settles.
type BiometricModule = typeof import('@aparajita/capacitor-biometric-auth');
let modulePromise: Promise<BiometricModule> | null = null;
const biometric = (): Promise<BiometricModule> => (modulePromise ??= import('@aparajita/capacitor-biometric-auth'));

const mirror = (key: string, on: boolean): void => {
  try {
    if (on) localStorage.setItem(key, '1');
    else localStorage.removeItem(key);
  } catch {
    // Blocked storage: Preferences still holds it.
  }
};

// The same for Preferences: its module, never the plugin from an async function.
const preferencesModule = () => import('@capacitor/preferences');

/** The lock's setting, synchronously (the localStorage copy). */
export const lockEnabledNow = (): boolean => {
  if (!isNativeApp()) return false;
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
};

/** The lock's setting from Preferences, which also refreshes the copy. */
export const loadLockEnabled = async (): Promise<boolean> => {
  if (!isNativeApp()) return false;
  try {
    const { Preferences } = await preferencesModule();
    const { value } = await Preferences.get({ key: KEY });
    const on = value === '1';
    mirror(KEY, on);
    return on;
  } catch {
    return lockEnabledNow();
  }
};

export const setLockEnabled = async (on: boolean): Promise<void> => {
  mirror(KEY, on);
  try {
    const { Preferences } = await preferencesModule();
    if (on) await Preferences.set({ key: KEY, value: '1' });
    else await Preferences.remove({ key: KEY });
  } finally {
    window.dispatchEvent(new CustomEvent(LOCK_CHANGED, { detail: on }));
  }
};

/** Whether this phone was already asked once (AppLockOffer). */
export const wasOffered = async (): Promise<boolean> => {
  try {
    const { Preferences } = await preferencesModule();
    const { value } = await Preferences.get({ key: OFFERED_KEY });
    return value === '1';
  } catch {
    return true;
  }
};

export const markOffered = async (): Promise<void> => {
  try {
    const { Preferences } = await preferencesModule();
    await Preferences.set({ key: OFFERED_KEY, value: '1' });
  } catch {
    // Asked again next time at worst.
  }
};

/** Can this phone lock the app, and with what. Never throws. */
export const lockSupport = async (): Promise<LockSupport> => {
  const none: LockSupport = { available: false, method: 'biometrics' };
  if (!isNativeApp()) return none;
  try {
    const { Capacitor } = await import('@capacitor/core');
    if (!Capacitor.isPluginAvailable(PLUGIN_NAME)) return none;
    const { BiometricAuth, BiometryType } = await biometric();
    const info = await BiometricAuth.checkBiometry();
    const method: LockMethod =
      nativePlatform() === 'ios' ? (info.biometryType === BiometryType.faceId ? 'face' : 'fingerprint') : 'biometrics';
    return { available: info.isAvailable, method };
  } catch {
    return none;
  }
};

export type UnlockResult = 'ok' | 'cancelled' | 'failed';

/** The phone's own prompt: biometrics first, its passcode as the fallback. */
export const authenticate = async (texts: { reason: string; cancel: string; title: string }): Promise<UnlockResult> => {
  try {
    const { BiometricAuth } = await biometric();
    await BiometricAuth.authenticate({
      reason: texts.reason,
      cancelTitle: texts.cancel,
      allowDeviceCredential: true,
      // The reason already shows under the title; a subtitle would repeat it.
      androidTitle: texts.title,
      androidConfirmationRequired: false,
    });
    return 'ok';
  } catch (error) {
    const code = (error as { code?: string } | null)?.code;
    return code === 'userCancel' || code === 'appCancel' || code === 'systemCancel' ? 'cancelled' : 'failed';
  }
};
