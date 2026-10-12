import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import type { LeadStats } from '../../services/leadsApi';

interface LeadsChartProps {
  /** 30 days, oldest first, today last. */
  perDay: LeadStats['perDay'];
}

/** 'YYYY-MM-DD' as that calendar day — never through UTC, which can shift it by one. */
const dayOf = (date: string): Date => {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d);
};

/**
 * Inquiries per day over the last 30 days (LT-274), today's bar in full
 * colour. Plain bars rather than a charting library: 30 equal columns need no
 * axis maths, size with their card from the first paint (the bookings graph
 * had to measure itself, LT-083) and leave the main bundle alone. Tapping or
 * hovering a bar reads its day out in the header; it shows today otherwise.
 */
const LeadsChart: React.FC<LeadsChartProps> = ({ perDay }) => {
  const { t, i18n } = useTranslation();
  const [active, setActive] = useState<number | null>(null);

  const locale =
    i18n.language === 'he' ? 'he-IL' : i18n.language === 'ar' ? 'ar' : i18n.language === 'fr' ? 'fr' : i18n.language === 'es' ? 'es' : 'en-GB';
  const last = perDay.length - 1;
  const max = Math.max(1, ...perDay.map((d) => d.count));
  const dayLabel = (i: number) =>
    i === last ? t('appointments.today') : dayOf(perDay[i].date).toLocaleDateString(locale, { day: 'numeric', month: 'short' });
  const shown = active ?? last;

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="glass-card rounded-3xl p-4 sm:p-5 h-full flex flex-col"
      data-testid="leads-chart"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 mb-4">
        <h3 className="font-semibold text-gray-800 dark:text-white">{t('dashboard.leadsChart.title')}</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 tabular-nums" data-testid="leads-chart-readout">
          {dayLabel(shown)} · {t('dashboard.leadsChart.dayCount', { count: perDay[shown].count })}
        </p>
      </div>

      {/* Time runs left to right in every language, like the bookings graph
          and the sparklines; each date label keeps its own direction. */}
      <div dir="ltr" className="flex-1 flex flex-col justify-end">
        <div
          className="flex items-end gap-[2px] sm:gap-1 h-36 sm:h-44 border-b border-gray-200 dark:border-gray-700/60"
          onMouseLeave={() => setActive(null)}
          role="img"
          aria-label={t('dashboard.leadsChart.title')}
        >
          {perDay.map((d, i) => (
            <div
              key={d.date}
              className="flex-1 h-full flex items-end cursor-pointer"
              onMouseEnter={() => setActive(i)}
              onClick={() => setActive(i)}
              data-testid="leads-chart-bar"
              data-today={i === last ? 'true' : undefined}
            >
              {/* An empty day keeps a 2px stub, so the 30 slots stay visible. */}
              <div
                className={`w-full rounded-t-[3px] bg-primary transition-opacity ${
                  i === last ? 'opacity-100' : i === active ? 'opacity-70' : 'opacity-30'
                }`}
                style={{ height: d.count ? `${(d.count / max) * 100}%` : '2px' }}
              />
            </div>
          ))}
        </div>
        <div className="flex justify-between mt-2 text-[11px] text-gray-400">
          <span dir="auto">{dayLabel(0)}</span>
          <span dir="auto">{dayLabel(Math.floor(last / 2))}</span>
          <span dir="auto">{dayLabel(last)}</span>
        </div>
      </div>
    </motion.section>
  );
};

export default LeadsChart;
