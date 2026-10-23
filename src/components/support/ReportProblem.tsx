import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ImagePlus, LifeBuoy, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import Button from '../ui/Button';
import { uploadImage } from '../../services/imagesApi';
import { sendProblemReport, SUPPORT_EMAIL } from '../../services/supportApi';
import { isNativeApp, nativePlatform } from '../../lib/platform';

/**
 * LT-448: "report a problem", from the sidebar and the phone's "More" menu.
 * The owner says what went wrong, may add a screenshot; the page they were
 * on, the language and the browser or app go with it. It reaches Lightor's
 * admin panel and inbox, and is answered by email.
 *
 * One window for the whole dashboard (`ReportProblemHost` in the layout),
 * opened from anywhere with `openReportProblem()`.
 */
const listeners = new Set<() => void>();
export const openReportProblem = (): void => listeners.forEach((open) => open());

const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

export const ReportProblemHost: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [shot, setShot] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const fieldId = useId();

  useEffect(() => {
    const show = () => {
      setMessage('');
      setShot(null);
      setOpen(true);
    };
    listeners.add(show);
    return () => { listeners.delete(show); };
  }, []);

  const close = () => { if (!sending) setOpen(false); };

  // Escape closes; focus moves in and stays in (as ConfirmDialog).
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !sending) {
        e.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener('keydown', onKeyDown, true);
    panelRef.current?.querySelector<HTMLElement>('textarea')?.focus();
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [open, sending]);

  const ready = message.trim().length >= 5 && !sending;

  const send = async () => {
    if (!ready) return;
    setSending(true);
    try {
      const imageName = shot ? (await uploadImage(shot)).imageName : undefined;
      await sendProblemReport({
        message: message.trim(),
        pageUrl: `${window.location.pathname}${window.location.search}`,
        language: (i18n.language || '').split('-')[0],
        app: isNativeApp() ? `${nativePlatform()} app` : 'web',
        ...(imageName ? { imageName } : {}),
      });
      toast.success(t('support.report.sent'));
      setOpen(false);
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      toast.error(status === 429 ? t('support.report.tooMany') : t('support.report.failed', { email: SUPPORT_EMAIL }));
    } finally {
      setSending(false);
    }
  };

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[10050] flex items-center justify-center p-4 overlay-safe" data-testid="report-problem">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={close}
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
            className="relative w-full max-w-md glass-modal rounded-2xl p-6"
          >
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-violet-100 dark:bg-violet-900/30 shrink-0">
                <LifeBuoy size={20} className="text-violet-600 dark:text-violet-300" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 id={titleId} className="text-lg font-bold text-gray-900 dark:text-dark-text">{t('support.report.title')}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">{t('support.report.intro')}</p>
              </div>
              <button
                type="button"
                onClick={close}
                aria-label={t('support.report.close')}
                className="w-8 h-8 -mt-1 -me-1 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10"
              >
                <X size={16} aria-hidden="true" />
              </button>
            </div>

            <label htmlFor={fieldId} className="block text-xs font-medium text-gray-500 dark:text-gray-400 mt-4 mb-1.5">
              {t('support.report.label')}
            </label>
            <textarea
              id={fieldId}
              value={message}
              onChange={(e) => setMessage(e.target.value.slice(0, 2000))}
              rows={5}
              placeholder={t('support.report.placeholder')}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700/80 bg-white dark:bg-dark-surface text-sm text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
            />

            <input
              ref={fileInput}
              type="file"
              accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
              className="sr-only"
              tabIndex={-1}
              aria-hidden="true"
              data-testid="report-problem-file"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file && IMAGE_TYPES.includes(file.type)) setShot(file);
                e.target.value = '';
              }}
            />
            {shot ? (
              <div className="mt-2 flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                <ImagePlus size={16} className="text-violet-500 shrink-0" aria-hidden="true" />
                <span className="truncate" dir="auto">{shot.name}</span>
                <button
                  type="button"
                  onClick={() => setShot(null)}
                  aria-label={t('support.report.removeShot')}
                  className="w-6 h-6 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10 shrink-0"
                >
                  <X size={14} aria-hidden="true" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-violet-700 dark:text-violet-300 hover:underline"
              >
                <ImagePlus size={16} aria-hidden="true" />
                {t('support.report.addShot')}
              </button>
            )}

            <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
              {t('support.report.note')}{' '}
              {t('support.report.orEmail')}{' '}
              <a href={`mailto:${SUPPORT_EMAIL}`} className="text-violet-700 dark:text-violet-300 hover:underline"><bdi>{SUPPORT_EMAIL}</bdi></a>
            </p>

            <div className="flex justify-end gap-2 mt-5">
              <Button variant="ghost" size="sm" onClick={close} disabled={sending}>
                {t('common.cancel')}
              </Button>
              <Button variant="primary" size="sm" onClick={() => void send()} disabled={!ready} isLoading={sending}>
                {t('support.report.send')}
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
};
