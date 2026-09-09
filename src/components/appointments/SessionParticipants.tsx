import React from 'react';
import { motion } from 'framer-motion';
import { X, CalendarDays, Clock, Users, Phone, Check, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { Appointment } from '../../types';
import { Session, activeParticipants, sessionDisplayStatus } from '../../utils/sessions';
import { getDisplayStatus } from '../../utils/appointmentUtils';
import { useTheme } from '../../contexts/ThemeContext';
import { useAppDispatch } from '../../hooks/useAppDispatch';
import { updateAppointmentStatus } from '../../store/slices/appointmentsSlice';
import { formatPhoneForDisplay, whatsAppHref } from '../../utils/phone';

interface SessionParticipantsProps {
  session: Session | null;
  onClose: () => void;
  onUpdate?: () => void;
}

/** Stable tint per person, so the same face keeps the same colour in a roster. */
const AVATARS = [
  'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200',
  'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200',
  'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-200',
  'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200',
  'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-200',
  'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-200',
] as const;

const hashStr = (value: string): number => {
  let h = 0;
  for (let i = 0; i < value.length; i++) h = (Math.imul(31, h) + value.charCodeAt(i)) | 0;
  return Math.abs(h);
};

export const initialsOf = (name: string): string =>
  (name || '')
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

const STATUS_BADGE: Record<string, string> = {
  scheduled: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-200',
  completed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200',
  ongoing: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200',
  cancelled: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-200',
};

const badgeClass = (status: string): string =>
  STATUS_BADGE[status] ?? 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200';

/**
 * The roster behind a session card (LT-152). One panel serves both the
 * calendar and the list: everyone booked into this service at this time, with
 * the per-person actions the owner used to reach through the single-booking
 * popup.
 */
const SessionParticipants: React.FC<SessionParticipantsProps> = ({ session, onClose, onUpdate }) => {
  const { language } = useTheme();
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const locale = language === 'he' ? he : undefined;

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!session) return null;

  const start = new Date(session.startMs);
  const end = new Date(session.startMs + session.durationMS);
  const going = activeParticipants(session);
  const cancelledCount = session.participants.length - going.length;
  const status = sessionDisplayStatus(session);

  const setStatus = (appointment: Appointment, next: 'completed' | 'cancelled') => {
    if (next === 'cancelled' && !window.confirm(t('appointments.cancelConfirm'))) return;
    try {
      dispatch(updateAppointmentStatus({ id: appointment._id, status: next }));
      toast.success(t('appointments.updateSuccess'));
      onUpdate?.();
    } catch {
      toast.error(t('appointments.updateError'));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />

      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label={session.type?.name}
        initial={{ opacity: 0, scale: 0.94, y: -8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94 }}
        transition={{ duration: 0.16, ease: 'easeOut' }}
        onClick={(e) => e.stopPropagation()}
        className="relative glass-modal rounded-2xl overflow-hidden w-full max-w-2xl max-h-[85vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-2 px-5 pt-5 pb-3 shrink-0">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-0.5">
              {t('appointments.session.title')}
            </p>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white leading-snug truncate">
              {session.type?.name}
            </h3>
          </div>
          <button
            onClick={onClose}
            aria-label={t('appointments.session.close')}
            className="w-7 h-7 mt-0.5 shrink-0 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        {/* Meta strip */}
        <div className="px-5 pb-4 shrink-0 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 bg-gray-50 dark:bg-gray-700/50 px-3 py-1.5 rounded-lg text-xs text-gray-700 dark:text-gray-200">
            <CalendarDays size={13} className="text-gray-400 shrink-0" />
            {format(start, 'PPP', { locale })}
          </span>
          <span className="inline-flex items-center gap-1.5 bg-gray-50 dark:bg-gray-700/50 px-3 py-1.5 rounded-lg text-xs text-gray-700 dark:text-gray-200 tabular-nums">
            <Clock size={13} className="text-gray-400 shrink-0" />
            {format(start, 'HH:mm')} – {format(end, 'HH:mm')}
          </span>
          <span className="inline-flex items-center gap-1.5 bg-primary/10 text-primary px-3 py-1.5 rounded-lg text-xs font-medium">
            <Users size={13} className="shrink-0" />
            {t('appointments.session.participants', { count: going.length })}
          </span>
          <span className={`px-2.5 py-1 rounded-full text-[11px] font-medium ${badgeClass(status)}`}>
            {t(`appointments.${status}`)}
          </span>
        </div>

        {/* Roster */}
        <div className="px-5 pb-5 overflow-y-auto scrollbar-thin">
          <ul className="grid sm:grid-cols-2 gap-2.5">
            {session.participants.map((participant, index) => {
              const cancelled = participant.status === 'cancelled';
              const rowStatus = getDisplayStatus(participant);
              const avatar = AVATARS[hashStr(participant.phone || participant.name || String(index)) % AVATARS.length];

              return (
                <motion.li
                  key={participant._id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: cancelled ? 0.55 : 1, y: 0 }}
                  transition={{ delay: Math.min(index * 0.02, 0.2), duration: 0.15 }}
                  className="bg-gray-50 dark:bg-gray-700/40 rounded-xl p-3 border border-transparent hover:border-primary/20 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-full shrink-0 flex items-center justify-center text-xs font-bold ${avatar}`}>
                      {initialsOf(participant.name)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium text-gray-900 dark:text-white truncate ${cancelled ? 'line-through' : ''}`}>
                        {participant.name}
                      </p>
                      <a
                        href={`tel:${formatPhoneForDisplay(participant.phone)}`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-xs text-gray-500 dark:text-gray-400 hover:text-primary transition-colors tabular-nums"
                      >
                        {formatPhoneForDisplay(participant.phone)}
                      </a>
                    </div>

                    {rowStatus !== 'scheduled' && (
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium shrink-0 ${badgeClass(rowStatus)}`}>
                        {t(`appointments.${rowStatus}`)}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 mt-2.5">
                    <a
                      href={`tel:${formatPhoneForDisplay(participant.phone)}`}
                      title={t('appointments.call')}
                      aria-label={t('appointments.call')}
                      className="w-8 h-8 flex items-center justify-center rounded-lg bg-[#088F8F] text-white hover:opacity-90 transition-opacity"
                    >
                      <Phone size={14} />
                    </a>
                    <a
                      href={whatsAppHref(participant.phone)}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="WhatsApp"
                      aria-label="WhatsApp"
                      className="w-8 h-8 flex items-center justify-center rounded-lg bg-green-500 text-white hover:opacity-90 transition-opacity"
                    >
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                      </svg>
                    </a>

                    <span className="flex-1" />

                    {!cancelled && rowStatus !== 'completed' && (
                      <button
                        onClick={() => setStatus(participant, 'completed')}
                        title={t('appointments.markCompleted')}
                        aria-label={t('appointments.markCompleted')}
                        className="w-8 h-8 flex items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-300 dark:hover:bg-emerald-900/50 transition-colors"
                      >
                        <Check size={14} />
                      </button>
                    )}
                    {!cancelled && (
                      <button
                        onClick={() => setStatus(participant, 'cancelled')}
                        title={t('appointments.cancelAppointment')}
                        aria-label={t('appointments.cancelAppointment')}
                        className="w-8 h-8 flex items-center justify-center rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 dark:bg-rose-900/30 dark:text-rose-300 dark:hover:bg-rose-900/50 transition-colors"
                      >
                        <XCircle size={14} />
                      </button>
                    )}
                  </div>
                </motion.li>
              );
            })}
          </ul>

          {cancelledCount > 0 && (
            <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
              {t('appointments.session.cancelledCount', { count: cancelledCount })}
            </p>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default SessionParticipants;
