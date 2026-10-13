import { isNativeApp } from './platform';

/**
 * A light haptic tap (LT-268) — the same small tick iOS gives a picker wheel.
 * Played on a calendar page turn and whenever Lighty answers.
 *
 * Native app only: a browser gets nothing (iOS Safari has no web vibration,
 * and Android Chrome's navigator.vibrate is a buzz, not a tick). The plugin is
 * imported lazily so the web bundle never carries it, and a failure — an
 * older app build without the plugin, haptics switched off — is silent: a tap
 * is a nicety, never something a flow waits on.
 */
export const lightTick = (): void => impact('light');

/**
 * An impact of a given weight (LT-313) — the floating Lighty is picked up
 * with a medium one, bumps the screen's edge and lands with light ones.
 */
let plugin: Promise<typeof import('@capacitor/haptics')> | null = null;

export const impact = (weight: 'light' | 'medium' | 'heavy'): void => {
  if (!isNativeApp()) return;
  // Loaded once: a pick-up and a bump can come a frame apart.
  void (plugin ??= import('@capacitor/haptics'))
    .then(({ Haptics, ImpactStyle }) =>
      Haptics.impact({ style: weight === 'heavy' ? ImpactStyle.Heavy : weight === 'medium' ? ImpactStyle.Medium : ImpactStyle.Light })
    )
    .catch(() => {});
};
