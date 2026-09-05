import React from 'react';
import { useTranslation } from 'react-i18next';
import { Trophy, Coins } from 'lucide-react';
import Card from '../ui/Card';
import { TopCustomer } from '../../services/customersApi';
import { formatPhoneForDisplay } from '../../utils/phone';

/**
 * Top customers (LT-122): two ranked lists side by side — most visits and
 * most revenue. Revenue is an estimate (service prices are free text and can
 * change after the fact), so it is labelled as such.
 */
interface TopCustomersProps {
  byVisits: TopCustomer[];
  byRevenue: TopCustomer[];
  loading?: boolean;
  onSelect: (customerId: string) => void;
}

const Ranked: React.FC<{
  title: string;
  hint?: string;
  icon: React.ReactNode;
  rows: TopCustomer[];
  metric: (row: TopCustomer) => string;
  emptyLabel: string;
  onSelect: (customerId: string) => void;
}> = ({ title, hint, icon, rows, metric, emptyLabel, onSelect }) => (
  <Card animate={false} className="!p-5">
    <div className="flex items-center gap-2 mb-3">
      <div className="p-2 rounded-lg bg-primary/10 text-primary">{icon}</div>
      <div className="min-w-0">
        <h3 className="font-semibold text-gray-900 dark:text-dark-text leading-tight">{title}</h3>
        {hint && <p className="text-[11px] text-gray-400">{hint}</p>}
      </div>
    </div>
    {rows.length === 0 ? (
      <p className="text-sm text-gray-400 py-4 text-center">{emptyLabel}</p>
    ) : (
      <ol className="divide-y divide-gray-100 dark:divide-gray-800">
        {rows.map((row, i) => (
          <li key={`${row.customerId ?? row.phone}-${i}`}>
            <button
              type="button"
              disabled={!row.customerId}
              onClick={() => row.customerId && onSelect(row.customerId)}
              className="w-full flex items-center gap-3 py-2.5 text-start hover:bg-gray-50 dark:hover:bg-gray-800/40 rounded-lg px-1.5 -mx-1.5 transition-colors disabled:cursor-default"
            >
              <span className="w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-800 text-xs font-bold text-gray-500 flex items-center justify-center shrink-0">
                {i + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-medium text-gray-900 dark:text-dark-text truncate">{row.name}</span>
                <span className="block text-xs text-gray-400 truncate" dir="ltr">
                  {formatPhoneForDisplay(row.phone)}
                </span>
              </span>
              <span className="text-sm font-semibold text-primary whitespace-nowrap">{metric(row)}</span>
            </button>
          </li>
        ))}
      </ol>
    )}
  </Card>
);

const TopCustomers: React.FC<TopCustomersProps> = ({ byVisits, byRevenue, onSelect }) => {
  const { t } = useTranslation();
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Ranked
        title={t('customers.top.byVisits')}
        icon={<Trophy size={16} />}
        rows={byVisits}
        metric={(r) => t('customers.top.visits', { count: r.visits })}
        emptyLabel={t('customers.top.empty')}
        onSelect={onSelect}
      />
      <Ranked
        title={t('customers.top.byRevenue')}
        hint={t('customers.top.estimated')}
        icon={<Coins size={16} />}
        rows={byRevenue}
        metric={(r) => `${t('appointments.currencySymbol')}${Math.round(r.revenue).toLocaleString()}`}
        emptyLabel={t('customers.top.empty')}
        onSelect={onSelect}
      />
    </div>
  );
};

export default TopCustomers;
