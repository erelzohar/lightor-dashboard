import { App } from '@capacitor/app';
import { FirebaseMessaging } from '@capacitor-firebase/messaging';
import i18n from '../i18n/config';
import { isNativeApp, nativePlatform } from '../lib/platform';
import { registerDevice, unregisterDevice } from './devicesApi';

/**
 * Push notifications, client side (LT-129, mobile plan phase 2 §4).
 *
 * Native only: on the web every export is a no-op. Every plugin call is
 * try/caught because the app must run without a Firebase config file
 * (GoogleService-Info.plist / google-services.json are not in the repo yet)
 * — without one the plugin throws, and the dashboard must carry on exactly as
 * before, just without push.
 *
 * Registration is asked for AFTER the first successful `/auth/me` of a
 * verified account, never on launch: the permission prompt lands on someone
 * who already sees their appointments, which is when "notify me about
 * bookings" makes sense.
 */
let currentToken: string | null = null;
let listening = false;

const appVersion = async (): Promise<string | undefined> => {
  try {
    const info = await App.getInfo();
    return info.version;
  } catch {
    return undefined;
  }
};

const postToken = async (token: string): Promise<void> => {
  currentToken = token;
  try {
    await registerDevice({
      token,
      platform: nativePlatform(),
      locale: i18n.language,
      appVersion: await appVersion(),
    });
  } catch {
    // The next launch re-registers; a missed upsert is not worth a toast.
  }
};

/**
 * Ask for permission, register the FCM token with the API, and keep it fresh
 * on `tokenReceived`. Idempotent — the listener is attached once per app run.
 */
export const registerForPush = async (): Promise<void> => {
  if (!isNativeApp()) return;
  try {
    if (nativePlatform() === 'android') {
      // Android 8+: a channel must exist before the first notification shows.
      // `importance: 4` = IMPORTANCE_HIGH (heads-up + sound).
      await FirebaseMessaging.createChannel({ id: 'bookings', name: 'Bookings', importance: 4 });
    }
    const { receive } = await FirebaseMessaging.requestPermissions();
    if (receive !== 'granted') return;

    if (!listening) {
      listening = true;
      await FirebaseMessaging.addListener('tokenReceived', ({ token }) => {
        if (token && token !== currentToken) void postToken(token);
      });
    }

    const { token } = await FirebaseMessaging.getToken();
    if (token) await postToken(token);
  } catch {
    // No Firebase config, plugin missing, or the OS refused — the app works
    // without push, so nothing surfaces to the user.
  }
};

/**
 * Route a tapped notification. The API sends `data.url` as a dashboard path
 * (`/appointments?focus=<id>`); anything that is not a same-app path is
 * ignored so a push can never send the WebView to an arbitrary origin.
 */
let tapNavigate: ((url: string) => void) | null = null;
let tapsBound = false;

export const bindNotificationTaps = async (navigate: (url: string) => void): Promise<void> => {
  if (!isNativeApp()) return;
  // Layout can mount more than once per app run (logout → login); the plugin
  // listener is attached once and always calls the latest navigate.
  tapNavigate = navigate;
  if (tapsBound) return;
  tapsBound = true;
  try {
    await FirebaseMessaging.addListener('notificationActionPerformed', (event) => {
      const data = event.notification?.data as { url?: unknown } | undefined;
      const url = data?.url;
      if (typeof url === 'string' && url.startsWith('/')) tapNavigate?.(url);
    });
  } catch {
    // Same reasoning as registerForPush.
  }
};

/** The FCM token registered this run, for the logout DELETE. */
export const getPushToken = (): string | null => currentToken;

/**
 * Best-effort unregistration on logout: the phone stays, the account leaves.
 * Called BEFORE the session is cleared so the DELETE still carries the Bearer.
 */
export const unregisterPush = async (): Promise<void> => {
  const token = currentToken;
  currentToken = null;
  if (!isNativeApp() || !token) return;
  try {
    await unregisterDevice(token);
  } catch {
    // Dead tokens are also pruned server-side when FCM reports them.
  }
};
