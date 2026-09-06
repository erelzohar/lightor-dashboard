import { describe, it, expect, vi, beforeEach } from 'vitest';

const platform = { isNativeApp: vi.fn(() => true), nativePlatform: vi.fn(() => 'ios' as 'ios' | 'android' | 'web') };
const messaging = {
  requestPermissions: vi.fn(),
  getToken: vi.fn(),
  addListener: vi.fn(),
  createChannel: vi.fn(),
};
const app = { getInfo: vi.fn() };
const devices = { registerDevice: vi.fn(), unregisterDevice: vi.fn() };

vi.mock('../../lib/platform', () => ({
  isNativeApp: () => platform.isNativeApp(),
  nativePlatform: () => platform.nativePlatform(),
}));
vi.mock('@capacitor-firebase/messaging', () => ({ FirebaseMessaging: messaging }));
vi.mock('@capacitor/app', () => ({ App: app }));
vi.mock('../../services/devicesApi', () => devices);
vi.mock('../../i18n/config', () => ({ default: { language: 'he' } }));

type Listener = (event: unknown) => void;
const listeners: Record<string, Listener> = {};

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
    platform.isNativeApp.mockReturnValue(true);
    platform.nativePlatform.mockReturnValue('ios');
    messaging.requestPermissions.mockResolvedValue({ receive: 'granted' });
    messaging.getToken.mockResolvedValue({ token: 'fcm-1' });
    messaging.createChannel.mockResolvedValue(undefined);
    messaging.addListener.mockImplementation(async (name: string, fn: Listener) => {
      listeners[name] = fn;
      return { remove: vi.fn() };
    });
    app.getInfo.mockResolvedValue({ name: 'Lightor', id: 'app.lightor.dashboard', build: '7', version: '1.2.3' });
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

    it('creates the bookings channel on Android', async () => {
      platform.nativePlatform.mockReturnValue('android');
      const push = await load();
      await push.registerForPush();
      expect(messaging.createChannel).toHaveBeenCalledWith({ id: 'bookings', name: 'Bookings', importance: 4 });
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
