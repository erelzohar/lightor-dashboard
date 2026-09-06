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
    expect(screen.getByText('common.appointments').closest('a')).toHaveAttribute('aria-current', 'page');
    expect(screen.getByText('common.dashboard').closest('a')).not.toHaveAttribute('aria-current');

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
    expect(screen.getByTestId('bottom-tab-bar').className).toContain('pb-[env(safe-area-inset-bottom)]');
  });
});
