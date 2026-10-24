import { describe, it, expect, vi, beforeEach } from 'vitest';

const platform = { isNativeApp: vi.fn(() => true), nativePlatform: vi.fn(() => 'ios' as 'ios' | 'android' | 'web') };
const messaging = {
  requestPermissions: vi.fn(),
  checkPermissions: vi.fn(),
  getToken: vi.fn(),
  addListener: vi.fn(),
  createChannel: vi.fn(),
};
const app = { getInfo: vi.fn(), addListener: vi.fn() };
const devices = { registerDevice: vi.fn(), unregisterDevice: vi.fn() };

vi.mock('../../lib/platform', () => ({
  isNativeApp: () => platform.isNativeApp(),
  nativePlatform: () => platform.nativePlatform(),
}));
vi.mock('@capacitor-firebase/messaging', () => ({ FirebaseMessaging: messaging }));
vi.mock('@capacitor/app', () => ({ App: app }));
vi.mock('../../services/devicesApi', () => devices);
vi.mock('../../i18n/config', () => ({
  default: { language: 'he', t: (key: string) => (key === 'account.notifications.pushChannel' ? 'תורים ולידים' : key) },
}));

type Listener = (event: unknown) => void;
const listeners: Record<string, Listener> = {};
const appListeners: Record<string, () => void> = {};

// The client keeps the token and the listener flag at module level, so each
// test gets a fresh module.
const load = async () => {
  vi.resetModules();
  return import('../../services/pushClient');
};

const flush = () => new Promise((r) => setTimeout(r, 0));

/**
 * Push client (LT-129). Everything is native-only and swallow-on-failure:
 * the app ships before the Firebase config files exist.
 */
