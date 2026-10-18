import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ToursCard from '../../components/account/ToursCard';
import { restartTours, setToursOff } from '../../services/toursApi';

/** LT-389 — the account page's switch for Lighty's page tours, and "start over". */
const { t } = vi.hoisted(() => ({ t: (key: string) => key }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t }) }));
const toast = vi.hoisted(() => Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }));
vi.mock('react-hot-toast', () => ({ default: toast }));
const refreshUser = vi.hoisted(() => vi.fn().mockResolvedValue(null));
const auth = vi.hoisted(() => ({ user: { _id: 'u1', tours: { seen: ['home'], off: false } as { seen?: string[]; off?: boolean } } }));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ auth, refreshUser }) }));
vi.mock('../../services/toursApi', () => ({
  setToursOff: vi.fn().mockResolvedValue({ seen: ['home'], off: true }),
  restartTours: vi.fn().mockResolvedValue({ seen: [], off: false }),
  markTourSeen: vi.fn(),
}));

describe('ToursCard (LT-389)', () => {
  beforeEach(() => {
    vi.mocked(setToursOff).mockClear();
    vi.mocked(restartTours).mockClear();
    refreshUser.mockClear();
    toast.success.mockClear();
  });

  it('turns the tours off from the switch, and reads the account again', async () => {
    render(<ToursCard />);
    const toggle = screen.getByRole('switch', { name: 'account.tours.show' });
    expect(toggle).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(toggle);
    await waitFor(() => expect(setToursOff).toHaveBeenCalledWith(true));
    expect(refreshUser).toHaveBeenCalled();
  });

  it('starts every tour over', async () => {
    render(<ToursCard />);
    fireEvent.click(screen.getByText('account.tours.restart'));
    await waitFor(() => expect(restartTours).toHaveBeenCalled());
    expect(toast.success).toHaveBeenCalledWith('account.tours.restarted');
  });
});
