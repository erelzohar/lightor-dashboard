import { describe, it, expect, vi, beforeEach } from 'vitest';

// The update plugin, played by the test. Like every Capacitor plugin it answers `then`
// (a promise resolved with it never settles: LT-604), so the code must never return it.
const lu = vi.hoisted(() => ({
  blocked: [] as string[],
  downloaded: [] as string[],
  current: null as string | null,
  calls: [] as string[],
}));
vi.mock('@capawesome/capacitor-live-update', () => ({
  LiveUpdate: {
    then: () => new Promise(() => {}),
    ready: vi.fn(async () => { lu.calls.push('ready'); }),
    reload: vi.fn(async () => { lu.calls.push('reload'); }),
    getBlockedBundles: vi.fn(async () => ({ bundleIds: lu.blocked })),
    getDownloadedBundles: vi.fn(async () => ({ bundleIds: lu.downloaded })),
    getCurrentBundle: vi.fn(async () => ({ bundleId: lu.current })),
    downloadBundle: vi.fn(async (o: { bundleId: string }) => { lu.calls.push(`download:${o.bundleId}`); lu.downloaded.push(o.bundleId); }),
    setNextBundle: vi.fn(async (o: { bundleId: string }) => { lu.calls.push(`next:${o.bundleId}`); }),
    deleteBundle: vi.fn(async (o: { bundleId: string }) => { lu.calls.push(`delete:${o.bundleId}`); }),
  },
}));
const prefs = vi.hoisted(() => new Map<string, string>());
vi.mock('@capacitor/preferences', () => ({
  Preferences: {
    get: vi.fn(async ({ key }: { key: string }) => ({ value: prefs.get(key) ?? null })),
    set: vi.fn(async ({ key, value }: { key: string; value: string }) => { prefs.set(key, value); }),
  },
}));
const appState = vi.hoisted(() => ({ listener: null as null | ((s: { isActive: boolean }) => void) }));
vi.mock('@capacitor/app', () => ({
  App: {
    getInfo: vi.fn(async () => ({ version: '1.1', build: '26' })),
    addListener: vi.fn(async (_e: string, l: (s: { isActive: boolean }) => void) => { appState.listener = l; return { remove: vi.fn() }; }),
  },
}));
vi.mock('../../lib/platform', () => ({ isNativeApp: () => true, nativePlatform: () => 'ios' }));
const api = vi.hoisted(() => ({ answer: { bundle: null as unknown, forceUpdate: false }, params: [] as Record<string, unknown>[] }));
vi.mock('../../services/apiClient', () => ({
  default: {
    get: vi.fn(async (_url: string, opts: { params: Record<string, unknown> }) => {
      api.params.push(opts.params);
      return { data: { success: true, data: api.answer } };
    }),
  },
}));

const bundle = { id: 'abc1234-202611080100', url: 'https://dashboard.lightor.app/app-updates/abc1234-202611080100.zip', checksum: 'f'.repeat(64), signature: 'c2lnbmVk' };
const fresh = async () => {
  vi.resetModules();
  return import('../../lib/liveUpdate');
};
const settle = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  lu.blocked = []; lu.downloaded = []; lu.current = null; lu.calls = [];
  api.answer = { bundle: null, forceUpdate: false }; api.params = [];
  prefs.clear();
  appState.listener = null;
});

