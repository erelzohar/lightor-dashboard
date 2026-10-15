import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import toast from 'react-hot-toast';
import ShareSiteCard from '../../components/dashboard/ShareSiteCard';

const { t } = vi.hoisted(() => ({ t: (key: string) => key }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t }) }));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));
// The QR library loads only when the modal opens (a dynamic import): this
// stands in for it, and canvas, which jsdom does not draw.
const qr = vi.hoisted(() => ({ toDataURL: vi.fn() }));
vi.mock('qrcode', () => ({ toDataURL: qr.toDataURL }));

const SITE = 'https://dana.lightor.app';
const w = window as unknown as { Capacitor?: unknown };
const writeText = vi.fn();

beforeEach(() => {
  vi.mocked(toast.success).mockReset();
  vi.mocked(toast.error).mockReset();
  qr.toDataURL.mockReset().mockResolvedValue('data:image/png;base64,QR');
  writeText.mockReset().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
});
afterEach(() => {
  delete w.Capacitor;
  Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
});

/** LT-274: copy the site's address, send it on WhatsApp, or show it as a QR code. */
describe('ShareSiteCard', () => {
  it('copies the site address and says so', async () => {
    render(<ShareSiteCard kind="leads" businessName="Dana Renovations" subDomain="dana" />);
    fireEvent.click(screen.getByText('dashboard.share.copy'));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('dashboard.share.copied'));
    expect(writeText).toHaveBeenCalledWith(SITE);
  });

  it('falls back to select-and-copy where the clipboard API is missing', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
    const execCommand = vi.fn(() => true);
    Object.defineProperty(document, 'execCommand', { value: execCommand, configurable: true });
    render(<ShareSiteCard kind="leads" subDomain="dana" />);
    fireEvent.click(screen.getByText('dashboard.share.copy'));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('dashboard.share.copied'));
    expect(execCommand).toHaveBeenCalledWith('copy');
    expect(document.querySelector('textarea')).toBeNull(); // cleaned up
  });

  it('says so when the link could not be copied at all', async () => {
    writeText.mockRejectedValue(new Error('denied'));
    Object.defineProperty(document, 'execCommand', { value: vi.fn(() => false), configurable: true });
    render(<ShareSiteCard kind="leads" subDomain="dana" />);
    fireEvent.click(screen.getByText('dashboard.share.copy'));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('dashboard.share.copyFailed'));
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('shares the business name and the address on WhatsApp', () => {
    render(<ShareSiteCard kind="bookings" businessName="Dana Renovations" subDomain="dana" />);
    const link = screen.getByText('leads.whatsapp').closest('a');

    expect(link).toHaveAttribute('href', `https://wa.me/?text=${encodeURIComponent(`Dana Renovations - ${SITE}`)}`);
    expect(link?.getAttribute('href')).toContain(encodeURIComponent(SITE));
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('shows the site as a black-on-white QR code with its address, to download on the web', async () => {
    render(<ShareSiteCard kind="leads" subDomain="dana" />);
    expect(qr.toDataURL).not.toHaveBeenCalled(); // nothing loads before the modal opens
    fireEvent.click(screen.getByText('dashboard.share.qr'));

    const modal = await screen.findByTestId('share-qr-modal');
    const image = await within(modal).findByTestId('share-qr-image');
    expect(image).toHaveAttribute('src', 'data:image/png;base64,QR');
    expect(qr.toDataURL).toHaveBeenCalledWith(
      SITE,
      expect.objectContaining({ margin: 4, color: { dark: '#000000', light: '#ffffff' } })
    );
    expect(within(modal).getByText('dana.lightor.app')).toBeInTheDocument();
    const download = within(modal).getByText('dashboard.share.download').closest('a');
    expect(download).toHaveAttribute('href', 'data:image/png;base64,QR');
    expect(download).toHaveAttribute('download', 'dana-qr.png');
    expect(within(modal).queryByTestId('share-qr-native-hint')).not.toBeInTheDocument();

    fireEvent.click(within(modal).getByLabelText('dashboard.share.close'));
    await waitFor(() => expect(screen.queryByTestId('share-qr-modal')).not.toBeInTheDocument());
  });

  it('tells an app user how to keep the code instead of offering a download that cannot work', async () => {
    w.Capacitor = { isNativePlatform: () => true, getPlatform: () => 'ios' };
    render(<ShareSiteCard kind="leads" subDomain="dana" />);
    fireEvent.click(screen.getByText('dashboard.share.qr'));

    const modal = await screen.findByTestId('share-qr-modal');
    expect(await within(modal).findByTestId('share-qr-image')).toBeInTheDocument();
    expect(within(modal).getByTestId('share-qr-native-hint')).toHaveTextContent('dashboard.share.qrNativeHint');
    expect(within(modal).queryByText('dashboard.share.download')).not.toBeInTheDocument();
  });

  it('says so when the code cannot be drawn', async () => {
    qr.toDataURL.mockRejectedValue(new Error('no canvas'));
    render(<ShareSiteCard kind="leads" subDomain="dana" />);
    fireEvent.click(screen.getByText('dashboard.share.qr'));

    expect(await screen.findByText('dashboard.share.qrFailed')).toBeInTheDocument();
    expect(screen.queryByTestId('share-qr-image')).not.toBeInTheDocument();
  });

  it.each([
    ['leads', false, 'dashboard.share.titleLeads'],
    ['bookings', false, 'dashboard.share.titleBookings'],
    ['leads', true, 'dashboard.share.firstLeads'],
    ['bookings', true, 'dashboard.share.firstBookings'],
  ] as const)('titles a %s site’s card (first: %s) %s', (kind, first, title) => {
    render(<ShareSiteCard kind={kind} first={first} subDomain="dana" />);
    expect(screen.getByRole('heading', { name: title })).toBeInTheDocument();
    expect(screen.getByTestId('share-site-card').classList.contains('glass-tint-primary')).toBe(first);
  });
});
