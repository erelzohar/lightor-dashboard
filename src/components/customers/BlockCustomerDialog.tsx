import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ConfirmDialog from '../ui/ConfirmDialog';
import Input from '../ui/Input';

/**
 * "Block this customer" (LT-122): a danger confirm with two extras — the
 * checkbox that also cancels their upcoming appointments (on by default; the
 * common reason to block is a no-show, and their pending slots are the
 * immediate problem) and an optional reason the owner sees later.
 */
interface BlockCustomerDialogProps {
  open: boolean;
  customerName: string;
  upcomingCount: number;
  loading?: boolean;
  onConfirm: (options: { reason?: string; cancelUpcoming: boolean }) => void;
  onClose: () => void;
}

const BlockCustomerDialog: React.FC<BlockCustomerDialogProps> = ({
  open,
  customerName,
  upcomingCount,
  loading = false,
  onConfirm,
  onClose,
}) => {
  const { t } = useTranslation();
  const [cancelUpcoming, setCancelUpcoming] = useState(true);
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (open) {
      setCancelUpcoming(true);
      setReason('');
    }
  }, [open]);

  return (
    <ConfirmDialog
      open={open}
      danger
      loading={loading}
      title={t('customers.block.title')}
      confirmLabel={t('customers.block.confirm')}
      cancelLabel={t('customers.block.cancel')}
      onClose={onClose}
      onConfirm={() => onConfirm({ reason: reason.trim() || undefined, cancelUpcoming })}
      message={
        <div className="space-y-4">
          <p>{t('customers.block.message', { name: customerName })}</p>

          <label className="flex items-start gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary/30"
              checked={cancelUpcoming}
              onChange={(e) => setCancelUpcoming(e.target.checked)}
              data-testid="cancel-upcoming"
            />
            <span>
              <span className="block font-medium text-gray-800 dark:text-gray-100">
                {t('customers.block.cancelUpcoming')}
              </span>
              <span className="block text-xs text-gray-500 dark:text-gray-400">
                {t('customers.block.cancelUpcomingHint', { count: upcomingCount })}
              </span>
            </span>
          </label>

          <Input
            label={t('customers.block.reason')}
            placeholder={t('customers.block.reasonPlaceholder')}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={200}
          />
        </div>
      }
    />
  );
};

export default BlockCustomerDialog;
