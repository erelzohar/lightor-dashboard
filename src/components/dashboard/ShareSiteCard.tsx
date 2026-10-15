import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { Copy, Download, Loader2, Megaphone, MessageCircle, QrCode, X } from 'lucide-react';
import { isNativeApp } from '../../lib/platform';

interface ShareSiteCardProps {
  /** What the site converts to: the title speaks of inquiries or of bookings. */
  kind: 'leads' | 'bookings';
  /** Nothing has come in yet: the card is the page's call to action. */
  first?: boolean;
  businessName?: string;
  subDomain: string;
}

/** The live site's address: every site sits on its own subdomain. */
const siteHost = (subDomain: string) => `${subDomain}.lightor.app`;

/** navigator.clipboard where the page may use it, else the old select-and-copy. */
export const copyText = async (text: string): Promise<boolean> => {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* refused, or not a secure context: try the old way */
  }
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  // Off to the side, and selectable although the body is user-select: none.
  area.style.cssText = 'position:fixed;top:0;opacity:0;-webkit-user-select:text;user-select:text';
  document.body.appendChild(area);
  area.select();
  area.setSelectionRange(0, text.length); // iOS selects nothing with select() alone
  let copied = false;
  try {
    copied = document.execCommand('copy');
  } catch {
    copied = false;
  }
  area.remove();
  return copied;
};

/**
 * "How to bring more inquiries / bookings" (LT-274), at the foot of both
 * homes once the site is live: copy the address, send it on WhatsApp, or show
 * it as a QR code. With nothing in yet it is the page's call to action.
 */
const ShareSiteCard: React.FC<ShareSiteCardProps> = ({ kind, first = false, businessName, subDomain }) => {
  const { t } = useTranslation();
  const [qrOpen, setQrOpen] = useState(false);
  const closeQr = useCallback(() => setQrOpen(false), []);

  const url = `https://${siteHost(subDomain)}`;
  const name = businessName?.trim();
  const whatsAppShare = `https://wa.me/?text=${encodeURIComponent(name ? `${name} - ${url}` : url)}`;
  const title = first
    ? t(kind === 'leads' ? 'dashboard.share.firstLeads' : 'dashboard.share.firstBookings')
    : t(kind === 'leads' ? 'dashboard.share.titleLeads' : 'dashboard.share.titleBookings');

  const handleCopy = async () => {
    if (await copyText(url)) toast.success(t('dashboard.share.copied'));
    else toast.error(t('dashboard.share.copyFailed'));
  };

  const button = `flex flex-col sm:flex-row items-center justify-center gap-1.5 sm:gap-2 px-2 py-2.5 rounded-xl text-sm font-medium text-center transition-colors ${
    first
      ? 'bg-primary hover:bg-primary-dark text-white shadow-sm'
      : 'border border-gray-200 dark:border-gray-700/60 bg-white/60 dark:bg-white/5 text-primary hover:bg-white dark:hover:bg-white/10'
  }`;

  return (
    <>
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        // First: under Lighty's centred welcome, as wide as a phone's page, not the pane.
        className={`glass-card ${first ? 'glass-tint-primary w-full max-w-2xl mx-auto' : ''} rounded-3xl p-4 sm:p-5 space-y-4`}
        data-testid="share-site-card"
      >
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-full bg-primary text-white shrink-0">
            <Megaphone className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h2 className={`font-semibold text-gray-800 dark:text-white ${first ? 'text-lg' : ''}`}>{title}</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{t('dashboard.share.desc')}</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <button type="button" onClick={handleCopy} className={button}>
            <Copy className="w-4 h-4 shrink-0" />
            {t('dashboard.share.copy')}
          </button>
          {/* A plain link, like the leads' WhatsApp buttons: in the app too it hands over to WhatsApp. */}
          <a href={whatsAppShare} target="_blank" rel="noopener noreferrer" className={button}>
            <MessageCircle className="w-4 h-4 shrink-0" />
            {t('leads.whatsapp')}
          </a>
          <button type="button" onClick={() => setQrOpen(true)} className={button}>
            <QrCode className="w-4 h-4 shrink-0" />
            {t('dashboard.share.qr')}
          </button>
        </div>
      </motion.section>
      <SiteQrModal open={qrOpen} subDomain={subDomain} onClose={closeQr} />
    </>
  );
};

interface SiteQrModalProps {
  open: boolean;
  subDomain: string;
  onClose: () => void;
}

/**
 * The site's address as a QR code, large enough to scan off the screen or to
 * print. Black on white with the standard four-module quiet zone in either
 * theme: scanners need the contrast. `qrcode` is imported only once the modal
 * opens, so the main bundle does not carry it. In the app a download link
 * does nothing, so it says how to keep the code instead.
 */
const SiteQrModal: React.FC<SiteQrModalProps> = ({ open, subDomain, onClose }) => {
  const { t } = useTranslation();
  const host = siteHost(subDomain);
  const url = `https://${host}`;
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const [qr, setQr] = useState<{ url: string; image: string } | null>(null);
  const [failed, setFailed] = useState(false);
  const image = qr?.url === url ? qr.image : null;

  useEffect(() => {
    if (!open || image) return;
    let cancelled = false;
    setFailed(false);
    import('qrcode')
      .then(({ toDataURL }) =>
        toDataURL(url, { width: 1024, margin: 4, errorCorrectionLevel: 'M', color: { dark: '#000000', light: '#ffffff' } })
      )
      .then((data) => {
        if (!cancelled) setQr({ url, image: data });
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [open, url, image]);

  // Focus lands inside on open; Escape closes, like the backdrop.
  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [open, onClose]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overlay-safe">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="relative w-full max-w-sm glass-modal rounded-2xl p-6 max-h-[90dvh] overflow-y-auto"
            data-testid="share-qr-modal"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 id={titleId} className="text-lg font-bold text-gray-900 dark:text-dark-text">{t('dashboard.share.qrTitle')}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">{t('dashboard.share.qrDesc')}</p>
              </div>
              <button
                ref={closeRef}
                type="button"
                onClick={onClose}
                aria-label={t('dashboard.share.close')}
                className="shrink-0 p-1.5 -m-1.5 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-5 mx-auto w-60 h-60 rounded-2xl bg-white overflow-hidden flex items-center justify-center shadow-sm">
              {image ? (
                <img src={image} alt={t('dashboard.share.qrTitle')} className="w-full h-full" data-testid="share-qr-image" />
              ) : failed ? (
                <p className="px-6 text-center text-sm text-gray-500">{t('dashboard.share.qrFailed')}</p>
              ) : (
                <Loader2 className="w-8 h-8 text-gray-300 animate-spin" />
              )}
            </div>
            <p dir="ltr" className="mt-3 text-center font-medium text-gray-800 dark:text-gray-100 break-all">
              {host}
            </p>

            {isNativeApp() ? (
              <p className="mt-4 text-center text-xs text-gray-500 dark:text-gray-400" data-testid="share-qr-native-hint">
                {t('dashboard.share.qrNativeHint')}
              </p>
            ) : (
              <a
                href={image ?? undefined}
                download={`${subDomain}-qr.png`}
                aria-disabled={!image}
                className={`mt-5 w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary hover:bg-primary-dark text-white text-sm font-medium transition-colors ${
                  image ? '' : 'opacity-60 pointer-events-none'
                }`}
              >
                <Download className="w-4 h-4" />
                {t('dashboard.share.download')}
              </a>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
};

export default ShareSiteCard;
