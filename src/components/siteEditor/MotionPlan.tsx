import React, { useEffect, useState } from 'react';
import { Crown, Pause } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLeaveGuard } from '../../contexts/LeaveGuardContext';
import { fetchMyEntitlements } from '../../services/entitlementsApi';
import { canOfferPurchases } from '../../lib/platform';

/**
 * LT-570: whether the owner's plan holds the moving designs still on the live
 * site (the free plan). False until the answer comes, and on an older API.
 */
export const useMotionHeld = (): boolean => {
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
 * The paid plans' mark on a moving design's chip: a crown (Erel 2026-11-04,
 * "a crown or a diamond" in place of the plan's name). For the eye only: the
 * chip keeps the design's name, and the note under the chips says it in words.
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

/** What the live site shows on the free plan; on the web, the way to the plans (in the app a fact only, LT-130). */
export const MotionNote: React.FC<{ text: string; testId?: string }> = ({ text, testId = 'motion-note' }) => {
  const { t } = useTranslation();
  const { guardLinkClick } = useLeaveGuard();
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-2xl border border-primary/20 bg-primary/5 p-3 text-xs text-gray-600 dark:text-slate-300" data-testid={testId}>
      <Pause className="w-3.5 h-3.5 shrink-0 text-primary" aria-hidden="true" />
      <span>{text}</span>
      {canOfferPurchases() && (
        <Link to="/account" onClick={(e) => guardLinkClick(e, '/account')} className="font-medium text-primary underline">
          {t('siteEditor.motion.upgrade')}
        </Link>
      )}
    </p>
  );
};
