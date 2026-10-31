import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import toast from 'react-hot-toast';
import CalendarFeedCard from '../../components/settings/CalendarFeedCard';

const t = (key: string) => key;
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t }) }));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../../hooks/useConfirm', () => ({ useConfirm: () => vi.fn() }));
vi.mock('../../services/calendarApi', () => ({
  fetchCalendarFeedUrl: vi.fn(() => Promise.resolve('https://api.test/feed.ics')),
  regenerateCalendarFeedUrl: vi.fn(),
}));

/** LT-501: an Android WebView refuses the clipboard: the feed link copies the old way, or says it could not. */
describe('the calendar feed link', () => {
  const refused = Object.assign(new Error('Write permission denied.'), { name: 'NotAllowedError' });

  beforeEach(() => {
    vi.mocked(toast.error).mockClear();
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText: vi.fn(() => Promise.reject(refused)) } });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('copies by the fallback when the clipboard refuses', async () => {
    document.execCommand = vi.fn(() => true);
    render(<CalendarFeedCard />);
    fireEvent.click(await screen.findByRole('button', { name: 'settings.calendar.copy' }));
    expect(await screen.findByRole('button', { name: 'settings.calendar.copied' })).toBeInTheDocument();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('says it could not when neither way works', async () => {
    document.execCommand = vi.fn(() => false);
    render(<CalendarFeedCard />);
    fireEvent.click(await screen.findByRole('button', { name: 'settings.calendar.copy' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('settings.calendar.copyFailed'));
    expect(screen.queryByRole('button', { name: 'settings.calendar.copied' })).toBeNull();
  });
});
