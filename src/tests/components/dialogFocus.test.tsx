import { useEffect, useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import AddCustomerModal from '../../components/customers/AddCustomerModal';
import Input from '../../components/ui/Input';
import { SidebarLink, SidebarProvider } from '../../components/ui/sidebar';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../../services/customersApi', () => ({ createCustomer: vi.fn(), isApiErrorCode: () => false }));

const Opener = ({ onClose }: { onClose?: () => void }) => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>add</button>
      <AddCustomerModal open={open} onClose={() => { onClose?.(); setOpen(false); }} onSaved={vi.fn()} onExists={vi.fn()} />
    </>
  );
};

/** LT-362 - the dashboard's popups are real dialogs (useDialogFocus). */
describe('a popup as a dialog', () => {
  it('takes the focus, keeps Tab inside, and Escape closes it and gives the focus back', async () => {
    const user = userEvent.setup();
    render(<Opener />);
    const opener = screen.getByRole('button', { name: 'add' });
    await user.click(opener);

    const dialog = screen.getByRole('dialog', { name: 'customers.add.title' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toContainElement(document.activeElement as HTMLElement);
    for (let i = 0; i < 10; i++) {
      await user.tab();
      expect(dialog).toContainElement(document.activeElement as HTMLElement);
    }
    await user.keyboard('{Escape}');
    expect(opener).toHaveFocus();
    // The box fades out (AnimatePresence) before it leaves the page.
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('over another popup, Escape closes only the top one', async () => {
    // As the class roster (SessionParticipants) closes on a window Escape.
    const closeBelow = vi.fn();
    const closeTop = vi.fn();
    const Below = () => {
      useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeBelow(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
      }, []);
      return <AddCustomerModal open onClose={closeTop} onSaved={vi.fn()} onExists={vi.fn()} />;
    };
    render(<Below />);
    fireEvent.keyDown(document.activeElement as Element, { key: 'Escape' });
    expect(closeTop).toHaveBeenCalledTimes(1);
    expect(closeBelow).not.toHaveBeenCalled();
  });
});

/** LT-362 - fields carry their label, error and hint. */
describe('the shared Input', () => {
  it('is named by its label and described by its error', () => {
    render(<Input label="Phone" error="Too short" />);
    const field = screen.getByRole('textbox', { name: 'Phone' });
    expect(field).toHaveAccessibleDescription('Too short');
    expect(field).toHaveAttribute('aria-invalid', 'true');
  });
});

/** LT-362 - the folded rail hides its labels (display:none), so the links carry their names. */
describe('the sidebar rail, folded', () => {
  it('names each link, with its badge', () => {
    render(
      <MemoryRouter>
        <SidebarProvider open={false} setOpen={vi.fn()}>
          <SidebarLink link={{ label: 'Leads', href: '/leads', icon: <span aria-hidden="true">*</span>, badge: 3 }} />
        </SidebarProvider>
      </MemoryRouter>
    );
    expect(screen.getByRole('link')).toHaveAttribute('aria-label', 'Leads 3');
  });
});
