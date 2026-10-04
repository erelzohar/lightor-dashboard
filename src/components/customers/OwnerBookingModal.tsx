import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { CalendarPlus, ChevronLeft, ChevronRight } from 'lucide-react';
import Input from '../ui/Input';
import AddressAutocomplete from './AddressAutocomplete';
import Select from '../ui/Select';
import Button from '../ui/Button';
import { useAuth } from '../../contexts/AuthContext';
import { useAppSelector } from '../../hooks/useAppSelector';
import { useAppDispatch } from '../../hooks/useAppDispatch';
import { fetchAppointments, fetchAppointmentTypes } from '../../store/slices/appointmentsSlice';
import { createAppointment, getAvailability, type Availability } from '../../services/appointmentsApi';
import { apiErrorStatus, isApiErrorCode } from '../../services/customersApi';
import { localDateKey, slotTimestamp } from '../../utils/bookingSlots';
import { classDayStatus, dayStatus, freeSlots, sessionsOnDay, type DayStatus, type ScheduleFacts } from '../../utils/ownerSchedule';
import { formatPhoneForDisplay } from '../../utils/phone';
import { useTheme } from '../../contexts/ThemeContext';
import { ChoiceSummary, DayTimes, MonthDays, ServicePicker } from './BookingSteps';
import { ANSWER_MAX_LENGTH, CONFIRM_YES, answerText, fieldsForService, isAddressAnswer, type AddressAnswer } from '../../utils/bookingFields';
import { isBookableService } from '../../utils/siteMode';
import type { AppointmentAnswer, AppointmentType, BookingField } from '../../types';

/**
 * Book an appointment FOR a customer from the dashboard (LT-122) — the first
 * owner-made booking UI. The site's own flow, a step at a time (LT-211):
 * the services as cards with their pictures → a day on the site's booking
 * calendar → one of its free times (the opening hours less the vacations,
 * the bookings and the classes, as the site works them out, so the owner is
 * offered what a customer would be, bar the customers' booking window) →
 * who and the owner's questions. The server's overlap check stays the
 * authority: a slot taken meanwhile comes back as 409 → toast, back to the
 * times, read again. Name and phone are the customer's, so the booking lands
 * in their history and their reminders go to the right number.
 *
 * A group class (LT-204) offers its sessions on that day instead, with the
 * seats the server counts, and books the session's own timestamp exactly as
 * the server listed it. From a class roster it seats a walk-in: the session
 * comes preset and, with no customer yet, the owner types a name and phone —
 * nothing else (LT-211): the owner chose the class and its time by clicking
 * it, so the window shows that session instead of a calendar to pick it again.
 * Opened with no customer at all ("New appointment" on the appointments
 * page, LT-211), it is a walk-in for any service.
 *
 * Asks the owner's own booking questions for the chosen service (LT-178), the
 * same ones a customer sees, so a walk-in arrives with its address too —
 * with Google's suggestions under it, as on the public form (LT-206).
 * Required is marked but never enforced here: the server spares the owner.
 * A customer's details kept from their last booking (LT-217, an address)
 * fill those questions in; the owner sees them and may change them.
 */
interface OwnerBookingModalProps {
  open: boolean;
  /** Who is booked. Absent for a walk-in (LT-204): the owner types a name and a phone. */
  customer?: { name: string; phone: string; channelType?: 'sms' | 'whatsapp'; answers?: AppointmentAnswer[] };
  /** Open on this class session (LT-204: "Add participant" on a roster). */
  preset?: { typeId: string; timestamp: string };
  onClose: () => void;
  onBooked: () => void;
}

// As far ahead as the server expands a class's sessions for the owner.
const MONTHS_AHEAD = 12;

const monthOf = (date: Date): Date => new Date(date.getFullYear(), date.getMonth(), 1);
const monthIndexOf = (date: Date): number => date.getFullYear() * 12 + date.getMonth();

// A class's refusals (LT-152), each in its own words. Any other 409 is an
// ordinary appointment whose slot is taken.
const CLASS_REFUSALS: Record<string, string> = {
  CLASS_FULL: 'customers.booking.classFull',
  ALREADY_BOOKED: 'customers.booking.alreadyBooked',
  NOT_A_SESSION: 'customers.booking.notASession',
};

