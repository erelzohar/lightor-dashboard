import React from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Inbox, Phone, MessageCircle, ArrowLeft, ArrowRight } from 'lucide-react';
import type { LeadsPage, LeadStatus } from '../../services/leadsApi';
import { formatPhoneForDisplay, telHref, whatsAppHref } from '../../utils/phone';

const STATUS_TINT: Record<LeadStatus, string> = {
  new: 'bg-primary/10 text-primary border-primary/30',
  contacted: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-700/40',
  closed: 'bg-gray-100 text-gray-500 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700',
};

interface LeadsSummaryProps {
  /** The newest leads as `/api/leads?limit=5` answered; null when it failed. */
  page: LeadsPage | null;
  /** The month's leads as the entitlements meter counts them; absent on an older API. */
  thisMonth?: number | null;
  direction: 'ltr' | 'rtl';
}

/**
 * A leads site's home (LT-199): what a booking site's income, graph, donut
 * and appointments list are to a booking site — how many inquiries wait, how
 * many came this month, and the latest five with the number to call back.
 * Phone-first: each lead is one row with its call and WhatsApp buttons.
 */
const LeadsSummary: React.FC<LeadsSummaryProps> = ({ page, thisMonth, direction }) => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();

  const locale =
    i18n.language === 'he' ? 'he-IL' : i18n.language === 'ar' ? 'ar' : i18n.language === 'fr' ? 'fr' : i18n.language === 'es' ? 'es' : 'en-GB';
  const formatWhen = (iso: string) =>
    new Date(iso).toLocaleString(locale, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  const Arrow = direction === 'rtl' ? ArrowLeft : ArrowRight;

  const stats = [
    { key: 'new', label: t('dashboard.leadsSummary.new'), value: page ? page.counts?.new ?? 0 : null },
    { key: 'month', label: t('dashboard.leadsSummary.thisMonth'), value: thisMonth ?? null },
  ];

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="glass-card rounded-2xl p-4 sm:p-5 space-y-4"
      data-testid="leads-summary"
    >
      <div className="flex items-center gap-3">
        <div className="p-2 bg-primary/10 rounded-full text-primary shrink-0">
          <Inbox className="w-5 h-5" />
        </div>
        <h2 className="flex-1 min-w-0 font-semibold text-gray-800 dark:text-white">{t('common.leads')}</h2>
        <button
          type="button"
          onClick={() => navigate('/leads')}
          className="shrink-0 flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          {t('dashboard.leadsSummary.viewAll')}
          <Arrow className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {stats.map((stat) => (
          <div key={stat.key} className="rounded-xl bg-white/60 dark:bg-white/5 border border-gray-200/60 dark:border-gray-700/60 p-3">
            <p className="text-xs text-gray-500 dark:text-gray-400">{stat.label}</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white tabular-nums" data-testid={`leads-stat-${stat.key}`}>
              {stat.value ?? '—'}
            </p>
          </div>
        ))}
      </div>

      {page === null ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">{t('leads.errors.loadFailed')}</p>
      ) : (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400">{t('dashboard.leadsSummary.latest')}</h3>
          <ul className="divide-y divide-gray-200/60 dark:divide-gray-700/60">
            {page.data.slice(0, 5).map((lead) => (
              <li key={lead._id} className="py-3 flex flex-col gap-2" data-testid="leads-summary-row">
                <div className="flex items-start gap-2 min-w-0">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-gray-900 dark:text-dark-text break-words">{lead.name}</p>
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${STATUS_TINT[lead.status] ?? STATUS_TINT.new}`}>
                        {t(`leads.status.${lead.status}`)}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">{formatWhen(lead.createdAt)}</p>
                    {lead.message && (
                      <p className="text-sm text-gray-600 dark:text-gray-300 mt-1 truncate">{lead.message}</p>
                    )}
                  </div>
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
              </li>
            ))}
          </ul>
        </div>
      )}
    </motion.section>
  );
};

export default LeadsSummary;
