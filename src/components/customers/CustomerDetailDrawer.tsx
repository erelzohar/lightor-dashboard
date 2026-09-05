import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { X, Phone, Ban, ShieldCheck, CalendarPlus, StickyNote, Loader } from 'lucide-react';
import Button from '../ui/Button';
import ConfirmDialog from '../ui/ConfirmDialog';
import StatusBadge from '../admin/StatusBadge';
import BlockCustomerDialog from './BlockCustomerDialog';
import OwnerBookingModal from './OwnerBookingModal';
import { useTheme } from '../../contexts/ThemeContext';
import {
  fetchCustomer,
  setCustomerBlock,
  setCustomerNotes,
  CustomerDetail,
} from '../../services/customersApi';
import { formatPhoneForDisplay, telHref, whatsAppHref } from '../../utils/phone';

/**
 * One customer, in full (LT-122): who they are, how to reach them, what they
 * have booked, the owner's private notes, and the block switch. Slides in
 * from the end side so the list stays visible behind it.
 */
interface CustomerDetailDrawerProps {
  customerId: string | null;
  onClose: () => void;
  /** Something changed that the list/stats behind the drawer should reflect. */
  onChanged: () => void;
}

const WhatsAppGlyph: React.FC = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

const CustomerDetailDrawer: React.FC<CustomerDetailDrawerProps> = ({ customerId, onClose, onChanged }) => {
  const { t, i18n } = useTranslation();
  const { direction } = useTheme();

  const [detail, setDetail] = useState<CustomerDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [notes, setNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [blockOpen, setBlockOpen] = useState(false);
  const [unblockOpen, setUnblockOpen] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const [bookingOpen, setBookingOpen] = useState(false);

  const open = customerId !== null;

  const load = useCallback(async () => {
    if (!customerId) return;
    setLoading(true);
    try {
      const data = await fetchCustomer(customerId);
      setDetail(data);
      setNotes(data.customer.notes ?? '');
    } catch {
      toast.error(t('customers.errors.loadFailed'));
      onClose();
    } finally {
      setLoading(false);
    }
  }, [customerId, t, onClose]);

  useEffect(() => {
    if (open) {
      setDetail(null);
      load();
    }
  }, [open, load]);

  const locale = i18n.language === 'he' ? 'he-IL' : i18n.language === 'ar' ? 'ar' : i18n.language === 'fr' ? 'fr' : i18n.language === 'es' ? 'es' : 'en-GB';
  const formatDate = (value?: string | null) =>
    value ? new Date(value).toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
  const formatDateTime = (value?: string | null) =>
    value
      ? new Date(value).toLocaleString(locale, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
      : '—';

  const saveNotes = async () => {
    if (!detail) return;
    setSavingNotes(true);
    try {
      const updated = await setCustomerNotes(detail.customer._id, notes);
      setDetail({ ...detail, customer: updated });
      toast.success(t('customers.detail.notesSaved'));
    } catch {
      toast.error(t('customers.errors.saveFailed'));
    } finally {
      setSavingNotes(false);
    }
  };

  const applyBlock = async (isBlocked: boolean, options: { reason?: string; cancelUpcoming?: boolean } = {}) => {
    if (!detail) return;
    setBlocking(true);
    try {
      const result = await setCustomerBlock(detail.customer._id, { isBlocked, ...options });
      if (isBlocked) {
        toast.success(
          result.cancelledCount
            ? t('customers.block.doneWithCancelled', { count: result.cancelledCount })
            : t('customers.block.done')
        );
      } else {
        toast.success(t('customers.block.unblocked'));
      }
      setBlockOpen(false);
      setUnblockOpen(false);
      await load();
      onChanged();
    } catch {
      toast.error(t('customers.errors.saveFailed'));
    } finally {
      setBlocking(false);
    }
  };

  const customer = detail?.customer;
  const stats = detail?.stats;
  const notesDirty = detail ? notes !== (detail.customer.notes ?? '') : false;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
          />
          <motion.aside
            initial={{ x: direction === 'rtl' ? '-100%' : '100%' }}
            animate={{ x: 0 }}
            exit={{ x: direction === 'rtl' ? '-100%' : '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            className="absolute inset-y-0 end-0 w-full max-w-xl bg-light-surface shadow-2xl flex flex-col"
            role="dialog"
            aria-modal="true"
            aria-label={t('customers.detail.title')}
          >
            {/* Header */}
            <div className="flex items-start gap-3 p-5 border-b border-gray-100 dark:border-gray-800">
              <div className="flex-1 min-w-0">
                {customer ? (
                  <>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-xl font-bold text-gray-900 dark:text-dark-text truncate">{customer.name}</h2>
                      <StatusBadge status={customer.isBlocked ? 'blocked' : 'active'} i18nPrefix="customers.status" />
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5" dir="ltr">
                      {formatPhoneForDisplay(customer.phone)}
                    </p>
                    {customer.isBlocked && customer.blockReason && (
                      <p className="text-xs text-red-500 mt-1">{customer.blockReason}</p>
                    )}
                  </>
                ) : (
                  <div className="h-7 w-40 rounded bg-gray-100 dark:bg-gray-800 animate-pulse" />
                )}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                aria-label={t('customers.detail.close')}
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              {loading && !detail ? (
                <div className="flex justify-center py-16">
                  <Loader className="animate-spin text-primary" />
                </div>
              ) : customer && stats ? (
                <>
                  {/* Actions */}
                  <div className="flex flex-wrap gap-2">
                    <a
                      href={telHref(customer.phone)}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium bg-[#088F8F] text-white hover:bg-[#088F8F]/85 transition-colors"
                    >
                      <Phone size={15} /> {t('customers.detail.call')}
                    </a>
                    <a
                      href={whatsAppHref(customer.phone)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium bg-green-500 text-white hover:bg-green-600 transition-colors"
                    >
                      <WhatsAppGlyph /> WhatsApp
                    </a>
                    <Button size="sm" variant="primary" leftIcon={<CalendarPlus size={15} />} onClick={() => setBookingOpen(true)}>
                      {t('customers.detail.schedule')}
                    </Button>
                    {customer.isBlocked ? (
                      <Button size="sm" variant="outline" leftIcon={<ShieldCheck size={15} />} onClick={() => setUnblockOpen(true)}>
                        {t('customers.block.unblockConfirm')}
                      </Button>
                    ) : (
                      <Button size="sm" variant="danger" leftIcon={<Ban size={15} />} onClick={() => setBlockOpen(true)}>
                        {t('customers.block.title')}
                      </Button>
                    )}
                  </div>

                  {/* Stats strip */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: t('customers.columns.visits'), value: stats.visits },
                      { label: t('customers.detail.cancelledCount'), value: stats.cancelled },
                      { label: t('customers.detail.upcoming'), value: stats.upcoming },
                      {
                        label: t('customers.columns.revenue'),
                        value: `${t('appointments.currencySymbol')}${Math.round(stats.revenue).toLocaleString()}`,
                      },
                    ].map((item) => (
                      <div key={item.label} className="rounded-xl bg-gray-50 dark:bg-gray-800/50 p-3">
                        <p className="text-[11px] uppercase tracking-wide text-gray-400">{item.label}</p>
                        <p className="text-lg font-bold text-gray-900 dark:text-dark-text">{item.value}</p>
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-gray-400">{t('customers.columns.lastVisit')}</p>
                      <p className="font-medium text-gray-800 dark:text-gray-100">{formatDate(stats.lastVisit)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">{t('customers.detail.nextVisit')}</p>
                      <p className="font-medium text-gray-800 dark:text-gray-100">{formatDateTime(stats.nextVisit)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">{t('customers.detail.firstSeen')}</p>
                      <p className="font-medium text-gray-800 dark:text-gray-100">{formatDate(customer.firstSeenAt)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">{t('customers.detail.source')}</p>
                      <p className="font-medium text-gray-800 dark:text-gray-100">{t(`customers.source.${customer.source}`)}</p>
                    </div>
                  </div>

                  {/* Notes */}
                  <section>
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                      <StickyNote size={15} className="text-primary" /> {t('customers.detail.notes')}
                    </h3>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      maxLength={2000}
                      rows={4}
                      placeholder={t('customers.detail.notesPlaceholder')}
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700/80 bg-white dark:bg-dark-surface text-sm text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-y"
                    />
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-[11px] text-gray-400">{notes.length}/2000</span>
                      <Button size="sm" variant="secondary" onClick={saveNotes} isLoading={savingNotes} disabled={!notesDirty}>
                        {t('customers.detail.saveNotes')}
                      </Button>
                    </div>
                  </section>

                  {/* History */}
                  <section>
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                      {t('customers.detail.history')}
                    </h3>
                    {detail.history.length === 0 ? (
                      <p className="text-sm text-gray-400 py-6 text-center">{t('customers.detail.noHistory')}</p>
                    ) : (
                      <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                        {detail.history.map((row) => (
                          <li key={row._id} className="flex items-center gap-3 py-2.5">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 dark:text-dark-text truncate">
                                {row.typeName ?? '—'}
                              </p>
                              <p className="text-xs text-gray-400">{formatDateTime(row.scheduledAt)}</p>
                            </div>
                            {row.typePrice && (
                              <span className="text-xs text-gray-500 whitespace-nowrap">
                                {t('appointments.currencySymbol')}{row.typePrice}
                              </span>
                            )}
                            <StatusBadge status={row.status} />
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                </>
              ) : null}
            </div>
          </motion.aside>

          {customer && (
            <>
              <BlockCustomerDialog
                open={blockOpen}
                customerName={customer.name}
                upcomingCount={stats?.upcoming ?? 0}
                loading={blocking}
                onClose={() => setBlockOpen(false)}
                onConfirm={(options) => applyBlock(true, options)}
              />
              <ConfirmDialog
                open={unblockOpen}
                title={t('customers.block.unblockTitle')}
                message={t('customers.block.unblockMessage', { name: customer.name })}
                confirmLabel={t('customers.block.unblockConfirm')}
                cancelLabel={t('customers.block.cancel')}
                loading={blocking}
                onClose={() => setUnblockOpen(false)}
                onConfirm={() => applyBlock(false)}
              />
              <OwnerBookingModal
                open={bookingOpen}
                customer={{
                  name: customer.name,
                  phone: customer.phone,
                  channelType: detail?.history.find((h) => h.channelType)?.channelType,
                }}
                onClose={() => setBookingOpen(false)}
                onBooked={() => {
                  load();
                  onChanged();
                }}
              />
            </>
          )}
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
};

export default CustomerDetailDrawer;
