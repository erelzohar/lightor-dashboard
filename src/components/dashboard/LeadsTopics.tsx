import React from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import type { LeadStats } from '../../services/leadsApi';

type Topic = NonNullable<LeadStats['topic']>;

/** Anything to draw: a question with at least one answer in the last 30 days. */
export const hasTopics = (topic: LeadStats['topic']): topic is Topic =>
  !!topic && (topic.other > 0 || topic.items.some((item) => item.count > 0));

/**
 * The word for "other" in the dashboard's languages, and the forms an AI-built
 * contact form uses for its own catch-all option (LT-576).
 */
const OTHER_WORDS = ['אחר', 'אחרת', 'אחרים', 'other', 'others', 'autre', 'autres', 'otro', 'otra', 'otros', 'أخرى', 'اخرى', 'آخر', 'اخر'];

/** Case, spaces and end punctuation ("Other…", "אחר:") don't matter. */
const normalise = (value: string) =>
  value.trim().toLocaleLowerCase().replace(/^[^\p{L}]+|[^\p{L}]+$/gu, '');

/**
 * "What people ask about" (LT-274): the answers to the contact form's first
 * multiple-choice question over the last 30 days — the top four and the rest
 * as "other" (with the question's own "other" option, LT-576) — as bars
 * scaled to the most common answer. They grow from the reading side, so from
 * the right in Hebrew.
 */
const LeadsTopics: React.FC<{ topic: Topic }> = ({ topic }) => {
  const { t } = useTranslation();
  const otherLabel = t('dashboard.leadsTopics.other');

  // The question's own "אחר" option joins the rest, so one row reads "אחר".
  const otherWords = new Set([...OTHER_WORDS, normalise(otherLabel)]);
  const isOther = (value: string) => otherWords.has(normalise(value));
  const otherCount = topic.other + topic.items.filter((item) => isOther(item.value)).reduce((sum, item) => sum + item.count, 0);

  const rows = [
    ...topic.items
      .filter((item) => !isOther(item.value))
      .sort((a, b) => b.count - a.count)
      .map((item) => ({ key: `item:${item.value}`, label: item.value, count: item.count })),
    { key: 'other', label: otherLabel, count: otherCount },
  ].filter((row) => row.count > 0);
  const max = Math.max(1, ...rows.map((row) => row.count));

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
      className="glass-card rounded-3xl p-4 sm:p-5 h-full"
      data-testid="leads-topics"
    >
      <h3 className="font-semibold text-gray-800 dark:text-white">{t('dashboard.leadsTopics.title')}</h3>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
        <span dir="auto">{topic.label}</span> · {t('dashboard.leadsStats.last30')}
      </p>
      <ul className="mt-4 space-y-3">
        {rows.map((row) => (
          <li key={row.key} data-testid="leads-topic-row">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              {/* dir="auto": an English answer truncates at its own end, not its start. */}
              <span className="min-w-0 truncate text-gray-700 dark:text-gray-200" dir="auto">{row.label}</span>
              <span className="shrink-0 font-semibold text-gray-900 dark:text-white tabular-nums">{row.count}</span>
            </div>
            <div className="mt-1.5 h-2 rounded-full bg-gray-200/70 dark:bg-gray-700/60 overflow-hidden">
              <div className="h-full rounded-full bg-primary" style={{ width: `${(row.count / max) * 100}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </motion.section>
  );
};

export default LeadsTopics;
