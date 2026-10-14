import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { CalendarClock, ChevronLeft, ChevronRight } from 'lucide-react';
import Button from '../ui/Button';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useAppSelector } from '../../hooks/useAppSelector';
import { useAppDispatch } from '../../hooks/useAppDispatch';
import { fetchAppointments } from '../../store/slices/appointmentsSlice';
import { getAvailability, moveAppointment, type Availability, type BusySlot } from '../../services/appointmentsApi';
import { apiErrorStatus } from '../../services/customersApi';
import { localDateKey, slotTimestamp } from '../../utils/bookingSlots';
import { businessTimeZone, zonedDateOf, zonedTimeLabel, zonedTimeToMs, zonedToday } from '../../utils/businessTime';
import { dayStatus, freeSlots, type DayStatus, type ScheduleFacts } from '../../utils/ownerSchedule';
import { ChoiceSummary, DayTimes, MonthDays } from '../customers/BookingSteps';
import type { Appointment } from '../../types';

/**
 * The owner moves a booking to another day or time (LT-341). Until now the
 * owner could only cancel and book again, and the customer got a
 * cancellation and then a new booking; the customer could move it from their
 * link, the owner could not. A day, then one of its free times — the owner
 * booking window's own steps (LT-211), read the same way: the opening hours
 * less the vacations, the classes and the other bookings, this one's own time
 * counted free, on the business's clock (LT-318) — then a last look at the
 * old and the new time. The server stays the authority on overlaps: a time
 * taken meanwhile comes back as 409, and the times are read again. It sends
 * the customer the new time.
 *
 * One-to-one bookings only: a class participant moves between sessions from
 * no screen yet.
 */
interface MoveAppointmentModalProps {
  /** The booking to move; null when closed. */
  appointment: Appointment | null;
  onClose: () => void;
  /** After the server moved it, with the booking as it is now. */
  onMoved?: (moved: Appointment) => void;
}

const MONTHS_AHEAD = 12;
const monthOf = (date: Date): Date => new Date(date.getFullYear(), date.getMonth(), 1);

type Step = 'date' | 'time' | 'confirm';

interface FetchedMonth extends Availability {
  key: string;
  failed: boolean;
}

/** The month's taken times less this booking's own: its time is free to move within. */
const withoutOwn = (busy: BusySlot[], appointment: Appointment): BusySlot[] => {
  const own = busy.findIndex((slot) => slot.timestamp === appointment.timestamp);
  return own === -1 ? busy : [...busy.slice(0, own), ...busy.slice(own + 1)];
};

