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
export const lightTick = (): void => {
  if (!isNativeApp()) return;
  void import('@capacitor/haptics')
    .then(({ Haptics, ImpactStyle }) => Haptics.impact({ style: ImpactStyle.Light }))
    .catch(() => {});
};
