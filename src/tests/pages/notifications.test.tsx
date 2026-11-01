import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import Notifications, { whenText } from '../../pages/Notifications';
import { fetchNotifications, markNotificationsRead } from '../../services/notificationsApi';
import { setUnreadNotifications, useUnreadNotifications } from '../../hooks/useUnreadNotifications';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }) }));
vi.mock('../../services/notificationsApi', () => ({
  fetchNotifications: vi.fn(),
  markNotificationsRead: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../components/ui/PullToRefresh', () => ({ default: ({ children }: { children: React.ReactNode }) => <>{children}</> }));

const item = (over: Record<string, unknown> = {}) => ({
  _id: 'n1',
  event: 'newBooking',
  title: 'New booking',
  body: 'Dana at 10:00',
  url: '/appointments?focus=a1',
  read: false,
  createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
  ...over,
});

const Where = () => {
  const { pathname, search } = useLocation();
  const unread = useUnreadNotifications();
  return <><p data-testid="where">{pathname + search}</p><p data-testid="unread">{String(unread)}</p></>;
};

const page = () =>
  render(
    <MemoryRouter initialEntries={['/notifications']}>
      <Routes><Route path="*" element={<><Notifications /><Where /></>} /></Routes>
    </MemoryRouter>
  );

/** LT-527 — the owner's Notifications page. */
describe('Notifications', () => {
  beforeEach(() => {
    vi.mocked(fetchNotifications).mockReset();
    vi.mocked(markNotificationsRead).mockClear();
    setUnreadNotifications(null);
  });

  it('shows what the system sent and clears the unread count, keeping the mark on what was new', async () => {
    vi.mocked(fetchNotifications).mockResolvedValue({ data: [item(), item({ _id: 'n2', title: 'Older', body: 'Older one', read: true })], unread: 1 });
    setUnreadNotifications(1);
    page();

    expect(await screen.findByText('New booking')).toBeInTheDocument();
    expect(screen.getByText('Dana at 10:00')).toBeInTheDocument();
    expect(screen.getAllByTestId('notification').map((row) => row.dataset.unread)).toEqual(['true', 'false']);
    await waitFor(() => expect(markNotificationsRead).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId('unread')).toHaveTextContent('0');
  });

  it('does not write when nothing is unread', async () => {
    vi.mocked(fetchNotifications).mockResolvedValue({ data: [item({ read: true })], unread: 0 });
    page();
    await screen.findByText('New booking');
    expect(markNotificationsRead).not.toHaveBeenCalled();
  });

  it('opens the page a message belongs to', async () => {
    vi.mocked(fetchNotifications).mockResolvedValue({ data: [item()], unread: 0 });
    page();
    fireEvent.click(await screen.findByText('New booking'));
    expect(screen.getByTestId('where')).toHaveTextContent('/appointments?focus=a1');
  });

  it('says so when there are none', async () => {
    vi.mocked(fetchNotifications).mockResolvedValue({ data: [], unread: 0 });
    page();
    expect(await screen.findByTestId('notifications-empty')).toBeInTheDocument();
  });

  it('offers to try again after a failure', async () => {
    vi.mocked(fetchNotifications).mockRejectedValueOnce(new Error('down')).mockResolvedValue({ data: [item()], unread: 0 });
    page();
    fireEvent.click(await screen.findByText('notifications.retry'));
    expect(await screen.findByText('New booking')).toBeInTheDocument();
  });

  it('counts the last week in words, then gives the date', () => {
    const now = new Date('2026-11-01T12:00:00Z').getTime();
    const ago = (ms: number) => new Date(now - ms).toISOString();
    expect(whenText(ago(10_000), 'en', 'Just now', now)).toBe('Just now');
    expect(whenText(ago(5 * 60_000), 'en', 'Just now', now)).toBe('5 minutes ago');
    expect(whenText(ago(3 * 3_600_000), 'en', 'Just now', now)).toBe('3 hours ago');
    expect(whenText(ago(2 * 86_400_000), 'en', 'Just now', now)).toBe('2 days ago');
    expect(whenText(ago(10 * 86_400_000), 'en', 'Just now', now)).toContain('Oct');
  });
});
