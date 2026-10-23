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
    // LT-315 (L2): a subdomain that is not a DNS label links nowhere.
    expect(reportLink({ subDomain: 'login-lightor.example/x?', pageUrl: 'https://evil.example/' })).toBeNull();
  });

  it('never links a reported page that is not https', async () => {
    vi.mocked(fetchSiteReports).mockResolvedValue(page([report({ pageUrl: 'javascript:alert(1)', status: 'handled' })], 0));
    render(<AdminReports />);
    const link = (await screen.findByText('dana')).closest('a');
    expect(link?.getAttribute('href')).toBe('https://dana.lightor.app');
    expect(screen.getByText('admin.reports.reopen')).toBeTruthy();
  });

  it('steps back a page when handling empties the last one (LT-315)', async () => {
    const onPage = (rows: SiteReportRow[], at: number, pages: number) => ({
      ...page(rows, rows.length),
      pagination: { total: 20 * (pages - 1) + rows.length, page: at, limit: 20, pages },
    });
    vi.mocked(fetchSiteReports)
      .mockResolvedValueOnce(onPage([report({ _id: 'p1', message: 'first page' })], 1, 2))
      .mockResolvedValueOnce(onPage([report({ _id: 'p2', message: 'the only one on page 2' })], 2, 2))
      .mockResolvedValueOnce(onPage([], 2, 1))
      .mockResolvedValue(onPage([report({ _id: 'p1', message: 'first page' })], 1, 1));
    vi.mocked(updateSiteReport).mockResolvedValue(report({ status: 'handled' }));
    render(<AdminReports />);
    fireEvent.click(await screen.findByLabelText('admin.table.nextPage'));
    expect(await screen.findByText('the only one on page 2')).toBeTruthy();

    fireEvent.click(screen.getByText('admin.reports.markHandled'));
    await waitFor(() => expect(fetchSiteReports).toHaveBeenLastCalledWith({ page: 1, limit: 20, status: 'new' }));
    expect(await screen.findByText('first page')).toBeTruthy();
  });

  // LT-448: an owner's report from the dashboard.
  it("shows an owner's report as from the dashboard, with the email to answer and the screenshot", async () => {
    vi.mocked(fetchSiteReports).mockResolvedValue(page([report({ source: 'owner', subDomain: undefined, contact: undefined, pageUrl: '/appointments', email: 'owner@example.com', imageName: 'shot.webp', message: 'The calendar is blank' })], 1));
    render(<AdminReports />);
    expect(await screen.findByText('The calendar is blank')).toBeTruthy();
    expect(screen.getByText('admin.reports.fromOwner')).toBeTruthy();
    expect(screen.getByText('/appointments')).toBeTruthy();
    expect(screen.getByText('owner@example.com').closest('a')?.getAttribute('href')).toBe('mailto:owner@example.com');
    expect(screen.getByText('admin.reports.screenshot').closest('a')?.getAttribute('href')).toMatch(/\/api\/images\/shot\.webp$/);
  });
});
