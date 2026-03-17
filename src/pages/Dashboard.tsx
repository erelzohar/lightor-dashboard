import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Sun, Moon } from 'lucide-react';
import { Appointment } from '../types';
import AppointmentStats from '../components/appointments/AppointmentStats';
import AppointmentsList from '../components/appointments/AppointmentsList';
import AppointmentDetails from '../components/appointments/AppointmentDetails';
import IncomeStats from '../components/dashboard/IncomeStats';
import AppointmentsGraph from '../components/dashboard/AppointmentsGraph';
import { useTheme } from '../contexts/ThemeContext';
import { useAppDispatch } from '../hooks/useAppDispatch';
import { useAppSelector } from '../hooks/useAppSelector';
import { fetchAppointments } from '../store/slices/appointmentsSlice';
import { useAuth } from '../contexts/AuthContext';
import ErrorBoundaryWithLanguage from '../components/ui/ErrorBoundary';
import DashboardFallback from '../components/dashboard/DashboardFallback';

const greetingsMap = {
  en: {
    morning: 'Good morning',
    afternoon: 'Good afternoon',
    evening: 'Good evening',
    night: 'Good night',
  },
  he: {
    morning: 'בוקר טוב',
    afternoon: 'צהריים טובים',
    evening: 'ערב טוב',
    night: 'לילה טוב'
  }
};

const getGreeting = (language: 'en' | 'he'): string => {
  const hour = new Date().getHours();
  const langGreetings = greetingsMap[language];

  if (hour < 12 && hour > 4) return langGreetings.morning;
  if (hour < 12 && hour < 4) return langGreetings.night;
  if (hour < 18) return langGreetings.afternoon;
  return langGreetings.evening;
};

const getGreetingIcon = () => {
  const hour = new Date().getHours();
  // 5 AM to 5:59 PM gets Sun
  if (hour >= 5 && hour < 18) return Sun;
  // 6 PM to 4:59 AM gets Moon
  return Moon;
};

const Dashboard: React.FC = () => {
  const { auth } = useAuth();
  // const [error, setError] = useState<string | null>(null);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const { language } = useTheme();

  const GreetingIcon = getGreetingIcon();


  const dispatch = useAppDispatch();
  const appointments = useAppSelector(state => state.appointments.appointments);
  const isLoading = useAppSelector(state => state.appointments.loading);
  document.title = language === "he" ? "לוח בקרה" : "Dashboard";

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

  const upcomingAppointments = appointments.filter(appointment =>
    appointment.status === 'scheduled' &&
    +appointment.timestamp > Date.now()
  )
    .sort((a, b) => +a.timestamp - +b.timestamp);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-4"
    >
      {/* Page Title */}
      <div className="mb-6">
        <div className="flex items-center justify-center gap-3">
          <motion.div
            initial={{ rotate: -20, scale: 0.8, opacity: 0 }}
            animate={{ rotate: 0, scale: 1, opacity: 1 }}
            transition={{
              type: "spring",
              stiffness: 200,
              damping: 10,
              duration: 0.5
            }}
            whileHover={{ scale: 1.1, rotate: 15 }}
            className={`p-1 rounded-full shadow-sm ${GreetingIcon === Sun
              ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-500 shadow-amber-200/50'
              : 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-500 shadow-indigo-200/50'
              }`}
          >
            <GreetingIcon className="w-7 h-7" />
          </motion.div>
          <h1 className="font-semibold text-2xl text-gray-800 dark:text-white">
            {language === 'he'
              ? `${getGreeting('he')} , ${auth.user.name}`
              : `${getGreeting('en')} , ${auth.user.name}`}
          </h1>
        </div>
      </div>

      {/* Income Stats */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="mb-4"
      >
        <ErrorBoundaryWithLanguage
          fallback={<DashboardFallback language={language} title={language === 'he' ? 'שגיאה בטעינת נתוני הכנסות' : 'Error loading income stats'} />}
        >
          <IncomeStats
            appointments={appointments}
          />
        </ErrorBoundaryWithLanguage>
      </motion.div>

      {/* Appointments Graph */}
      <ErrorBoundaryWithLanguage
        fallback={<DashboardFallback language={language} title={language === 'he' ? 'שגיאה בטעינת גרף תורים' : 'Error loading appointments graph'} />}
      >
        <AppointmentsGraph
          appointments={appointments}
        />
      </ErrorBoundaryWithLanguage>

      {/* Stats Overview */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <ErrorBoundaryWithLanguage
          fallback={<DashboardFallback language={language} title={language === 'he' ? 'שגיאה בטעינת סטטיסטיקות' : 'Error loading stats'} />}
        >
          <AppointmentStats appointments={appointments} />
        </ErrorBoundaryWithLanguage>
      </motion.div>

      {/* Upcoming Appointments */}
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.5 }}
        className="mb-4"
      >
        <ErrorBoundaryWithLanguage
          fallback={<DashboardFallback language={language} title={language === 'he' ? 'שגיאה בטעינת רשימת תורים' : 'Error loading appointments list'} />}
        >
          <AppointmentsList
            appointments={upcomingAppointments}
            onAppointmentClick={setSelectedAppointment}
          />
        </ErrorBoundaryWithLanguage>
      </motion.div>

      {/* Appointment Details Modal */}
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

export default Dashboard;

