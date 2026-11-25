import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Button from '../ui/Button';
import PhoneInput from '../ui/PhoneInput';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { phoneCodeErrorKey, sendPhoneCode, verifyPhoneCode } from '../../services/phoneCodeApi';
import { usePhoneCountries } from '../../hooks/usePhoneCountries';
import { checkPhone, deviceCountry, formatPhoneForDisplay, isAbroadPhone, toE164 } from '../../utils/phone';
import { weeklyLimitMessage } from '../../utils/accountPace';

const RESEND_SECONDS = 30;
const CODE_LENGTH = 6;

/** Account's wording says "save again"; here there is no save, only a new code. */
const gateErrorKey = (error: unknown): string => {
  const key = phoneCodeErrorKey(error);
  if (key === 'account.phoneCode.expired') return 'onboarding.phoneGate.expired';
  if (key === 'account.phoneCode.tooManyTries') return 'onboarding.phoneGate.tooManyTries';
  return key;
};

interface PhoneCodeFormProps {
  /** The phone is saved with its proof; the server has decided the free period. */
  onSaved?: () => void;
}

/**
 * The phone and its code, then the save that proves it (LT-360). It was the
 * body of the PhoneGate (LT-500/LT-634), a screen with no way past it; since
 * LT-724 (Erel 2026-11-25) the phone is offered, not demanded, and this form
 * is the body of the two-free-months offer (FreeMonthsOffer).
 *
 * The number, a code by SMS or on WhatsApp, a new code after 30 seconds.
 * LT-677: a number in a country opened abroad is taken too. Its code is always
 * an SMS (no WhatsApp choice), sent only by a tap here, with the same 30
 * seconds before another. The field starts on the device's own country when
 * that one is offered: this owner has no phone yet to go by.
 */
const PhoneCodeForm: React.FC<PhoneCodeFormProps> = ({ onSaved }) => {
  const { t } = useTranslation();
  const { updateUser } = useAuth();
  const { language } = useTheme();
  const { abroad } = usePhoneCountries();
  const [phone, setPhone] = useState('');
  const [codeFor, setCodeFor] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [tried, setTried] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [wait, setWait] = useState(0);
  const codeRef = useRef<HTMLInputElement>(null);
  // One resend at a time: a second tap while the first is on its way asks for nothing.
  const resending = useRef(false);

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
    if (busy || !checkPhone(phone, 'mobile', abroad).valid) return;
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
    if (!codeFor || busy || wait > 0 || resending.current) return;
    resending.current = true;
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
    } finally {
      resending.current = false;
    }
  };

  const confirm = async (value: string) => {
    if (!codeFor || value.length !== CODE_LENGTH || busy) return;
    setBusy(true);
    setError(null);
    try {
      const phoneToken = await verifyPhoneCode(codeFor, value);
      await updateUser({ phone: toE164(codeFor) ?? codeFor, phoneToken });
      setBusy(false);
      onSaved?.();
    } catch (err) {
      setCode('');
      // LT-633: a phone that opened or deleted another account this week waits.
      setError(weeklyLimitMessage(err, t, language) ?? t(gateErrorKey(err)));
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

  return codeFor ? (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        void confirm(code);
      }}
    >
      <p className="text-sm text-center text-gray-600 dark:text-gray-300">
        {t('account.phoneCode.sent', { phone: formatPhoneForDisplay(codeFor) })}
      </p>
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
            {/* A code abroad is an SMS only (LT-677). */}
            {!isAbroadPhone(codeFor) && (
              <button type="button" onClick={() => void resend('whatsapp')} disabled={busy} className="py-1 font-semibold text-primary dark:text-violet-300 disabled:opacity-50">
                {t('onboarding.phoneGate.whatsapp')}
              </button>
            )}
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
        defaultCountry={deviceCountry()}
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
  );
};

export default PhoneCodeForm;
