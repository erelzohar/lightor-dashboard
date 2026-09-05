import React from 'react';
import { motion } from 'framer-motion';
import { X, CalendarDays, Clock, User, Phone, Check, XCircle, ChevronDown } from 'lucide-react';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';
import { Appointment } from '../../types';
import { getDisplayStatus } from '../../utils/appointmentUtils';
import { useTheme } from '../../contexts/ThemeContext';
import { useAppDispatch } from '../../hooks/useAppDispatch';
import { updateAppointmentStatus } from '../../store/slices/appointmentsSlice';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { formatPhoneForDisplay, whatsAppHref } from '../../utils/phone';

interface AppointmentDetailsProps {
  appointment: Appointment | null;
  onClose: () => void;
  onUpdate: () => void;
}

const AppointmentDetails: React.FC<AppointmentDetailsProps> = ({ appointment, onClose, onUpdate }) => {
  const [loading, setLoading] = React.useState(false);
  const { language } = useTheme();
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const locale = language === 'he' ? he : undefined;

  if (!appointment) return null;

  const status = getDisplayStatus(appointment);

  const handleStatusChange = async (s: 'completed' | 'cancelled') => {
    if (s === 'cancelled' && !window.confirm(t('appointments.cancelConfirm'))) return;
    setLoading(true);
    try {
      dispatch(updateAppointmentStatus({ id: appointment._id, status: s }));
      toast.success(t('appointments.updateSuccess'));
      onUpdate();
      onClose();
    } catch {
      toast.error(t('appointments.updateError'));
    } finally {
      setLoading(false);
    }
  };



  const getStatusBadgeClass = (s: string) => ({
    scheduled: 'bg-violet-100 text-violet-700',
    completed: 'bg-emerald-100 text-emerald-700',
    ongoing:   'bg-amber-100 text-amber-700',
    cancelled: 'bg-rose-100 text-rose-700',
  }[s] ?? 'bg-gray-100 text-gray-700');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.93, y: -8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.93 }}
        transition={{ duration: 0.16, ease: 'easeOut' }}
        onClick={e => e.stopPropagation()}
        className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-700 overflow-hidden w-full max-w-sm"
      >
        {/* Title row */}
        <div className="flex items-start justify-between px-5 pt-5 pb-3 gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-0.5">
              {appointment.type.name}
            </p>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white leading-snug truncate">
              {appointment.name}
            </h3>
          </div>
          <button onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 shrink-0 transition-colors mt-0.5">
            <X size={14} />
          </button>
        </div>

        {/* Detail rows */}
        <div className="px-5 pb-4 space-y-2">
          {/* Date */}
          <div className="flex items-center gap-3 bg-gray-50 dark:bg-gray-700/50 px-3 py-2 rounded-lg">
            <CalendarDays size={14} className="text-gray-400 shrink-0" />
            <span className="text-sm text-gray-600 dark:text-gray-300">
              {format(new Date(parseInt(appointment.timestamp)), 'EEEE, d MMMM', { locale })}
            </span>
          </div>

          {/* Time range */}
          <div className="flex items-center gap-3">
            <Clock size={14} className="text-gray-400 shrink-0 ms-3" />
            <div className="flex items-center gap-2 flex-1">
              <div className="flex-1 flex items-center justify-between bg-gray-50 dark:bg-gray-700/50 px-3 py-2 rounded-lg">
                <span className="text-sm text-gray-600 dark:text-gray-300">
                  {format(new Date(parseInt(appointment.timestamp)), 'HH:mm')}
                </span>
                <ChevronDown size={11} className="text-gray-400" />
              </div>
              <div className="flex-1 flex items-center justify-between bg-gray-50 dark:bg-gray-700/50 px-3 py-2 rounded-lg">
                <span className="text-sm text-gray-600 dark:text-gray-300">
                  {format(new Date(parseInt(appointment.timestamp) + Number(appointment.type.durationMS)), 'HH:mm')}
                </span>
                <ChevronDown size={11} className="text-gray-400" />
              </div>
            </div>
          </div>

          {/* Client name */}
          <div className="flex items-center gap-3 bg-gray-50 dark:bg-gray-700/50 px-3 py-2 rounded-lg">
            <User size={14} className="text-gray-400 shrink-0" />
            <span className="text-sm text-gray-600 dark:text-gray-300 truncate">{appointment.name}</span>
          </div>

          {/* Phone + WhatsApp */}
          <div className="flex items-center gap-2 px-3 py-2">
            <Phone size={14} className="text-gray-400 shrink-0" />
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <a href={`tel:${formatPhoneForDisplay(appointment.phone)}`}
                className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors truncate"
                onClick={e => e.stopPropagation()}>
                <Phone size={11} />
                {formatPhoneForDisplay(appointment.phone)}
              </a>
              <a href={whatsAppHref(appointment.phone)}
                target="_blank" rel="noopener noreferrer"
                onClick={e => e.stopPropagation()}
                className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/30 transition-colors shrink-0">
                <svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
                WhatsApp
              </a>
            </div>
          </div>
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-2 px-5 pb-4">
          <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusBadgeClass(status)}`}>
            {t(`appointments.${status}`)}
          </span>
          <span className="px-3 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
            {appointment.type.name}
          </span>
          <span className="px-3 py-1 rounded-full text-xs font-medium bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400">
            ₪{appointment.type.price}
          </span>
        </div>

        {/* Action buttons */}
        {status === 'scheduled' ? (
          <div className="flex gap-2 px-5 pb-5">
            <button
              onClick={() => handleStatusChange('completed')}
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-medium text-white transition-colors hover:opacity-90 disabled:opacity-60"
              style={{ background: '#111827' }}>
              <Check size={14} />
              {t('appointments.markCompleted')}
            </button>
            <button
              onClick={() => handleStatusChange('cancelled')}
              disabled={loading}
              title={t('appointments.cancelAppointment')}
              className="w-10 h-10 flex items-center justify-center rounded-xl bg-rose-50 dark:bg-rose-900/20 hover:bg-rose-100 dark:hover:bg-rose-900/30 transition-colors disabled:opacity-60">
              <XCircle size={16} className="text-rose-500" />
            </button>
          </div>
        ) : (
          <div className="px-5 pb-5">
            <div className={`py-2 rounded-xl text-center text-sm font-medium ${getStatusBadgeClass(status)}`}>
              {t(`appointments.${status}`)}
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default AppointmentDetails;
