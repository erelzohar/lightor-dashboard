import React, { useCallback, useEffect, useRef, useState } from 'react';
import ConfirmDialog from '../components/ui/ConfirmDialog';

export interface ConfirmOptions {
  title: string;
  message: React.ReactNode;
  confirmLabel: string;
  /** The way out; the dialog's own "Cancel" when absent. */
  cancelLabel?: string;
  danger?: boolean;
}

/**
 * The dashboard's own question box instead of the browser's window.confirm
 * (LT-347; the register did the same in LT-335). `confirm(options)` opens a
 * ConfirmDialog and resolves true when the owner confirms, false on the way
 * out — its cancel button, Escape or a tap outside. The component renders
 * `dialog` once, anywhere: it portals to the body.
 */
export const useConfirm = (): {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  dialog: React.ReactElement;
} => {
  // The question stays in state after it closes, so the box keeps its words
  // while it fades out.
  const [asked, setAsked] = useState<ConfirmOptions | null>(null);
  const [open, setOpen] = useState(false);
  const resolveRef = useRef<((ok: boolean) => void) | null>(null);

  const settle = useCallback((ok: boolean) => {
    const resolve = resolveRef.current;
    resolveRef.current = null;
    setOpen(false);
    resolve?.(ok);
  }, []);

  const confirm = useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        // A new question replaces one still open, which counts as a "no".
        resolveRef.current?.(false);
        resolveRef.current = resolve;
        setAsked(options);
        setOpen(true);
      }),
    []
  );

  // Leaving with the question open is a "no".
  useEffect(() => {
    const pending = resolveRef;
    return () => pending.current?.(false);
  }, []);

  const onConfirm = useCallback(() => settle(true), [settle]);
  const onClose = useCallback(() => settle(false), [settle]);

  const dialog = (
    <ConfirmDialog
      open={open}
      title={asked?.title ?? ''}
      message={asked?.message ?? null}
      confirmLabel={asked?.confirmLabel ?? ''}
      cancelLabel={asked?.cancelLabel}
      danger={asked?.danger}
      onConfirm={onConfirm}
      onClose={onClose}
    />
  );
  return { confirm, dialog };
};
