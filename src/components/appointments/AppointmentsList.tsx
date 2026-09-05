import React from 'react';
import { Calendar, Clock, User, Phone } from 'lucide-react';
import { motion } from 'framer-motion';
import Card from '../ui/Card';
import { Appointment } from '../../types';
import { formatTime } from '../../utils/dateUtils';
import { useTheme } from '../../contexts/ThemeContext';
import { isToday, isTomorrow, format } from 'date-fns';
import { he, enUS } from 'date-fns/locale';
import { getDisplayStatus } from '../../utils/appointmentUtils';
import { useTranslation } from 'react-i18next';
import { formatPhoneForDisplay, whatsAppHref } from '../../utils/phone';

interface AppointmentsListProps {
  appointments: Appointment[];
  onAppointmentClick: (appointment: Appointment) => void;
}

const AppointmentsList: React.FC<AppointmentsListProps> = ({
  appointments,
  onAppointmentClick
}) => {
  const { language, direction } = useTheme();
  const { t } = useTranslation();
  const locale = language === 'he' ? he : enUS;

  const getStatusTag = (status: string) => {
    switch (status) {
      case 'scheduled':
        return (
          <span className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 text-xs px-2.5 py-1 rounded-full font-medium">
            {t('appointments.scheduled')}
          </span>
        );
      case 'completed':
        return (
          <span className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 text-xs px-2.5 py-1 rounded-full font-medium">
            {t('appointments.completed')}
          </span>
        );
      case 'cancelled':
        return (
          <span className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 text-xs px-2.5 py-1 rounded-full font-medium">
            {t('appointments.cancelled')}
          </span>
        );
      case 'ongoing':
        return (
          <span className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 text-xs px-2.5 py-1 rounded-full font-medium">
            {t('appointments.ongoing')}
          </span>
        );
      default:
        return null;
    }
  };

  const sortedAppointments = [...appointments].sort(
    (a, b) => parseInt(a.timestamp) - parseInt(b.timestamp)
  );



  const getDateDisplay = (timestamp: string) => {
    const date = new Date(parseInt(timestamp));
    const time = formatTime(date);

    if (isToday(date)) {
      return `${t('appointments.today')}, ${time}`;
    }
    if (isTomorrow(date)) {
      return `${t('appointments.tomorrow')}, ${time}`;
    }
    return `${format(date, 'PPP', { locale })}, ${time}`;
  };

  return (
    <Card className="h-full overflow-hidden w-full mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h3 className="font-semibold text-xl">
          {t('appointments.upcoming')}
        </h3>
      </div>

      <div className="overflow-y-auto max-h-[calc(100vh-18.75rem)] scrollbar-thin">
        {sortedAppointments.length > 0 ? (
          <div className="space-y-4">
            {sortedAppointments.map((appointment, i) => (
              <motion.div
                key={appointment._id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => onAppointmentClick(appointment)}
                className="group cursor-pointer"
              >
                <div className={`bg-light-surface p-4 rounded-xl border border-light-gray/10 shadow-sm
                  hover:shadow-md hover:border-primary/20 transition-all duration-200 transform hover:-translate-y-1
                  dark:shadow-none dark:hover:shadow-none dark:hover:bg-dark-surface/50
                  ${direction === 'rtl' ? 'text-right' : 'text-left'}`}>
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h4 className="font-medium text-lg mb-1 group-hover:text-primary transition-colors">
                        {appointment.type.name}
                      </h4>
                      <div className={`flex items-center text-light-gray text-sm ${direction === 'rtl' ? 'ml-2' : 'mr-2'}`}>
                        <Calendar size={14} className={direction === 'rtl' ? 'ml-2' : 'mr-2'} />
                        <span>{getDateDisplay(appointment.timestamp)}</span>
                      </div>
                    </div>
                    {getStatusTag(getDisplayStatus(appointment))}
                  </div>

                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <div className="flex items-center text-light-text">
                      <User size={16} className={`text-light-gray ${direction === 'rtl' ? 'ml-2' : 'mr-2'}`} />
                      <span className="text-sm">{appointment.name}</span>
                    </div>

                    <div className="flex items-center justify-end gap-2">
                      <a
                        href={`tel:${formatPhoneForDisplay(appointment.phone)}`}
                        onClick={(e) => e.stopPropagation()}
                        className="p-2 rounded-full bg-[#088F8F] text-white hover:bg-[#088F8F]/80 transition-colors"
                        title={t('appointments.call')}
                      >
                        <Phone size={16} />
                      </a>
                      <a
                        href={whatsAppHref(appointment.phone)}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="p-2 rounded-full bg-green-500 text-white hover:bg-green-600 transition-colors"
                        title="WhatsApp"
                      >
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                        </svg>
                      </a>
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t border-light-gray/10">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center text-light-gray">
                        <Clock size={14} className={direction === 'rtl' ? 'ml-1' : 'mr-1'} />
                        <span>
                          {Number(appointment.type.durationMS) / 60000} {t('appointments.minutes')}
                        </span>
                      </div>
                      <span className="font-medium text-primary">
                        {t('appointments.currencySymbol')}{appointment.type.price}
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="py-12 text-center">
            <Calendar size={48} className="mx-auto mb-4 text-light-gray/50" />
            <p className="text-light-gray text-lg">
              {t('appointments.noAppointments')}
            </p>
          </div>
        )}
      </div>
    </Card>
  );
};

export default AppointmentsList;
