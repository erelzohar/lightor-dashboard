import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { CalendarPlus, MapPin } from 'lucide-react';
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
import { ANSWER_MAX_LENGTH, CONFIRM_YES, fieldsForService } from '../../utils/bookingFields';
import type { BookingField } from '../../types';

/**
 * Book an appointment FOR a customer from the dashboard (LT-122) — the first
 * owner-made booking UI. Service → date → a time from the business's opening
 * hours (advisory; the server's overlap check is the authority and a taken
 * slot comes back as 409 → toast). Name and phone are the customer's, so the
 * booking lands in their history and their reminders go to the right number.
 *
 * Asks the owner's own booking questions for the chosen service (LT-178), the
 * same ones a customer sees, so a walk-in arrives with its address too.
 * Required is marked but never enforced here: the server spares the owner.
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
  // Keyed by the question's key, not by service: switching service re-scopes
  // which questions show, and what was typed for a question that still
  // applies is still there.
  const [answers, setAnswers] = useState<Record<string, string>>({});

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
    setAnswers({});
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

  const questions = useMemo(
    () => fieldsForService(webConfig?.bookingFields, typeId).filter((f): f is BookingField & { key: string } => !!f.key),
    [webConfig?.bookingFields, typeId]
  );

  const setAnswer = (key: string, value: string) => setAnswers((prev) => ({ ...prev, [key]: value }));

  // Key + value only, for the questions in scope; the server rebuilds label
  // and type from the catalog. An unticked confirm is simply absent.
  const answersPayload = () =>
    questions.flatMap((q) => {
      const raw = answers[q.key] ?? '';
      const value = q.type === 'confirm' ? (raw === CONFIRM_YES ? CONFIRM_YES : '') : raw.trim();
      return value ? [{ key: q.key, value }] : [];
    });

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
        ...(questions.length ? { answers: answersPayload() } : {}),
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
            className="relative w-full max-w-md glass-modal rounded-2xl p-6 max-h-[90dvh] overflow-y-auto"
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

              {questions.length > 0 && (
                <div className="pt-3 border-t border-gray-200/70 dark:border-gray-700/60 space-y-4" data-testid="booking-questions">
                  {questions.map((q) => {
                    const id = `booking-q-${q.key}`;
                    const label = (
                      <>
                        {q.label}
                        {q.required && <span className="text-red-500 ms-0.5" aria-hidden="true">*</span>}
                      </>
                    );
                    const value = answers[q.key] ?? '';

                    if (q.type === 'confirm') {
                      return (
                        <label key={q.key} htmlFor={id} className="flex items-start gap-2.5 cursor-pointer text-sm text-gray-700 dark:text-gray-300">
                          <input
                            id={id}
                            type="checkbox"
                            checked={value === CONFIRM_YES}
                            onChange={(e) => setAnswer(q.key, e.target.checked ? CONFIRM_YES : '')}
                            className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary/30"
                          />
                          <span>{label}</span>
                        </label>
                      );
                    }

                    if (q.type === 'note') {
                      return (
                        <div key={q.key}>
                          <label htmlFor={id} className="block text-[0.875rem] font-medium text-gray-700 dark:text-gray-300 mb-2 ms-0.5">
                            {label}
                          </label>
                          <textarea
                            id={id}
                            rows={3}
                            maxLength={ANSWER_MAX_LENGTH.note}
                            value={value}
                            onChange={(e) => setAnswer(q.key, e.target.value)}
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700/80 bg-white dark:bg-dark-surface text-base sm:text-[0.9375rem] text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-[0.1875rem] focus:ring-primary/20 focus:border-primary transition-all duration-300 resize-none shadow-sm"
                          />
                        </div>
                      );
                    }

                    if (q.type === 'choice') {
                      return (
                        <Select
                          key={q.key}
                          id={id}
                          label={label}
                          value={value}
                          onChange={(e) => setAnswer(q.key, e.target.value)}
                          options={[
                            { value: '', label: '—' },
                            ...(q.options ?? []).map((o) => ({ value: o, label: o })),
                          ]}
                        />
                      );
                    }

                    return (
                      <Input
                        key={q.key}
                        id={id}
                        label={label}
                        value={value}
                        maxLength={ANSWER_MAX_LENGTH[q.type]}
                        leftIcon={q.type === 'address' ? <MapPin className="w-4 h-4 text-gray-400" /> : undefined}
                        onChange={(e) => setAnswer(q.key, e.target.value)}
                      />
                    );
                  })}
                </div>
              )}

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
