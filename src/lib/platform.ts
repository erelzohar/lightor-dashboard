/**
 * Where is this build running? (LT-127, mobile plan phase 0)
 *
 * The same Vite bundle serves dashboard.lightor.app and — from phase 1 of
 * `lightor-mobile-app-plan.md` — the Capacitor iOS/Android shells. Everything
 * that must differ between the two (billing hidden on native for App Store
 * 3.1.1, push registration, the "remember me" checkbox) keys off this one
 * function, so the check lives in exactly one place.
 *
 * Capacitor exposes a global on `window`; we read it duck-typed instead of
 * importing `@capacitor/core` so the web build carries no native dependency.
 */
interface CapacitorGlobal {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
}

const capacitor = (): CapacitorGlobal | undefined =>
  typeof window === 'undefined'
    ? undefined
    : (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor;

/** True inside the iOS/Android app, false in any browser (including a PWA). */
export const isNativeApp = (): boolean => capacitor()?.isNativePlatform?.() === true;

/** 'ios' | 'android' inside the app, 'web' everywhere else. */
export const nativePlatform = (): 'ios' | 'android' | 'web' => {
  if (!isNativeApp()) return 'web';
  const p = capacitor()?.getPlatform?.();
  return p === 'ios' || p === 'android' ? p : 'web';
};
