import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import NotificationBell from '../../components/layout/NotificationBell';
import { setUnreadNotifications } from '../../hooks/useUnreadNotifications';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('../../contexts/LeaveGuardContext', () => ({ useLeaveGuard: () => ({ confirmLeave: (go: () => void) => go() }) }));

const Where = () => <p data-testid="where">{useLocation().pathname}</p>;
const bell = (onOpen?: () => void) =>
  render(<MemoryRouter><NotificationBell onOpen={onOpen} /><Where /></MemoryRouter>);

/** LT-527 — the bell beside the account's name, red while any wait. */
describe('NotificationBell', () => {
  beforeEach(() => setUnreadNotifications(null));

  it('shows no mark with nothing unread', () => {
    setUnreadNotifications(0);
    bell();
    expect(screen.queryByTestId('notification-bell-count')).toBeNull();
  });

  it('counts what waits, up to 9+', () => {
    setUnreadNotifications(3);
    const { unmount } = bell();
    expect(screen.getByTestId('notification-bell-count')).toHaveTextContent('3');
    unmount();
    setUnreadNotifications(12);
    bell();
    expect(screen.getByTestId('notification-bell-count')).toHaveTextContent('9+');
  });

  it('opens the page, and closes the menu it sits in', () => {
    const onOpen = vi.fn();
    bell(onOpen);
    fireEvent.click(screen.getByTestId('notification-bell'));
    expect(onOpen).toHaveBeenCalled();
    expect(screen.getByTestId('where')).toHaveTextContent('/notifications');
  });
});
