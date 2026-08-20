import React from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Save, RefreshCcw } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface UnsavedChangesBarProps {
  visible: boolean;
  onSave: () => void;
  /** Omit to hide the discard button (a page may have no revert flow). */
  onDiscard?: () => void;
  saving?: boolean;
  /** Replaces the default message, renders red, and disables save. */
  errorMessage?: string | null;
  isRtl?: boolean;
}

/**
 * Floating unsaved-changes bar, shared by the pages that batch-save a form.
 *
 * Portaled to <body> so ancestors' entrance-animation transforms can't
 * re-anchor position:fixed. On phones it stacks vertically and floats at
 * bottom-24, clear of the corner AI-assistant button (bottom-6 + ~56px);
 * from `sm` up it's a centered one-line pill at bottom-5.
 */
const UnsavedChangesBar: React.FC<UnsavedChangesBarProps> = ({
  visible, onSave, onDiscard, saving = false, errorMessage, isRtl,
}) => {
  const { t } = useTranslation();

  return createPortal(
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 96, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 96, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 380, damping: 32 }}
          className="fixed bottom-24 sm:bottom-5 inset-x-0 z-50 flex justify-center px-4 pointer-events-none"
          dir={isRtl === undefined ? undefined : isRtl ? 'rtl' : 'ltr'}
        >
          <div className="pointer-events-auto flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 w-full max-w-sm sm:w-auto sm:max-w-none rounded-2xl px-5 py-3 bg-light-surface/90 dark:bg-dark-surface/90 backdrop-blur-md border border-black/10 dark:border-white/10 shadow-2xl shadow-black/20">
            <p className="text-sm font-semibold text-light-text dark:text-dark-text text-center sm:text-start sm:whitespace-nowrap">
              {errorMessage
                ? <span className="text-red-500">{errorMessage}</span>
                : t('common.unsavedChanges')}
            </p>
            <div className="flex gap-2 justify-center sm:justify-end">
              {onDiscard && (
                <button
                  onClick={onDiscard}
                  className="px-4 py-2 rounded-xl bg-black/5 dark:bg-white/5 text-light-text dark:text-dark-text border border-black/10 dark:border-white/10 font-semibold text-sm hover:bg-black/10 dark:hover:bg-white/10 transition-all"
                >
                  {t('common.cancel')}
                </button>
              )}
              <button
                onClick={onSave}
                disabled={saving || !!errorMessage}
                className="px-5 py-2 rounded-xl bg-primary text-white font-bold text-sm hover:opacity-90 hover:shadow-lg hover:shadow-primary/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {saving
                  ? <RefreshCcw size={14} className="animate-spin" />
                  : <Save size={14} />
                }
                {t('common.save')}
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};

export default UnsavedChangesBar;
