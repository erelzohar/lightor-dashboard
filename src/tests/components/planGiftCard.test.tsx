import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import PlanGiftCard from '../../components/admin/PlanGiftCard';
import { removeUserPlan, setUserPlan } from '../../services/adminApi';

const { t } = vi.hoisted(() => ({
  t: (key: string, values?: Record<string, unknown>) => (values ? `${key} ${JSON.stringify(values)}` : key),
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t, i18n: { language: 'en' } }) }));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../../services/adminApi', () => ({ setUserPlan: vi.fn(), removeUserPlan: vi.fn() }));

const renderCard = (props: Partial<React.ComponentProps<typeof PlanGiftCard>> = {}) => {
  const onChanged = vi.fn();
  render(<PlanGiftCard userId="u9" userName="Dana" gift={null} onChanged={onChanged} {...props} />);
  return { onChanged };
};

/**
 * LT-662 (Erel 2026-11-15): the admin moves an account to Lightor+ or Pro by
 * hand, until a date or until he changes it, and can remove it.
 */
describe('the manual plan card (LT-662)', () => {
  beforeEach(() => {
    vi.mocked(setUserPlan).mockReset().mockResolvedValue({ plan: 'pro', from: '2026-11-15T10:00:00.000Z', until: null });
    vi.mocked(removeUserPlan).mockReset().mockResolvedValue(undefined);
  });

  it('sets Pro until changed by default', async () => {
    const { onChanged } = renderCard();
    expect(screen.getByRole('radio', { name: 'admin.planGift.untilChanged' })).toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: 'admin.planGift.save' }));
    await waitFor(() => expect(setUserPlan).toHaveBeenCalledWith('u9', 'pro', null));
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    // Nothing is set: nothing to remove.
    expect(screen.queryByTestId('plan-gift-current')).toBeNull();
  });

  it('sets Lightor+ until the end of a chosen day, and asks for the day first', async () => {
    renderCard();
    fireEvent.click(screen.getByRole('button', { name: /admin\.planGift\.planLabel/ }));
    fireEvent.click(await screen.findByRole('option', { name: 'admin.planStanding.plus' }));
    fireEvent.click(screen.getByRole('radio', { name: 'admin.planGift.untilDate' }));
    const save = screen.getByRole('button', { name: 'admin.planGift.save' });
    expect(save).toBeDisabled();
    expect(screen.getByText('admin.planGift.dateRequired')).toBeInTheDocument();

    fireEvent.change(screen.getByTestId('plan-gift-date'), { target: { value: '2026-12-15' } });
    fireEvent.click(save);
    await waitFor(() => expect(setUserPlan).toHaveBeenCalledWith('u9', 'plus', new Date('2026-12-15T23:59:59').toISOString()));
  });

  it('shows the running plan, fills the form with it, and removes it after a confirm', async () => {
    const until = new Date('2026-12-15T21:59:59.000Z').toISOString();
    const { onChanged } = renderCard({ gift: { plan: 'plus', from: '2026-11-01T10:00:00.000Z', until } });
    expect(screen.getByTestId('plan-gift-current')).toHaveTextContent('admin.planGift.current');
    expect(screen.getByRole('radio', { name: 'admin.planGift.untilDate' })).toBeChecked();
    expect(screen.getByTestId('plan-gift-date')).toHaveValue('2026-12-15');

    fireEvent.click(screen.getByTestId('plan-gift-remove'));
    expect(removeUserPlan).not.toHaveBeenCalled();
    // The dialog's own button, beside the card's.
    const removes = await screen.findAllByRole('button', { name: 'admin.planGift.remove' });
    expect(removes.length).toBe(2);
    fireEvent.click(removes[removes.length - 1]);
    await waitFor(() => expect(removeUserPlan).toHaveBeenCalledWith('u9'));
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
  });

  it('warns that a paying account keeps being charged', () => {
    renderCard({ subscription: { status: 'active', subscriptionId: 'sub_1', plan: 'plus', provider: 'apple' } });
    const warning = screen.getByTestId('plan-gift-paying');
    expect(warning).toHaveTextContent('admin.planGift.paying');
    expect(warning).toHaveTextContent('App Store');
    expect(warning).toHaveTextContent('admin.planStanding.plus');
  });

  it('says nothing of billing for an account that pays nothing', () => {
    renderCard({ subscription: { status: 'free' } });
    expect(screen.queryByTestId('plan-gift-paying')).toBeNull();
  });
});
