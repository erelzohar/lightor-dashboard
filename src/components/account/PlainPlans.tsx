import React from 'react';
import { useTranslation } from 'react-i18next';
import Button from '../ui/Button';
import { PLAN_NAMES } from '../../services/paddleApi';
import type { PricingSectionProps } from '../ui/pricing-section-3';

/**
 * The plans with nothing to load (LT-512): when the pricing section's chunk
 * cannot be fetched (lazyOr), the owner can still see the prices and pay.
 */
const PlainPlans: React.FC<PricingSectionProps> = ({ plans, opening, actionLabel, onChoose }) => {
  const { t } = useTranslation();
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {plans.map((plan) => (
        <div
          key={plan.priceId}
          className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 flex flex-col gap-2"
        >
          <span className="text-sm font-medium text-gray-900 dark:text-white">
            <bdi>{PLAN_NAMES[plan.plan]}</bdi>
          </span>
          <span className="text-2xl font-bold text-gray-900 dark:text-white">
            {plan.formatted}
            {plan.interval && (
              <span className="text-sm font-normal text-gray-500">
                {' / '}
                {t(`billing.per_${plan.interval}`)}
              </span>
            )}
          </span>
          <Button variant="primary" onClick={() => onChoose(plan)} disabled={opening !== null}>
            {opening === plan.priceId ? t('billing.opening') : actionLabel}
          </Button>
        </div>
      ))}
    </div>
  );
};

export default PlainPlans;
