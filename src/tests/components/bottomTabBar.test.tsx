import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
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
    for (const key of ['common.dashboard', 'common.appointments', 'Lighty', 'common.scheduleVacations']) {
      expect(screen.getByText(key)).toBeInTheDocument();
    }
    // LT-256: Lighty takes Customers' place; Customers is under "More".
    expect(screen.getByText('Lighty').closest('a')).toHaveAttribute('href', '/lighty');
    expect(screen.queryByText('common.customers')).not.toBeInTheDocument();
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

  it('only offers Dashboard and the site design page to a restricted account', () => {
    render(
      <MemoryRouter>
        <BottomTabBar isRestricted onMore={vi.fn()} />
      </MemoryRouter>
    );
    expect(screen.getByText('common.dashboard')).toBeInTheDocument();
    expect(screen.getByText('common.siteDesign')).toBeInTheDocument();
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
   * A leads site (LT-199) has no calendar: Dashboard / Leads / Lighty /
   * Hours, with no Appointments and no Customers. Lighty stands where he
   * does on a booking site (LT-257) — Services moved to "More" — so the bar
   * does not swap him out when the site's mode arrives.
   */
  it('shows Dashboard, Leads, Lighty and Hours on a leads site', () => {
    render(
      <MemoryRouter initialEntries={['/leads']}>
        <BottomTabBar leadsSite onMore={vi.fn()} />
      </MemoryRouter>
    );
    const hrefs = screen.getAllByRole('link').map((a) => a.getAttribute('href'));
    expect(hrefs).toEqual(['/', '/leads', '/lighty', '/schedule-vacations']);
    for (const key of ['common.dashboard', 'common.leads', 'Lighty', 'common.openingHours']) {
      expect(screen.getByText(key)).toBeInTheDocument();
    }
    expect(screen.queryByText('common.serviceTypes')).not.toBeInTheDocument();
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
    expect(screen.getAllByRole('link').map((a) => a.getAttribute('href'))).toEqual(['/', '/design']);
  });

  it('floats clear of the home indicator, frosted in both themes (LT-304)', () => {
    render(
      <MemoryRouter>
        <BottomTabBar onMore={vi.fn()} />
      </MemoryRouter>
    );
    const bar = screen.getByTestId('bottom-tab-bar');
    // Off the edges, half the inset above the bottom (pages clear 4.5rem + the inset).
    expect(bar.className).toContain('inset-x-3');
    expect(bar.className).toContain('bottom-[calc(0.5rem+env(safe-area-inset-bottom)/2)]');
    // Glass from stock colours: the theme's are bare CSS vars, and `/80` on them emits nothing.
    expect(bar.className).toContain('bg-white/80');
    expect(bar.className).toContain('dark:bg-slate-900/80');
    expect(bar.className).not.toMatch(/dark:bg-dark-surface\/\d/);
    // Each page on its coloured tile, as in the sidebar; Lighty keeps his face.
    const home = screen.getByText('common.dashboard').closest('a') as HTMLElement;
    expect(home.querySelector('.bg-gradient-to-br.from-violet-400')).not.toBeNull();
  });

  // LT-342: on a phone the bar steps aside while the owner scrolls down.
  it('hides while scrolling down, inside any scroller, and comes back on a scroll up or near the top', () => {
    render(
      <MemoryRouter>
        <div data-testid="scroller" />
        <BottomTabBar onMore={vi.fn()} />
      </MemoryRouter>
    );
    const bar = screen.getByTestId('bottom-tab-bar');
    const scroller = screen.getByTestId('scroller');
    const scrollTo = (top: number) => {
      Object.defineProperty(scroller, 'scrollTop', { value: top, configurable: true });
      act(() => { fireEvent.scroll(scroller); });
    };
    scrollTo(100);
    scrollTo(160); // down
    expect(bar).toHaveAttribute('data-hidden', 'true');
    expect(bar.className).toContain('translate-y-');
    scrollTo(162); // a jitter changes nothing
    expect(bar).toHaveAttribute('data-hidden', 'true');
    scrollTo(120); // up
    expect(bar).not.toHaveAttribute('data-hidden');
    scrollTo(300);
    expect(bar).toHaveAttribute('data-hidden', 'true');
    scrollTo(10); // near the top
    expect(bar).not.toHaveAttribute('data-hidden');
  });
});
