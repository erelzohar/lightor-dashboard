import { App } from '@capacitor/app';
import { FirebaseMessaging } from '@capacitor-firebase/messaging';
import toast from 'react-hot-toast';
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
 *
 * The app stands in for the owner's booking emails while the phone keeps
 * opening it and its notifications are on (LT-452, the server's
 * APP_FRESH_DAYS). So every launch, and a return to the app after
 * REFRESH_EVERY_MS, re-registers the token, and notifications turned off in
 * the phone's settings take the phone off the server: FCM would still take
 * every send to it without an error. The token is kept in localStorage for
 * that, since a phone whose notifications are off is never handed one again.
 */
let currentToken: string | null = null;
let listening = false;
let active = false;
let lastPostAt = 0;
let resumeBound = false;

const TOKEN_KEY = 'lightor.pushToken';
const REFRESH_EVERY_MS = 12 * 60 * 60 * 1000;

const storedToken = (): string | null => {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};

const storeToken = (token: string | null): void => {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Storage refused: logout still has currentToken.
  }
};

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
  storeToken(token);
  try {
    const registered = await registerDevice({
      token,
      platform: nativePlatform(),
      locale: i18n.language,
      appVersion: await appVersion(),
    });
    lastPostAt = Date.now();
    // The account's first phone with the app: its booking emails just
    // turned off (LT-455), and the owner hears it once, here.
    if (registered?.appDefault) toast(i18n.t('account.notifications.appDefaultNotice'), { duration: 8000 });
  } catch {
    // The next launch re-registers; a missed upsert is not worth a toast.
  }
};

/** Take this phone off the server; kept for the next launch if the DELETE fails. */
const forgetToken = async (): Promise<void> => {
  const token = currentToken ?? storedToken();
  currentToken = null;
  if (!token) return;
  try {
    await unregisterDevice(token);
    storeToken(null);
  } catch {
    // Tried again on the next launch or return to the app.
  }
};

/** Back in the app: notifications turned off since, or a registration grown old. */
const onResume = async (): Promise<void> => {
  if (!active) return;
  try {
    const { receive } = await FirebaseMessaging.checkPermissions();
    if (receive !== 'granted') {
      await forgetToken();
      return;
    }
  } catch {
    return;
  }
  if (!currentToken || Date.now() - lastPostAt >= REFRESH_EVERY_MS) await registerForPush();
};

/**
 * Ask for permission, register the FCM token with the API, and keep it fresh
 * on `tokenReceived` and on a return to the app. Idempotent — the listeners
 * are attached once per app run.
 */
export const registerForPush = async (): Promise<void> => {
  if (!isNativeApp()) return;
  active = true;
  try {
    if (!resumeBound) {
      resumeBound = true;
      await App.addListener('resume', () => void onResume());
    }
  } catch {
    // Without the listener the next launch refreshes instead.
  }
  try {
    if (nativePlatform() === 'android') {
      // Android 8+: a channel must exist before the first notification shows.
      // `importance: 4` = IMPORTANCE_HIGH (heads-up + sound). The name is what
      // the owner sees in Android's notification settings, so it is in the
      // app's language; creating it again on each launch renames an existing
      // channel (LT-444, it was "Bookings" in every language).
      await FirebaseMessaging.createChannel({
        id: 'bookings',
        name: i18n.t('account.notifications.pushChannel'),
        importance: 4,
      });
    }
    const { receive } = await FirebaseMessaging.requestPermissions();
    if (receive !== 'granted') {
      await forgetToken();
      return;
    }

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

/**
 * Whether this phone lets the app show notifications (LT-455), for the
 * Account page; null on the web or when the plugin cannot say.
 */
export const pushPermission = async (): Promise<string | null> => {
  if (!isNativeApp()) return null;
  try {
    const { receive } = await FirebaseMessaging.checkPermissions();
    return receive;
  } catch {
    return null;
  }
};

/** The FCM token registered this run, for the logout DELETE. */
export const getPushToken = (): string | null => currentToken;

/**
 * Best-effort unregistration on logout: the phone stays, the account leaves.
 * Called BEFORE the session is cleared so the DELETE still carries the Bearer.
 */
export const unregisterPush = async (): Promise<void> => {
  const token = currentToken ?? storedToken();
  currentToken = null;
  active = false;
  storeToken(null);
  if (!isNativeApp() || !token) return;
  try {
    await unregisterDevice(token);
  } catch {
    // Dead tokens are also pruned server-side when FCM reports them.
  }
};
