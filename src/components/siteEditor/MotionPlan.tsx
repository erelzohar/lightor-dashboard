import React, { useEffect, useState } from 'react';
import { Pause } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLeaveGuard } from '../../contexts/LeaveGuardContext';
import { fetchMyEntitlements } from '../../services/entitlementsApi';
import { PLAN_NAMES } from '../../services/paddleApi';
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
 * The paid plans' mark on a moving design's chip. For the eye only: the chip
 * keeps the design's name, and the note under the chips says it in words.
 */
export const PlusMark: React.FC<{ on: boolean }> = ({ on }) => (
  // dir="ltr": on a right-to-left page the plus would stand before the name.
  <span aria-hidden="true" dir="ltr" className={`ms-1.5 rounded-full px-1.5 py-px text-[10px] font-semibold ${on ? 'bg-white/25 text-white' : 'bg-primary/10 text-primary'}`} data-testid="plus-mark">
    {PLAN_NAMES.plus}
  </span>
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
