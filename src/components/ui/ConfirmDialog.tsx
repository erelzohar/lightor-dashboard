import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Button from './Button';

/**
 * Confirmation modal (LT-058) — replaces window.confirm for admin actions.
 * Follows the house modal pattern (AppointmentDetails): fixed overlay with
 * backdrop blur, motion card, click-outside closes.
 *
 * `confirmText` arms type-to-confirm: the confirm button stays disabled
 * until the user types the exact string (used with the target's email for
 * account deletion — the same proof-of-intent bar as self-service).
 */
interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: React.ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  danger?: boolean;
  /** Exact string the user must type before confirm enables. */
  confirmText?: string;
  confirmTextLabel?: string;
  loading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  danger = false,
  confirmText,
  confirmTextLabel,
  loading = false,
  onConfirm,
  onClose,
}) => {
  const { t } = useTranslation();
  const [typed, setTyped] = useState('');

  useEffect(() => {
    if (open) setTyped('');
  }, [open]);

  const armed = !confirmText || typed.trim().toLowerCase() === confirmText.trim().toLowerCase();

  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  // Escape closes (unless a confirm is in flight), matching the backdrop click.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [open, loading, onClose]);

  // Move focus into the dialog on open so keyboard and screen-reader users land
  // inside it, and keep Tab from escaping to the page behind (a simple trap).
  useEffect(() => {
    if (!open) return;
    const focusables = () =>
      Array.from(
        panelRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
        ) ?? []
      );
    const first = focusables()[0];
    first?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const items = focusables();
      if (items.length === 0) return;
      const firstEl = items[0];
      const lastEl = items[items.length - 1];
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    };
    const node = panelRef.current;
    node?.addEventListener('keydown', onKeyDown);
    return () => node?.removeEventListener('keydown', onKeyDown);
  }, [open, confirmText]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={loading ? undefined : onClose}
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md bg-light-surface dark:bg-dark-surface rounded-2xl shadow-xl p-6"
          >
            <div className="flex items-start gap-3">
              {danger && (
                <div className="p-2.5 rounded-xl bg-red-100 dark:bg-red-900/30 shrink-0">
                  <AlertTriangle size={20} className="text-red-500" />
                </div>
              )}
              <div className="min-w-0">
                <h3 id={titleId} className="text-lg font-bold text-gray-900 dark:text-dark-text">{title}</h3>
                <div className="text-sm text-gray-600 dark:text-gray-300 mt-1.5">{message}</div>
              </div>
            </div>

            {confirmText && (
              <div className="mt-4">
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                  {confirmTextLabel ?? t('admin.actions.typeToConfirm', { text: confirmText })}
                </label>
                <input
                  type="text"
                  dir="ltr"
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  placeholder={confirmText}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700/80 bg-white dark:bg-dark-surface text-sm text-gray-800 dark:text-gray-100 placeholder-gray-300 dark:placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                />
              </div>
            )}

            <div className="flex justify-end gap-2 mt-6">
              <Button variant="ghost" size="sm" onClick={onClose} disabled={loading}>
                {cancelLabel ?? t('admin.actions.cancel')}
              </Button>
              <Button
                variant={danger ? 'danger' : 'primary'}
                size="sm"
                onClick={onConfirm}
                disabled={!armed}
                isLoading={loading}
              >
                {confirmLabel}
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
};

export default ConfirmDialog;
