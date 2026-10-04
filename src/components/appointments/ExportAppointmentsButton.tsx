import React, { useEffect, useState } from 'react';
import { Download, Lock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import ConfirmDialog from '../ui/ConfirmDialog';
import { exportAppointmentsCsv } from '../../services/appointmentsApi';
import { fetchMyEntitlements } from '../../services/entitlementsApi';
import { canOfferPurchases } from '../../lib/platform';

const pad = (n: number) => String(n).padStart(2, '0');

/** This month, first day to last, as the export's default. */
const thisMonth = (): { from: string; to: string } => {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  return { from: `${y}-${pad(m + 1)}-01`, to: `${y}-${pad(m + 1)}-${pad(new Date(y, m + 1, 0).getDate())}` };
};

const DATE_INPUT =
  'w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700/80 bg-white dark:bg-dark-surface ' +
  'text-sm text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary';

/**
 * "Export" on the appointments page (LT-217): the appointments of a range as
 * a CSV for Excel, a column per booking question. Plus, like the customers
 * export (LT-125): on the free plan the web shows it locked and points at the
 * plans; the app shows nothing (no call to buy, LT-130).
 */
const ExportAppointmentsButton: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [locked, setLocked] = useState(false);
  const [open, setOpen] = useState(false);
  const [range, setRange] = useState(thisMonth);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    fetchMyEntitlements().then((entitlements) => {
      if (alive && entitlements) setLocked(entitlements.limits.customerExport === false);
    });
    return () => {
      alive = false;
    };
  }, []);

  if (locked && !canOfferPurchases()) return null;

  const promptUpgrade = () => {
    toast(t('appointments.export.upgradeToast'), { icon: '👑' });
    navigate('/account');
  };

  const download = async () => {
    setBusy(true);
    try {
      await exportAppointmentsCsv(range);
      setOpen(false);
    } catch (error) {
      const code = error instanceof Error ? error.message : '';
      if (code === 'PLAN_REQUIRED') {
        setOpen(false);
        promptUpgrade();
      } else {
        toast.error(t(code === 'RANGE_INVALID' ? 'appointments.export.rangeInvalid' : 'appointments.export.failed'));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => (locked ? promptUpgrade() : setOpen(true))}
        title={locked ? t('appointments.export.upgradeToast') : undefined}
        data-testid="export-appointments"
        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
      >
        {locked ? <Lock size={15} className="shrink-0" /> : <Download size={15} className="shrink-0" />}
        <span className="hidden sm:inline">{t('appointments.export.button')}</span>
        <span className="sr-only sm:hidden">{t('appointments.export.button')}</span>
      </button>

      <ConfirmDialog
        open={open}
        title={t('appointments.export.title')}
        message={
          <div className="space-y-3 text-start">
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('appointments.export.hint')}</p>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm text-gray-700 dark:text-gray-300">
                <span className="block mb-1">{t('appointments.export.from')}</span>
                <input
                  type="date"
                  value={range.from}
                  onChange={(e) => setRange((prev) => ({ ...prev, from: e.target.value }))}
                  className={DATE_INPUT}
                  data-testid="export-from"
                />
              </label>
              <label className="block text-sm text-gray-700 dark:text-gray-300">
                <span className="block mb-1">{t('appointments.export.to')}</span>
                <input
                  type="date"
                  value={range.to}
                  min={range.from}
                  onChange={(e) => setRange((prev) => ({ ...prev, to: e.target.value }))}
                  className={DATE_INPUT}
                  data-testid="export-to"
                />
              </label>
            </div>
          </div>
        }
        confirmLabel={t('appointments.export.download')}
        cancelLabel={t('appointments.export.cancel')}
        loading={busy}
        onConfirm={() => void download()}
        onClose={() => setOpen(false)}
      />
    </>
  );
};

export default ExportAppointmentsButton;
