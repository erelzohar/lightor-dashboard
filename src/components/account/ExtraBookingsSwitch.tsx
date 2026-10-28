import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import type { AxiosError } from 'axios';
import ToggleSwitch from '../ui/ToggleSwitch';
import ConfirmDialog from '../ui/ConfirmDialog';
import { BookingsMeter, setExtraBookings } from '../../services/entitlementsApi';

interface ExtraBookingsSwitchProps {
  bookings: BookingsMeter;
  /** What one extra booking costs, written in the page's language. */
  price: string;
  /** The day the next period starts, written in the page's language. */
  periodEnd: string | null;
  dateLocale: string;
  canSell: boolean;
  onChanged: (bookings: BookingsMeter) => void;
}

/**
 * Lightor+'s extra bookings, the owner's choice (LT-465, Erel 2026-10-28):
 * on, every booking over the period's 500 is taken and billed automatically;
 * off (the default), the site stops taking bookings at 500 until the next
 * period. Turning on is agreeing to pay more, so the app only turns it off
 * and states the rest (LT-130).
 */
const ExtraBookingsSwitch: React.FC<ExtraBookingsSwitchProps> = ({
  bookings,
  price,
  periodEnd,
  dateLocale,
  canSell,
  onChanged,
}) => {
  const { t } = useTranslation();
  // The value waiting for the owner's yes.
  const [asking, setAsking] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const extras = bookings.extras;
  // Nothing to choose while nothing is charged for anyone, or with no subscription.
  if (!extras || extras.blockedBy === 'billingOff' || extras.blockedBy === 'notSubscribed') return null;

  const included = bookings.included;
  const extra = Math.max(0, bookings.used - included);
  const canTurnOn = canSell && extras.blockedBy === null;
  const changedOn = extras.changedAt ? new Date(extras.changedAt).toLocaleDateString(dateLocale) : null;

  const save = async (on: boolean) => {
    setSaving(true);
    try {
      const next = await setExtraBookings(on);
      if (next) onChanged(next);
      setAsking(null);
      toast.success(t(on ? 'billing.extras.turnedOn' : 'billing.extras.turnedOff'));
    } catch (error) {
      const code = (error as AxiosError<{ code?: string }>)?.response?.data?.code;
      setAsking(null);
      toast.error(t(code === 'CANCEL_SCHEDULED' ? 'billing.extras.cancelScheduled' : 'billing.extras.failed'));
    } finally {
      setSaving(false);
    }
  };

  // Turning on always asks; turning off asks only when it closes booking at once.
  const pick = (on: boolean) => {
    if (on || bookings.used >= included) setAsking(on);
    else void save(false);
  };

  return (
    <div className="space-y-2 rounded-lg border border-gray-200 dark:border-gray-700 p-3" data-testid="extras-switch">
      {extras.chosen || canTurnOn ? (
        <ToggleSwitch
          checked={extras.chosen}
          onChange={pick}
          disabled={saving}
          label={t('billing.extras.label')}
          ariaLabel={t('billing.extras.label')}
        />
      ) : (
        <p className="text-sm font-medium text-gray-800 dark:text-gray-100">
          {t('billing.extras.label')}: {t('billing.extras.offShort')}
        </p>
      )}
      <p className="text-xs text-gray-600 dark:text-gray-300">
        {extras.on
          ? t('billing.extras.onDesc', { included, price })
          : canTurnOn
            ? t('billing.extras.offDesc', { included, price })
            : t('billing.extras.offDescNative', { included })}
      </p>
      {extras.chosen && extras.blockedBy === 'cancelScheduled' && (
        <p className="text-xs text-amber-700 dark:text-amber-300">{t('billing.extras.heldByCancel', { included })}</p>
      )}
      {extras.closed && (
        <p className="text-xs font-medium text-red-600 dark:text-red-400" data-testid="extras-closed">
          {canTurnOn
            ? t('billing.extras.closedDesc', { included, date: periodEnd })
            : t('billing.extras.closedDescNative', { included, date: periodEnd })}
        </p>
      )}
      {changedOn && (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {t(extras.chosen ? 'billing.extras.onSince' : 'billing.extras.offSince', { date: changedOn })}
        </p>
      )}
      <ConfirmDialog
        open={asking !== null}
        title={t(asking ? 'billing.extras.confirmOnTitle' : 'billing.extras.confirmOffTitle')}
        message={
          asking
            ? t('billing.extras.confirmOnBody', { included, price })
            : extra > 0
              ? t('billing.extras.confirmOffBodyExtra', { date: periodEnd, n: extra })
              : t('billing.extras.confirmOffBody', { date: periodEnd })
        }
        confirmLabel={t(asking ? 'billing.extras.confirmOn' : 'billing.extras.confirmOff')}
        loading={saving}
        onConfirm={() => void save(asking === true)}
        onClose={() => !saving && setAsking(null)}
      />
    </div>
  );
};

export default ExtraBookingsSwitch;
