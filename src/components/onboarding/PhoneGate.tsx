import React, { useEffect, useId, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Smartphone } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Button from '../ui/Button';
import PhoneInput from '../ui/PhoneInput';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { phoneCodeErrorKey, sendPhoneCode, verifyPhoneCode } from '../../services/phoneCodeApi';
import { checkPhone, formatPhoneForDisplay, toE164 } from '../../utils/phone';

const RESEND_SECONDS = 30;
const CODE_LENGTH = 6;

/** Account's wording says "save again"; here there is no save, only a new code. */
const gateErrorKey = (error: unknown): string => {
  const key = phoneCodeErrorKey(error);
  if (key === 'account.phoneCode.expired') return 'onboarding.phoneGate.expired';
  if (key === 'account.phoneCode.tooManyTries') return 'onboarding.phoneGate.tooManyTries';
  return key;
};

/**
 * LT-500 (Erel: right after signup, before the site is built): an account
 * made by Apple or Google sign-in has no proven phone, so the first thing it
 * meets is this step, the signup's own (LT-360): the number, a code by SMS or
 * on WhatsApp, a new code after 30 seconds. No way past it but the code, or
 * logging out. The save proves the phone and decides the free period, and
 * the Layout then opens the site builder.
 *
 * LT-502: `onLater` adds a "later" for the iOS app, where App Review may refuse
 * a required phone after Sign in with Apple. It holds for this launch.
 */
const PhoneGate: React.FC<{ onLater?: () => void }> = ({ onLater }) => {
  const { t } = useTranslation();
  const { logout, updateUser } = useAuth();
  const { language } = useTheme();
  const titleId = useId();
  const [phone, setPhone] = useState('');
  const [codeFor, setCodeFor] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [tried, setTried] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [wait, setWait] = useState(0);
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (wait <= 0) return;
    const tick = setTimeout(() => setWait((s) => s - 1), 1000);
    return () => clearTimeout(tick);
  }, [wait]);

  useEffect(() => {
    if (codeFor) codeRef.current?.focus();
  }, [codeFor]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    setTried(true);
    if (busy || !checkPhone(phone, 'mobile').valid) return;
    setBusy(true);
    setError(null);
    try {
      await sendPhoneCode(phone, 'sms', language);
      setCodeFor(phone);
      setCode('');
      setNote(null);
      setWait(RESEND_SECONDS);
    } catch (err) {
      setError(t(gateErrorKey(err)));
    } finally {
      setBusy(false);
    }
  };

  const resend = async (channel: 'sms' | 'whatsapp') => {
    if (!codeFor || busy || wait > 0) return;
    setError(null);
    setNote(null);
    try {
      await sendPhoneCode(codeFor, channel, language);
      setWait(RESEND_SECONDS);
      setCode('');
      setNote(t('onboarding.phoneGate.sentAgain'));
      codeRef.current?.focus();
    } catch (err) {
      setError(t(gateErrorKey(err)));
    }
  };

  const confirm = async (value: string) => {
    if (!codeFor || value.length !== CODE_LENGTH || busy) return;
    setBusy(true);
    setError(null);
    try {
      const phoneToken = await verifyPhoneCode(codeFor, value);
      // Once saved the account has its phone, and the Layout takes this away.
      await updateUser({ phone: toE164(codeFor) ?? codeFor, phoneToken });
    } catch (err) {
      setCode('');
      setError(t(gateErrorKey(err)));
      setBusy(false);
    }
  };

  const changeNumber = () => {
    setCodeFor(null);
    setCode('');
    setError(null);
    setNote(null);
    setTried(false);
  };

  return (
    <motion.div
      className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-black/60 p-4 overlay-safe"
      exit={{ opacity: 0, transition: { duration: 0.15 } }}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-testid="phone-gate"
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className="glass-modal rounded-3xl w-full max-w-md p-6 sm:p-8 space-y-5"
      >
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 mb-3">
            <Smartphone size={26} className="text-primary" aria-hidden="true" />
          </div>
          <h1 id={titleId} className="text-xl font-bold text-gray-900 dark:text-dark-text">
            {t('onboarding.phoneGate.title')}
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-300 mt-1.5">
            {codeFor
              ? t('account.phoneCode.sent', { phone: formatPhoneForDisplay(codeFor) })
              : t('onboarding.phoneGate.body')}
          </p>
        </div>

        {codeFor ? (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              void confirm(code);
            }}
          >
            <label htmlFor="phone-gate-code" className="sr-only">{t('account.phoneCode.label')}</label>
            <input
              ref={codeRef}
              id="phone-gate-code"
              dir="ltr"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={CODE_LENGTH}
              value={code}
              disabled={busy}
              onChange={(e) => {
                const digits = e.target.value.replace(/\D/g, '').slice(0, CODE_LENGTH);
                setCode(digits);
                setError(null);
                if (digits.length === CODE_LENGTH) void confirm(digits);
              }}
              placeholder="••••••"
              className="w-full py-3 rounded-xl text-2xl text-center font-bold tracking-[0.5em] border border-gray-200 dark:border-gray-700/80 bg-white dark:bg-dark-surface text-gray-800 dark:text-gray-100 placeholder-gray-300 dark:placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
            {error && <p className="text-sm text-center text-red-600 dark:text-red-400" role="alert">{error}</p>}
            {!error && note && <p className="text-sm text-center text-gray-600 dark:text-gray-300" role="status">{note}</p>}
            <Button type="submit" fullWidth isLoading={busy} disabled={code.length !== CODE_LENGTH}>
              {t('onboarding.phoneGate.confirm')}
            </Button>
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-sm">
              <button type="button" onClick={changeNumber} disabled={busy} className="py-1 font-semibold text-gray-600 dark:text-gray-300 disabled:opacity-50">
                {t('onboarding.phoneGate.changePhone')}
              </button>
              {wait > 0 ? (
                <span className="text-gray-500 dark:text-gray-400">{t('onboarding.phoneGate.resendIn', { s: wait })}</span>
              ) : (
                <span className="flex items-center gap-3">
                  <button type="button" onClick={() => void resend('sms')} disabled={busy} className="py-1 font-semibold text-primary dark:text-violet-300 disabled:opacity-50">
                    {t('onboarding.phoneGate.resend')}
                  </button>
                  <button type="button" onClick={() => void resend('whatsapp')} disabled={busy} className="py-1 font-semibold text-primary dark:text-violet-300 disabled:opacity-50">
                    {t('onboarding.phoneGate.whatsapp')}
                  </button>
                </span>
              )}
            </div>
          </form>
        ) : (
          <form className="space-y-3" onSubmit={(e) => void send(e)} noValidate>
            <PhoneInput
              label={t('onboarding.phoneGate.label')}
              name="phone"
              accept="mobile"
              value={phone}
              showError={tried}
              onChange={(value) => {
                setPhone(value);
                setError(null);
              }}
              required
            />
            {error && <p className="text-sm text-center text-red-600 dark:text-red-400" role="alert">{error}</p>}
            <Button type="submit" fullWidth isLoading={busy}>
              {t('onboarding.phoneGate.send')}
            </Button>
          </form>
        )}

        <div className="flex items-center justify-center gap-5">
          {onLater && (
            <button type="button" onClick={onLater} disabled={busy} className="py-1 text-sm font-semibold text-gray-600 dark:text-gray-300 disabled:opacity-50">
              {t('onboarding.phoneGate.later')}
            </button>
          )}
          <button type="button" onClick={logout} disabled={busy} className="py-1 text-sm text-gray-500 dark:text-gray-400 disabled:opacity-50">
            {t('onboarding.phoneGate.logout')}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default PhoneGate;