const MoveAppointmentModal: React.FC<MoveAppointmentModalProps> = ({ appointment, onClose, onMoved }) => {
  const { t } = useTranslation();
  const { direction, language } = useTheme();
  const { auth } = useAuth();
  const dispatch = useAppDispatch();
  const webConfig = useAppSelector((s) => s.webConfig.data);
  const timeZone = businessTimeZone(webConfig);
  const open = !!appointment;

  const [step, setStep] = useState<Step>('date');
  const [month, setMonth] = useState(() => monthOf(zonedToday(timeZone)));
  const [dateKey, setDateKey] = useState('');
  const [time, setTime] = useState('');
  const [saving, setSaving] = useState(false);
  const [fetched, setFetched] = useState<FetchedMonth | null>(null);
  const [availabilityVersion, setAvailabilityVersion] = useState(0);

  // Each opening starts on the booking's own day, chosen, so a move within
  // the day is one tap away.
  const appointmentId = appointment?._id;
  const currentStart = Number(appointment?.timestamp) || 0;
  useEffect(() => {
    if (!appointmentId) return;
    const today = zonedToday(timeZone);
    const ownDay = zonedDateOf(currentStart, timeZone);
    const start = ownDay < today ? today : ownDay;
    setMonth(monthOf(start));
    setDateKey(localDateKey(start));
    setTime('');
    setStep('date');
  }, [appointmentId, currentStart, timeZone]);

  const service = appointment?.type;
  const durationMS = Number(service?.durationMS) || 30 * 60_000;
  const date = useMemo(() => {
    const [y, m, d] = dateKey.split('-').map(Number);
    return new Date(y, (m || 1) - 1, d || 1);
  }, [dateKey]);

  const subDomain = webConfig?.subDomain;
  const monthStart = zonedTimeToMs(month.getFullYear(), month.getMonth(), 1, 0, 0, timeZone);
  const monthEnd = zonedTimeToMs(month.getFullYear(), month.getMonth() + 1, 1, 0, 0, timeZone) - 1;
  const availabilityKey = `${monthStart}|${availabilityVersion}`;
  useEffect(() => {
    if (!open || !subDomain) return;
    let cancelled = false;
    getAvailability(subDomain, String(monthStart), String(monthEnd))
      .then((availability) => {
        if (!cancelled) setFetched({ key: availabilityKey, ...availability, failed: false });
      })
      .catch(() => {
        if (!cancelled) setFetched({ key: availabilityKey, busy: [], classes: [], failed: true });
      });
    return () => {
      cancelled = true;
    };
  }, [open, subDomain, monthStart, monthEnd, availabilityKey]);

  const current = fetched?.key === availabilityKey ? fetched : null;
  const loading = !!subDomain && !current;
  const facts = useMemo<ScheduleFacts>(
    () => ({
      timeZone,
      workingDays: webConfig?.workingDays ?? [],
      dateOverrides: webConfig?.dateOverrides,
      vacations: webConfig?.vacations,
      busy: current && appointment ? withoutOwn(current.busy, appointment) : [],
      classes: current?.classes ?? [],
    }),
    [timeZone, webConfig?.workingDays, webConfig?.dateOverrides, webConfig?.vacations, current, appointment]
  );

  // The booking's own start is no move at all: not offered.
  const slots = useMemo(() => {
    if (loading || !dateKey) return [];
    return freeSlots(facts, date, durationMS).filter((slot) => slotTimestamp(date, slot, timeZone) !== currentStart);
  }, [loading, dateKey, facts, date, durationMS, timeZone, currentStart]);

  const statuses = useMemo(() => {
    const byDay = new Map<string, DayStatus>();
    if (loading) return byDay;
    const count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    for (let d = 1; d <= count; d++) {
      const day = new Date(month.getFullYear(), month.getMonth(), d);
      byDay.set(localDateKey(day), dayStatus(facts, day, durationMS));
    }
    return byDay;
  }, [loading, month, facts, durationMS]);

  const thisMonth = monthOf(zonedToday(timeZone));
  const lastMonth = new Date(thisMonth.getFullYear(), thisMonth.getMonth() + MONTHS_AHEAD, 1);
  const turnMonth = (next: Date) => {
    setMonth(next);
    setDateKey('');
    setTime('');
  };
  const pickDay = (key: string) => {
    setDateKey(key);
    setTime('');
    setStep('time');
  };
  const pickTime = (slot: string) => {
    setTime(slot);
    setStep('confirm');
  };
  const back = () => setStep(step === 'confirm' ? 'time' : 'date');

  const newStart = time ? slotTimestamp(date, time, timeZone) : undefined;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appointment || newStart === undefined || saving) return;
    setSaving(true);
    try {
      const moved = await moveAppointment(appointment._id, String(newStart));
      toast.success(t('appointments.move.success'));
      if (auth.user) dispatch(fetchAppointments({ user_id: auth.user._id, limit: 5000 }));
      onMoved?.(moved);
      onClose();
    } catch (error) {
      if (apiErrorStatus(error) === 409) {
        // Taken meanwhile: back to the day's times, read again.
        toast.error(t('customers.booking.slotTaken'));
        setAvailabilityVersion((version) => version + 1);
        setTime('');
        setStep('time');
      } else {
        toast.error(t('appointments.move.failed'));
      }
    } finally {
      setSaving(false);
    }
  };

  // Where it is now, on the business's clock.
  const currentDay = new Intl.DateTimeFormat(language, { weekday: 'long', day: 'numeric', month: 'long', timeZone }).format(currentStart);

  return createPortal(
    <AnimatePresence>
      {appointment && service && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 overlay-safe">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={saving ? undefined : onClose}
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="move-appointment-title"
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-lg glass-modal rounded-2xl p-6 max-h-[90dvh] overflow-y-auto"
          >
            <h3 id="move-appointment-title" className="text-lg font-bold text-gray-900 dark:text-dark-text flex items-center gap-2 mb-1">
              {step !== 'date' ? (
                <button
                  type="button"
                  onClick={back}
                  aria-label={t('customers.booking.back')}
                  className="w-8 h-8 -ms-1 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700/60 transition-colors"
                >
                  {direction === 'rtl' ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
                </button>
              ) : (
                <CalendarClock size={18} className="text-primary" />
              )}
              {t('appointments.move.title')}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
              {appointment.name} · {t('appointments.move.current')}: {currentDay},{' '}
              <span dir="ltr">{zonedTimeLabel(currentStart, timeZone)}</span>
            </p>

            <form onSubmit={submit} className="space-y-4">
              {step !== 'date' && (
                <ChoiceSummary
                  service={service}
                  startMs={step === 'confirm' ? newStart : undefined}
                  day={step === 'time' && dateKey ? date : undefined}
                  timeZone={timeZone}
                />
              )}

              {step === 'date' && (
                <MonthDays
                  month={month}
                  minMonth={thisMonth}
                  maxMonth={lastMonth}
                  onMonthChange={turnMonth}
                  dateKey={dateKey}
                  onPickDay={pickDay}
                  statusOf={(day) => statuses.get(localDateKey(day))}
                  timeZone={timeZone}
                />
              )}

              {step === 'time' && dateKey && (
                <DayTimes
                  day={date}
                  mode="times"
                  loading={loading}
                  failed={!!current?.failed}
                  slots={slots}
                  time={time}
                  onPickTime={pickTime}
                  sessions={[]}
                  sessionTs=""
                  onPickSession={() => undefined}
                  timeZone={timeZone}
                />
              )}

              {step === 'confirm' && (
                <p className="text-sm text-gray-600 dark:text-gray-300 ms-0.5">{t('appointments.move.notice')}</p>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={saving}>
                  {t('customers.block.cancel')}
                </Button>
                {step === 'confirm' && (
                  <Button type="submit" variant="primary" size="sm" isLoading={saving} disabled={newStart === undefined}>
                    {t('appointments.move.submit')}
                  </Button>
                )}
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
};

export default MoveAppointmentModal;
