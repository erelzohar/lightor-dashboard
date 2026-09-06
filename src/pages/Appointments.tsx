import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Calendar, CalendarRange, List } from 'lucide-react';
import { Appointment } from '../types';
import AppointmentCalendar from '../components/appointments/AppointmentCalendar';
import AppointmentDetails from '../components/appointments/AppointmentDetails';
import { useTheme } from '../contexts/ThemeContext';
import AppointmentsList from '../components/appointments/AppointmentsList';
import PullToRefresh from '../components/ui/PullToRefresh';
import { useAppDispatch } from '../hooks/useAppDispatch';
import { useAppSelector } from '../hooks/useAppSelector';
import { fetchAppointments } from '../store/slices/appointmentsSlice';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';

const Appointments: React.FC = () => {
  const { auth } = useAuth();
  const { t } = useTranslation();
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const { direction } = useTheme();
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>(() => {
    return (localStorage.getItem('appointments_view_mode') as 'calendar' | 'list') || 'calendar';
  });

  const toggleViewMode = () => {
    const newMode = viewMode === 'calendar' ? 'list' : 'calendar';
    setViewMode(newMode);
    localStorage.setItem('appointments_view_mode', newMode);
  };

  document.title = t('appointments.title');

  const dispatch = useAppDispatch();
  const appointments = useAppSelector(state => state.appointments.appointments);
  const isLoading = useAppSelector(state => state.appointments.loading);

  useEffect(() => {
    if (appointments.length === 0 && auth.user) {
      dispatch(fetchAppointments({ user_id: auth.user?._id, limit: 5000 }));
    }
    const interval = setInterval(() => {
      if (appointments.length && auth.user) {
        dispatch(fetchAppointments({ user_id: auth.user?._id, limit: 5000 }));
      }
    }, 240000);
    return () => clearInterval(interval);
  }, [dispatch, auth]);

  const refresh = useCallback(async () => {
    if (auth.user) await dispatch(fetchAppointments({ user_id: auth.user._id, limit: 5000 }));
  }, [dispatch, auth.user]);

  const upcomingAppointments = appointments
    .filter(appointment =>
      appointment.status === 'scheduled' &&
      Number(appointment.timestamp) > Date.now()
    )
    .sort((a, b) => Number(a.timestamp) - Number(b.timestamp));

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <PullToRefresh onRefresh={refresh}>
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col gap-4 h-full"
    >
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <CalendarRange className="text-primary w-6 h-6 shrink-0" />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
              {t('appointments.title')}
            </h1>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {t('appointments.description')}
          </p>
        </div>

        {/* View toggle */}
        <div className="inline-flex items-center bg-gray-100 dark:bg-gray-800 rounded-xl p-1 shrink-0">
          <button
            onClick={() => { setViewMode('calendar'); localStorage.setItem('appointments_view_mode', 'calendar'); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all
              ${viewMode === 'calendar'
                ? 'bg-white dark:bg-gray-700 text-gray-800 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
          >
            <Calendar size={15} />
            <span className="hidden sm:inline">{t('appointments.calendarView') || 'Calendar'}</span>
          </button>
          <button
            onClick={() => { setViewMode('list'); localStorage.setItem('appointments_view_mode', 'list'); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all
              ${viewMode === 'list'
                ? 'bg-white dark:bg-gray-700 text-gray-800 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
          >
            <List size={15} />
            <span className="hidden sm:inline">{t('appointments.listView') || 'List'}</span>
          </button>
        </div>
      </div>

      {/* Content */}
      {viewMode === 'calendar' ? (
        <motion.div
          key="calendar"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="rounded-2xl overflow-hidden shadow-sm flex-1 min-h-0"
        >
          <AppointmentCalendar
            appointments={appointments}
            onAppointmentClick={setSelectedAppointment}
          />
        </motion.div>
      ) : (
        <motion.div
          key="list"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="mb-4"
        >
          <AppointmentsList
            appointments={upcomingAppointments}
            onAppointmentClick={setSelectedAppointment}
          />
        </motion.div>
      )}

      {/* Details modal — triggered only from sidebar "next appointment" card */}
      {selectedAppointment && (
        <AppointmentDetails
          appointment={selectedAppointment}
          onClose={() => setSelectedAppointment(null)}
          onUpdate={() => { }}
        />
      )}
    </motion.div>
    </PullToRefresh>
  );
};

export default Appointments;
