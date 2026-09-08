import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ConfirmDialog from '../../components/ui/ConfirmDialog';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

/**
 * ConfirmDialog (LT-058) gates the destructive admin actions — delete user,
 * cancel subscription, delete account. LT-144 fixed it being unreadable in
 * dark mode (the panel had no dark background while its text switched to a
 * light one) and gave the custom portal modal the semantics a screen-reader
 * and keyboard user need.
 */
describe('ConfirmDialog', () => {
  const base = {
    open: true,
    title: 'Delete user',
    message: 'This cannot be undone.',
    confirmLabel: 'Delete',
    onConfirm: vi.fn(),
    onClose: vi.fn(),
  };

  it('renders nothing while closed', () => {
    render(<ConfirmDialog {...base} open={false} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('is an accessible modal labelled by its title (B3)', () => {
    render(<ConfirmDialog {...base} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    const heading = screen.getByRole('heading', { name: 'Delete user' });
    expect(dialog.getAttribute('aria-labelledby')).toBe(heading.id);
    expect(heading.id).toBeTruthy();
  });

  it('carries a dark-mode panel background (B2)', () => {
    render(<ConfirmDialog {...base} />);
    expect(screen.getByRole('dialog').className).toContain('dark:bg-dark-surface');
  });

  it('closes on Escape', () => {
    const onClose = vi.fn();
    render(<ConfirmDialog {...base} onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('ignores Escape while a confirm is in flight', () => {
    const onClose = vi.fn();
    render(<ConfirmDialog {...base} onClose={onClose} loading />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
  });
});
