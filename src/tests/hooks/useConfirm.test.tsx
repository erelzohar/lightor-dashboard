import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react';
import { useConfirm } from '../../hooks/useConfirm';
import { cancelBookingQuestion } from '../../components/appointments/cancelQuestion';
import type { TFunction } from 'i18next';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

/**
 * LT-347 — the dashboard's own question box instead of window.confirm: the
 * answer comes back as a promise, and nothing inside the box reaches the
 * screen behind it (a draggable photo, a clickable card, another window).
 */
function Harness({ onAnswer, onParent }: { onAnswer: (ok: boolean) => void; onParent: () => void }) {
  const { confirm, dialog } = useConfirm();
  const ask = async (title: string) => onAnswer(await confirm({ title, message: 'Gone for good.', confirmLabel: 'Delete', danger: true }));
  return (
    <div onClick={onParent} onPointerDown={onParent} onKeyDown={onParent}>
      <button type="button" onClick={(e) => { e.stopPropagation(); void ask('Delete it?'); }} onPointerDown={(e) => e.stopPropagation()}>
        Ask
      </button>
      <button type="button" onClick={(e) => { e.stopPropagation(); void ask('Delete the other?'); }} onPointerDown={(e) => e.stopPropagation()}>
        Ask again
      </button>
      {dialog}
    </div>
  );
}

const setup = () => {
  const onAnswer = vi.fn();
  const onParent = vi.fn();
  const view = render(<Harness onAnswer={onAnswer} onParent={onParent} />);
  const open = async (name = 'Ask') => {
    fireEvent.click(screen.getByRole('button', { name }));
    return screen.findByRole('dialog');
  };
  const gone = () => waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  return { onAnswer, onParent, view, open, gone };
};

afterEach(() => vi.useRealTimers());

describe('useConfirm (LT-347)', () => {
  it('asks in the dashboard dialog and answers yes on its confirm button', async () => {
    const { onAnswer, open, gone } = setup();
    const dialog = await open();
    expect(within(dialog).getByRole('heading', { name: 'Delete it?' })).toBeInTheDocument();
    expect(dialog).toHaveTextContent('Gone for good.');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
    await gone();
    expect(onAnswer).toHaveBeenCalledWith(true);
  });

  it('answers no on its cancel button, on Escape and on a tap outside', async () => {
    const { onAnswer, open, gone } = setup();
    fireEvent.click(within(await open()).getByRole('button', { name: 'admin.actions.cancel' }));
    await gone();
    await open();
    fireEvent.keyDown(document, { key: 'Escape' });
    await gone();
    await open();
    fireEvent.click(document.querySelector('.backdrop-blur-sm') as HTMLElement);
    await gone();
    expect(onAnswer.mock.calls).toEqual([[false], [false], [false]]);
  });

  it('a new question replaces one still open, which counts as a no', async () => {
    const { onAnswer, open } = setup();
    await open('Ask');
    const second = await open('Ask again');
    await waitFor(() => expect(onAnswer).toHaveBeenCalledWith(false));
    expect(within(second).getByRole('heading', { name: 'Delete the other?' })).toBeInTheDocument();
    fireEvent.click(within(second).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(onAnswer).toHaveBeenLastCalledWith(true));
    expect(onAnswer).toHaveBeenCalledTimes(2);
  });

  it('closing the screen with the question open answers no', async () => {
    const { onAnswer, view, open } = setup();
    await open();
    act(() => view.unmount());
    await waitFor(() => expect(onAnswer).toHaveBeenCalledWith(false));
  });

  it('keeps clicks, presses and keys inside the dialog from the screen behind it', async () => {
    const { onParent, open, gone } = setup();
    const dialog = await open();
    fireEvent.pointerDown(within(dialog).getByRole('button', { name: 'Delete' }));
    fireEvent.keyDown(within(dialog).getByRole('button', { name: 'Delete' }), { key: 'Enter' });
    fireEvent.click(dialog);
    fireEvent.pointerDown(document.querySelector('.backdrop-blur-sm') as HTMLElement);
    fireEvent.click(document.querySelector('.backdrop-blur-sm') as HTMLElement);
    await gone();
    expect(onParent).not.toHaveBeenCalled();
  });
});

describe('cancelBookingQuestion (LT-347)', () => {
  const t = ((key: string) => key) as unknown as TFunction;

  it('tells the owner the customer hears of a booking still ahead, and keeps "keep the booking" as the way out', () => {
    const ahead = cancelBookingQuestion(t, String(Date.now() + 3_600_000));
    expect(ahead).toMatchObject({
      title: 'appointments.cancelDialog.title',
      message: 'appointments.cancelDialog.bodyAhead',
      confirmLabel: 'appointments.cancelDialog.confirm',
      cancelLabel: 'appointments.cancelDialog.keep',
      danger: true,
    });
  });

  it('says nothing about a message for a booking already past', () => {
    expect(cancelBookingQuestion(t, String(Date.now() - 3_600_000)).message).toBe('appointments.cancelDialog.body');
  });
});
