import React, { useState } from 'react';
import { MotionConfig, motion } from 'framer-motion';
import NumberFlow from '@number-flow/react';
import { CheckCheck, Minus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/utils';
import { PLAN_NAMES, type PaidPlan, type UpgradePlan } from '../../services/paddleApi';
import type { PLAN_ROWS } from '../account/PlanCompare';
import { VerticalCutReveal } from './vertical-cut-reveal';

/**
 * LT-512 (Erel 2026-11-01): the plans in the shape of 21st.dev's
 * "pricing-section-3", adapted for Lightor.
 *
 * What changed from the original:
 * - the plans and the rows are Lightor's: the prices are Paddle's, the rows
 *   plain sentences (Erel 2026-11-01), `billing.pricing.rows`. Their numbers
 *   are the server's limits (entitlements.ts), as in PlanCompare: change both;
 * - what a site does decides its rows: bookings, or inquiries (LT-511);
 * - the dashboard's primary colour and dark mode, right-to-left logical
 *   classes, and no scaled card, which would cover its neighbour here;
 * - the "yearly" chip is counted from the two prices;
 * - no blur in the reveal: blur stalls WebKit on phones;
 * - framer-motion, already in the bundle, not `motion` as a second copy;
 * - no `TimelineContent`: `whileInView` does its job.
 *
 * LT-602 (Erel 2026-11-06): the apps show the same cards, with the stores'
 * prices (`StorePlans`): their bookings rows name the booking packs, and each
 * card can carry a note, a badge and a locked button (`cardExtra`).
 */
export interface PricingSectionProps {
  plans: UpgradePlan[];
  leadsSite: boolean;
  /** The page's locale, for the prices. */
  locale: string;
  /** What one extra booking costs, written in the page's language. */
  extraPrice: string;
  /** The price being opened, while the server prepares its checkout. */
  opening: string | null;
  /** The buttons' word: "upgrade", or "subscribe" in the free days. */
  actionLabel: string;
  /** The account is on the free plan itself, not in its free days. */
  onFreePlan: boolean;
  onChoose: (plan: UpgradePlan) => void;
  /** LT-602: sold in the app's store: the paid plans' bookings rows name the booking packs. */
  store?: boolean;
  /** LT-602: what a card adds for the offer it shows: a badge, a note, its button's word, a lock. */
  cardExtra?: (offer: UpgradePlan) => CardExtra | null;
}

export interface CardExtra {
  badge?: React.ReactNode;
  note?: React.ReactNode;
  label?: string;
  icon?: React.ReactNode;
  disabled?: boolean;
}

type Interval = 'month' | 'year';
type Column = 'free' | PaidPlan;
type Row = (typeof PLAN_ROWS)[number];

const PAID_PLANS: PaidPlan[] = ['plus', 'pro'];
// LT-511: a leads site takes no bookings, and sends no booking's texts.
// LT-565: its cards name the products (a products site is a leads site).
const BOOKING_ROWS: Row[] = ['bookings', 'texts', 'siteLighty', 'pictures', 'editing', 'aiModel', 'history', 'badge'];
const LEAD_ROWS: Row[] = ['inquiries', 'services', 'products', 'siteLighty', 'pictures', 'editing', 'aiModel', 'history', 'badge'];

const reveal = {
  hidden: { opacity: 0, y: -16 },
  visible: (order: number) => ({ opacity: 1, y: 0, transition: { delay: order * 0.12, duration: 0.4 } }),
};

const PricingSwitch: React.FC<{ interval: Interval; months: number; onChange: (interval: Interval) => void }> = ({
  interval,
  months,
  onChange,
}) => {
  const { t } = useTranslation();
  const options: { value: Interval; label: string }[] = [
    { value: 'month', label: t('billing.pricing.monthly') },
    { value: 'year', label: t('billing.pricing.yearly') },
  ];
  return (
    <div
      role="group"
      aria-label={t('billing.pricing.title')}
      className="relative z-10 flex w-fit rounded-full border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-1"
    >
      {options.map(({ value, label }) => (
        <button
          key={value}
          type="button"
          aria-pressed={interval === value}
          onClick={() => onChange(value)}
          className={cn(
            'relative h-10 rounded-full px-4 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary',
            interval === value ? 'text-white' : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
          )}
        >
          {interval === value && (
            <motion.span
              layoutId="pricing-switch"
              className="absolute inset-0 rounded-full bg-primary shadow-sm"
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            />
          )}
          <span className="relative flex items-center gap-2">
            {label}
            {value === 'year' && months > 0 && (
              <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', interval === 'year' ? 'bg-white/20 text-white' : 'bg-primary/10 text-primary dark:text-white')}>
                {t('billing.pricing.saveMonths', { months })}
              </span>
            )}
          </span>
        </button>
      ))}
    </div>
  );
};

const PricingSection: React.FC<PricingSectionProps> = ({
  plans,
  leadsSite,
  locale,
  extraPrice,
  opening,
  actionLabel,
  onFreePlan,
  onChoose,
  store = false,
  cardExtra,
}) => {
  const { t } = useTranslation();
  const [interval, setInterval] = useState<Interval>('month');

  const offer = (plan: PaidPlan, every: Interval) => plans.find((item) => item.plan === plan && (item.interval ?? 'month') === every);
  const paid = PAID_PLANS.filter((plan) => offer(plan, 'month') || offer(plan, 'year'));
  const shown = paid.some((plan) => offer(plan, 'year')) ? interval : 'month';
  const currency = plans.find((item) => item.currency)?.currency ?? 'ILS';
  const rows = leadsSite ? LEAD_ROWS : BOOKING_ROWS;

  // What a year saves, from the prices themselves, so the chip cannot go stale.
  const monthly = offer('plus', 'month')?.amount;
  const yearly = offer('plus', 'year')?.amount;
  const monthsFree = monthly && yearly ? Math.round(12 - yearly / monthly) : 0;

  const price = (amount: number) => (
    <NumberFlow
      value={amount}
      locales={locale}
      format={{ style: 'currency', currency, maximumFractionDigits: Number.isInteger(amount) ? 0 : 2 }}
      className="text-4xl font-semibold"
    />
  );

  const card = (column: Column, order: number) => {
    const chosen = column === 'free' ? undefined : offer(column, shown);
    const extra = chosen && cardExtra ? cardExtra(chosen) : null;
    // Erel 2026-11-01: Pro, as the best value.
    const highlighted = column === 'pro';
    return (
      <motion.div
        key={column}
        custom={order + 1}
        variants={reveal}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        data-testid={`pricing-card-${column}`}
        className={cn(
          'flex flex-col justify-between gap-4 rounded-xl p-4',
          highlighted
            ? 'bg-gradient-to-t from-primary-dark to-primary text-white ring-2 ring-primary shadow-lg'
            : 'text-gray-900 dark:text-white'
        )}
      >
        <div>
          <div className="flex min-h-7 items-center justify-between gap-2">
            <h3 className="text-xl font-semibold">
              {column === 'free' ? t('billing.compare.free') : <bdi>{PLAN_NAMES[column]}</bdi>}
            </h3>
            {highlighted && (
              <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-medium">
                {t('billing.pricing.bestValue')}
              </span>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-baseline gap-1">
            {column === 'free' ? (
              price(0)
            ) : chosen?.amount != null ? (
              price(chosen.amount)
            ) : (
              <span className="text-4xl font-semibold">{chosen?.formatted}</span>
            )}
            {column !== 'free' && (
              <span className={cn('text-sm', highlighted ? 'text-white' : 'text-gray-600 dark:text-gray-300')}>
                {' / '}
                {t(`billing.per_${shown}`)}
              </span>
            )}
          </div>
          <p className={cn('mt-2 text-sm lg:min-h-10', highlighted ? 'text-white' : 'text-gray-600 dark:text-gray-300')}>
            {t(`billing.pricing.desc.${column}`)}
          </p>
          <div className={cn('mt-4 border-t pt-3', highlighted ? 'border-white/30' : 'border-gray-300 dark:border-gray-600')}>
            <h4 className="mb-2 text-sm font-medium">{t('billing.pricing.includes')}</h4>
            <ul className="space-y-2">
              {rows.map((row) => {
                // A row the free plan does not have reads as such at a glance.
                const missing = column === 'free' && (row === 'siteLighty' || row === 'badge');
                const Icon = missing ? Minus : CheckCheck;
                return (
                  <li key={row} className="flex items-start gap-2 text-sm">
                    <span
                      className={cn(
                        'mt-0.5 grid h-5 w-5 shrink-0 place-content-center rounded-full',
                        highlighted ? 'bg-white/20 text-white' : 'border border-gray-300 dark:border-gray-600 text-primary dark:text-white'
                      )}
                    >
                      <Icon className="h-3 w-3" aria-hidden="true" />
                    </span>
                    <span className={highlighted ? 'text-white' : 'text-gray-700 dark:text-gray-200'}>
                      {t(`billing.pricing.rows.${row}.${store && row === 'bookings' && column !== 'free' ? `${column}Store` : column}`, { price: extraPrice })}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
        {chosen ? (
          <div className="space-y-3">
            {extra?.badge}
            {extra?.note && (
              <p className={cn('text-xs leading-5', highlighted ? 'text-white' : 'text-gray-600 dark:text-gray-300')}>{extra.note}</p>
            )}
            <button
              type="button"
              onClick={() => onChoose(chosen)}
              disabled={opening !== null || !!extra?.disabled}
              data-testid={`pricing-buy-${column}`}
              className={cn(
                'flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 font-semibold transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary disabled:opacity-60',
                highlighted
                  ? 'bg-white text-primary-dark shadow-md hover:opacity-90'
                  : 'bg-gradient-to-t from-gray-900 to-gray-700 text-white shadow-md hover:opacity-90 dark:from-white dark:to-gray-200 dark:text-gray-900'
              )}
            >
              {opening === chosen.priceId ? t('billing.opening') : (
                <>
                  {extra?.icon}
                  {extra?.label ?? actionLabel}
                </>
              )}
            </button>
          </div>
        ) : column === 'free' && onFreePlan ? (
          <p className="py-3 text-center text-sm font-medium text-gray-600 dark:text-gray-300" data-testid="pricing-current">
            {t('billing.pricing.current')}
          </p>
        ) : null}
      </motion.div>
    );
  };

  return (
    // The user's "reduce motion" setting holds the reveal and the switch too; NumberFlow reads it itself.
    <MotionConfig reducedMotion="user">
      <div className="space-y-4" data-testid="pricing-section">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-2xl font-medium text-gray-900 dark:text-white">
              <VerticalCutReveal>{t('billing.pricing.title')}</VerticalCutReveal>
            </h3>
            <motion.p
              custom={0}
              variants={reveal}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              className="mt-1 text-sm text-gray-600 dark:text-gray-300"
            >
              {t('billing.pricing.subtitle')}
            </motion.p>
          </div>
          {paid.some((plan) => offer(plan, 'year')) && (
            <PricingSwitch interval={interval} months={monthsFree} onChange={setInterval} />
          )}
        </div>
        <div className="grid gap-2 rounded-2xl bg-gradient-to-b from-gray-100 to-gray-200 dark:from-gray-800/70 dark:to-gray-900/70 p-2 sm:p-3 lg:grid-cols-3">
          {(['free', ...paid] as Column[]).map(card)}
        </div>
      </div>
    </MotionConfig>
  );
};

export default PricingSection;
