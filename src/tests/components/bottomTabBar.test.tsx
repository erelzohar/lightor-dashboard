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

  it('has no Leads tab on a booking site', () => {
    render(
      <MemoryRouter>
        <BottomTabBar onMore={vi.fn()} newLeads={3} />
      </MemoryRouter>
    );
    expect(screen.queryByText('common.leads')).not.toBeInTheDocument();
    expect(screen.queryByTestId('tab-dot')).not.toBeInTheDocument();
  });

  /**
   * A leads site (LT-199) has no calendar: Dashboard / Leads / Services /
   * Hours, with no Appointments and no Customers.
   */
  it('shows Dashboard, Leads, Services and Hours on a leads site', () => {
    render(
      <MemoryRouter initialEntries={['/leads']}>
        <BottomTabBar leadsSite onMore={vi.fn()} />
      </MemoryRouter>
    );
    const hrefs = screen.getAllByRole('link').map((a) => a.getAttribute('href'));
    expect(hrefs).toEqual(['/', '/leads', '/appointment-types', '/schedule-vacations']);
    for (const key of ['common.dashboard', 'common.leads', 'common.serviceTypes', 'common.openingHours']) {
      expect(screen.getByText(key)).toBeInTheDocument();
    }
    expect(screen.queryByText('common.appointments')).not.toBeInTheDocument();
    expect(screen.queryByText('common.customers')).not.toBeInTheDocument();
    expect(screen.queryByText('common.scheduleVacations')).not.toBeInTheDocument();
    expect(screen.getByText('common.leads').closest('a')).toHaveAttribute('aria-current', 'page');
    expect(screen.getByText('sidebar.more')).toBeInTheDocument();
  });

  it('dots the Leads tab while new leads wait', () => {
    const { rerender } = render(
      <MemoryRouter>
        <BottomTabBar leadsSite newLeads={2} onMore={vi.fn()} />
      </MemoryRouter>
    );
    expect(screen.getByText('common.leads').closest('a')).toContainElement(screen.getByTestId('tab-dot'));

    rerender(
      <MemoryRouter>
        <BottomTabBar leadsSite newLeads={0} onMore={vi.fn()} />
      </MemoryRouter>
    );
    expect(screen.queryByTestId('tab-dot')).not.toBeInTheDocument();
  });

  it('keeps a restricted account on Dashboard and the AI builder on a leads site too', () => {
    render(
      <MemoryRouter>
        <BottomTabBar isRestricted leadsSite onMore={vi.fn()} />
      </MemoryRouter>
    );
    expect(screen.getAllByRole('link').map((a) => a.getAttribute('href'))).toEqual(['/', '/ai']);
  });

  it('clears the home indicator via the safe-area inset', () => {
    render(
      <MemoryRouter>
        <BottomTabBar onMore={vi.fn()} />
      </MemoryRouter>
    );
    const bar = screen.getByTestId('bottom-tab-bar');
    // Split across top and bottom, not all below the icons: the whole inset
    // sitting underneath made the bar look top-heavy on a real phone.
    expect(bar.className).toContain('py-[calc(env(safe-area-inset-bottom)/2)]');
    expect(bar.className).not.toContain('pb-[env(safe-area-inset-bottom)]');
    // Theme colours are bare CSS vars, so `/95` on them emits no CSS at all.
    expect(bar.className).toContain('dark:bg-dark-surface');
    expect(bar.className).not.toMatch(/dark:bg-dark-surface\/\d/);
  });
});
