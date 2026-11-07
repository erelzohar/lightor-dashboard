import { isNativeApp, nativePlatform } from './platform';
import apiClient from '../services/apiClient';
import globals from '../services/globals';

/**
 * LT-608 (Erel 2026-11-07): over-the-air updates of the dashboard inside the
 * apps, from our own server. Every deploy of the dashboard also publishes its
 * bundle (deploy.sh: a zip of dist, signed with our private key, listed in the
 * server's manifest with its native fingerprint).
 *
 * At launch, and on returning to the app after half an hour, the app asks
 * `GET /api/app/update` (which also records this install's versions) for a
 * newer bundle made for its own native fingerprint. It downloads it in the
 * background; the plugin checks the signature against the public key in
 * capacitor.config.ts and refuses anything else. The bundle starts on the
 * next launch, or when the owner comes back after 10 minutes away - never
 * under their fingers. A bundle that does not call `ready()` within the
 * plugin's readyTimeout is rolled back and never tried again.
 *
 * The server can also ask for a store update (`forceUpdate`, a minimum native
 * build in the manifest): the app then shows only the update screen.
 */

declare const __BUNDLE_ID__: string;
declare const __BUILD_TIME__: string;
declare const __NATIVE_FINGERPRINT__: string;

/** The dashboard bundle this code is: its id (commit and time), when it was built, and the native app it needs. */
export const BUNDLE = {
  id: typeof __BUNDLE_ID__ === 'string' ? __BUNDLE_ID__ : 'dev',
  builtAt: typeof __BUILD_TIME__ === 'string' ? __BUILD_TIME__ : '',
  fingerprint: typeof __NATIVE_FINGERPRINT__ === 'string' ? __NATIVE_FINGERPRINT__ : '',
};

export interface AppVersion {
  platform: 'ios' | 'android' | 'web';
  /** The store version, like 1.1, and the native build (iOS build / Android versionCode); empty on the web. */
  version: string;
  build: string;
  bundle: string;
  builtAt: string;
}

interface UpdateAnswer {
  bundle: { id: string; url: string; checksum: string; signature: string } | null;
  forceUpdate: boolean;
}

const INSTALL_KEY = 'lightor.installId';
const RECHECK_MS = 30 * 60 * 1000;
const APPLY_AFTER_AWAY_MS = 10 * 60 * 1000;

const plugin = () => import('@capawesome/capacitor-live-update');

let pendingBundle: string | null = null;
let lastCheck = 0;
let awaySince = 0;
let checking: Promise<void> | null = null;
const forceListeners = new Set<() => void>();
let forced = false;

/** The store version and build this app is, or the web. */
export const appVersion = async (): Promise<AppVersion> => {
  const base = { bundle: BUNDLE.id, builtAt: BUNDLE.builtAt };
  if (!isNativeApp()) return { platform: 'web', version: '', build: '', ...base };
  try {
    const { App } = await import('@capacitor/app');
    const info = await App.getInfo();
    return { platform: nativePlatform(), version: info.version, build: info.build, ...base };
  } catch {
    return { platform: nativePlatform(), version: '', build: '', ...base };
  }
};

/** A random id for this install, kept in the app's storage: the server counts installs, not owners. */
const installId = async (): Promise<string> => {
  const { Preferences } = await import('@capacitor/preferences');
  const { value } = await Preferences.get({ key: INSTALL_KEY });
  if (value) return value;
  // randomUUID is missing before iOS 15.4; 16 random bytes do the same job.
  const id = typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('');
  await Preferences.set({ key: INSTALL_KEY, value: id });
  return id;
};

let renderCrashed = false;
/** An error boundary caught a render crash: this bundle is not confirmed, so the plugin rolls it back. */
export const noteRenderCrash = (): void => {
  renderCrashed = true;
};

/** Called a few seconds after the app rendered: the bundle is good, no rollback - unless a page crashed meanwhile. */
export const markAppReady = async (): Promise<void> => {
  if (!isNativeApp() || renderCrashed) return;
  try {
    const { LiveUpdate } = await plugin();
    await LiveUpdate.ready();
  } catch {
    // An app without the plugin (an older store build) has nothing to confirm.
  }
};

/** The update screen listens here; called at once if the server already asked. */
export const onForceUpdate = (listener: () => void): (() => void) => {
  forceListeners.add(listener);
  if (forced) listener();
  return () => forceListeners.delete(listener);
};

const check = async (): Promise<void> => {
  lastCheck = Date.now();
  const version = await appVersion();
  const { data } = await apiClient.get<{ success: boolean; data: UpdateAnswer }>(`${globals.appUrl}update`, {
    params: {
      installId: await installId(),
      platform: version.platform,
      version: version.version,
      build: version.build,
      bundle: BUNDLE.id,
      builtAt: BUNDLE.builtAt,
      fingerprint: BUNDLE.fingerprint,
    },
  });
  const answer = data?.data;
  if (!answer) return;
  if (answer.forceUpdate && !forced) {
    forced = true;
    forceListeners.forEach((listener) => listener());
  }
  const next = answer.bundle;
  const { LiveUpdate } = await plugin();
  const { bundleIds: blocked } = await LiveUpdate.getBlockedBundles();
  if (next && next.id !== BUNDLE.id && next.id !== pendingBundle && !blocked.includes(next.id)) {
    const { bundleIds: have } = await LiveUpdate.getDownloadedBundles();
    if (!have.includes(next.id)) {
      await LiveUpdate.downloadBundle({ url: next.url, bundleId: next.id, checksum: next.checksum, signature: next.signature });
    }
    await LiveUpdate.setNextBundle({ bundleId: next.id });
    pendingBundle = next.id;
  }
  // Keep only the bundle running now and the one waiting.
  const { bundleId: current } = await LiveUpdate.getCurrentBundle();
  const { bundleIds } = await LiveUpdate.getDownloadedBundles();
  for (const id of bundleIds) {
    if (id !== current && id !== pendingBundle) await LiveUpdate.deleteBundle({ bundleId: id }).catch(() => undefined);
  }
};

const checkSoon = (): void => {
  if (checking) return;
  checking = check()
    .catch(() => undefined)
    .finally(() => { checking = null; });
};

/**
 * The app went to the background (`isActive` false) or came back: the bundle
 * waiting starts when the owner returns after 10 minutes away; otherwise a
 * check runs if the last one is half an hour old.
 */
export const onAppStateChange = ({ isActive }: { isActive: boolean }): void => {
  if (!isActive) {
    awaySince = Date.now();
    return;
  }
  const away = awaySince ? Date.now() - awaySince : 0;
  awaySince = 0;
  if (pendingBundle && away >= APPLY_AFTER_AWAY_MS) {
    void plugin().then(({ LiveUpdate }) => LiveUpdate.reload()).catch(() => undefined);
    return;
  }
  if (Date.now() - lastCheck >= RECHECK_MS) checkSoon();
};

/** Starts the checks: at launch, and on coming back to the app. Native only. */
export const startLiveUpdates = async (): Promise<void> => {
  if (!isNativeApp()) return;
  checkSoon();
  try {
    const { App } = await import('@capacitor/app');
    await App.addListener('appStateChange', onAppStateChange);
  } catch {
    // Without @capacitor/app only the launch check runs.
  }
};
