import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import axe from 'axe-core';
import Sidebar from '../../components/layout/Sidebar';
import AddCustomerModal from '../../components/customers/AddCustomerModal';
import UserFormModal from '../../components/admin/UserFormModal';

/**
 * LT-362 - the automatic accessibility check, as on the customer sites
 * (lightor-front, LT-356) and the signup (LT-357). axe-core runs over the
 * navigation (the desktop rail folded and open, the phone tab bar) and the
 * popups that phase 4 made real dialogs, left-to-right and right-to-left.
 * Any WCAG 2.x A/AA violation it can see fails the build. The booking window
 * is checked in its own suite (ownerBookingModal.test.tsx), with its mocks.
 *
 * What jsdom cannot judge is switched off: colour contrast (no rendering)
 * and landmarks/regions (parts rendered alone have no page around them).
 */

let direction: 'ltr' | 'rtl' = 'ltr';
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    logout: vi.fn(),
    auth: { user: { _id: 'u1', name: 'Erel', role: 'admin' }, isAuthenticated: true, isLoading: false },
  }),
}));
vi.mock('../../contexts/ThemeContext', () => ({
  useTheme: () => ({ direction, language: direction === 'rtl' ? 'he' : 'en', darkMode: false, toggleDarkMode: vi.fn() }),
}));
vi.mock('../../hooks/useAppSelector', () => ({
  useAppSelector: (selector: (s: unknown) => unknown): unknown =>
    selector({ webConfig: { data: { businessName: 'Biz', conversion: 'book' } } }),
}));
vi.mock('../../services/leadsApi', () => ({
  fetchLeads: vi.fn().mockResolvedValue({ success: true, data: [], counts: { new: 3 } }),
}));
vi.mock('../../services/customersApi', () => ({ createCustomer: vi.fn(), isApiErrorCode: () => false }));
vi.mock('../../services/adminApi', () => ({ createUser: vi.fn() }));
vi.mock('../../services/userApi', () => ({ updateUserInfo: vi.fn() }));

const RULES: axe.RunOptions = {
  runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] },
  rules: {
    'color-contrast': { enabled: false },
    region: { enabled: false },
  },
};

const violationsIn = async (node: Element): Promise<string[]> => {
  const result = await axe.run(node, RULES);
  return result.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(' | ')}`);
};

describe.each(['ltr', 'rtl'] as const)('no WCAG A/AA violation axe can see (%s)', (dir) => {
  beforeEach(() => {
    direction = dir;
    document.documentElement.dir = dir;
  });

  it('the navigation: the rail folded, the rail open, the phone tab bar and its menu', async () => {
    const { container } = render(<MemoryRouter><Sidebar /></MemoryRouter>);
    expect(await violationsIn(container)).toEqual([]);
    // The desktop rail is the first of the two navigations (the tab bar the other).
    fireEvent.mouseEnter(screen.getAllByRole('navigation', { name: 'sidebar.navigation' })[0]);
    expect(await violationsIn(container)).toEqual([]);
    fireEvent.click(screen.getByRole('button', { name: 'sidebar.openMenu' }));
    expect(await violationsIn(document.body)).toEqual([]);
  });

  it('adding a customer', async () => {
    render(<AddCustomerModal open onClose={vi.fn()} onSaved={vi.fn()} onExists={vi.fn()} />);
    expect(screen.getByRole('dialog', { name: 'customers.add.title' })).toBeInTheDocument();
    expect(await violationsIn(document.body)).toEqual([]);
  });

  it.each(['create', 'edit'] as const)('the admin user form (%s)', async (mode) => {
    render(
      <UserFormModal
        open
        mode={mode}
        user={mode === 'edit' ? { _id: 'u2', name: 'Dana', email: 'd@x.co', phone: '0501234567', defaultLanguage: 'he', channelType: 'sms' } : undefined}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />
    );
    expect(screen.getByRole('dialog')).toHaveAccessibleName();
    expect(await violationsIn(document.body)).toEqual([]);
  });
});
