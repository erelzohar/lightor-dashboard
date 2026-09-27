import React, { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { Inbox, Phone, MessageCircle, Trash2, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import PullToRefresh from '../components/ui/PullToRefresh';
import AnswersList from '../components/appointments/AnswersList';
import { useAppSelector } from '../hooks/useAppSelector';
import { useAppDispatch } from '../hooks/useAppDispatch';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { fetchWebConfig } from '../store/slices/webConfigSlice';
import { fetchLeads, updateLeadStatus, deleteLead, Lead, LeadStatus, LeadsPage, LEAD_STATUSES } from '../services/leadsApi';
import { setNewLeadsCount } from '../hooks/useNewLeadsCount';
import { formatPhoneForDisplay, telHref, whatsAppHref } from '../utils/phone';

const PAGE_SIZE = 20;

const STATUS_TINT: Record<LeadStatus, string> = {
  new: 'bg-primary/10 text-primary border-primary/30',
  contacted: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-700/40',
  closed: 'bg-gray-100 text-gray-500 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700',
};

const CHIP = 'px-3 py-1.5 rounded-full text-sm font-medium border transition-colors whitespace-nowrap';

/**
 * Leads (LT-197): the messages visitors left through the site's contact form,
 * newest first. Phone-first like the rest of the dashboard: each lead is a
 * card with the number to call or WhatsApp, the message, the answers to the
 * owner's own questions and a status the owner moves along.
 */
const Leads: React.FC = () => {
  const { t, i18n } = useTranslation();
  const dispatch = useAppDispatch();
  const { auth } = useAuth();
  const { direction } = useTheme();
  const webConfig = useAppSelector((s) => s.webConfig.data);

  const [result, setResult] = useState<LeadsPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<LeadStatus | ''>('');
  const [page, setPage] = useState(1);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<Lead | null>(null);
  const [deleting, setDeleting] = useState(false);

  document.title = t('leads.title');

  // The answers are shown against the lead form's catalog (maps link for an
  // address, a tick for a confirm); the page may be the first one opened.
  useEffect(() => {
    if (!webConfig && auth.user?.webConfig_id) dispatch(fetchWebConfig(auth.user.webConfig_id));
  }, [webConfig, auth.user?.webConfig_id, dispatch]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchLeads({ status: status || undefined, page, limit: PAGE_SIZE });
      setResult(data);
      setNewLeadsCount(data.counts?.new ?? 0);
    } catch {
      toast.error(t('leads.errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [status, page, t]);

  useEffect(() => {
    load();
  }, [load]);

  const locale =
    i18n.language === 'he' ? 'he-IL' : i18n.language === 'ar' ? 'ar' : i18n.language === 'fr' ? 'fr' : i18n.language === 'es' ? 'es' : 'en-GB';
  const formatWhen = (iso: string) =>
    new Date(iso).toLocaleString(locale, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

  const changeStatus = async (lead: Lead, next: LeadStatus) => {
    if (lead.status === next) return;
    setBusyId(lead._id);
    try {
      await updateLeadStatus(lead._id, next);
      await load();
    } catch {
      toast.error(t('leads.errors.saveFailed'));
    } finally {
      setBusyId(null);
    }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await deleteLead(toDelete._id);
      setToDelete(null);
      // The last lead of a page gone: step back rather than show an empty page.
      if (result && result.data.length === 1 && page > 1) setPage(page - 1);
      else await load();
      toast.success(t('leads.deleted'));
    } catch {
      toast.error(t('leads.errors.deleteFailed'));
    } finally {
      setDeleting(false);
    }
  };

  const counts = result?.counts;
  const total = counts ? counts.new + counts.contacted + counts.closed : undefined;
  const filters: { value: LeadStatus | ''; label: string; count?: number }[] = [
    { value: '', label: t('leads.filter.all'), count: total },
    ...LEAD_STATUSES.map((s) => ({ value: s, label: t(`leads.status.${s}`), count: counts?.[s] })),
  ];
  const pagination = result?.pagination;
  const PrevIcon = direction === 'rtl' ? ChevronRight : ChevronLeft;
  const NextIcon = direction === 'rtl' ? ChevronLeft : ChevronRight;

  return (
    <PullToRefresh onRefresh={load}>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10">
            <Inbox size={22} className="text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-dark-text">{t('leads.title')}</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('leads.subtitle')}</p>
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide" role="tablist" aria-label={t('leads.filter.label')}>
          {filters.map((f) => {
            const active = status === f.value;
            return (
              <button
                key={f.value || 'all'}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => {
                  setStatus(f.value);
                  setPage(1);
                }}
                className={`${CHIP} ${
                  active
                    ? 'bg-primary text-white border-primary'
                    : 'bg-white dark:bg-dark-surface text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-primary/50'
                }`}
              >
                {f.label}
                {f.count !== undefined && <span className="ms-1.5 tabular-nums opacity-80">{f.count}</span>}
              </button>
            );
          })}
        </div>

        {loading && !result ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : !result?.data.length ? (
          <div className="glass-card rounded-2xl p-10 text-center space-y-2" data-testid="leads-empty">
            <Inbox className="w-10 h-10 mx-auto text-gray-300 dark:text-gray-600" />
            <p className="font-medium text-gray-700 dark:text-gray-200">
              {status ? t('leads.emptyFiltered') : t('leads.empty')}
            </p>
            {!status && <p className="text-sm text-gray-500 dark:text-gray-400">{t('leads.emptyHint')}</p>}
          </div>
        ) : (
          <ul className="space-y-3" data-testid="leads-list">
            {result.data.map((lead) => (
              <li
                key={lead._id}
                data-testid="lead-card"
                className={`glass-card rounded-2xl p-4 sm:p-5 space-y-3 ${lead.status === 'closed' ? 'opacity-70' : ''}`}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-gray-900 dark:text-dark-text break-words">{lead.name}</p>
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${STATUS_TINT[lead.status]}`}>
                        {t(`leads.status.${lead.status}`)}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">{formatWhen(lead.createdAt)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setToDelete(lead)}
                    className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 hover:text-rose-600 transition-colors shrink-0"
                    aria-label={t('leads.delete')}
                    title={t('leads.delete')}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                <div className="flex flex-wrap gap-2">
                  <a
                    href={telHref(lead.phone)}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-primary text-white text-sm font-medium"
                  >
                    <Phone size={15} />
                    <span dir="ltr">{formatPhoneForDisplay(lead.phone)}</span>
                  </a>
                  <a
                    href={whatsAppHref(lead.phone)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-emerald-300 dark:border-emerald-700/60 text-emerald-700 dark:text-emerald-400 text-sm font-medium"
                  >
                    <MessageCircle size={15} />
                    {t('leads.whatsapp')}
                  </a>
                </div>

                {lead.message && (
                  <p className="text-sm text-gray-700 dark:text-gray-200 whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                    {lead.message}
                  </p>
                )}

                <AnswersList answers={lead.answers} fields={webConfig?.leadFields ?? []} />

                <div className="flex flex-wrap items-center gap-1.5 pt-1" role="group" aria-label={t('leads.statusLabel')}>
                  {LEAD_STATUSES.map((s) => (
                    <button
                      key={s}
                      type="button"
                      disabled={busyId === lead._id}
                      aria-pressed={lead.status === s}
                      onClick={() => void changeStatus(lead, s)}
                      className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors disabled:opacity-50 ${
                        lead.status === s
                          ? STATUS_TINT[s]
                          : 'bg-transparent text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-primary/50'
                      }`}
                    >
                      {t(`leads.status.${s}`)}
                    </button>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}

        {pagination && pagination.pages > 1 && (
          <div className="flex items-center justify-center gap-4">
            <button
              type="button"
              disabled={page <= 1 || loading}
              onClick={() => setPage(page - 1)}
              className="w-9 h-9 flex items-center justify-center rounded-lg border border-gray-200 dark:border-gray-700 disabled:opacity-40"
              aria-label={t('leads.prevPage')}
            >
              <PrevIcon size={16} />
            </button>
            <span className="text-sm text-gray-500 tabular-nums">
              {pagination.page} / {pagination.pages}
            </span>
            <button
              type="button"
              disabled={page >= pagination.pages || loading}
              onClick={() => setPage(page + 1)}
              className="w-9 h-9 flex items-center justify-center rounded-lg border border-gray-200 dark:border-gray-700 disabled:opacity-40"
              aria-label={t('leads.nextPage')}
            >
              <NextIcon size={16} />
            </button>
          </div>
        )}

        <ConfirmDialog
          open={!!toDelete}
          title={t('leads.deleteTitle')}
          message={t('leads.deleteMessage', { name: toDelete?.name ?? '' })}
          confirmLabel={t('leads.delete')}
          cancelLabel={t('common.cancel')}
          danger
          loading={deleting}
          onConfirm={() => void confirmDelete()}
          onClose={() => setToDelete(null)}
        />
      </motion.div>
    </PullToRefresh>
  );
};

export default Leads;
