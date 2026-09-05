import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { CalendarPlus } from 'lucide-react';
import Input from '../ui/Input';
import Select from '../ui/Select';
import Button from '../ui/Button';
import { useAuth } from '../../contexts/AuthContext';
import { useAppSelector } from '../../hooks/useAppSelector';
import { useAppDispatch } from '../../hooks/useAppDispatch';
import { fetchAppointments, fetchAppointmentTypes } from '../../store/slices/appointmentsSlice';
import { createAppointment } from '../../services/appointmentsApi';
import { apiErrorStatus } from '../../services/customersApi';
import { generateSlots, localDateKey, slotTimestamp } from '../../utils/bookingSlots';
import { formatPhoneForDisplay } from '../../utils/phone';

/**
 * Book an appointment FOR a customer from the dashboard (LT-122) — the first
 * owner-made booking UI. Service → date → a time from the business's opening
 * hours (advisory; the server's overlap check is the authority and a taken
 * slot comes back as 409 → toast). Name and phone are the customer's, so the
 * booking lands in their history and their reminders go to the right number.
 */
interface OwnerBookingModalProps {
  open: boolean;
  customer: { name: string; phone: string; channelType?: 'sms' | 'whatsapp' };
  onClose: () => void;
  onBooked: () => void;
}

const OwnerBookingModal: React.FC<OwnerBookingModalProps> = ({ open, customer, onClose, onBooked }) => {
  const { t } = useTranslation();
  const { auth } = useAuth();
  const dispatch = useAppDispatch();
  const appointmentTypes = useAppSelector((s) => s.appointments.appointmentTypes);
  const webConfig = useAppSelector((s) => s.webConfig.data);

  const [typeId, setTypeId] = useState('');
  const [dateKey, setDateKey] = useState(localDateKey(new Date()));
  const [time, setTime] = useState('');
  const [saving, setSaving] = useState(false);

  // Opening hours arrive with the web config; services with it or on demand.
  useEffect(() => {
    if (!open) return;
    if (!appointmentTypes.length && auth.user?.webConfig_id) {
      dispatch(fetchAppointmentTypes({ webConfig_id: auth.user.webConfig_id }));
    }
  }, [open, appointmentTypes.length, auth.user?.webConfig_id, dispatch]);

  useEffect(() => {
    if (!open) return;
    setTypeId(appointmentTypes[0]?._id ?? '');
    setDateKey(localDateKey(new Date()));
    setTime('');
  }, [open, appointmentTypes]);

  const selectedType = appointmentTypes.find((ty) => ty._id === typeId);
  const date = useMemo(() => {
    const [y, m, d] = dateKey.split('-').map(Number);
    return new Date(y, (m || 1) - 1, d || 1);
  }, [dateKey]);

  const slots = useMemo(() => {
    if (!webConfig || !selectedType) return [];
    const all = generateSlots(
      { workingDays: webConfig.workingDays, dateOverrides: webConfig.dateOverrides },
      date,
      Number(selectedType.durationMS) || 30 * 60_000
    );
    // Today: only what is still ahead of us.
    const now = Date.now();
    return all.filter((hhmm) => slotTimestamp(date, hhmm) > now);
  }, [webConfig, selectedType, date]);

  useEffect(() => {
    if (time && !slots.includes(time)) setTime('');
  }, [slots, time]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.user || !selectedType || !time) return;
    setSaving(true);
    try {
      await createAppointment({
        name: customer.name,
        phone: customer.phone,
        type_id: selectedType._id,
        timestamp: String(slotTimestamp(date, time)),
        user_id: auth.user._id,
        channelType: customer.channelType ?? 'sms',
      });
      toast.success(t('customers.booking.success'));
      dispatch(fetchAppointments({ user_id: auth.user._id, limit: 5000 }));
      onBooked();
      onClose();
    } catch (error) {
      if (apiErrorStatus(error) === 409) {
        toast.error(t('customers.booking.slotTaken'));
      } else {
        const serverMessage = (error as { response?: { data?: { error?: string } } })?.response?.data?.error;
        toast.error(serverMessage || t('customers.booking.failed'));
      }
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
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
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md bg-light-surface rounded-2xl shadow-xl p-6 max-h-[90dvh] overflow-y-auto"
          >
            <h3 className="text-lg font-bold text-gray-900 dark:text-dark-text flex items-center gap-2 mb-1">
              <CalendarPlus size={18} className="text-primary" />
              {t('customers.booking.title')}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
              {customer.name} · <span dir="ltr">{formatPhoneForDisplay(customer.phone)}</span>
            </p>

            <form onSubmit={submit} className="space-y-4">
              <Select
                label={t('customers.booking.service')}
                value={typeId}
                onChange={(e) => setTypeId(e.target.value)}
                options={appointmentTypes.map((ty) => ({
                  value: ty._id,
                  label: `${ty.name} · ${Math.round(Number(ty.durationMS) / 60_000)} ${t('appointments.minutes')}`,
                }))}
                disabled={!appointmentTypes.length}
                helperText={appointmentTypes.length ? undefined : t('customers.booking.noServices')}
              />
              <Input
                label={t('customers.booking.date')}
                type="date"
                dir="ltr"
                value={dateKey}
                min={localDateKey(new Date())}
                onChange={(e) => setDateKey(e.target.value || localDateKey(new Date()))}
                required
              />
              <Select
                label={t('customers.booking.time')}
                value={time}
                onChange={(e) => setTime(e.target.value)}
                disabled={!slots.length}
                options={[
                  { value: '', label: slots.length ? t('customers.booking.pickTime') : t('customers.booking.noSlots') },
                  ...slots.map((s) => ({ value: s, label: s })),
                ]}
                data-testid="slot-select"
              />

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={saving}>
                  {t('customers.block.cancel')}
                </Button>
                <Button type="submit" variant="primary" size="sm" isLoading={saving} disabled={!time || !selectedType}>
                  {t('customers.booking.submit')}
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

export default OwnerBookingModal;
