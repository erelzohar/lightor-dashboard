import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import LiveUpdateGate from '../../components/app/LiveUpdateGate';
import AppVersionLine from '../../components/app/AppVersionLine';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, vars?: Record<string, string>) => (vars ? `${key} ${JSON.stringify(vars)}` : key), i18n: { language: 'he' } }),
}));
const lu = vi.hoisted(() => ({ force: null as null | (() => void), ready: vi.fn(), start: vi.fn(), native: true }));
vi.mock('../../lib/platform', () => ({ isNativeApp: () => lu.native, nativePlatform: () => 'ios' }));
vi.mock('../../lib/liveUpdate', () => ({
  markAppReady: lu.ready,
  startLiveUpdates: lu.start,
  onForceUpdate: (listener: () => void) => { lu.force = listener; return () => { lu.force = null; }; },
  appVersion: async () => ({ platform: lu.native ? 'ios' : 'web', version: lu.native ? '1.1' : '', build: lu.native ? '26' : '', bundle: 'abc1234-202611080100', builtAt: '2026-11-08T01:00:00.000Z' }),
}));

beforeEach(() => {
  lu.force = null; lu.ready.mockClear(); lu.start.mockClear(); lu.native = true;
  vi.stubEnv('VITE_APP_STORE_URL', 'https://apps.apple.com/app/id6819305092');
});

/** LT-608: the update checks start in the app, and the store-update screen when the server asks. */
describe('LiveUpdateGate (LT-608)', () => {
  it('starts the checks, confirms the bundle after a few seconds, and shows nothing until a store update is asked', async () => {
    vi.useFakeTimers();
    render(<LiveUpdateGate />);
    expect(lu.start).toHaveBeenCalledTimes(1);
    expect(lu.ready).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(4000); });
    expect(lu.ready).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('force-update')).toBeNull();
    vi.useRealTimers();
  });

  it('covers the app with the update screen and a link to the store', () => {
    render(<LiveUpdateGate />);
    act(() => { lu.force!(); });
    expect(screen.getByTestId('force-update')).toHaveTextContent('app.update.title');
    expect(screen.getByRole('link', { name: 'app.update.cta' })).toHaveAttribute('href', 'https://apps.apple.com/app/id6819305092');
  });

  it('does nothing on the web', () => {
    lu.native = false;
    render(<LiveUpdateGate />);
    expect(lu.start).not.toHaveBeenCalled();
  });
});

describe('AppVersionLine (LT-608)', () => {
  it('names the store version and build, and the dashboard update', async () => {
    render(<AppVersionLine />);
    const line = await screen.findByTestId('app-version');
    expect(line).toHaveTextContent('app.version.app {"version":"1.1","build":"26"}');
    expect(line).toHaveTextContent('"id":"abc1234"');
  });

  it('on the web, the update only', async () => {
    lu.native = false;
    render(<AppVersionLine />);
    const line = await screen.findByTestId('app-version');
    expect(line).not.toHaveTextContent('app.version.app');
    expect(line).toHaveTextContent('app.version.bundle');
  });
});
