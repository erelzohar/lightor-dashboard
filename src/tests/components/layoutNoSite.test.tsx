import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import Layout from '../../components/layout/Layout';
import { nativePlatform } from '../../lib/platform';
import type { User } from '../../types';

/**
 * LT-502: an account with no site goes straight to the builder, with no card
 * and no navbar until a site is saved. LT-724: an account with no proven
 * phone too (LT-500 had a phone step first).
 */
const { state, t, toastFn } = vi.hoisted(() => ({
  state: {
    user: {} as Partial<User>,
    webConfig: { data: null as unknown, loading: false, error: null },
  },
  t: (key: string) => key,
  toastFn: vi.fn(),
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t }) }));
vi.mock('react-hot-toast', () => ({ default: toastFn }));
vi.mock('../../contexts/ThemeContext', () => ({ useTheme: () => ({ direction: 'rtl', language: 'he' }) }));
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ auth: { user: state.user }, updateUser: vi.fn(), logout: vi.fn() }),
}));
vi.mock('../../contexts/LeaveGuardContext', () => ({ useLeaveGuard: () => ({ confirmLeave: (go: () => void) => go() }) }));
vi.mock('../../contexts/PhoneBarContext', () => ({ PhoneBarProvider: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock('../../hooks/useAppDispatch', () => ({ useAppDispatch: () => vi.fn(() => ({ finally: vi.fn() })) }));
vi.mock('../../hooks/useAppSelector', () => ({
  useAppSelector: (selector: (s: unknown) => unknown) => selector({ webConfig: state.webConfig }),
}));
vi.mock('../../hooks/useMomentum', () => ({ useMomentum: () => ({ mood: 0 }) }));
vi.mock('../../hooks/useAppUrlOpen', () => ({ useDeepLinkLeaveGuard: vi.fn() }));
vi.mock('../../services/pushClient', () => ({ bindNotificationTaps: vi.fn() }));
vi.mock('../../lib/platform', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/platform')>()),
  nativePlatform: vi.fn(),
}));
vi.mock('../../components/layout/Sidebar', () => ({ default: () => <div data-testid="navbar" /> }));
vi.mock('../../components/layout/AccountBanners', () => ({ default: (): null => null }));
vi.mock('../../components/tour/PageTour', () => ({ default: (): null => null }));
vi.mock('../../components/support/ReportProblem', () => ({ ReportProblemHost: (): null => null }));
const lighty = vi.hoisted(() => ({ props: null as null | { greeting?: string; note?: string } }));
vi.mock('../../components/ui/glowing-ai-chat-assistant', () => ({
  FloatingAiAssistant: (props: { greeting?: string; note?: string }): null => {
    lighty.props = props;
    return null;
  },
}));
vi.mock('../../components/onboarding/OnboardingWelcome', () => ({ default: () => <div data-testid="welcome-card" /> }));

const Page: React.FC = () => <div data-testid="page">{useLocation().pathname}</div>;

const open = (path = '/') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route path="*" element={<Page />} />
          <Route index element={<Page />} />
        </Route>
      </Routes>
    </MemoryRouter>
  );

describe('Layout, an account with no site', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(nativePlatform).mockReturnValue('web');
    state.user = { name: 'Dana', boardingStatus: 'new', freePeriod: { state: 'granted' } } as Partial<User>;
    state.webConfig.data = null;
  });

  it('goes straight to the builder, with no card and no navbar', () => {
    open('/');
    expect(screen.getByTestId('page').textContent).toBe('/design');
    expect(screen.queryByTestId('welcome-card')).toBeNull();
    expect(screen.queryByTestId('navbar')).toBeNull();
  });

  it('turns any other page back to the builder', () => {
    open('/appointments');
    expect(screen.getByTestId('page').textContent).toBe('/design');
  });

  it('leaves the account page open, with the way back', () => {
    open('/design');
    fireEvent.click(screen.getByText('onboarding.buildingBar.account'));
    expect(screen.getByTestId('page').textContent).toBe('/account');
    fireEvent.click(screen.getByText('onboarding.buildingBar.back'));
    expect(screen.getByTestId('page').textContent).toBe('/design');
  });

  it('has the navbar back once a site is saved, with no card over the editor', () => {
    const view = open('/design');
    state.webConfig.data = { _id: 'w1', businessName: 'Studio' };
    view.rerender(
      <MemoryRouter initialEntries={['/design']}>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route path="*" element={<Page />} />
          </Route>
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByTestId('navbar')).toBeTruthy();
    expect(screen.queryByTestId('building-bar')).toBeNull();
    expect(screen.queryByTestId('welcome-card')).toBeNull();
  });

  it('keeps the card and the navbar for a new account that arrives with a site', () => {
    state.user.webConfig_id = 'w1';
    state.webConfig.data = { _id: 'w1', businessName: 'Studio' };
    open('/');
    expect(screen.getByTestId('welcome-card')).toBeTruthy();
    expect(screen.getByTestId('navbar')).toBeTruthy();
  });

  it('leaves an account past onboarding alone', () => {
    state.user.boardingStatus = 'onboarded' as User['boardingStatus'];
    open('/appointments');
    expect(screen.getByTestId('page').textContent).toBe('/appointments');
    expect(screen.getByTestId('navbar')).toBeTruthy();
  });

  // LT-724: the phone is offered, not demanded: no gate (it was one since
  // LT-500), on any platform, and no offer before there is a site.
  it('lets an account with no proven phone build its site, with no phone step and no offer', () => {
    state.user.freePeriod = { state: 'pending' } as User['freePeriod'];
    for (const platform of ['web', 'android', 'ios'] as const) {
      vi.mocked(nativePlatform).mockReturnValue(platform);
      const { unmount } = open('/');
      expect(screen.getByTestId('page').textContent).toBe('/design');
      expect(screen.getByTestId('building-bar')).toBeTruthy();
      expect(screen.queryByTestId('free-months-offer')).toBeNull();
      expect(screen.queryByRole('dialog')).toBeNull();
      unmount();
    }
  });

});

// LT-724: every email signup starts unverified; the home page's red card then holds the resend
// button where his greeting bubble opens on a wide screen, so he says nothing by himself there.
describe('Layout, Lighty over the home page of an account not verified', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    lighty.props = null;
    vi.mocked(nativePlatform).mockReturnValue('web');
    state.user = { _id: 'u1', name: 'Dana', boardingStatus: 'onboarded', webConfig_id: 'w1', freePeriod: { state: 'granted' } } as unknown as Partial<User>;
    state.webConfig.data = { _id: 'w1', businessName: 'Studio' };
  });

  it('has no greeting bubble while the email waits for its link', () => {
    state.user.isVerified = false;
    open('/');
    expect(lighty.props).not.toBeNull();
    expect(lighty.props?.greeting).toBeUndefined();
    expect(lighty.props?.note).toBeUndefined();
  });

  it('greets as before once the email is verified', () => {
    state.user.isVerified = true;
    open('/');
    expect(lighty.props?.greeting).toContain('common.greetingWithName');
  });
});
