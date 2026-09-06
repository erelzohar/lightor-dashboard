import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import BottomTabBar from '../../components/layout/BottomTabBar';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

/**
 * Phone tab bar (LT-127): the four daily destinations plus "More", which
 * hands off to the drawer. Restricted (not-yet-onboarded) accounts only get
 * what the drawer would let them reach.
 */
describe('BottomTabBar', () => {
  it('shows the four daily tabs and hands "More" to the drawer', () => {
    const onMore = vi.fn();
    render(
      <MemoryRouter initialEntries={['/appointments']}>
        <BottomTabBar onMore={onMore} />
      </MemoryRouter>
    );
    for (const key of ['common.dashboard', 'common.appointments', 'common.customers', 'common.scheduleVacations']) {
      expect(screen.getByText(key)).toBeInTheDocument();
    }
    const active = screen.getByText('common.appointments').closest('a')!;
    const idle = screen.getByText('common.dashboard').closest('a')!;
    expect(active).toHaveAttribute('aria-current', 'page');
    expect(idle).not.toHaveAttribute('aria-current');
    // The highlight must win in BOTH themes: no idle colour class may remain
    // on the active tab (a leftover `dark:text-gray-400` outranks text-primary).
    expect(active.className).toContain('text-primary');
    expect(active.className).toContain('dark:text-primary');
    expect(active.className).not.toContain('text-gray-500');
    expect(active.className).not.toContain('dark:text-gray-400');
    expect(idle.className).toContain('dark:text-gray-400');

    fireEvent.click(screen.getByText('sidebar.more'));
    expect(onMore).toHaveBeenCalledTimes(1);
  });

  it('only offers Dashboard and the AI builder to a restricted account', () => {
    render(
      <MemoryRouter>
        <BottomTabBar isRestricted onMore={vi.fn()} />
      </MemoryRouter>
    );
    expect(screen.getByText('common.dashboard')).toBeInTheDocument();
    expect(screen.getByText('common.aiBuilder')).toBeInTheDocument();
    expect(screen.queryByText('common.customers')).not.toBeInTheDocument();
    expect(screen.queryByText('common.appointments')).not.toBeInTheDocument();
  });

  it('clears the home indicator via the safe-area inset', () => {
    render(
      <MemoryRouter>
        <BottomTabBar onMore={vi.fn()} />
      </MemoryRouter>
    );
    const bar = screen.getByTestId('bottom-tab-bar');
    expect(bar.className).toContain('pb-[env(safe-area-inset-bottom)]');
    // Theme colours are bare CSS vars, so `/95` on them emits no CSS at all.
    expect(bar.className).toContain('dark:bg-dark-surface');
    expect(bar.className).not.toMatch(/dark:bg-dark-surface\/\d/);
  });
});
