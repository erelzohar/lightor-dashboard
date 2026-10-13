import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AdminReports, { reportLink } from '../../pages/admin/AdminReports';
import { fetchSiteReports, updateSiteReport, SiteReportRow } from '../../services/adminApi';

const { t } = vi.hoisted(() => ({ t: (key: string) => key }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t, i18n: { language: 'en' } }) }));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../../contexts/ThemeContext', () => ({ useTheme: () => ({ direction: 'ltr' }) }));
vi.mock('../../services/adminApi', () => ({
  fetchSiteReports: vi.fn(),
  updateSiteReport: vi.fn(),
}));

const report = (over: Partial<SiteReportRow> = {}): SiteReportRow => ({
  _id: 'r1',
  subDomain: 'dana',
  message: 'The booking button does nothing',
  contact: '050-1234567',
  pageUrl: 'https://dana.lightor.app/#schedule',
  language: 'he',
  browser: 'iPhone Safari',
  status: 'new',
  createdAt: '2026-10-13T09:30:00.000Z',
  user_id: 'u1',
  ...over,
});

const page = (rows: SiteReportRow[], open: number) => ({
  success: true,
  count: rows.length,
  pagination: { total: rows.length, page: 1, limit: 20, pages: 1 },
  summary: { open },
  data: rows,
});

/** Admin → site reports (LT-302): visitors' problem reports from Lighty, open ones first. */
describe('Admin site reports', () => {
  beforeEach(() => {
    vi.mocked(fetchSiteReports).mockReset();
    vi.mocked(updateSiteReport).mockReset();
  });

  it('lists the open reports with the site, the problem and how to reply', async () => {
    vi.mocked(fetchSiteReports).mockResolvedValue(page([report()], 1));
    render(<AdminReports />);
    expect(await screen.findByText('The booking button does nothing')).toBeTruthy();
    expect(fetchSiteReports).toHaveBeenCalledWith({ page: 1, limit: 20, status: 'new' });
    expect(screen.getByText('050-1234567')).toBeTruthy();
    expect(screen.getByText('iPhone Safari · he')).toBeTruthy();
    expect(screen.getByText('dana').closest('a')?.getAttribute('href')).toBe('https://dana.lightor.app/#schedule');
    expect(screen.getByText('admin.reports.open')).toBeTruthy();
  });

  it('marks a report handled and reloads the list', async () => {
    vi.mocked(fetchSiteReports)
      .mockResolvedValueOnce(page([report()], 1))
      .mockResolvedValueOnce(page([], 0));
    vi.mocked(updateSiteReport).mockResolvedValue(report({ status: 'handled' }));
    render(<AdminReports />);
    fireEvent.click(await screen.findByText('admin.reports.markHandled'));
    await waitFor(() => expect(updateSiteReport).toHaveBeenCalledWith('r1', 'handled'));
    expect(await screen.findByText('admin.reports.emptyOpen')).toBeTruthy();
    expect(fetchSiteReports).toHaveBeenCalledTimes(2);
  });

  it('links the reported page only on a Lightor site', () => {
    expect(reportLink({ subDomain: 'dana', pageUrl: 'https://evil.example/phish' })).toBe('https://dana.lightor.app');
    expect(reportLink({ subDomain: 'dana', pageUrl: 'https://dana.lightor.app.evil.example/' })).toBe('https://dana.lightor.app');
    expect(reportLink({ subDomain: 'dana', pageUrl: 'not a url' })).toBe('https://dana.lightor.app');
    expect(reportLink({ subDomain: 'dana' })).toBe('https://dana.lightor.app');
    expect(reportLink({ subDomain: 'dana', pageUrl: 'https://dana.lightor.app/#faq' })).toBe('https://dana.lightor.app/#faq');
  });

  it('never links a reported page that is not https', async () => {
    vi.mocked(fetchSiteReports).mockResolvedValue(page([report({ pageUrl: 'javascript:alert(1)', status: 'handled' })], 0));
    render(<AdminReports />);
    const link = (await screen.findByText('dana')).closest('a');
    expect(link?.getAttribute('href')).toBe('https://dana.lightor.app');
    expect(screen.getByText('admin.reports.reopen')).toBeTruthy();
  });
});
