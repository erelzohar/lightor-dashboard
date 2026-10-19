import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useDialogFocus } from '../../hooks/useDialogFocus';
import { AnimatePresence, motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { UserPlus } from 'lucide-react';
import Input from '../ui/Input';
import PhoneInput from '../ui/PhoneInput';
import { toE164 } from '../../utils/phone';
import Button from '../ui/Button';
import ToggleSwitch from '../ui/ToggleSwitch';
import { createCustomer, isApiErrorCode } from '../../services/customersApi';

/**
 * Add a customer by hand (LT-122) — someone who has not booked online yet,
 * or a number the owner wants blocked before it ever does. A phone that is
 * already in the directory (in any format) answers 409 CUSTOMER_EXISTS and
 * the modal hands the caller the existing id instead of a duplicate.
 */
interface AddCustomerModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: (customerId: string) => void;
  onExists: (customerId: string) => void;
  /** A block on a leads site refuses messages, not bookings (LT-376). */
  leadsSite?: boolean;
}

const AddCustomerModal: React.FC<AddCustomerModalProps> = ({ open, onClose, onSaved, onExists, leadsSite = false }) => {
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', blockNow: false, notes: '' });
  // The phone field's own error shows once a save was tried (LT-407).
  const [tried, setTried] = useState(false);

  useEffect(() => {
    if (open) {
      setForm({ name: '', phone: '', blockNow: false, notes: '' });
      setTried(false);
    }
  }, [open]);

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    // A valid number (LT-407): Israeli, or with its country code for a
    // business abroad. Only Israeli mobiles get texts.
    if (!toE164(form.phone)) {
      setTried(true);
      return;
    }
    setSaving(true);
    try {
      const created = await createCustomer({
        name: form.name.trim(),
        phone: toE164(form.phone) ?? form.phone.trim(),
        isBlocked: form.blockNow,
        ...(form.notes.trim() ? { notes: form.notes.trim() } : {}),
      });
      toast.success(t('customers.add.done'));
      onSaved(created._id);
      onClose();
    } catch (error) {
      if (isApiErrorCode(error, 'CUSTOMER_EXISTS')) {
        const existingId = (error as { response?: { data?: { customerId?: string } } }).response?.data?.customerId;
        toast(t('customers.add.exists'), { icon: 'ℹ️' });
        if (existingId) onExists(existingId);
        onClose();
        return;
      }
      const serverMessage = (error as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(serverMessage || t('customers.errors.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  // LT-362: a real dialog for keyboards and screen readers: focus in, Tab
  // kept inside, Escape closes (not mid-save, as the backdrop), focus back.
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const notesId = useId();
  useDialogFocus(open, panelRef, () => { if (!saving) onClose(); });

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overlay-safe">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={saving ? undefined : onClose}
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md glass-modal rounded-2xl p-6 max-h-[90dvh] overflow-y-auto"
          >
            <h3 id={titleId} className="text-lg font-bold text-gray-900 dark:text-dark-text flex items-center gap-2 mb-5">
              <UserPlus size={18} className="text-primary" aria-hidden="true" />
              {t('customers.add.title')}
            </h3>

            <form onSubmit={submit} className="space-y-4">
              <Input
                label={t('customers.add.name')}
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                required
                maxLength={50}
              />
              <PhoneInput
                label={t('customers.add.phone')}
                accept="world"
                value={form.phone}
                onChange={(phone) => set('phone', phone)}
                showError={tried}
                required
                helperText={t('customers.add.phoneHint')}
              />
              <div>
                <label htmlFor={notesId} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  {t('customers.add.notes')}
                </label>
                <textarea
                  id={notesId}
                  value={form.notes}
                  onChange={(e) => set('notes', e.target.value)}
                  maxLength={2000}
                  rows={3}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700/80 bg-white dark:bg-dark-surface text-sm text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-y"
                />
              </div>

              <div className="flex items-center justify-between py-1">
                <div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('customers.add.blockNow')}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{t(leadsSite ? 'customers.add.blockNowHintLeads' : 'customers.add.blockNowHint')}</p>
                </div>
                <ToggleSwitch checked={form.blockNow} onChange={(checked: boolean) => set('blockNow', checked)} ariaLabel={t('customers.add.blockNow')} />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={saving}>
                  {t('customers.block.cancel')}
                </Button>
                <Button type="submit" variant="primary" size="sm" isLoading={saving}>
                  {t('customers.add.submit')}
                </Button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
};

export default AddCustomerModal;