/** LT-608: the apps' over-the-air updates from our own server. */
describe('live updates (LT-608)', () => {
  it('asks with the app\'s versions and a kept install id, downloads a newer bundle with its signature and sets it for the next launch', async () => {
    api.answer = { bundle, forceUpdate: false };
    const m = await fresh();
    await m.startLiveUpdates();
    await vi.waitFor(() => expect(lu.calls).toContain(`next:${bundle.id}`));
    expect(lu.calls.indexOf(`download:${bundle.id}`)).toBeLessThan(lu.calls.indexOf(`next:${bundle.id}`));
    const { LiveUpdate } = await import('@capawesome/capacitor-live-update');
    expect(LiveUpdate.downloadBundle).toHaveBeenCalledWith({ url: bundle.url, bundleId: bundle.id, checksum: bundle.checksum, signature: bundle.signature });
    expect(api.params[0]).toMatchObject({ platform: 'ios', version: '1.1', build: '26', bundle: m.BUNDLE.id });
    expect(String(api.params[0].installId)).toHaveLength(36);
    expect(lu.calls).not.toContain('reload');

    // The same install id the next time.
    const again = await fresh();
    await again.startLiveUpdates();
    await vi.waitFor(() => expect(api.params).toHaveLength(2));
    expect(api.params[1].installId).toBe(api.params[0].installId);
  });

  it('never takes a bundle that was rolled back, nor downloads one it already has', async () => {
    api.answer = { bundle, forceUpdate: false };
    lu.blocked = [bundle.id];
    const m = await fresh();
    await m.startLiveUpdates();
    await vi.waitFor(() => expect(api.params).toHaveLength(1));
    await settle();
    expect(lu.calls.filter((c) => c.startsWith('download') || c.startsWith('next'))).toEqual([]);

    lu.blocked = []; lu.downloaded = [bundle.id]; lu.calls = [];
    const n = await fresh();
    await n.startLiveUpdates();
    await vi.waitFor(() => expect(lu.calls).toContain(`next:${bundle.id}`));
    expect(lu.calls.some((c) => c.startsWith('download'))).toBe(false);
  });

  it('keeps only the bundle running and the one waiting', async () => {
    api.answer = { bundle, forceUpdate: false };
    lu.current = 'old-running';
    lu.downloaded = ['old-running', 'older-1', 'older-2'];
    const m = await fresh();
    await m.startLiveUpdates();
    await vi.waitFor(() => expect(lu.calls).toContain('delete:older-2'));
    expect(lu.calls).toContain('delete:older-1');
    expect(lu.calls).not.toContain('delete:old-running');
    expect(lu.calls).not.toContain(`delete:${bundle.id}`);
  });

  it('applies the waiting bundle only after 10 minutes away, never on a quick switch', async () => {
    api.answer = { bundle, forceUpdate: false };
    const m = await fresh();
    await m.startLiveUpdates();
    await vi.waitFor(() => expect(lu.calls).toContain(`next:${bundle.id}`));
    const now = Date.now();
    const clock = vi.spyOn(Date, 'now');
    clock.mockReturnValue(now);
    m.onAppStateChange({ isActive: false });
    clock.mockReturnValue(now + 60_000);
    m.onAppStateChange({ isActive: true });
    await settle();
    expect(lu.calls).not.toContain('reload');
    clock.mockReturnValue(now + 2 * 60_000);
    m.onAppStateChange({ isActive: false });
    clock.mockReturnValue(now + 13 * 60_000);
    m.onAppStateChange({ isActive: true });
    await vi.waitFor(() => expect(lu.calls).toContain('reload'));
    clock.mockRestore();
  });

  it('tells the update screen when the server asks for a store update', async () => {
    api.answer = { bundle: null, forceUpdate: true };
    const m = await fresh();
    const seen = vi.fn();
    m.onForceUpdate(seen);
    await m.startLiveUpdates();
    await vi.waitFor(() => expect(seen).toHaveBeenCalledTimes(1));
    const late = vi.fn();
    m.onForceUpdate(late);
    expect(late).toHaveBeenCalledTimes(1);
  });

  it('confirms the bundle, but not after a page crashed', async () => {
    const m = await fresh();
    await m.markAppReady();
    expect(lu.calls).toEqual(['ready']);
    lu.calls = [];
    const n = await fresh();
    n.noteRenderCrash();
    await n.markAppReady();
    expect(lu.calls).toEqual([]);
  });
});
