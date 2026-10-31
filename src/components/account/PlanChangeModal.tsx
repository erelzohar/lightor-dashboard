import React from 'react';
import { useTranslation } from 'react-i18next';
import Button from '../ui/Button';
import { PLAN_NAMES, type PaidPlan, type PlanChange } from '../../services/paddleApi';

interface PlanChangeModalProps {
  plan: PaidPlan;
  change: PlanChange;
  money: (amount: number, currency: string) => string;
  dateLocale: string;
  moving: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

/**
 * LT-504: what a move between the plans costs, in Paddle's own numbers, before
 * the owner confirms. Up is charged today; down changes now and the rest of the
 * period is credited on the next charge; in the free days with a card nothing
 * is charged, the first charge is simply the new plan's.
 */
const PlanChangeModal: React.FC<PlanChangeModalProps> = ({ plan, change, money, dateLocale, moving, onConfirm, onClose }) => {
  const { t } = useTranslation();
  const currency = change.currency ?? 'ILS';
  const nextDate = change.nextBilledAt ? new Date(change.nextBilledAt).toLocaleDateString(dateLocale) : null;
  const note = plan === 'plus' ? 'billing.change.noteDown' : change.chargedNow > 0 ? 'billing.change.noteUp' : 'billing.change.noteFree';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overlay-safe"
      onClick={() => !moving && onClose()}
    >
      <div
        className="w-full max-w-md rounded-2xl glass-modal p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="plan-change-title"
        data-testid="plan-change-modal"
      >
        <h3 id="plan-change-title" className="text-lg font-semibold text-gray-900 dark:text-white">
          {t('billing.change.title')} <bdi>{PLAN_NAMES[plan]}</bdi>
        </h3>
        <dl className="text-sm text-gray-700 dark:text-gray-200 space-y-1">
          {change.chargedNow > 0 && (
            <div className="flex items-baseline justify-between gap-3">
              <dt>{t('billing.change.chargedNow')}</dt>
              <dd className="font-semibold" data-testid="plan-change-now">{money(change.chargedNow, currency)}</dd>
            </div>
          )}
          {nextDate && change.nextCharge > 0 && (
            <div className="flex items-baseline justify-between gap-3">
              <dt>{t('billing.change.nextCharge', { date: nextDate })}</dt>
              <dd className="font-semibold" data-testid="plan-change-next">{money(change.nextCharge, currency)}</dd>
            </div>
          )}
          {change.recurring > 0 && (
            <div className="flex items-baseline justify-between gap-3">
              <dt>{t('billing.change.recurring')}</dt>
              <dd className="font-semibold" data-testid="plan-change-recurring">{money(change.recurring, currency)}</dd>
            </div>
          )}
        </dl>
        <p className="text-sm text-gray-600 dark:text-gray-300">{t(note)}</p>
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" onClick={onClose} disabled={moving}>
            {t('billing.change.keep')}
          </Button>
          <Button variant="primary" onClick={onConfirm} disabled={moving}>
            {moving ? t('billing.opening') : t('billing.change.confirm')}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default PlanChangeModal;
