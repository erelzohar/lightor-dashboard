import React, { useEffect, useState } from 'react';
import { Crown } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLeaveGuard } from '../../contexts/LeaveGuardContext';
import { fetchMyEntitlements } from '../../services/entitlementsApi';
import { canOfferPurchases } from '../../lib/platform';

/**
 * LT-570: whether the owner's plan is without the paid designs (the free
 * one), whose site shows their sections' defaults. False until the answer
 * comes, and on an older API.
 */
export const usePaidDesignsHeld = (): boolean => {
  const [held, setHeld] = useState(false);
  useEffect(() => {
    let alive = true;
    void fetchMyEntitlements().then((e) => {
      if (alive && e?.limits?.motionDesigns === false) setHeld(true);
    });
    return () => { alive = false; };
  }, []);
  return held;
};

/**
 * The paid designs' mark on a chip: a crown (Erel 2026-11-04, "a crown or a
 * diamond" in place of the plan's name). For the eye only: the chip keeps the
 * design's name, and the note under the chips says it in words.
 */
export const PaidMark: React.FC<{ on: boolean }> = ({ on }) => (
  <Crown
    aria-hidden="true"
    data-testid="paid-mark"
    className={`ms-1.5 inline-block h-3.5 w-3.5 align-[-2px] ${on ? 'text-amber-200' : 'text-amber-500 dark:text-amber-400'}`}
    fill="currentColor"
    strokeWidth={1.5}
  />
);

/** A paid design, tapped on the free plan: where it is, and the way to the plans. Never in the app (LT-130). */
export const PaidNote: React.FC = () => {
  const { t } = useTranslation();
  const { guardLinkClick } = useLeaveGuard();
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-2xl border border-amber-300/60 bg-amber-50 p-3 text-xs text-gray-700 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-slate-200" data-testid="paid-note" role="status">
      <Crown className="w-3.5 h-3.5 shrink-0 text-amber-500 dark:text-amber-400" fill="currentColor" strokeWidth={1.5} aria-hidden="true" />
      <span>{t('siteEditor.paidDesign.note')}</span>
      {canOfferPurchases() && (
        <Link to="/account" onClick={(e) => guardLinkClick(e, '/account')} className="font-medium text-primary underline">
          {t('siteEditor.paidDesign.upgrade')}
        </Link>
      )}
    </p>
  );
};
