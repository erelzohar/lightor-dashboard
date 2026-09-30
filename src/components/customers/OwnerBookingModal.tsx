import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { CalendarPlus } from 'lucide-react';
import Input from '../ui/Input';
import AddressAutocomplete from './AddressAutocomplete';
import Select from '../ui/Select';
import Button from '../ui/Button';
import { useAuth } from '../../contexts/AuthContext';
import { useAppSelector } from '../../hooks/useAppSelector';
import { useAppDispatch } from '../../hooks/useAppDispatch';
import { fetchAppointments, fetchAppointmentTypes } from '../../store/slices/appointmentsSlice';
import { createAppointment, getClassSessions, type ClassSessionAvailability } from '../../services/appointmentsApi';
import { apiErrorStatus, isApiErrorCode } from '../../services/customersApi';
import { generateSlots, localDateKey, slotTimestamp } from '../../utils/bookingSlots';
import { formatPhoneForDisplay } from '../../utils/phone';
import { formatTime } from '../../utils/dateUtils';
import { ANSWER_MAX_LENGTH, CONFIRM_YES, answerText, fieldsForService, isAddressAnswer, type AddressAnswer } from '../../utils/bookingFields';
import { isBookableService } from '../../utils/siteMode';
import type { AppointmentType, BookingField } from '../../types';

/**
 * Book an appointment FOR a customer from the dashboard (LT-122) — the first
 * owner-made booking UI. Service → date → a time from the business's opening
 * hours (advisory; the server's overlap check is the authority and a taken
 * slot comes back as 409 → toast). Name and phone are the customer's, so the
 * booking lands in their history and their reminders go to the right number.
 *
 * A group class (LT-204) offers its sessions on that date instead, with the
 * seats the server counts, and books the session's own timestamp exactly as
 * the server listed it. From a class roster it seats a walk-in: the session
 * comes preset and, with no customer yet, the owner types a name and phone.
 *
 * Asks the owner's own booking questions for the chosen service (LT-178), the
 * same ones a customer sees, so a walk-in arrives with its address too —
 * with Google's suggestions under it, as on the public form (LT-206).
 * Required is marked but never enforced here: the server spares the owner.
 */
interface OwnerBookingModalProps {
  open: boolean;
  /** Who is booked. Absent for a walk-in (LT-204): the owner types a name and a phone. */
  customer?: { name: string; phone: string; channelType?: 'sms' | 'whatsapp' };
  /** Open on this class session (LT-204: "Add participant" on a roster). */
  preset?: { typeId: string; timestamp: string };
  onClose: () => void;
  onBooked: () => void;
}

const DAY_MS = 86_400_000;

// A class's refusals (LT-152), each in its own words. Any other 409 is an
// ordinary appointment whose slot is taken.
const CLASS_REFUSALS: Record<string, string> = {
  CLASS_FULL: 'customers.booking.classFull',
  ALREADY_BOOKED: 'customers.booking.alreadyBooked',
  NOT_A_SESSION: 'customers.booking.notASession',
};

interface FetchedSessions {
  /** What the list was fetched for: service, date and refetch count. */
  key: string;
  sessions: ClassSessionAvailability[];
  failed: boolean;
}

