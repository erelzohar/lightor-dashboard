import React from 'react';
import { Gift } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/**
 * LT-724: the two free months' banner, drawn by AccountBanners when the
 * offer (FreeMonthsOffer, in the Layout) says it is its turn.
 */
/** The standing banner, after "later", until the phone is proven. */
const FreeMonthsBanner: React.FC<{ onVerify: () => void }> = ({ onVerify }) => {
  const { t } = useTranslation();
  return (
    <div
      role="status"
      data-testid="free-months-banner"
      className="lt-ui mb-4 glass-card glass-tint-primary rounded-3xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
    >
      <div className="flex items-center gap-3">
        <div className="p-2 bg-primary/15 rounded-full text-primary shrink-0">
          <Gift className="w-5 h-5" aria-hidden="true" />
        </div>
        <p className="font-semibold text-gray-800 dark:text-gray-100 text-sm">{t('onboarding.freeMonths.banner')}</p>
      </div>
      <button
        type="button"
        onClick={onVerify}
        className="shrink-0 flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors bg-primary hover:bg-primary-dark text-white"
      >
        {t('onboarding.freeMonths.verifyNow')}
      </button>
    </div>
  );
};

export default FreeMonthsBanner;
