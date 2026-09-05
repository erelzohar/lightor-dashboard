import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import BlockCustomerDialog from '../../components/customers/BlockCustomerDialog';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

/**
 * Blocking a customer (LT-122): the "also cancel upcoming" checkbox is ON by
 * default — the usual reason to block is a no-show, and their pending slots
 * are the immediate problem — and the dialog reports exactly what was chosen.
 */
describe('BlockCustomerDialog', () => {
  it('confirms with cancelUpcoming on by default and passes the reason', () => {
    const onConfirm = vi.fn();
    render(
      <BlockCustomerDialog open customerName="Dana" upcomingCount={2} onConfirm={onConfirm} onClose={vi.fn()} />
    );

    const checkbox = screen.getByTestId('cancel-upcoming') as HTMLInputElement;
    expect(checkbox.checked).toBe(true);

    fireEvent.change(screen.getByPlaceholderText('customers.block.reasonPlaceholder'), {
      target: { value: '  no-show x3  ' },
    });
    fireEvent.click(screen.getByText('customers.block.confirm'));

    expect(onConfirm).toHaveBeenCalledWith({ reason: 'no-show x3', cancelUpcoming: true });
  });

  it('respects unticking the checkbox and omits an empty reason', () => {
    const onConfirm = vi.fn();
    render(
      <BlockCustomerDialog open customerName="Dana" upcomingCount={0} onConfirm={onConfirm} onClose={vi.fn()} />
    );

    fireEvent.click(screen.getByTestId('cancel-upcoming'));
    fireEvent.click(screen.getByText('customers.block.confirm'));

    expect(onConfirm).toHaveBeenCalledWith({ reason: undefined, cancelUpcoming: false });
  });
});
