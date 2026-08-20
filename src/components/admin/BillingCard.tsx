import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { CreditCard, FileText, RefreshCw, AlertTriangle, ExternalLink } from 'lucide-react';
import Card from '../ui/Card';
import Button from '../ui/Button';
import StatusBadge from './StatusBadge';
import { fetchUserBilling, fetchInvoiceUrl, UserBilling } from '../../services/adminApi';

/**
 * Live Paddle subscription + payment history, rendered in-app (LT-058
 * follow-up — Erel: "not with external link"). The data comes through
 * /api/admin/users/:id/billing, so the Paddle API key never reaches the
 * browser. Loaded lazily and independently: a slow or down Paddle turns
 * into this card's error state, never a broken detail page.
 */
interface BillingCardProps {
  userId: string;
  /** Raw ids shown in the footer for cross-referencing with Paddle. */
  subscriptionId?: string;
  customerId?: string;
}

const BillingCard: React.FC<BillingCardProps> = ({ userId, subscriptionId, customerId }) => {
  const { t, i18n } = useTranslation();
  const [billing, setBilling] = useState<UserBilling | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [openingInvoice, setOpeningInvoice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      setBilling(await fetchUserBilling(userId));
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  const locale = i18n.language === 'he' ? 'he-IL' : 'en-GB';
  const formatDate = (value?: string | null) =>
    value
      ? new Date(value).toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' })
      : '—';

  const money = (amount: number, currency?: string) => (
    <span dir="ltr">
      {currency === 'ILS' || !currency ? '₪' : `${currency} `}
      {amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}
    </span>
  );

  const openInvoice = async (transactionId: string) => {
    setOpeningInvoice(transactionId);
    try {
      const url = await fetchInvoiceUrl(transactionId);
      window.open(url, '_blank', 'noopener');
    } catch {
      toast.error(t('admin.billing.invoiceError'));
    } finally {
      setOpeningInvoice(null);
    }
  };

  const subscription = billing?.subscription;
  const transactions = billing?.transactions ?? [];

  return (
    <Card animate={false}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900 dark:text-dark-text flex items-center gap-2">
          <CreditCard size={16} className="text-primary" />
          {t('admin.billing.title')}
        </h3>
        {subscription && <StatusBadge status={subscription.status} i18nPrefix="admin.paddleStatus" />}
      </div>

      {loading ? (
        <div className="space-y-2.5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-4 rounded bg-gray-100 dark:bg-gray-800 animate-pulse w-3/4" />
          ))}
        </div>
      ) : failed ? (
        <div className="flex flex-col items-start gap-2">
          <p className="text-sm text-red-500 flex items-center gap-1.5">
            <AlertTriangle size={14} />
            {t('admin.billing.loadError')}
          </p>
          <Button variant="ghost" size="sm" leftIcon={<RefreshCw size={13} />} onClick={load}>
            {t('admin.billing.retry')}
          </Button>
        </div>
      ) : billing?.stale ? (
        <div>
          <p className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 rounded-lg px-3 py-2">
            {t('admin.billing.stale')}
          </p>
          <p className="mt-2 text-[11px] text-gray-400 font-mono truncate" dir="ltr">
            {subscriptionId}
            {customerId ? ` · ${customerId}` : ''}
          </p>
        </div>
      ) : !subscription ? (
        <p className="text-sm text-gray-400">{t('admin.actions.noBillingActions')}</p>
      ) : (
        <>
          {/* ── Plan ── */}
          {subscription.items.map((item, index) => (
            <div key={index} className="mb-3">
              <p className="font-medium text-gray-900 dark:text-dark-text">
                {item.productName ?? item.priceName ?? '—'}
              </p>
              <p className="text-sm text-gray-500">
                {item.priceName && item.productName ? `${item.priceName} · ` : ''}
                {money(item.amount, item.currencyCode)}
                {item.interval ? ` / ${t(`admin.billing.interval.${item.interval}`, { defaultValue: item.interval })}` : ''}
                {item.quantity > 1 ? ` × ${item.quantity}` : ''}
              </p>
            </div>
          ))}

          {subscription.scheduledChange?.action === 'cancel' && (
            <p className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 rounded-lg px-3 py-2 mb-3">
              {t('admin.billing.scheduledCancel', {
                date: formatDate(subscription.scheduledChange.effectiveAt),
              })}
            </p>
          )}

          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm mb-4">
            <div>
              <dt className="text-xs text-gray-400">{t('admin.billing.started')}</dt>
              <dd className="text-gray-800 dark:text-gray-200">{formatDate(subscription.startedAt)}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-400">{t('admin.billing.nextBill')}</dt>
              <dd className="text-gray-800 dark:text-gray-200">{formatDate(subscription.nextBilledAt)}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-xs text-gray-400">{t('admin.billing.periodEnds')}</dt>
              <dd className="text-gray-800 dark:text-gray-200">
                {formatDate(subscription.currentPeriod?.endsAt)}
              </dd>
            </div>
          </dl>

          {/* ── Payments ── */}
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">
            {t('admin.billing.payments')}
          </p>
          {transactions.length === 0 ? (
            <p className="text-sm text-gray-400">{t('admin.billing.noPayments')}</p>
          ) : (
            <ul className="divide-y divide-gray-50 dark:divide-gray-800/40">
              {transactions.map((tx) => (
                <li key={tx.id} className="py-2 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm text-gray-800 dark:text-gray-200" dir="ltr">
                      {formatDate(tx.billedAt ?? tx.createdAt)}
                    </p>
                    {tx.invoiceNumber && (
                      <p className="text-[11px] text-gray-400 font-mono" dir="ltr">
                        {tx.invoiceNumber}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-sm font-semibold text-gray-800 dark:text-gray-200 tabular-nums">
                      {money(tx.total, tx.currencyCode)}
                    </span>
                    <StatusBadge status={tx.status} i18nPrefix="admin.txStatus" />
                    {tx.invoiceNumber && (
                      <button
                        onClick={() => openInvoice(tx.id)}
                        disabled={openingInvoice === tx.id}
                        title={t('admin.billing.invoice')}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-primary hover:bg-primary/5 disabled:opacity-40 transition-colors"
                      >
                        <FileText size={15} />
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}

          {/* ── Cross-reference footer ── */}
          <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800/60 space-y-1">
            {subscription.managementUrls?.updatePaymentMethod && (
              <a
                href={subscription.managementUrls.updatePaymentMethod}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-primary hover:underline inline-flex items-center gap-1"
              >
                {t('admin.billing.updatePaymentMethod')}
                <ExternalLink size={10} />
              </a>
            )}
            <p className="text-[11px] text-gray-400 font-mono truncate" dir="ltr">
              {subscriptionId ?? subscription.id}
              {customerId ? ` · ${customerId}` : ''}
            </p>
          </div>
        </>
      )}
    </Card>
  );
};

export default BillingCard;
