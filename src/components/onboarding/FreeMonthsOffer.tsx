import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { Gift, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import Button from '../ui/Button';
import PhoneCodeForm from './PhoneCodeForm';
import { useAuth } from '../../contexts/AuthContext';
import { useAppSelector } from '../../hooks/useAppSelector';
import { useDialogFocus } from '../../hooks/useDialogFocus';
import { FreeMonthsOfferContext, markOfferedHere, offeredHere, rememberLater, saidLater } from './freeMonthsMemory';

/**
 * LT-724 (Erel 2026-11-25): the phone is optional. An account works without
 * one on the free plan; proving a phone by code is what starts the two free
 * months of Lightor+, and it is offered, not demanded:
 *  - a popup once the owner is in and has a site, with "later" (Escape and
 *    the close control say "later" too), remembered in this browser for this
 *    account;
 *  - after "later", a standing banner in the layout's banner slot until the
 *    phone is proven (FreeMonthsBanner, drawn by AccountBanners; it lives in
 *    its own light file; the context that opens this popup is in freeMonthsMemory).
 * Without a phone the site shows no call / WhatsApp buttons and booking
 * alerts go by email only, and the popup says so.
 *
 * Like the app-lock offer (LT-617), the popup waits for any open dialog or
 * page tour (both marked aria-modal) to close, and the page tours wait for
 * it the same way.
 */

/** A beat after the dashboard opens, so the page (and a page tour) is up first. */
const OFFER_AFTER_MS = 2000;
/** While another dialog or a page tour is open, look again this often. */
const RETRY_MS = 1500;

type Step = 'intro' | 'phone';

interface DialogProps {
  step: Step;
  onVerify: () => void;
  onLater: () => void;
  onSaved: () => void;
}

/** The popup itself: the offer, then the phone and its code. */
export const FreeMonthsOfferDialog: React.FC<DialogProps> = ({ step, onVerify, onLater, onSaved }) => {
  const { t } = useTranslation();
  const titleId = useId();
  const bodyId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  useDialogFocus(true, panelRef, onLater);

  // On the phone step the field takes the focus the "verify now" button had.
  useEffect(() => {
    if (step === 'phone') panelRef.current?.querySelector<HTMLInputElement>('input')?.focus();
  }, [step]);

  return createPortal(
    <div className="lt-ui fixed inset-0 z-[10040] flex items-center justify-center overflow-y-auto bg-black/60 p-4 overlay-safe">
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        tabIndex={-1}
        data-testid="free-months-offer"
        data-step={step}
        className="glass-modal relative rounded-3xl w-full max-w-md p-6 sm:p-8 space-y-5 outline-none"
      >
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 mb-3">
            <Gift size={26} className="text-primary" aria-hidden="true" />
          </div>
          <h2 id={titleId} className="text-xl font-bold text-gray-900 dark:text-dark-text">
            {t('onboarding.freeMonths.title')}
          </h2>
          <div id={bodyId}>
            <p className="text-sm text-gray-600 dark:text-gray-300 mt-1.5">{t('onboarding.freeMonths.body')}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">{t('onboarding.freeMonths.note')}</p>
          </div>
        </div>

        {step === 'phone' ? (
          <PhoneCodeForm onSaved={onSaved} />
        ) : (
          <Button type="button" fullWidth onClick={onVerify}>
            {t('onboarding.freeMonths.verifyNow')}
          </Button>
        )}

        <div className="flex justify-center">
          <button
            type="button"
            onClick={onLater}
            className="py-1 px-3 rounded-xl text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5"
          >
            {t('onboarding.freeMonths.later')}
          </button>
        </div>

        {/* Last in the order, so the focus starts on the offer's own button. */}
        <button
          type="button"
          onClick={onLater}
          aria-label={t('onboarding.freeMonths.close')}
          className="absolute top-3 end-3 p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5"
        >
          <X className="w-5 h-5" aria-hidden="true" />
        </button>
      </div>
    </div>,
    document.body
  );
};

interface ProviderProps {
  /** Off under the first-run welcome card. */
  enabled: boolean;
  /** How long the dashboard gets before the popup comes (tests pass 0). */
  delayMs?: number;
  children: React.ReactNode;
}

export const FreeMonthsOfferProvider: React.FC<ProviderProps> = ({ enabled, delayMs = OFFER_AFTER_MS, children }) => {
  const { t } = useTranslation();
  const { auth } = useAuth();
  const { pathname } = useLocation();
  const hasSite = !!useAppSelector((state) => state.webConfig.data)?.businessName;
  const user = auth.user;
  const userId = user?._id ?? '';
  const freePeriodState = user?.freePeriod?.state;

  // The account waits for its phone: not an admin, and a site already built.
  const eligible = !!user && user.role !== 'admin' && freePeriodState === 'pending' && hasSite;
  const [step, setStep] = useState<Step | null>(null);
  const [later, setLater] = useState(() => (userId ? saidLater(userId) : false));
  useEffect(() => {
    setLater(userId ? saidLater(userId) : false);
  }, [userId]);

  // By itself once: not in the site builder, not under the welcome card, not after "later".
  const autoWanted = eligible && enabled && pathname !== '/design' && !later;
  useEffect(() => {
    if (!autoWanted || offeredHere(userId)) return undefined;
    let timer = 0;
    const offer = () => {
      if (document.querySelector('[aria-modal="true"]')) {
        timer = window.setTimeout(offer, RETRY_MS);
        return;
      }
      markOfferedHere(userId);
      setStep('intro');
    };
    timer = window.setTimeout(offer, delayMs);
    return () => window.clearTimeout(timer);
  }, [autoWanted, userId, delayMs]);

  // A proven phone: the server has said whether the free months start. The
  // account's new state may reach here before the save's promise or after it.
  const proven = useRef(false);
  const stateNow = useRef(freePeriodState);
  const settle = useCallback(() => {
    const state = stateNow.current;
    if (!proven.current || !state || state === 'pending') return;
    proven.current = false;
    setStep(null);
    if (state === 'granted') toast.success(t('onboarding.freeMonths.started'));
    else toast(t('billing.freePeriodUsed'));
  }, [t]);
  useEffect(() => {
    stateNow.current = freePeriodState;
    settle();
  }, [freePeriodState, settle]);

  const close = useCallback(() => {
    setStep(null);
    if (userId) rememberLater(userId);
    setLater(true);
  }, [userId]);

  const openPhone = useCallback(() => setStep('phone'), []);
  const value = useMemo(() => ({ bannerShown: eligible && step === null, openPhone }), [eligible, step, openPhone]);

  return (
    <FreeMonthsOfferContext.Provider value={value}>
      {children}
      {eligible && step && (
        <FreeMonthsOfferDialog
          step={step}
          onVerify={() => setStep('phone')}
          onLater={close}
          onSaved={() => {
            proven.current = true;
            settle();
          }}
        />
      )}
    </FreeMonthsOfferContext.Provider>
  );
};
