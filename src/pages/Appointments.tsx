import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { format, startOfMonth, endOfMonth, addMonths, subMonths } from 'date-fns';
import { Calendar, CalendarRange, List } from 'lucide-react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { Appointment } from '../types';
import { getAppointments } from '../services/appointmentsApi';
import AppointmentCalendar from '../components/appointments/AppointmentCalendar';
import AppointmentDetails from '../components/appointments/AppointmentDetails';
import { useTheme } from '../contexts/ThemeContext';
import AppointmentsList from '../components/appointments/AppointmentsList';
import { useAppDispatch } from '../hooks/useAppDispatch';
import { useAppSelector } from '../hooks/useAppSelector';
import { fetchAppointments } from '../store/slices/appointmentsSlice';
import { useAuth } from '../contexts/AuthContext';



const Appointments: React.FC = () => {
  const { auth } = useAuth();
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [filter, setFilter] = useState<'all' | 'scheduled' | 'completed' | 'cancelled'>('all');
  const { language, direction } = useTheme();
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>(() => {
    return (localStorage.getItem('appointments_view_mode') as 'calendar' | 'list') || 'list';
  });

  const toggleViewMode = () => {
    const newMode = viewMode === 'calendar' ? 'list' : 'calendar';
    setViewMode(newMode);
    localStorage.setItem('appointments_view_mode', newMode);
  };

  document.title = language === "he" ? "התורים שלך" : "Appointments";

  const dispatch = useAppDispatch();
  const appointments = useAppSelector(state => state.appointments.appointments);
  const isLoading = useAppSelector(state => state.appointments.loading);

  useEffect(() => {
    if (appointments.length === 0 && auth.user) {
      dispatch(fetchAppointments({ user_id: auth.user?._id, limit: 5000 }));
    }
    //update every 4 mins
    const interval = setInterval(() => {
      if (appointments.length && auth.user) {
        dispatch(fetchAppointments({ user_id: auth.user?._id, limit: 5000 }));
      }
    }, 240000)

    return () => clearInterval(interval);
  }, [dispatch, auth]);

  const upcomingAppointments = appointments
    .filter(appointment =>
      appointment.status === 'scheduled' &&
      Number(appointment.timestamp) > Date.now()
    )
    .sort((a, b) => Number(a.timestamp) - Number(b.timestamp));

  const filteredAppointments = filter === 'all'
    ? appointments
    : appointments.filter(appointment => appointment.status === filter);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-4 max-w-7xl mx-auto px-2 sm:px-4"
    >
      {/* Page Title */}
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <CalendarRange className="text-primary w-5 h-5" />
          <h1 className="font-semibold text-xl text-gray-800 dark:text-white">
            {language === 'he' ? 'ניהול התורים שלך' : 'Appointments'}
          </h1>
        </div>
        <p className="text-light-text dark:text-gray-400 text-sm mt-1 mb-2">
          {language === 'he' ? 'צפייה וניהול' : 'View and manage'}
        </p>
      </div>

      <div className={`flex ${direction === 'rtl' ? 'justify-start' : 'justify-end'} mt-4`}>
        <div className="inline-flex items-center bg-gray-200 dark:bg-gray-700 rounded-full p-1">
          <button
            onClick={toggleViewMode}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-sm transition
        ${viewMode === 'calendar'
                ? 'bg-white dark:bg-gray-900 text-black dark:text-white shadow'
                : 'text-gray-600 dark:text-gray-300'}`}
          >
            <Calendar size={16} />
          </button>
          <button
            onClick={toggleViewMode}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-sm transition
        ${viewMode === 'list'
                ? 'bg-white dark:bg-gray-900 text-black dark:text-white shadow'
                : 'text-gray-600 dark:text-gray-300'}`}
          >
            <List size={16} />
          </button>
        </div>
      </div>

      {viewMode === 'calendar' ?
        <Card className="mb-4">

          <div className="flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-2">
              <Button
                variant={filter === 'all' ? 'primary' : 'outline'}
                size="sm"
                onClick={() => setFilter('all')}
              >
                {language === 'he' ? 'הכל' : 'All'}
              </Button>
              <Button
                variant={filter === 'scheduled' ? 'primary' : 'outline'}
                size="sm"
                onClick={() => setFilter('scheduled')}
              >
                {language === 'he' ? 'ממתינים' : 'Scheduled'}
              </Button>
              <Button
                variant={filter === 'completed' ? 'primary' : 'outline'}
                size="sm"
                onClick={() => setFilter('completed')}
              >
                {language === 'he' ? 'הושלמו' : 'Completed'}
              </Button>
              <Button
                variant={filter === 'cancelled' ? 'primary' : 'outline'}
                size="sm"
                onClick={() => setFilter('cancelled')}
              >
                {language === 'he' ? 'בוטלו' : 'Cancelled'}
              </Button>
            </div>
          </div>
          <div className="mt-6">
            <AppointmentCalendar
              appointments={filteredAppointments}
              onAppointmentClick={setSelectedAppointment}
            />
          </div>
        </Card>
        :
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.5 }}
          className="mb-4"
        >
          <AppointmentsList
            appointments={upcomingAppointments}
            onAppointmentClick={setSelectedAppointment}
          />
        </motion.div>
      }
      {selectedAppointment && (
        <AppointmentDetails
          appointment={selectedAppointment}
          onClose={() => setSelectedAppointment(null)}
          onUpdate={() => { }}
        />
      )}
    </motion.div>
  );
};

export default Appointments;