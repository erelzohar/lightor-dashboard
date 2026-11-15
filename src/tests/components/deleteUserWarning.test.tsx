import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import DeleteUserWarning from '../../components/admin/DeleteUserWarning';
import { fetchDeletionPreview } from '../../services/adminApi';

const { t } = vi.hoisted(() => ({
  t: (key: string, vars?: Record<string, unknown>) => (vars ? `${key} ${JSON.stringify(vars)}` : key),
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t }) }));
vi.mock('../../services/adminApi', () => ({ fetchDeletionPreview: vi.fn() }));

/**
 * LT-663 (Erel 2026-11-15): the operator's delete dialog. A subscription a
 * store bills is not cancelled by the delete, so the dialog stops saying it
 * is and warns instead; the bookings still ahead are counted.
 */
describe('DeleteUserWarning (LT-663)', () => {
  // Braces on purpose: a function returned from beforeEach is run as its cleanup.
  beforeEach(() => {
    vi.mocked(fetchDeletionPreview).mockReset();
  });

  it('keeps the usual text, with no warning, for an account without a store subscription', async () => {
    vi.mocked(fetchDeletionPreview).mockResolvedValue({ futureBookings: 0, storeSubscription: null });
    render(<DeleteUserWarning userId="u9" name="Dana" known={null} />);
    await waitFor(() => expect(fetchDeletionPreview).toHaveBeenCalledWith('u9'));
    expect(screen.getByText('admin.actions.deleteConfirm {"name":"Dana"}')).toBeInTheDocument();
    expect(screen.queryByTestId('admin-delete-store-warning')).not.toBeInTheDocument();
    expect(screen.queryByTestId('admin-delete-bookings-warning')).not.toBeInTheDocument();
  });

  it.each([
    ['apple', 'billing.store.appStore'],
    ['google', 'billing.store.googlePlay'],
  ] as const)('%s: warns that the store goes on billing, and no longer says a live subscription is cancelled', async (store, name) => {
    vi.mocked(fetchDeletionPreview).mockResolvedValue({ futureBookings: 3, storeSubscription: store });
    render(<DeleteUserWarning userId="u9" name="Dana" known={null} />);

    const warning = await screen.findByTestId('admin-delete-store-warning');
    expect(warning).toHaveTextContent(`admin.actions.deleteStoreWarning {"store":"${name}"}`);
    expect(warning).toHaveAttribute('role', 'alert');
    expect(screen.getByText('admin.actions.deleteConfirmStore {"name":"Dana"}')).toBeInTheDocument();
    expect(screen.queryByText('admin.actions.deleteConfirm {"name":"Dana"}')).not.toBeInTheDocument();
    expect(screen.getByTestId('admin-delete-bookings-warning')).toHaveTextContent('admin.actions.deleteBookingsWarning {"count":3}');
  });

  it('warns from what the page knows until the server answers, and when it cannot', async () => {
    vi.mocked(fetchDeletionPreview).mockRejectedValue(new Error('offline'));
    render(<DeleteUserWarning userId="u9" name="Dana" known="google" />);
    expect(screen.getByTestId('admin-delete-store-warning')).toBeInTheDocument();
    // Past the refusal: the warning has not moved.
    await act(async () => {
      await Promise.resolve();
    });
    expect(fetchDeletionPreview).toHaveBeenCalledWith('u9');
    expect(screen.getByTestId('admin-delete-store-warning')).toBeInTheDocument();
    expect(screen.queryByTestId('admin-delete-bookings-warning')).not.toBeInTheDocument();
  });

  it("takes the server's word when the page's copy is stale", async () => {
    vi.mocked(fetchDeletionPreview).mockResolvedValue({ futureBookings: 0, storeSubscription: null });
    render(<DeleteUserWarning userId="u9" name="Dana" known="apple" />);
    await waitFor(() => expect(screen.queryByTestId('admin-delete-store-warning')).not.toBeInTheDocument());
  });
});
