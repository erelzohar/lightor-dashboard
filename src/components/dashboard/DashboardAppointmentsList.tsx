import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Phone, Clock, Calendar, ChevronRight, ChevronLeft } from 'lucide-react';
import Card from '../ui/Card';
import { Appointment } from '../../types';
import { formatTime } from '../../utils/dateUtils';
import { useTheme } from '../../contexts/ThemeContext';
import { isToday, isTomorrow, format } from 'date-fns';
import { he, enUS } from 'date-fns/locale';
import { getDisplayStatus } from '../../utils/appointmentUtils';
import { useTranslation } from 'react-i18next';

interface DashboardAppointmentsListProps {
  appointments: Appointment[];
  onAppointmentClick: (appointment: Appointment) => void;
}

type StatusFilter = 'all' | 'scheduled' | 'completed' | 'cancelled' | 'ongoing';

// Map status to a plain hex color for inline styles (avatar backgrounds)
const SEGMENT_BG_COLORS: Record<string, string> = {
  scheduled: '#3b82f6',
  completed: '#22c55e',
  cancelled: '#ef4444',
  ongoing: '#f59e0b',
};

const STATUS_COLORS: Record<string, { dot: string; badge: string; label: string }> = {
  scheduled: {
    dot: 'bg-blue-500',
    badge: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    label: 'appointments.scheduled',
  },
  completed: {
    dot: 'bg-emerald-500',
    badge: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
    label: 'appointments.completed',
  },
  cancelled: {
    dot: 'bg-red-500',
    badge: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300',
    label: 'appointments.cancelled',
  },
  ongoing: {
    dot: 'bg-amber-500',
    badge: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    label: 'appointments.ongoing',
  },
};