type Step = 'service' | 'date' | 'time' | 'details';

interface FetchedMonth extends Availability {
  /** What it was fetched for: the month and the refetch count. */
  key: string;
  failed: boolean;
}

/** Kept answers back in the shape the form edits: an address keeps its place. */
const keptAnswers = (kept?: AppointmentAnswer[]): Record<string, string | AddressAnswer> =>
  Object.fromEntries(
    (kept ?? []).map((a) => [
      a.key,
      a.placeId && typeof a.lat === 'number' && typeof a.lng === 'number'
        ? { text: a.value, placeId: a.placeId, lat: a.lat, lng: a.lng }
        : a.value,
    ])
  );

const OwnerBookingModal: React.FC<OwnerBookingModalProps> = ({ open, customer, preset, onClose, onBooked }) => {
  // The array itself, from the drawer's state: stable while the window is open.
  const rememberedAnswers = customer?.answers;
  const { t } = useTranslation();
  const { direction } = useTheme();
  const { auth } = useAuth();
  const dispatch = useAppDispatch();
  const allTypes = useAppSelector((s) => s.appointments.appointmentTypes);
  // A service saved on a leads site has no duration (LT-199): the server
  // refuses to book it, so it is not offered here until it has one.
  const appointmentTypes = useMemo(() => allTypes.filter(isBookableService), [allTypes]);
  const webConfig = useAppSelector((s) => s.webConfig.data);

  const [step, setStep] = useState<Step>('service');
  // The calendar turns to next month by itself once per service when this
  // one has no day left with room (the last days of a month).
  const [autoTurned, setAutoTurned] = useState(false);
  const [typeId, setTypeId] = useState('');
  const [month, setMonth] = useState(() => monthOf(new Date()));
  const [dateKey, setDateKey] = useState(localDateKey(new Date()));
  const [time, setTime] = useState('');
  // A class's session is the server's own timestamp string (LT-204).
  const [sessionTs, setSessionTs] = useState('');
  // A walk-in's name and phone (LT-204); the phone goes as typed, the
  // server normalizes it.
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  // Keyed by the question's key, not by service: switching service re-scopes
  // which questions show, and what was typed for a question that still
  // applies is still there.
  // An address chosen from Google's suggestions carries its place (LT-206).
  const [answers, setAnswers] = useState<Record<string, string | AddressAnswer>>({});
  // The month's taken times and class sessions (LT-211), tagged with what
  // they were fetched for: another month's never passes for this one's, it
  // reads as loading until the answer arrives.
  const [fetched, setFetched] = useState<FetchedMonth | null>(null);
  // Bumped after a refusal, so what is shown is the server's again.
  const [availabilityVersion, setAvailabilityVersion] = useState(0);

  // Opening hours arrive with the web config; services with it or on demand.
  useEffect(() => {
    if (!open) return;
    if (!allTypes.length && auth.user?.webConfig_id) {
      dispatch(fetchAppointmentTypes({ webConfig_id: auth.user.webConfig_id }));
    }
  }, [open, allTypes.length, auth.user?.webConfig_id, dispatch]);

  const presetTypeId = preset?.typeId;
  const presetTimestamp = preset?.timestamp;

  useEffect(() => {
    if (!open) return;
    // "Add participant" on a roster (LT-204) opens on its session: that
    // service, that session's date, that session.
    const presetType = presetTypeId && appointmentTypes.some((ty) => ty._id === presetTypeId) ? presetTypeId : '';
    // Nothing chosen for the owner: the first step is the services (LT-211).
    setTypeId(presetType);
    const day = presetType && presetTimestamp ? new Date(Number(presetTimestamp)) : new Date();
    setMonth(monthOf(day));
    setDateKey(presetType ? localDateKey(day) : '');
    setTime('');
    setSessionTs(presetType ? presetTimestamp ?? '' : '');
    setStep(presetType && presetTimestamp ? 'details' : 'service');
    setName('');
    setPhone('');
    setAnswers(keptAnswers(rememberedAnswers));
  }, [open, appointmentTypes, presetTypeId, presetTimestamp, rememberedAnswers]);

  const selectedType = appointmentTypes.find((ty) => ty._id === typeId);
  const isClass = selectedType?.kind === 'class';
  const durationMS = Number(selectedType?.durationMS) || 30 * 60_000;
  // Opened on one session: nothing left to pick (LT-211). Read off the
  // preset itself, not the chosen service, so not even the first render
  // asks for a month to pick from.
  const presetService = presetTimestamp ? appointmentTypes.find((ty) => ty._id === presetTypeId) : undefined;
  const fixedSession = !!presetService;
  const date = useMemo(() => {
    const [y, m, d] = dateKey.split('-').map(Number);
    return new Date(y, (m || 1) - 1, d || 1);
  }, [dateKey]);

  // The month on show, from the site's own endpoint (LT-211): the times
  // taken, and each class's sessions with their seats — expanded, vacations
  // and all, by the server. Signed in as the owner, the sessions also include
  // those that began up to a day ago and those past the customers' window.
  const subDomain = webConfig?.subDomain;
  const monthStart = month.valueOf();
  const monthEnd = new Date(month.getFullYear(), month.getMonth() + 1, 1).valueOf() - 1;
  const availabilityKey = `${monthStart}|${availabilityVersion}`;
  useEffect(() => {
    if (!open || !subDomain || fixedSession) return;
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
  }, [open, subDomain, fixedSession, monthStart, monthEnd, availabilityKey]);

  const current = fetched?.key === availabilityKey ? fetched : null;
  // Unread yet. Without a subdomain there is nothing to read, and a service
  // falls back to its opening hours — degrade, never block (LT-098).
  const loading = !!subDomain && !current;
  const facts = useMemo<ScheduleFacts>(
    () => ({
      workingDays: webConfig?.workingDays ?? [],
      dateOverrides: webConfig?.dateOverrides,
      vacations: webConfig?.vacations,
      busy: current?.busy ?? [],
      classes: current?.classes ?? [],
    }),
    [webConfig?.workingDays, webConfig?.dateOverrides, webConfig?.vacations, current]
  );

  const slots = useMemo(
    () => (isClass || loading || !dateKey ? [] : freeSlots(facts, date, durationMS)),
    [isClass, loading, dateKey, facts, date, durationMS]
  );

  useEffect(() => {
    if (time && !slots.includes(time)) setTime('');
  }, [slots, time]);

  // Each day's dot for the month on show, worked out once per answer.
  const statuses = useMemo(() => {
    const byDay = new Map<string, DayStatus>();
    if (loading) return byDay;
    const count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    for (let d = 1; d <= count; d++) {
      const day = new Date(month.getFullYear(), month.getMonth(), d);
      byDay.set(localDateKey(day), isClass ? classDayStatus(facts.classes, typeId, day) : dayStatus(facts, day, durationMS));
    }
    return byDay;
  }, [loading, month, isClass, facts, typeId, durationMS]);

  const daySessions = isClass && dateKey ? sessionsOnDay(facts.classes, typeId, date) : [];
  // The session picked, while the list still offers it: one that filled up
  // or left the timetable reads as no choice at all.
  const chosenSession = daySessions.find((session) => session.timestamp === sessionTs && session.booked < session.capacity);

  const walkIn = !customer;
  const bookingName = walkIn ? name.trim() : customer.name;
  const bookingPhone = walkIn ? phone.trim() : customer.phone;
  // A preset session is the server's to refuse if it filled meanwhile (CLASS_FULL).
  const ready =
    !!selectedType && (fixedSession || (isClass ? !!chosenSession : !!time)) && !!bookingName && !!bookingPhone;

  const questions = useMemo(
    () => fieldsForService(webConfig?.bookingFields, typeId).filter((f): f is BookingField & { key: string } => !!f.key),
    [webConfig?.bookingFields, typeId]
  );

  const setAnswer = (key: string, value: string | AddressAnswer) => setAnswers((prev) => ({ ...prev, [key]: value }));

  // Key + value only, for the questions in scope; the server rebuilds label
  // and type from the catalog. An unticked confirm is simply absent. A chosen
  // address also sends the place it stands for, as the public form does.
  const answersPayload = () =>
    questions.flatMap((q) => {
      const raw = answers[q.key];
      if (q.type === 'address' && isAddressAnswer(raw)) {
        const text = raw.text.trim();
        return text ? [{ key: q.key, value: text, placeId: raw.placeId, lat: raw.lat, lng: raw.lng }] : [];
      }
      const typed = answerText(raw);
      const value = q.type === 'confirm' ? (typed === CONFIRM_YES ? CONFIRM_YES : '') : typed.trim();
      return value ? [{ key: q.key, value }] : [];
    });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.user || !selectedType || !ready) return;
    setSaving(true);
    try {
      await createAppointment({
        name: bookingName,
        phone: bookingPhone,
        type_id: selectedType._id,
        // A class session goes back exactly as the server listed it (LT-204).
        timestamp: fixedSession
          ? String(presetTimestamp)
          : isClass
            ? chosenSession.timestamp
            : String(slotTimestamp(date, time)),
        user_id: auth.user._id,
        channelType: customer?.channelType ?? 'sms',
        ...(questions.length ? { answers: answersPayload() } : {}),
      });
      toast.success(t('customers.booking.success'));
      dispatch(fetchAppointments({ user_id: auth.user._id, limit: 5000 }));
      onBooked();
      onClose();
    } catch (error) {
      const refusal = Object.keys(CLASS_REFUSALS).find((code) => isApiErrorCode(error, code));
      // Refused for its time: back to the day's times, read again — unless
      // the time was the roster's own session, which is all there is.
      if (refusal) {
        toast.error(t(CLASS_REFUSALS[refusal]));
        setAvailabilityVersion((version) => version + 1);
        if (!fixedSession) setStep('time');
      } else if (apiErrorStatus(error) === 409) {
        toast.error(t('customers.booking.slotTaken'));
        setAvailabilityVersion((version) => version + 1);
        if (!fixedSession) setStep('time');
      } else {
        const serverMessage = (error as { response?: { data?: { error?: string } } })?.response?.data?.error;
        toast.error(serverMessage || t('customers.booking.failed'));
      }
    } finally {
      setSaving(false);
    }
  };

  // Back to this month (a class's walk-in may still go to one that began
  // yesterday, LT-204), ahead a year.
  const thisMonth = monthOf(new Date());
  const lastMonth = new Date(thisMonth.getFullYear(), thisMonth.getMonth() + MONTHS_AHEAD, 1);
  const turnMonth = (next: Date) => {
    setMonth(next);
    // A day is read against its own month's bookings: turning the page
    // lets it go.
    setDateKey('');
    setTime('');
    setSessionTs('');
  };
  // Each choice is its own step, as on the site (LT-211).
  const pickService = (service: AppointmentType) => {
    setTypeId(service._id);
    setAutoTurned(false);
    setDateKey('');
    setTime('');
    setSessionTs('');
    setStep('date');
  };
  const pickDay = (key: string) => {
    setDateKey(key);
    setTime('');
    setSessionTs('');
    setStep('time');
  };
  const pickTime = (slot: string) => {
    setTime(slot);
    setStep('details');
  };
  const pickSession = (timestamp: string) => {
    setSessionTs(timestamp);
    setStep('details');
  };
  const back = () => setStep(step === 'details' ? 'time' : step === 'time' ? 'date' : 'service');

  // Nothing left this month (its last days, say): show the next one, as the
  // site offers the next month's first days near a month's end — once, so
  // the owner can still turn back.
  useEffect(() => {
    if (step !== 'date' || autoTurned || loading || !selectedType) return;
    if (monthIndexOf(month) !== monthIndexOf(thisMonth)) return;
    const anyOpen = Array.from(statuses.values()).some((status) => status === 'full' || status === 'limited');
    if (anyOpen || statuses.size === 0) return;
    setAutoTurned(true);
    turnMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, autoTurned, loading, selectedType, month, statuses]);
  const canGoBack = !fixedSession && step !== 'service';

  // The service and, once picked, its start — for the summary over each step.
  const summaryService = presetService ?? selectedType;
  const startMs = fixedSession
    ? Number(presetTimestamp)
    : isClass
      ? chosenSession
        ? Number(chosenSession.timestamp)
        : undefined
      : time
        ? slotTimestamp(date, time)
        : undefined;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 overlay-safe">
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
            className="relative w-full max-w-lg glass-modal rounded-2xl p-6 max-h-[90dvh] overflow-y-auto"
          >
            <h3 className={`text-lg font-bold text-gray-900 dark:text-dark-text flex items-center gap-2 ${customer ? 'mb-1' : 'mb-5'}`}>
              {canGoBack ? (
                <button
                  type="button"
                  onClick={back}
                  aria-label={t('customers.booking.back')}
                  className="w-8 h-8 -ms-1 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700/60 transition-colors"
                >
                  {direction === 'rtl' ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
                </button>
              ) : (
                <CalendarPlus size={18} className="text-primary" />
              )}
              {preset ? t('appointments.session.addParticipant') : t('customers.booking.title')}
            </h3>
            {customer && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
                {customer.name} · <span dir="ltr">{formatPhoneForDisplay(customer.phone)}</span>
              </p>
            )}

            <form onSubmit={submit} className="space-y-4">
              {step === 'service' && <ServicePicker services={appointmentTypes} onPick={pickService} />}

              {step !== 'service' && summaryService && (
                <ChoiceSummary
                  service={summaryService}
                  startMs={step === 'details' ? startMs : undefined}
                  day={step === 'time' && dateKey ? date : undefined}
                />
              )}

              {step === 'date' && selectedType && (
                <>
                  {/* A class's days come from its sessions: unread, the
                      calendar would look closed with no reason given. */}
                  {isClass && current?.failed && (
                    <p className="text-sm text-amber-700 dark:text-amber-300 ms-0.5">{t('customers.booking.sessionsFailed')}</p>
                  )}
                  <MonthDays
                    month={month}
                    minMonth={thisMonth}
                    maxMonth={lastMonth}
                    onMonthChange={turnMonth}
                    dateKey={dateKey}
                    onPickDay={pickDay}
                    statusOf={(day) => statuses.get(localDateKey(day))}
                  />
                </>
              )}

              {step === 'time' && selectedType && dateKey && (
                <DayTimes
                  day={date}
                  mode={isClass ? 'sessions' : 'times'}
                  loading={loading}
                  failed={!!current?.failed}
                  slots={slots}
                  time={time}
                  onPickTime={pickTime}
                  sessions={daySessions}
                  sessionTs={chosenSession?.timestamp ?? ''}
                  onPickSession={pickSession}
                />
              )}

              {step === 'details' && walkIn && (
                <>
                  <Input
                    id="booking-name"
                    label={t('customers.add.name')}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    maxLength={50}
                    autoComplete="off"
                  />
                  <Input
                    id="booking-phone"
                    label={t('customers.add.phone')}
                    dir="ltr"
                    inputMode="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                    maxLength={20}
                    autoComplete="off"
                    helperText={t('customers.add.phoneHint')}
                  />
                </>
              )}

              {step === 'details' && questions.length > 0 && (
                <div className="pt-3 border-t border-gray-200/70 dark:border-gray-700/60 space-y-4" data-testid="booking-questions">
                  {questions.map((q) => {
                    const id = `booking-q-${q.key}`;
                    const label = (
                      <>
                        {q.label}
                        {q.required && <span className="text-red-500 ms-0.5" aria-hidden="true">*</span>}
                      </>
                    );
                    const value = answerText(answers[q.key]);

                    if (q.type === 'address') {
                      return (
                        <AddressAutocomplete
                          key={q.key}
                          id={id}
                          label={label}
                          value={answers[q.key]}
                          maxLength={ANSWER_MAX_LENGTH.address}
                          onChange={(next) => setAnswer(q.key, next)}
                        />
                      );
                    }

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
                {step === 'details' && (
                  <Button type="submit" variant="primary" size="sm" isLoading={saving} disabled={!ready}>
                    {t('customers.booking.submit')}
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

export default OwnerBookingModal;
