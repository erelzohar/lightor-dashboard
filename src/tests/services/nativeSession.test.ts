import { describe, it, expect, vi, beforeEach } from 'vitest';

const isNativeApp = vi.fn(() => false);
const prefs = { get: vi.fn(), set: vi.fn(), remove: vi.fn() };

vi.mock('../../lib/platform', () => ({ isNativeApp: () => isNativeApp() }));
vi.mock('@capacitor/preferences', () => ({ Preferences: prefs }));

// Module-level cache → a fresh module per test.
const load = async () => {
  vi.resetModules();
  return import('../../services/nativeSession');
};

/**
 * The native Bearer store (LT-128). On the web the HttpOnly cookie is the
 * session and this module must do nothing at all — not even touch the
 * Preferences plugin.
 */
describe('nativeSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isNativeApp.mockReturnValue(false);
    prefs.get.mockResolvedValue({ value: null });
    prefs.set.mockResolvedValue(undefined);
    prefs.remove.mockResolvedValue(undefined);
  });

  it('is inert on the web', async () => {
    const s = await load();
    expect(await s.loadSession()).toBeNull();
    await s.saveSession('jwt');
    expect(s.getCachedToken()).toBeNull();
    await s.clearSession();
    expect(prefs.get).not.toHaveBeenCalled();
    expect(prefs.set).not.toHaveBeenCalled();
    expect(prefs.remove).not.toHaveBeenCalled();
  });

  it('hydrates the cache from Preferences under the lightor.session key', async () => {
    isNativeApp.mockReturnValue(true);
    prefs.get.mockResolvedValue({ value: 'stored-jwt' });
    const s = await load();

    expect(s.getCachedToken()).toBeNull(); // nothing until loadSession
    expect(await s.loadSession()).toBe('stored-jwt');
    expect(prefs.get).toHaveBeenCalledWith({ key: 'lightor.session' });
    expect(s.getCachedToken()).toBe('stored-jwt');
  });

  it('persists on save and forgets on clear', async () => {
    isNativeApp.mockReturnValue(true);
    const s = await load();

    await s.saveSession('fresh-jwt');
    expect(prefs.set).toHaveBeenCalledWith({ key: 'lightor.session', value: 'fresh-jwt' });
    expect(s.getCachedToken()).toBe('fresh-jwt');

    await s.clearSession();
    expect(prefs.remove).toHaveBeenCalledWith({ key: 'lightor.session' });
    expect(s.getCachedToken()).toBeNull();
  });

  it('survives a failing plugin', async () => {
    isNativeApp.mockReturnValue(true);
    prefs.get.mockRejectedValue(new Error('no bridge'));
    prefs.set.mockRejectedValue(new Error('no bridge'));
    prefs.remove.mockRejectedValue(new Error('no bridge'));
    const s = await load();

    expect(await s.loadSession()).toBeNull();
    await s.saveSession('jwt');
    expect(s.getCachedToken()).toBe('jwt'); // in-memory copy still serves this run
    await s.clearSession();
    expect(s.getCachedToken()).toBeNull();
  });
});