const OwnerBookingModal: React.FC<OwnerBookingModalProps> = ({ open, customer, preset, onClose, onBooked }) => {
  const { t } = useTranslation();
  const { auth } = useAuth();
  const dispatch = useAppDispatch();
  const allTypes = useAppSelector((s) => s.appointments.appointmentTypes);
  // A service saved on a leads site has no duration (LT-199): the server
  // refuses to book it, so it is not offered here until it has one.
  const appointmentTypes = useMemo(() => allTypes.filter(isBookableService), [allTypes]);
  const webConfig = useAppSelector((s) => s.webConfig.data);

  const [typeId, setTypeId] = useState('');
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
  // The chosen class's sessions on the chosen date (LT-204), tagged with what
  // they were fetched for: a list for another service or date never passes
  // for this one's, it reads as loading until the answer arrives. Opening
  // again fetches again; the list meanwhile is the last one for that day.
  const [fetchedSessions, setFetchedSessions] = useState<FetchedSessions | null>(null);
  // Bumped after a class refusal, so the seats shown are the server's again.
  const [sessionsVersion, setSessionsVersion] = useState(0);

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
    setTypeId(presetType || (appointmentTypes[0]?._id ?? ''));
    setDateKey(localDateKey(presetType && presetTimestamp ? new Date(Number(presetTimestamp)) : new Date()));
    setTime('');
    setSessionTs(presetType ? presetTimestamp ?? '' : '');
    setName('');
    setPhone('');
    setAnswers({});
  }, [open, appointmentTypes, presetTypeId, presetTimestamp]);

  const selectedType = appointmentTypes.find((ty) => ty._id === typeId);
  const isClass = selectedType?.kind === 'class';
  const date = useMemo(() => {
    const [y, m, d] = dateKey.split('-').map(Number);
    return new Date(y, (m || 1) - 1, d || 1);
  }, [dateKey]);

  // A class runs on its timetable, not on the opening hours (LT-204).
  const slots = useMemo(() => {
    if (!webConfig || !selectedType || selectedType.kind === 'class') return [];
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

  // A class's sessions on the chosen local day, from the server (LT-204): it
  // expands the timetable, knows the vacations and counts the seats. Signed
  // in as the owner, the list also holds sessions that began up to a day ago.
  const subDomain = webConfig?.subDomain;
  const sessionsKey = `${typeId}|${dateKey}|${sessionsVersion}`;
  useEffect(() => {
    if (!open || !isClass || !subDomain) return;
    let cancelled = false;
    const nextDay = new Date(date);
    nextDay.setDate(nextDay.getDate() + 1);
    getClassSessions(subDomain, String(date.valueOf()), String(nextDay.valueOf() - 1))
      .then((all) => {
        if (cancelled) return;
        const sessions = all
          .filter((session) => session.type_id === typeId)
          .sort((a, b) => Number(a.timestamp) - Number(b.timestamp));
        setFetchedSessions({ key: sessionsKey, sessions, failed: false });
      })
      .catch(() => {
        if (!cancelled) setFetchedSessions({ key: sessionsKey, sessions: [], failed: true });
      });
    return () => {
      cancelled = true;
    };
  }, [open, isClass, subDomain, typeId, date, sessionsKey]);

  const currentSessions = fetchedSessions?.key === sessionsKey ? fetchedSessions : null;
  const daySessions = currentSessions?.sessions ?? [];
  // The session picked, while the list still offers it: one that filled up
  // or left the timetable reads as no choice at all.
  const chosenSession = daySessions.find((session) => session.timestamp === sessionTs && session.booked < session.capacity);
  const sessionPrompt = !currentSessions
    ? t('customers.booking.loadingSessions')
    : currentSessions.failed
      ? t('customers.booking.sessionsFailed')
      : daySessions.length
        ? t('customers.booking.pickSession')
        : t('customers.booking.noSessions');

  const walkIn = !customer;
  const bookingName = walkIn ? name.trim() : customer.name;
  const bookingPhone = walkIn ? phone.trim() : customer.phone;
  const ready = !!selectedType && (isClass ? !!chosenSession : !!time) && !!bookingName && !!bookingPhone;

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
        timestamp: isClass ? chosenSession.timestamp : String(slotTimestamp(date, time)),
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
      if (refusal) {
        toast.error(t(CLASS_REFUSALS[refusal]));
        setSessionsVersion((version) => version + 1);
      } else if (apiErrorStatus(error) === 409) {
        toast.error(t('customers.booking.slotTaken'));
      } else {
        const serverMessage = (error as { response?: { data?: { error?: string } } })?.response?.data?.error;
        toast.error(serverMessage || t('customers.booking.failed'));
      }
    } finally {
      setSaving(false);
    }
  };

  // A class says so, and a label never reads "NaN min" (LT-204).
  const serviceLabel = (ty: AppointmentType) => {
    const minutes = Math.round(Number(ty.durationMS) / 60_000);
    return [
      ty.name,
      ty.kind === 'class' ? t('appointmentTypes.class.toggle') : '',
      minutes > 0 ? `${minutes} ${t('appointments.minutes')}` : '',
    ]
      .filter(Boolean)
      .join(' · ');
  };

  // A class may seat a walk-in in a session that began up to a day ago
  // (LT-204): the server lists those to the owner.
  const minDateKey = localDateKey(isClass ? new Date(Date.now() - DAY_MS) : new Date());

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
            className="relative w-full max-w-md glass-modal rounded-2xl p-6 max-h-[90dvh] overflow-y-auto"
          >
            <h3 className={`text-lg font-bold text-gray-900 dark:text-dark-text flex items-center gap-2 ${customer ? 'mb-1' : 'mb-5'}`}>
              <CalendarPlus size={18} className="text-primary" />
              {preset ? t('appointments.session.addParticipant') : t('customers.booking.title')}
            </h3>
            {customer && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
                {customer.name} · <span dir="ltr">{formatPhoneForDisplay(customer.phone)}</span>
              </p>
            )}

            <form onSubmit={submit} className="space-y-4">
              {walkIn && (
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
              <Select
                label={t('customers.booking.service')}
                value={typeId}
                onChange={(e) => setTypeId(e.target.value)}
                options={appointmentTypes.map((ty) => ({ value: ty._id, label: serviceLabel(ty) }))}
                disabled={!appointmentTypes.length}
                helperText={appointmentTypes.length ? undefined : t('customers.booking.noServices')}
              />
              <Input
                label={t('customers.booking.date')}
                type="date"
                dir="ltr"
                value={dateKey}
                min={minDateKey}
                onChange={(e) => setDateKey(e.target.value || localDateKey(new Date()))}
                required
              />
              {isClass ? (
                <Select
                  label={t('customers.booking.session')}
                  value={chosenSession?.timestamp ?? ''}
                  onChange={(e) => setSessionTs(e.target.value)}
                  disabled={!daySessions.length}
                  options={[
                    { value: '', label: sessionPrompt },
                    ...daySessions.map((session) => ({
                      value: session.timestamp,
                      // Display only: the time is read off the server's
                      // timestamp in the owner's browser; the booking sends
                      // the timestamp itself.
                      label: `${formatTime(Number(session.timestamp))} · ${session.booked}/${session.capacity}`,
                      disabled: session.booked >= session.capacity,
                    })),
                  ]}
                  data-testid="session-select"
                />
              ) : (
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
              )}

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
                <Button type="submit" variant="primary" size="sm" isLoading={saving} disabled={!ready}>
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