const DashboardAppointmentsList: React.FC<DashboardAppointmentsListProps> = ({
  appointments,
  onAppointmentClick,
}) => {
  const { language, direction } = useTheme();
  const { t } = useTranslation();
  const locale = language === 'he' ? he : enUS;
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const getDateDisplay = (timestamp: string) => {
    const date = new Date(parseInt(timestamp));
    const time = formatTime(date);
    if (isToday(date)) return `${t('appointments.today')}, ${time}`;
    if (isTomorrow(date)) return `${t('appointments.tomorrow')}, ${time}`;
    return `${format(date, 'PP', { locale })}, ${time}`;
  };

  const getInitials = (name: string) =>
    name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();

  const formatPhoneNumber = (phone: string) =>
    phone.startsWith('0') ? phone : `0${phone.slice(3)}`;

  const getWhatsAppLink = (phone: string) => {
    const formatted = phone.startsWith('+') ? phone.slice(1) : `972${phone.slice(1)}`;
    return `https://wa.me/${formatted}`;
  };

  const sorted = [...appointments].sort(
    (a, b) => parseInt(a.timestamp) - parseInt(b.timestamp)
  );

  const filtered = sorted.filter(a => {
    if (statusFilter === 'all') return true;
    return getDisplayStatus(a) === statusFilter;
  });

  const filterOptions: { value: StatusFilter; label: string }[] = [
    { value: 'all', label: t('appointments.all') },
    { value: 'scheduled', label: t('appointments.scheduled') },
    { value: 'completed', label: t('appointments.completed') },
    { value: 'cancelled', label: t('appointments.cancelled') },
  ];

  const ArrowIcon = direction === 'rtl' ? ChevronLeft : ChevronRight;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5 }}
    >
      <Card animate={false}>
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <div>
            <h3 className="font-semibold text-lg">{t('appointments.upcoming')}</h3>
            <p className="text-xs text-light-gray mt-0.5">
              {filtered.length} {t('dashboardList.total')}
            </p>
          </div>
          {/* Status filter */}
          <div className="flex gap-1.5 flex-wrap">
            {filterOptions.map(opt => (
              <button
                key={opt.value}
                onClick={() => setStatusFilter(opt.value)}
                className={`text-xs font-medium px-3 py-1.5 rounded-full transition-colors ${
                  statusFilter === opt.value
                    ? 'bg-primary text-white shadow-sm'
                    : 'bg-light-gray/10 dark:bg-white/5 text-light-gray hover:bg-light-gray/20 dark:hover:bg-white/10'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Column headers - hidden on mobile */}
        <div className="hidden md:grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 px-3 pb-2 border-b border-light-gray/10">
          <span className="text-xs font-semibold text-light-gray uppercase tracking-wide">
            {t('dashboardList.service')}
          </span>
          <span className="text-xs font-semibold text-light-gray uppercase tracking-wide w-28 text-center">
            {t('dashboardList.dateTime')}
          </span>
          <span className="text-xs font-semibold text-light-gray uppercase tracking-wide w-24 text-center">
            {t('dashboardList.duration')}
          </span>
          <span className="text-xs font-semibold text-light-gray uppercase tracking-wide w-24 text-center">
            {t('dashboardList.status')}
          </span>
          <span className="text-xs font-semibold text-light-gray uppercase tracking-wide w-20 text-end">
            {t('dashboardList.price')}
          </span>
        </div>

        {/* List */}
        <div className="mt-2 divide-y divide-light-gray/10 max-h-[26rem] overflow-y-auto scrollbar-thin">
          {filtered.length > 0 ? (
            filtered.map((appointment, i) => {
              const status = getDisplayStatus(appointment);
              const statusConfig = STATUS_COLORS[status] || STATUS_COLORS.scheduled;
              const durationMin = Math.round(Number(appointment.type.durationMS) / 60000);

              return (
                <motion.div
                  key={appointment._id}
                  initial={{ opacity: 0, x: direction === 'rtl' ? 10 : -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                  onClick={() => onAppointmentClick(appointment)}
                  className="group cursor-pointer"
                >
                  {/* Desktop row */}
                  <div className="hidden md:grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 items-center px-3 py-3.5 rounded-xl hover:bg-light-gray/5 dark:hover:bg-white/3 transition-colors">
                    {/* Service + client */}
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Avatar with initials */}
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-sm"
                        style={{ backgroundColor: SEGMENT_BG_COLORS[status] || '#3b82f6' }}
                      >
                        {getInitials(appointment.name)}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-sm truncate group-hover:text-primary transition-colors">
                          {appointment.type.name}
                        </p>
                        <p className="text-xs text-light-gray truncate">{appointment.name}</p>
                      </div>
                    </div>

                    {/* Date/Time */}
                    <div className="w-28 text-center">
                      <span className="text-xs font-medium text-light-gray flex items-center justify-center gap-1">
                        <Calendar size={11} />
                        {getDateDisplay(appointment.timestamp)}
                      </span>
                    </div>

                    {/* Duration */}
                    <div className="w-24 text-center">
                      <span className="text-xs text-light-gray flex items-center justify-center gap-1">
                        <Clock size={11} />
                        {durationMin} {t('appointments.minutes')}
                      </span>
                    </div>

                    {/* Status badge */}
                    <div className="w-24 flex justify-center">
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusConfig.badge}`}>
                        {t(statusConfig.label)}
                      </span>
                    </div>

                    {/* Price + action buttons (shown on hover) */}
                    <div className="w-28 flex items-center justify-end gap-1.5">
                      <span className="text-sm font-bold text-primary group-hover:hidden">
                        {t('appointments.currencySymbol')}{appointment.type.price}
                      </span>
                      <div className="hidden group-hover:flex items-center gap-1.5">
                        <a
                          href={`tel:${formatPhoneNumber(appointment.phone)}`}
                          onClick={(e) => e.stopPropagation()}
                          className="p-1.5 rounded-full bg-teal-100 text-teal-700 hover:bg-teal-200 transition-colors"
                          title={t('appointments.call')}
                        >
                          <Phone size={13} />
                        </a>
                        <a
                          href={getWhatsAppLink(appointment.phone)}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="p-1.5 rounded-full bg-green-100 text-green-700 hover:bg-green-200 transition-colors"
                          title="WhatsApp"
                        >
                          <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                          </svg>
                        </a>
                      </div>
                    </div>
                  </div>

                  {/* Mobile card row */}
                  <div className="md:hidden flex items-start gap-3 py-3.5 px-1 rounded-xl hover:bg-light-gray/5 dark:hover:bg-white/3 transition-colors">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
                      style={{ backgroundColor: SEGMENT_BG_COLORS[status] || '#3b82f6' }}
                    >
                      {getInitials(appointment.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold text-sm truncate">{appointment.type.name}</p>
                          <p className="text-xs text-light-gray">{appointment.name}</p>
                        </div>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${statusConfig.badge}`}>
                          {t(statusConfig.label)}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1.5">
                        <span className="text-xs text-light-gray flex items-center gap-1">
                          <Calendar size={10} />
                          {getDateDisplay(appointment.timestamp)}
                        </span>
                        <span className="text-xs font-bold text-primary">
                          {t('appointments.currencySymbol')}{appointment.type.price}
                        </span>
                      </div>
                    </div>
                    <ArrowIcon size={16} className="text-light-gray/50 shrink-0 mt-1" />
                  </div>

                </motion.div>
              );
            })
          ) : (
            <div className="py-12 text-center">
              <Calendar size={40} className="mx-auto mb-3 text-light-gray/30" />
              <p className="text-light-gray text-sm">{t('appointments.noAppointments')}</p>
            </div>
          )}
        </div>
      </Card>
    </motion.div>
  );
};

export default DashboardAppointmentsList;
