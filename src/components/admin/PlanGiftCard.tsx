import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { AlertTriangle, Gift, Trash2 } from 'lucide-react';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Select from '../ui/Select';
import ConfirmDialog from '../ui/ConfirmDialog';
import { removeUserPlan, setUserPlan, type AdminPlanGift, type AdminSubscription } from '../../services/adminApi';

/**
 * LT-662 (Erel 2026-11-15: "אני פשוט רוצה שתהיה לי אופציה לבחור משתמש במסך
 * האדמין ולהעביר אותו בין מנויים"): the operator moves the account to
 * Lightor+ or Pro by hand, until a date or until he changes it. Nothing is
 * billed; the account gets the better of its own plan and this one, and the
 * owner sees it as any plan. Removing it puts the account back on its own.
 */
interface PlanGiftCardProps {
  userId: string;
  userName: string;
  /** The plan set by hand while it runs (the detail endpoint's `planGift`). */
  gift: AdminPlanGift | null;
  /** The account's own subscription: a paying one is warned about. */
  subscription?: AdminSubscription;
  /** Re-reads the page after a change. */
  onChanged: () => void | Promise<void>;
}

type Duration = 'changed' | 'date';

const DATE_INPUT =
  'w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700/80 bg-white dark:bg-dark-surface ' +
  'text-sm text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary';

/** A local day as YYYY-MM-DD, what a date field holds. */
const dayOf = (date: Date): string => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

const BILLERS: Record<string, string> = { paddle: 'Paddle', apple: 'App Store', google: 'Google Play' };

/** The server's own words for a refusal (an end already past, the operator's account). */
const serverMessage = (error: unknown): string | undefined => {
  const data = (error as { response?: { data?: { error?: unknown; message?: unknown } } })?.response?.data;
  const text = data?.error ?? data?.message;
  return typeof text === 'string' && text.trim() ? text : undefined;
};

const PlanGiftCard: React.FC<PlanGiftCardProps> = ({ userId, userName, gift, subscription, onChanged }) => {
  const { t, i18n } = useTranslation();
  const [plan, setPlan] = useState<'plus' | 'pro'>(gift?.plan ?? 'pro');
  const [duration, setDuration] = useState<Duration>(gift?.until ? 'date' : 'changed');
  const [day, setDay] = useState<string>(gift?.until ? dayOf(new Date(gift.until)) : '');
  const [busy, setBusy] = useState<'save' | 'remove' | null>(null);
  const [confirming, setConfirming] = useState(false);

  // The page re-reads after a change: the form follows what the server holds.
  useEffect(() => {
    setPlan(gift?.plan ?? 'pro');
    setDuration(gift?.until ? 'date' : 'changed');
    setDay(gift?.until ? dayOf(new Date(gift.until)) : '');
  }, [gift?.plan, gift?.until]);

  const planName = (p: 'plus' | 'pro') => t(`admin.planStanding.${p}`);
  const formatDay = (value: string) =>
    new Date(value).toLocaleDateString(i18n.language === 'he' ? 'he-IL' : 'en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  // A subscription that bills now goes on billing: the operator hears so first.
  const paying =
    subscription && (subscription.status === 'active' || subscription.status === 'past_due') && subscription.subscriptionId
      ? subscription
      : null;
  const paidPlan = paying ? (paying.plan === 'plus' ? 'plus' : 'pro') : null;
  const biller = paying ? BILLERS[paying.provider ?? 'paddle'] ?? 'Paddle' : '';

  const today = dayOf(new Date());
  const needsDay = duration === 'date' && !day;

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy || needsDay) return;
    setBusy('save');
    try {
      // The end of the chosen day, on this computer's clock.
      const until = duration === 'date' ? new Date(`${day}T23:59:59`).toISOString() : null;
      await setUserPlan(userId, plan, until);
      toast.success(t('admin.planGift.saved'));
      await onChanged();
    } catch (error) {
      toast.error(serverMessage(error) ?? t('admin.errors.actionFailed'));
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    if (busy) return;
    setBusy('remove');
    try {
      await removeUserPlan(userId);
      toast.success(t('admin.planGift.removed'));
      setConfirming(false);
      await onChanged();
    } catch (error) {
      toast.error(serverMessage(error) ?? t('admin.errors.actionFailed'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card animate={false}>
      <h3 className="font-semibold text-gray-900 dark:text-dark-text mb-2 flex items-center gap-2">
        <Gift size={16} className="text-primary" />
        {t('admin.planGift.title')}
      </h3>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">{t('admin.planGift.intro')}</p>

      {gift && (
        <div
          className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm"
          data-testid="plan-gift-current"
        >
          <p className="min-w-0 text-gray-800 dark:text-gray-100">
            {t('admin.planGift.current', { plan: planName(gift.plan) })}{' '}
            <span dir="auto" className="inline-block text-gray-500 dark:text-gray-400">
              {gift.until ? t('admin.planGift.currentUntil', { date: formatDay(gift.until) }) : t('admin.planGift.currentUntilChanged')}
            </span>
          </p>
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<Trash2 size={14} />}
            disabled={busy !== null}
            onClick={() => setConfirming(true)}
            data-testid="plan-gift-remove"
          >
            {t('admin.planGift.remove')}
          </Button>
        </div>
      )}

      {paying && (
        <p
          className="mb-4 flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 rounded-lg px-3 py-2"
          data-testid="plan-gift-paying"
        >
          <AlertTriangle size={14} className="shrink-0 mt-0.5" />
          <span>{t('admin.planGift.paying', { plan: planName(paidPlan!), biller })}</span>
        </p>
      )}

      <form onSubmit={save} className="space-y-3" noValidate>
        <Select
          label={t('admin.planGift.planLabel')}
          value={plan}
          onChange={(e) => setPlan(e.target.value === 'plus' ? 'plus' : 'pro')}
          options={[
            { value: 'plus', label: planName('plus') },
            { value: 'pro', label: planName('pro') },
          ]}
        />

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('admin.planGift.durationLabel')}</legend>
          {(['changed', 'date'] as const).map((value) => (
            <label key={value} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200 cursor-pointer">
              <input
                type="radio"
                name={`plan-gift-duration-${userId}`}
                value={value}
                checked={duration === value}
                onChange={() => setDuration(value)}
                className="accent-[rgb(var(--color-primary-rgb))]"
              />
              {t(value === 'changed' ? 'admin.planGift.untilChanged' : 'admin.planGift.untilDate')}
            </label>
          ))}
          {duration === 'date' && (
            <label className="block text-xs text-gray-500 dark:text-gray-400">
              <span className="block mb-1">{t('admin.planGift.dateLabel')}</span>
              <input
                type="date"
                value={day}
                min={today}
                onChange={(e) => setDay(e.target.value)}
                className={DATE_INPUT}
                data-testid="plan-gift-date"
              />
              {needsDay && <span className="mt-1 block text-amber-700 dark:text-amber-400">{t('admin.planGift.dateRequired')}</span>}
            </label>
          )}
        </fieldset>

        <Button type="submit" variant="primary" size="sm" isLoading={busy === 'save'} disabled={busy !== null || needsDay}>
          {t('admin.planGift.save')}
        </Button>
      </form>

      <ConfirmDialog
        open={confirming && Boolean(gift)}
        title={t('admin.planGift.removeTitle')}
        message={t('admin.planGift.removeConfirm', { name: userName })}
        confirmLabel={t('admin.planGift.remove')}
        danger
        loading={busy === 'remove'}
        onClose={() => setConfirming(false)}
        onConfirm={() => void remove()}
      />
    </Card>
  );
};

export default PlanGiftCard;
