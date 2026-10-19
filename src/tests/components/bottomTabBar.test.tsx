import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import BottomTabBar, { HOLD_CLICK_WAIT_MS } from '../../components/layout/BottomTabBar';

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

  // LT-414: it used to step aside on a scroll down (LT-342); any scroller
  // counted, so a page scrolling itself left it showing but untappable.
  it('stays in place and tappable whatever scrolls', () => {
    render(
      <MemoryRouter>
        <div data-testid="scroller" />
        <BottomTabBar onMore={vi.fn()} />
      </MemoryRouter>
    );
    const bar = screen.getByTestId('bottom-tab-bar');
    const scroller = screen.getByTestId('scroller');
    for (const top of [100, 160, 400]) {
      Object.defineProperty(scroller, 'scrollTop', { value: top, configurable: true });
      act(() => { fireEvent.scroll(scroller); });
    }
    expect(bar).not.toHaveAttribute('data-hidden');
    expect(bar.className).not.toContain('translate-y-');
    expect(bar.className).not.toContain('pointer-events-none');
    // No gaps between the items for a tap to fall into.
    const row = screen.getByText('common.dashboard').closest('a')!.parentElement!;
    expect(row.className).not.toMatch(/\bgap-/);
  });

  // LT-414: a tap on a rounded item's corner, between items or on the bar's
  // edge goes to the item under that x, not to nothing.
  it('sends a tap off the items to the item under it', () => {
    const Where = () => <span data-testid="where">{useLocation().pathname}</span>;
    render(
      <MemoryRouter initialEntries={['/lighty']}>
        <BottomTabBar onMore={vi.fn()} />
        <Where />
      </MemoryRouter>
    );
    const bar = screen.getByTestId('bottom-tab-bar');
    const row = bar.querySelector('[data-tab-row]') as HTMLElement;
    const rect = (left: number, right: number, top = 700, bottom = 750) =>
      ({ left, right, top, bottom, x: left, y: top, width: right - left, height: bottom - top, toJSON: () => ({}) }) as DOMRect;
    row.getBoundingClientRect = () => rect(10, 380);
    // RTL: the first item is on the right.
    Array.from(row.querySelectorAll<HTMLElement>('a,button')).forEach((item, i) => {
      item.getBoundingClientRect = () => rect(306 - i * 74, 380 - i * 74);
    });
    fireEvent.click(bar, { clientX: 320, clientY: 752 }); // under the first item, on the bar's edge
    expect(screen.getByTestId('where')).toHaveTextContent(/^\/$/);
    fireEvent.click(row, { clientX: 250, clientY: 702 }); // a corner of the second
    expect(screen.getByTestId('where')).toHaveTextContent('/appointments');
    fireEvent.click(bar, { clientX: 250, clientY: 600 }); // above the row: the menu's or a panel's
    expect(screen.getByTestId('where')).toHaveTextContent('/appointments');
  });

  // LT-419: iOS sends no click for a touch held a little longer than a tap.
  describe('a held touch on a link', () => {
    const setup = () => {
      vi.useFakeTimers();
      const Where = () => <span data-testid="where">{useLocation().pathname}</span>;
      render(
        <MemoryRouter initialEntries={['/lighty']}>
          <BottomTabBar onMore={vi.fn()} />
          <Where />
        </MemoryRouter>
      );
      const link = screen.getByText('common.appointments').closest('a') as HTMLAnchorElement;
      document.elementFromPoint = vi.fn(() => link);
      return link;
    };
    const press = (link: HTMLElement, { type = 'touch', dx = 0 } = {}) => {
      fireEvent.pointerDown(link, { pointerType: type, clientX: 100, clientY: 700 });
      fireEvent.pointerUp(link, { pointerType: type, clientX: 100 + dx, clientY: 700 });
    };
    afterEach(() => { vi.useRealTimers(); });

    it('opens the link when iOS sent no click', () => {
      const link = setup();
      press(link);
      expect(screen.getByTestId('where')).toHaveTextContent('/lighty');
      act(() => { vi.advanceTimersByTime(HOLD_CLICK_WAIT_MS); });
      expect(screen.getByTestId('where')).toHaveTextContent('/appointments');
    });

    it('adds nothing when iOS clicked, slid away, or for a mouse', () => {
      const link = setup();
      const clicks = vi.spyOn(link, 'click');
      press(link);
      fireEvent.click(link); // the browser's own click
      press(link, { dx: 40 }); // slid off: a scroll, not a press
      press(link, { type: 'mouse' });
      act(() => { vi.advanceTimersByTime(HOLD_CLICK_WAIT_MS * 2); });
      expect(clicks).not.toHaveBeenCalled();
    });
  });
});
