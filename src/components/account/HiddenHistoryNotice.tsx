import React, { useEffect, useState } from 'react';
import { History } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { fetchMyEntitlements } from '../../services/entitlementsApi';
import { canOfferPurchases } from '../../lib/platform';

/**
 * LT-521: older bookings or leads wait behind the plan. Says how many, and on
 * the web that an upgrade brings them back; the app states the fact (LT-130).
 */
const HiddenHistoryNotice: React.FC<{ kind: 'bookings' | 'leads' }> = ({ kind }) => {
  const { t } = useTranslation();
  const [count, setCount] = useState(0);

  useEffect(() => {
    let alive = true;
    void fetchMyEntitlements().then((entitlements) => {
      if (alive) setCount(entitlements?.hiddenHistory?.[kind] ?? 0);
    });
    return () => { alive = false; };
  }, [kind]);

  if (!count) return null;
  return (
    <p className="flex flex-wrap items-center gap-2 rounded-2xl border border-primary/20 bg-primary/5 p-3 text-sm text-gray-600 dark:text-gray-300" data-testid="hidden-history">
      <History className="w-4 h-4 shrink-0 text-primary" aria-hidden="true" />
      {t(`billing.hiddenHistory.${kind}`, { n: count })}
      {canOfferPurchases() && (
        <Link to="/account" className="font-medium text-primary underline">
          {t('billing.hiddenHistory.upgrade')}
        </Link>
      )}
    </p>
  );
};

export default HiddenHistoryNotice;
