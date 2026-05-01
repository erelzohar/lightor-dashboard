import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Clock, User } from 'lucide-react';
import { format, addDays, isToday, isSameDay } from 'date-fns';
import { he } from 'date-fns/locale';
import { Appointment } from '../../types';
import { formatTime } from '../../utils/dateUtils';
import { getDisplayStatus } from '../../utils/appointmentUtils';
import { useTheme } from '../../contexts/ThemeContext';

interface AppointmentCalendarProps {
  appointments: Appointment[];
  onAppointmentClick: (appointment: Appointment) => void;
}

const AppointmentCalendar: React.FC<AppointmentCalendarProps> = ({
  appointments,
  onAppointmentClick,
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [visibleDays, setVisibleDays] = useState(7);
  const { direction, language } = useTheme();

  const locale = language === 'he' ? he : undefined;

  // Update visible days based on screen size
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 640) {
        setVisibleDays(1);
      } else if (window.innerWidth < 1024) {
        setVisibleDays(3);
      } else {
        setVisibleDays(7);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const weekDays = Array.from({ length: visibleDays }).map((_, i) => addDays(currentDate, i));

  const nextDay = () => setCurrentDate(prev => addDays(prev, visibleDays));
  const prevDay = () => setCurrentDate(prev => addDays(prev, -visibleDays));
  const goToToday = () => setCurrentDate(new Date());

  return (
    <>
      <div className="flex justify-center items-center gap-2 mb-6">
        <button
          onClick={prevDay}
          className="p-2 rounded-lg hover:bg-light-gray/10 transition-colors"
        >
          {direction === 'rtl' ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
        </button>

        <h2 className="text-xl font-semibold mx-4">
          {format(currentDate, 'MMMM yyyy', { locale })}
        </h2>

        <button
          onClick={nextDay}
          className="p-2 rounded-lg hover:bg-light-gray/10 transition-colors"
        >
          {direction === 'rtl' ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
        </button>
      </div>

      <button
        onClick={goToToday}
        className="px-4 py-1.5 m-1 text-sm rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
      >
        {language === 'he' ? 'איפוס' : 'reset'}
      </button>

      <motion.div
        layout
        className="grid gap-1 md:gap-2 mb-4"
        style={{ gridTemplateColumns: `repeat(${visibleDays}, minmax(0, 1fr))` }}
      >
        {weekDays.map((day) => (
          <motion.div
            key={day.toString()}
            layout
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="text-center"
          >
            <p className="text-xs sm:text-sm text-light-gray mb-2">
              {format(day, 'EEEE', { locale })}
            </p>
            <div
              className={`
                w-8 h-8 sm:w-10 sm:h-10 mx-auto rounded-xl flex items-center justify-center
                ${isToday(day)
                  ? 'bg-primary text-white'
                  : 'text-light-text dark:text-dark-text hover:bg-light-gray/10 dark:hover:bg-dark-gray/10'
                }
                transition-colors
              `}
            >
              <span className="font-medium text-sm sm:text-base">
                {format(day, 'd', { locale })}
              </span>
            </div>
          </motion.div>
        ))}
      </motion.div>

      <motion.div
        layout
        className="overflow-y-auto overflow-x-hidden max-h-[calc(100vh-25rem)]"
      >
        <div
          className="grid gap-1 md:gap-2"
          style={{ gridTemplateColumns: `repeat(${visibleDays}, minmax(0, 1fr))` }}
        >
          {weekDays.map((day) => {
            const dayAppointments = appointments
              .filter((appointment) =>
                isSameDay(new Date(parseInt(appointment.timestamp)), day)
              )
              .sort((a, b) => parseInt(a.timestamp) - parseInt(b.timestamp));

            return (
              <motion.div
                key={day.toString()}
                layout
                className="min-h-[7.5rem] px-0.5"
              >
                {dayAppointments.length > 0 ? (
                  <div className="space-y-1 py-0.5">
                    {dayAppointments.map((appointment) => (
                      <motion.div
                        key={appointment._id}
                        layout
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => onAppointmentClick(appointment)}
                        className={`
                          p-2 sm:p-3 rounded-xl cursor-pointer text-xs sm:text-sm
                          ${(() => {
                            const displayStatus = getDisplayStatus(appointment);
                            if (displayStatus === 'cancelled') return 'bg-red-50 dark:bg-red-900/20 border-l-2 border-red-400 dark:border-red-500';
                            if (displayStatus === 'completed') return 'bg-green-50 dark:bg-green-900/20 border-l-2 border-green-400';
                            if (displayStatus === 'ongoing') return 'bg-amber-50 dark:bg-amber-900/20 border-l-2 border-amber-400 dark:border-amber-500';
                            return 'bg-blue-50 dark:bg-blue-900/20 border-l-2 border-blue-400 dark:border-blue-500';
                          })()}
                          hover:shadow-md dark:hover:shadow-none transition-all duration-200
                        `}
                      >
                        <div className="flex flex-wrap items-center gap-1 mb-1 sm:mb-2">
                          <div className="flex items-center">
                            <Clock size={12} className="mr-1 hidden sm:block" />
                            <span className="font-medium">
                              {formatTime(parseInt(appointment.timestamp))}
                            </span>
                          </div>
                          <span className="text-[0.625rem] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded-full bg-white/50 dark:bg-black/10 whitespace-nowrap">
                            {Number(appointment.type.durationMS) / 60000} {language === 'he' ? 'דק' : 'm'}
                          </span>
                        </div>

                        <p className="font-medium mb-1 sm:mb-2 line-clamp-1 text-[0.6875rem] sm:text-sm">
                          {appointment.type.name}
                        </p>

                        <div className="flex items-center text-[0.625rem] sm:text-xs text-light-gray dark:text-dark-gray">
                          <User size={10} className="mr-1 hidden sm:block" />
                          <span className="truncate">{appointment.name}</span>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <div className="h-full min-h-[7.5rem] rounded-xl bg-light-gray/10 relative overflow-hidden">
                    <div
                      className="absolute inset-0"
                      style={{
                        backgroundImage: `repeating-linear-gradient(
                          45deg,
                          transparent,
                          transparent 0.625rem,
                          rgba(100, 116, 139, 0.05) 0.625rem,
                          rgba(100, 116, 139, 0.05) 1.25rem
                        )`
                      }}
                    />
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      </motion.div>
    </>
  );
};

export default AppointmentCalendar;