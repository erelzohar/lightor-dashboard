import { describe, it, expect, afterEach } from 'vitest';
import { isNativeApp, nativePlatform } from '../../lib/platform';

const w = window as unknown as { Capacitor?: unknown };

afterEach(() => {
  delete w.Capacitor;
});

/** One switch for every web-vs-app difference (LT-127). */
describe('platform', () => {
  it('is the web when no Capacitor global exists', () => {
    expect(isNativeApp()).toBe(false);
    expect(nativePlatform()).toBe('web');
  });

  it('is still the web when Capacitor is present but reports a browser', () => {
    w.Capacitor = { isNativePlatform: () => false, getPlatform: () => 'web' };
    expect(isNativeApp()).toBe(false);
  });

  it('reports the native platform inside the app', () => {
    w.Capacitor = { isNativePlatform: () => true, getPlatform: () => 'ios' };
    expect(isNativeApp()).toBe(true);
    expect(nativePlatform()).toBe('ios');
  });
});
