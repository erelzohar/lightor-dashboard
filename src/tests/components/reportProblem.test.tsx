import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import toast from 'react-hot-toast';
import { ReportProblemHost, openReportProblem } from '../../components/support/ReportProblem';
import { uploadImage } from '../../services/imagesApi';
import { sendProblemReport } from '../../services/supportApi';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'he-IL' } }) }));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../../services/imagesApi', () => ({ uploadImage: vi.fn(async () => ({ imageName: '1729700000000shot.webp' })) }));
vi.mock('../../services/supportApi', () => ({ SUPPORT_EMAIL: 'support@lightor.app', sendProblemReport: vi.fn(async () => undefined) }));

/**
 * LT-448 — "report a problem": the owner's words, an optional screenshot,
 * and the page and app it happened in; answered by email.
 */
describe('report a problem', () => {
  beforeEach(() => {
    vi.mocked(uploadImage).mockClear();
    vi.mocked(sendProblemReport).mockReset().mockResolvedValue(undefined);
    vi.mocked(toast.success).mockClear();
    vi.mocked(toast.error).mockClear();
    window.history.replaceState({}, '', '/appointments?date=2026-10-23');
  });

  const open = () => {
    render(<ReportProblemHost />);
    act(() => openReportProblem());
    return screen.getByRole('dialog', { name: 'support.report.title' });
  };

  it('sends the words, the screenshot, the page and the app, then thanks and closes', async () => {
    open();
    const send = screen.getByRole('button', { name: 'support.report.send' });
    fireEvent.change(screen.getByLabelText('support.report.label'), { target: { value: 'no' } });
    expect(send).toBeDisabled(); // a few words at least
    fireEvent.change(screen.getByLabelText('support.report.label'), { target: { value: 'The calendar does not open' } });
    const shot = new File([new Uint8Array(1)], 'shot.png', { type: 'image/png' });
    fireEvent.change(screen.getByTestId('report-problem-file'), { target: { files: [shot] } });
    expect(screen.getByText('shot.png')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'support@lightor.app' })).toHaveAttribute('href', 'mailto:support@lightor.app');
    fireEvent.click(send);
    await waitFor(() => expect(sendProblemReport).toHaveBeenCalledTimes(1));
    expect(uploadImage).toHaveBeenCalledWith(shot);
    expect(sendProblemReport).toHaveBeenCalledWith({
      message: 'The calendar does not open',
      pageUrl: '/appointments?date=2026-10-23',
      language: 'he',
      app: 'web',
      imageName: '1729700000000shot.webp',
    });
    expect(toast.success).toHaveBeenCalledWith('support.report.sent');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('says so when there were too many today, and keeps what was typed', async () => {
    vi.mocked(sendProblemReport).mockRejectedValue({ response: { status: 429 } });
    open();
    fireEvent.change(screen.getByLabelText('support.report.label'), { target: { value: 'Another problem here' } });
    fireEvent.click(screen.getByRole('button', { name: 'support.report.send' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('support.report.tooMany'));
    expect(uploadImage).not.toHaveBeenCalled();
    expect(screen.getByLabelText('support.report.label')).toHaveValue('Another problem here');
  });
});
