import React from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Inbox, Phone, MessageCircle, ArrowLeft, ArrowRight } from 'lucide-react';
import type { LeadsPage, LeadStatus } from '../../services/leadsApi';
import { formatPhoneForDisplay, telHref, whatsAppHref } from '../../utils/phone';
import { pop } from '../ui/pop-button';

const STATUS_TINT: Record<LeadStatus, string> = {
  new: 'bg-primary/10 text-primary border-primary/30',
  contacted: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-700/40',
  closed: 'bg-gray-100 text-gray-500 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700',
};

interface LeadsSummaryProps {
  /** The newest leads as `/api/leads?limit=5` answered; null when it failed. */
  page: LeadsPage | null;
  direction: 'ltr' | 'rtl';
}

/**
 * A leads site's latest inquiries (LT-199): the newest five with the number
 * to call back, and the way into the leads page. Phone-first: each lead is
 * one row with its call and WhatsApp buttons. The counts that sat above the
 * list moved to the home's numbers (LT-274).
 */
const LeadsSummary: React.FC<LeadsSummaryProps> = ({ page, direction }) => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();

  const locale =
    i18n.language === 'he' ? 'he-IL' : i18n.language === 'ar' ? 'ar' : i18n.language === 'fr' ? 'fr' : i18n.language === 'es' ? 'es' : 'en-GB';
  const formatWhen = (iso: string) =>
    new Date(iso).toLocaleString(locale, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  const Arrow = direction === 'rtl' ? ArrowLeft : ArrowRight;

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="glass-card rounded-3xl p-4 sm:p-5 space-y-4"
      data-testid="leads-summary"
    >
      <div className="flex items-center gap-3">
        <div className="p-2 bg-primary/10 rounded-full text-primary shrink-0">
          <Inbox className="w-5 h-5" />
        </div>
        <h2 className="flex-1 min-w-0 font-semibold text-gray-800 dark:text-white">{t('dashboard.leadsSummary.latest')}</h2>
        <button
          type="button"
          onClick={() => navigate('/leads')}
          className="shrink-0 flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          {t('dashboard.leadsSummary.viewAll')}
          <Arrow className="w-4 h-4" />
        </button>
      </div>

      {page === null ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">{t('leads.errors.loadFailed')}</p>
      ) : (
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
                  className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl ${pop()} text-sm font-medium`}
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
      )}
    </motion.section>
  );
};

export default LeadsSummary;
