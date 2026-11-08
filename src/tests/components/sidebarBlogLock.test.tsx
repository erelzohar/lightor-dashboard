import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Sidebar from '../../components/layout/Sidebar';
import { hasBlog } from '../../services/postsApi';
import { fetchMyEntitlements } from '../../services/entitlementsApi';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
const auth = vi.hoisted(() => ({
  user: { _id: 'u1', name: 'Erel', role: 'user', subscription: { status: 'free' } } as Record<string, unknown>,
}));
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ logout: vi.fn(), auth: { user: auth.user, isAuthenticated: true, isLoading: false } }),
}));
vi.mock('../../contexts/ThemeContext', () => ({
  useTheme: () => ({ direction: 'ltr', darkMode: false, toggleDarkMode: vi.fn() }),
}));
const state = vi.hoisted(() => ({
  webConfig: { data: { businessName: 'Biz', conversion: 'book', catalog: false, appointmentTypes: [] as unknown[], components: { portfolio: { items: [] as unknown[] } } } },
}));
vi.mock('../../hooks/useAppSelector', () => ({
  useAppSelector: (selector: (s: typeof state) => unknown): unknown => selector(state),
}));
vi.mock('../../services/leadsApi', () => ({
  fetchLeads: vi.fn().mockResolvedValue({ success: true, data: [], pagination: { total: 0, page: 1, limit: 1, pages: 0 }, counts: { new: 0, contacted: 0, closed: 0 } }),
}));
vi.mock('../../services/entitlementsApi', () => ({ fetchMyEntitlements: vi.fn() }));

const blogLink = () => screen.getAllByRole('link').find((a) => a.getAttribute('href') === '/blog')!;
const draw = () => render(<MemoryRouter><Sidebar /></MemoryRouter>);

/**
 * LT-610 (Erel 2026-11-08): "a lock on the blog's link although it is open for
 * me (the admin account) - better a lock only for whoever is really locked".
 * The menu remembered its first answer for the tab's life, so an account
 * signed in after another one kept that one's lock.
 */
describe("the blog's lock in the menu", () => {
  beforeEach(() => {
    vi.mocked(fetchMyEntitlements).mockReset();
    auth.user = { _id: 'u1', name: 'Erel', role: 'user', subscription: { status: 'free' } };
  });

  it('locks the link when the server says the plan has no blog', async () => {
    vi.mocked(fetchMyEntitlements).mockResolvedValue({ plan: 'plus', limits: { blog: false } } as never);
    draw();
    await waitFor(() => expect(blogLink()).toHaveAccessibleName('common.blog (blog.pro)'));
  });

  it('leaves it open on Pro, and for the admin account the server gives Pro', async () => {
    vi.mocked(fetchMyEntitlements).mockResolvedValue({ plan: 'pro', limits: { blog: true } } as never);
    draw();
    await waitFor(() => expect(fetchMyEntitlements).toHaveBeenCalled());
    expect(blogLink()).toHaveAccessibleName('common.blog');
    expect(screen.queryByTestId('nav-locked')).toBeNull();
  });

  it('locks nothing when the server could not answer', async () => {
    vi.mocked(fetchMyEntitlements).mockResolvedValue(null);
    draw();
    await waitFor(() => expect(fetchMyEntitlements).toHaveBeenCalled());
    expect(screen.queryByTestId('nav-locked')).toBeNull();
  });

  it('asks again when another account signs in in the same tab', async () => {
    vi.mocked(fetchMyEntitlements).mockResolvedValueOnce({ plan: 'free', limits: { blog: false } } as never);
    const { rerender } = draw();
    await waitFor(() => expect(screen.getByTestId('nav-locked')).toBeInTheDocument());
    auth.user = { _id: 'admin', name: 'Erel', role: 'admin', subscription: { status: 'free' } };
    vi.mocked(fetchMyEntitlements).mockResolvedValueOnce({ plan: 'pro', limits: { blog: true } } as never);
    rerender(<MemoryRouter><Sidebar /></MemoryRouter>);
    await waitFor(() => expect(screen.queryByTestId('nav-locked')).toBeNull());
    expect(fetchMyEntitlements).toHaveBeenCalledTimes(2);
  });

  it('asks again when the plan changes (an upgrade in the same tab)', async () => {
    vi.mocked(fetchMyEntitlements).mockResolvedValueOnce({ plan: 'plus', limits: { blog: false } } as never);
    const { rerender } = draw();
    await waitFor(() => expect(screen.getByTestId('nav-locked')).toBeInTheDocument());
    auth.user = { ...auth.user, subscription: { status: 'active', planId: 'pro_monthly' } };
    vi.mocked(fetchMyEntitlements).mockResolvedValueOnce({ plan: 'pro', limits: { blog: true } } as never);
    rerender(<MemoryRouter><Sidebar /></MemoryRouter>);
    await waitFor(() => expect(screen.queryByTestId('nav-locked')).toBeNull());
  });
});

describe('hasBlog', () => {
  beforeEach(() => vi.mocked(fetchMyEntitlements).mockReset());

  it('reads the plan, says null when the server could not, and never remembers', async () => {
    vi.mocked(fetchMyEntitlements)
      .mockResolvedValueOnce({ plan: 'pro', limits: { blog: true } } as never)
      .mockResolvedValueOnce({ plan: 'pro', limits: {} } as never)
      .mockResolvedValueOnce({ plan: 'plus', limits: { blog: false } } as never)
      .mockResolvedValueOnce(null);
    expect(await hasBlog()).toBe(true);
    expect(await hasBlog()).toBe(true);
    expect(await hasBlog()).toBe(false);
    expect(await hasBlog()).toBeNull();
    expect(fetchMyEntitlements).toHaveBeenCalledTimes(4);
  });
});
