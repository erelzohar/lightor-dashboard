import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Sidebar from '../../components/layout/Sidebar';
import { useEffect } from 'react';
import { PhoneBarProvider, usePhoneBar } from '../../contexts/PhoneBarContext';
import { openReportProblem } from '../../components/support/ReportProblem';

vi.mock('../../components/support/ReportProblem', () => ({ openReportProblem: vi.fn() }));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
const auth = { user: { _id: 'u1', name: 'Erel', email: 'owner@example.com', role: 'user' }, isAuthenticated: true, isLoading: false };
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ logout: vi.fn(), auth }),
}));
vi.mock('../../contexts/ThemeContext', () => ({
  useTheme: () => ({ direction: 'rtl', darkMode: false, toggleDarkMode: vi.fn() }),
}));
let conversion = 'book';
vi.mock('../../hooks/useAppSelector', () => ({
  useAppSelector: (selector: (s: unknown) => unknown): unknown =>
    selector({ webConfig: { data: { businessName: 'Biz', conversion } } }),
}));
let newLeads = 0;
vi.mock('../../hooks/useNewLeadsCount', () => ({
  useNewLeadsCount: () => newLeads,
  refreshNewLeadsCount: vi.fn(),
}));

/**
 * LT-352 — Erel: on the phone the full menu should open out of the tab bar,
 * the pages as tiles, not the side drawer that "looks unrelated". The bar
 * stays under it ("More" becomes the close button); a tap outside, Escape,
 * "More" again or a page closes it.
 */
const renderAt = (path = '/', restricted = false) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="*" element={<Sidebar isRestricted={restricted} />} />
      </Routes>
    </MemoryRouter>
  );
const more = () => within(screen.getByTestId('bottom-tab-bar')).getByRole('button', { name: /sidebar\.(open|close)Menu/ });
const menu = () => screen.queryByRole('region', { name: 'sidebar.menu' });
const gone = () => waitFor(() => expect(menu()).toBeNull());
const tileNames = (dialog: HTMLElement) => within(dialog).getAllByRole('link').map((a) => a.getAttribute('href'));

beforeEach(() => {
  conversion = 'book';
  newLeads = 0;
});

describe('the phone menu (LT-352, LT-378)', () => {
  it('grows the bar itself with only the pages the bar lacks, the current one marked (LT-378)', () => {
    renderAt('/customers');
    expect(more()).toHaveAttribute('aria-expanded', 'false');
    const barLinks = () => within(screen.getByTestId('bottom-tab-bar')).getAllByRole('link');
    const before = barLinks().map((a) => a.getAttribute('href'));
    expect(before).toEqual(['/', '/appointments', '/lighty', '/schedule-vacations']);
    fireEvent.click(more());

    const added = menu()!;
    // Part of the bar, above its own row: no second menu, no repeated pages.
    expect(screen.getByTestId('bottom-tab-bar')).toContainElement(added);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(tileNames(added)).toEqual(['/design', '/customers', '/leads', '/appointment-types', '/portfolio', '/settings']);
    tileNames(added).forEach((path) => expect(before).not.toContain(path));
    // The bar's own row is still there, unchanged.
    expect(barLinks().map((a) => a.getAttribute('href'))).toEqual([...tileNames(added), ...before]);
    expect(within(added).getByText('common.customers').closest('a')).toHaveAttribute('aria-current', 'page');
    // The account, logging out and the theme are in it too.
    expect(within(added).getByText('Erel')).toBeInTheDocument();
    expect(within(added).getByRole('button', { name: 'common.logout' })).toBeInTheDocument();
    expect(within(added).getByRole('button', { name: 'settings.darkMode' })).toBeInTheDocument();
    // "More" is now the way to close it.
    expect(more()).toHaveAccessibleName('sidebar.closeMenu');
    expect(more()).toHaveAttribute('aria-expanded', 'true');
  });

  it("adds the leads site's own missing pages, never its bar's", () => {
    conversion = 'lead';
    renderAt('/');
    fireEvent.click(more());
    // Customers too since LT-376: everyone who wrote is one.
    expect(tileNames(menu()!)).toEqual(['/design', '/customers', '/appointment-types', '/portfolio', '/settings']);
  });

  it('shows every page under More while a page edits through the bar (LT-384)', () => {
    const Editing = (): null => {
      const bar = usePhoneBar()!;
      useEffect(() => bar.setEditing(true), [bar]);
      return null;
    };
    render(
      <MemoryRouter initialEntries={['/design']}>
        <PhoneBarProvider>
          <Editing />
          <Sidebar />
        </PhoneBarProvider>
      </MemoryRouter>
    );
    fireEvent.click(more());
    expect(tileNames(menu()!)).toEqual([
      '/', '/lighty', '/design', '/appointments',
      '/customers', '/leads', '/schedule-vacations', '/appointment-types', '/portfolio', '/settings',
    ]);
  });

  it('shows the sign-in email under the name, in the sidebar and in the menu (LT-364)', () => {
    renderAt('/');
    // The desktop sidebar's account button.
    const side = screen.getByText('owner@example.com');
    expect(side.closest('button')).toHaveTextContent('Erelowner@example.com');
    fireEvent.click(more());
    const inMenu = within(menu()!).getByText('owner@example.com');
    expect(inMenu.tagName).toBe('BDI');
    expect(inMenu.closest('button')).toHaveTextContent('Erelowner@example.com');
    // The initials avatar is round in both (LT-369).
    const avatars = screen.getAllByText('E', { exact: true });
    expect(avatars.length).toBe(2);
    avatars.forEach((a) => expect(a).toHaveClass('rounded-full'));
  });

  it('closes on "More" again, Escape and a tap outside', async () => {
    renderAt('/');
    fireEvent.click(more());
    fireEvent.click(more());
    await gone();

    fireEvent.click(more());
    fireEvent.keyDown(window, { key: 'Escape' });
    await gone();

    fireEvent.click(more());
    fireEvent.click(screen.getByTestId('phone-menu-backdrop'));
    await gone();
  });

  it('closes when a page is chosen, and goes there', async () => {
    renderAt('/');
    fireEvent.click(more());
    fireEvent.click(within(menu()!).getByText('common.portfolio'));
    await gone();
    // The bar marks nothing of its own then: the gallery is not one of its tabs.
    expect(within(screen.getByTestId('bottom-tab-bar')).queryAllByRole('link').filter((a) => a.getAttribute('aria-current') === 'page')).toHaveLength(0);
  });

  it('offers a not-yet-onboarded account only what it may open: both are in the bar already', () => {
    renderAt('/', true);
    fireEvent.click(more());
    expect(within(menu()!).queryAllByRole('link')).toHaveLength(0);
    // Still the account and logging out.
    expect(within(menu()!).getByRole('button', { name: 'common.logout' })).toBeInTheDocument();
  });

  it('counts new leads on the Leads tile', () => {
    newLeads = 3;
    renderAt('/');
    fireEvent.click(more());
    expect(within(within(menu()!).getByText('common.leads').closest('a')!).getByTestId('menu-badge')).toHaveTextContent('3');
  });

  // LT-448: the menu and the sidebar offer "report a problem".
  it('offers "report a problem", closing the menu as it opens it', async () => {
    renderAt('/');
    fireEvent.click(more());
    const item = within(menu()!).getByRole('button', { name: 'support.report.open' });
    fireEvent.click(item);
    expect(openReportProblem).toHaveBeenCalled();
    await gone();
    expect(screen.getAllByRole('button', { name: 'support.report.open' }).length).toBeGreaterThan(0); // the sidebar's own
  });
});