describe('pushClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const k of Object.keys(listeners)) delete listeners[k];
    for (const k of Object.keys(appListeners)) delete appListeners[k];
    localStorage.clear();
    platform.isNativeApp.mockReturnValue(true);
    platform.nativePlatform.mockReturnValue('ios');
    messaging.requestPermissions.mockResolvedValue({ receive: 'granted' });
    messaging.checkPermissions.mockResolvedValue({ receive: 'granted' });
    messaging.getToken.mockResolvedValue({ token: 'fcm-1' });
    messaging.createChannel.mockResolvedValue(undefined);
    messaging.addListener.mockImplementation(async (name: string, fn: Listener) => {
      listeners[name] = fn;
      return { remove: vi.fn() };
    });
    app.getInfo.mockResolvedValue({ name: 'Lightor', id: 'app.lightor.dashboard', build: '7', version: '1.2.3' });
    app.addListener.mockImplementation(async (name: string, fn: () => void) => {
      appListeners[name] = fn;
      return { remove: vi.fn() };
    });
    devices.registerDevice.mockResolvedValue(undefined);
    devices.unregisterDevice.mockResolvedValue(undefined);
  });

  describe('registerForPush', () => {
    it('does nothing on the web', async () => {
      platform.isNativeApp.mockReturnValue(false);
      const push = await load();
      await push.registerForPush();
      expect(messaging.requestPermissions).not.toHaveBeenCalled();
      expect(devices.registerDevice).not.toHaveBeenCalled();
    });

    it('registers nothing when permission is denied', async () => {
      messaging.requestPermissions.mockResolvedValue({ receive: 'denied' });
      const push = await load();
      await push.registerForPush();
      expect(messaging.getToken).not.toHaveBeenCalled();
      expect(devices.registerDevice).not.toHaveBeenCalled();
      expect(push.getPushToken()).toBeNull();
    });

    it('POSTs the token with platform, locale and app version once granted', async () => {
      const push = await load();
      await push.registerForPush();
      expect(devices.registerDevice).toHaveBeenCalledWith({
        token: 'fcm-1',
        platform: 'ios',
        locale: 'he',
        appVersion: '1.2.3',
      });
      expect(push.getPushToken()).toBe('fcm-1');
      // iOS: no channel
      expect(messaging.createChannel).not.toHaveBeenCalled();
    });

    // LT-444: the name shows in Android's notification settings, in the app's language.
    it('creates the bookings channel on Android, named in the app language', async () => {
      platform.nativePlatform.mockReturnValue('android');
      const push = await load();
      await push.registerForPush();
      expect(messaging.createChannel).toHaveBeenCalledWith({ id: 'bookings', name: 'תורים ולידים', importance: 4 });
      expect(devices.registerDevice).toHaveBeenCalledWith(expect.objectContaining({ platform: 'android' }));
    });

    it('re-POSTs when FCM rotates the token', async () => {
      const push = await load();
      await push.registerForPush();
      listeners.tokenReceived({ token: 'fcm-2' });
      await flush();
      expect(devices.registerDevice).toHaveBeenLastCalledWith(expect.objectContaining({ token: 'fcm-2' }));
      expect(push.getPushToken()).toBe('fcm-2');
      // The same token again is not re-sent.
      listeners.tokenReceived({ token: 'fcm-2' });
      await flush();
      expect(devices.registerDevice).toHaveBeenCalledTimes(2);
    });

    it('swallows a throwing plugin (no Firebase config yet)', async () => {
      messaging.requestPermissions.mockRejectedValue(new Error('Firebase not configured'));
      const push = await load();
      await expect(push.registerForPush()).resolves.toBeUndefined();
      expect(devices.registerDevice).not.toHaveBeenCalled();
    });

    it('survives a failing device POST', async () => {
      devices.registerDevice.mockRejectedValue(new Error('500'));
      const push = await load();
      await expect(push.registerForPush()).resolves.toBeUndefined();
    });
  });

  // LT-452: the server lets the app stand in for the booking emails only while
  // the phone keeps opening it with its notifications on.
  describe('a phone whose notifications go off', () => {
    it('is taken off the server on the next launch, by the token kept from before', async () => {
      await (await load()).registerForPush();
      expect(localStorage.getItem('lightor.pushToken')).toBe('fcm-1');

      messaging.requestPermissions.mockResolvedValue({ receive: 'denied' });
      await (await load()).registerForPush();
      expect(devices.unregisterDevice).toHaveBeenCalledWith('fcm-1');
      expect(localStorage.getItem('lightor.pushToken')).toBeNull();
    });

    it('keeps the token for another try when the DELETE fails', async () => {
      await (await load()).registerForPush();
      messaging.requestPermissions.mockResolvedValue({ receive: 'denied' });
      devices.unregisterDevice.mockRejectedValue(new Error('offline'));
      await (await load()).registerForPush();
      expect(localStorage.getItem('lightor.pushToken')).toBe('fcm-1');
    });

    it('is taken off on a return to the app, and comes back once they are on again', async () => {
      const push = await load();
      await push.registerForPush();
      expect(app.addListener).toHaveBeenCalledTimes(1);

      messaging.checkPermissions.mockResolvedValue({ receive: 'denied' });
      appListeners.resume();
      await flush();
      expect(devices.unregisterDevice).toHaveBeenCalledWith('fcm-1');
      expect(push.getPushToken()).toBeNull();

      messaging.checkPermissions.mockResolvedValue({ receive: 'granted' });
      appListeners.resume();
      await flush();
      expect(devices.registerDevice).toHaveBeenCalledTimes(2);
      expect(push.getPushToken()).toBe('fcm-1');
    });
  });

  describe('a return to the app', () => {
    it('re-registers after 12 hours, not before, and not after logout', async () => {
      const now = vi.spyOn(Date, 'now').mockReturnValue(1_000_000);
      try {
        const push = await load();
        await push.registerForPush();

        now.mockReturnValue(1_000_000 + 11 * 3_600_000);
        appListeners.resume();
        await flush();
        expect(devices.registerDevice).toHaveBeenCalledTimes(1);

        now.mockReturnValue(1_000_000 + 12 * 3_600_000);
        appListeners.resume();
        await flush();
        expect(devices.registerDevice).toHaveBeenCalledTimes(2);

        await push.unregisterPush();
        now.mockReturnValue(1_000_000 + 30 * 3_600_000);
        appListeners.resume();
        await flush();
        expect(devices.registerDevice).toHaveBeenCalledTimes(2);
      } finally {
        now.mockRestore();
      }
    });
  });

  describe('bindNotificationTaps', () => {
    it('navigates to a dashboard path from the tapped notification', async () => {
      const navigate = vi.fn();
      const push = await load();
      await push.bindNotificationTaps(navigate);
      listeners.notificationActionPerformed({
        actionId: 'tap',
        notification: { data: { event: 'newBooking', appointmentId: '1', url: '/appointments?focus=1' } },
      });
      expect(navigate).toHaveBeenCalledWith('/appointments?focus=1');
    });

    it('ignores an absolute URL and a missing one', async () => {
      const navigate = vi.fn();
      const push = await load();
      await push.bindNotificationTaps(navigate);
      listeners.notificationActionPerformed({ actionId: 'tap', notification: { data: { url: 'https://evil.example/x' } } });
      listeners.notificationActionPerformed({ actionId: 'tap', notification: { data: {} } });
      listeners.notificationActionPerformed({ actionId: 'tap', notification: {} });
      expect(navigate).not.toHaveBeenCalled();
    });

    it('binds once and follows the latest navigate', async () => {
      const first = vi.fn();
      const second = vi.fn();
      const push = await load();
      await push.bindNotificationTaps(first);
      await push.bindNotificationTaps(second);
      expect(messaging.addListener).toHaveBeenCalledTimes(1);
      listeners.notificationActionPerformed({ actionId: 'tap', notification: { data: { url: '/customers' } } });
      expect(first).not.toHaveBeenCalled();
      expect(second).toHaveBeenCalledWith('/customers');
    });

    it('does nothing on the web', async () => {
      platform.isNativeApp.mockReturnValue(false);
      const push = await load();
      await push.bindNotificationTaps(vi.fn());
      expect(messaging.addListener).not.toHaveBeenCalled();
    });

    it('swallows a throwing plugin', async () => {
      messaging.addListener.mockRejectedValue(new Error('no bridge'));
      const push = await load();
      await expect(push.bindNotificationTaps(vi.fn())).resolves.toBeUndefined();
    });
  });

  describe('unregisterPush', () => {
    it('DELETEs the registered token and forgets it', async () => {
      const push = await load();
      await push.registerForPush();
      await push.unregisterPush();
      expect(devices.unregisterDevice).toHaveBeenCalledWith('fcm-1');
      expect(push.getPushToken()).toBeNull();
    });

    it('is a no-op without a token and survives a failing DELETE', async () => {
      const push = await load();
      await push.unregisterPush();
      expect(devices.unregisterDevice).not.toHaveBeenCalled();

      await push.registerForPush();
      devices.unregisterDevice.mockRejectedValue(new Error('offline'));
      await expect(push.unregisterPush()).resolves.toBeUndefined();
    });
  });
});
