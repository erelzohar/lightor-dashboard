import React, { useState, useCallback, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Calendar, CalendarPlus, CalendarRange, List } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { useStore } from 'react-redux';
import { startOfDay } from 'date-fns';
import { Appointment } from '../types';
import AppointmentCalendar from '../components/appointments/AppointmentCalendar';
import AppointmentDetails from '../components/appointments/AppointmentDetails';
import AppointmentsList from '../components/appointments/AppointmentsList';
import OwnerBookingModal from '../components/customers/OwnerBookingModal';
import ExportAppointmentsButton from '../components/appointments/ExportAppointmentsButton';
import PullToRefresh from '../components/ui/PullToRefresh';
import { useAppDispatch } from '../hooks/useAppDispatch';
import { useAppSelector } from '../hooks/useAppSelector';
import { fetchAppointments } from '../store/slices/appointmentsSlice';
import { useAppointmentsAutoRefresh } from '../hooks/useAppointmentsAutoRefresh';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { localDateKey } from '../utils/bookingSlots';
import type { RootState } from '../store/store';

/** A local calendar day from "YYYY-MM-DD"; null for anything else, 2026-02-31 included. */
const parseDay = (value: string): Date | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  const day = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return localDateKey(day) === value ? day : null;
};

const Appointments: React.FC = () => {
  const { auth } = useAuth();
  const { t } = useTranslation();
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>(() => {
    return (localStorage.getItem('appointments_view_mode') as 'calendar' | 'list') || 'calendar';
  });
  // The owner books from here too (LT-211), on the site's own calendar; the
  // booking window fetches the appointments again when it books.
  const [booking, setBooking] = useState(false);

  document.title = t('appointments.title');

  const dispatch = useAppDispatch();
  const appointments = useAppSelector(state => state.appointments.appointments);
  const isLoading = useAppSelector(state => state.appointments.loading);

  useAppointmentsAutoRefresh(auth.user?._id);

  const refresh = useCallback(async () => {
    if (auth.user) await dispatch(fetchAppointments({ user_id: auth.user._id, limit: 5000 }));
  }, [dispatch, auth.user]);

  // Links into the calendar (LT-267): Lighty's answers name a day
  // (`?date=2026-10-14`), a push notification its booking (`?focus=<id>`).
  // Each opens the calendar on that day, and is then taken off the URL so a
  // refresh does not open it again.
  const [searchParams, setSearchParams] = useSearchParams();
  const dateParam = searchParams.get('date');
  const focusId = searchParams.get('focus');
  const [openDay, setOpenDay] = useState<Date | null>(null);
  const store = useStore<RootState>();
  // The booking a load was awaited for: one still missing after it is gone.
  const focusAwaited = useRef<string | null>(null);

  useEffect(() => {
    if (!dateParam && !focusId) return;
    const done: string[] = [];
    const show = (day: Date) => {
      setViewMode('calendar');
      setOpenDay(day);
    };
    if (dateParam) {
      const day = parseDay(dateParam);
      if (day) show(day);
      done.push('date');
    }
    if (focusId) {
      const appointment = appointments.find((a) => a._id === focusId);
      if (appointment) {
        show(startOfDay(new Date(Number(appointment.timestamp))));
        setSelectedAppointment(appointment);
        focusAwaited.current = null;
        done.push('focus');
      } else if (isLoading || store.getState().appointments.loading) {
        // A push can be quicker than the list: wait for the load on its way
        // (on arrival, the page's own).
        focusAwaited.current = focusId;
      } else if (focusAwaited.current === focusId) {
        focusAwaited.current = null;
        done.push('focus');
      } else {
        // Tapped while this page was open: read the book again first.
        focusAwaited.current = focusId;
        void refresh();
      }
    }
    if (done.length > 0) {
      setSearchParams((params) => {
        const next = new URLSearchParams(params);
        done.forEach((name) => next.delete(name));
        return next;
      }, { replace: true });
    }
  }, [dateParam, focusId, appointments, isLoading, store, refresh, setSearchParams]);

  const upcomingAppointments = appointments
    .filter(appointment =>
      appointment.status === 'scheduled' &&
      Number(appointment.timestamp) > Date.now()
    )
    .sort((a, b) => Number(a.timestamp) - Number(b.timestamp));

  // The spinner is for the first load only (LT-204). A refetch — the
  // 4-minute refresh, or the one after the owner seats a walk-in from a class
  // roster — keeps the page mounted: tearing it down closed the open roster
  // and threw the calendar back to this week.
  if (isLoading && appointments.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <PullToRefresh onRefresh={refresh} fill={viewMode === 'calendar'}>
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      // A full-bleed page (LT-307): the calendar fills the pane down to the
      // tab bar's room and scrolls inside; the list grows past it, and the
      // page — not the scroller — carries that room, so it renders below it.
      className={`flex flex-col gap-4 flex-1 pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-8 ${viewMode === 'calendar' ? 'min-h-0' : ''}`}
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

        <div className="flex items-center gap-2 shrink-0">
          <ExportAppointmentsButton />
          <button
            type="button"
            onClick={() => setBooking(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold bg-primary text-white hover:bg-primary-dark transition-colors"
          >
            <CalendarPlus size={15} className="shrink-0" />
            <span className="hidden sm:inline">{t('appointments.newAppointment')}</span>
            <span className="sr-only sm:hidden">{t('appointments.newAppointment')}</span>
          </button>

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
            openDay={openDay}
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

      <OwnerBookingModal open={booking} onClose={() => setBooking(false)} onBooked={() => undefined} />

      {/* Details modal — from the sidebar's "next appointment" card, the list,
          or a link to one booking (`?focus=`) */}
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
