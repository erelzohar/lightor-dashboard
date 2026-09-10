import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import UnsavedChangesBar from '../../components/ui/UnsavedChangesBar';

const { t } = vi.hoisted(() => ({ t: (key: string) => key }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t }) }));

/**
 * The floating save bar (shared by Settings and Schedule & Vacations). Cancel
 * used to be optional and Settings shipped without it; now every page gets
 * the same two buttons.
 */
describe('UnsavedChangesBar', () => {
  it('always offers Cancel next to Save', () => {
    const onSave = vi.fn();
    const onDiscard = vi.fn();
    render(<UnsavedChangesBar visible onSave={onSave} onDiscard={onDiscard} />);

    fireEvent.click(screen.getByText('common.cancel'));
    expect(onDiscard).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText('common.save'));
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('locks both buttons while saving, and blocks Save on a validation error', () => {
    const { rerender } = render(<UnsavedChangesBar visible saving onSave={vi.fn()} onDiscard={vi.fn()} />);
    expect(screen.getByText('common.cancel').closest('button')).toBeDisabled();
    expect(screen.getByText('common.save').closest('button')).toBeDisabled();

    rerender(<UnsavedChangesBar visible errorMessage="fix it" onSave={vi.fn()} onDiscard={vi.fn()} />);
    expect(screen.getByText('fix it')).toBeInTheDocument();
    expect(screen.getByText('common.save').closest('button')).toBeDisabled();
    expect(screen.getByText('common.cancel').closest('button')).not.toBeDisabled();
  });

  it('renders nothing when there are no changes', () => {
    render(<UnsavedChangesBar visible={false} onSave={vi.fn()} onDiscard={vi.fn()} />);
    expect(screen.queryByText('common.save')).not.toBeInTheDocument();
  });
});
