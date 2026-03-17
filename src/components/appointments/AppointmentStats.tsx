import React from 'react';
import { CalendarCheck, Users, Hourglass, XCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import Card from '../ui/Card';
import { Appointment } from '../../types';
import { useTheme } from '../../contexts/ThemeContext';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
  delay: number;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon, color, delay }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3 }}
      className="bg-light-surface rounded-lg shadow-sm p-6 relative overflow-hidden border border-light-gray/10"
    >
      <div className="flex justify-between items-start">
        <div>
          <p className="text-light-gray text-sm font-medium">{title}</p>
          <h4 className="text-2xl font-bold mt-1">{value}</h4>
        </div>
        <div className={`p-3 rounded-full ${color}`}>
          {icon}
        </div>
      </div>
      <div
        className="absolute w-16 h-16 rounded-full -right-4 -bottom-4 opacity-10"
        style={{ background: color }}
      ></div>
    </motion.div>
  );
};

interface AppointmentStatsProps {
  appointments: Appointment[];
}

const AppointmentStats: React.FC<AppointmentStatsProps> = ({ appointments }) => {
  const { language } = useTheme();

  const totalAppointments = appointments.length;
  
  const completedAppointments = appointments.filter(
    (appointment) => appointment.status === 'completed'
  ).length;
  
  const upcomingAppointments = appointments.filter(
    (appointment) => 
      appointment.status === 'scheduled' && 
      parseInt(appointment.timestamp) > Date.now()
  ).length;
  
  const cancelledAppointments = appointments.filter(
    (appointment) => appointment.status === 'cancelled'
  ).length;

  const stats = [
    // {
    //   title: language === 'he' ? 'סך התורים' : 'Total Appointments',
    //   value: totalAppointments,
    //   icon: <CalendarCheck className="text-blue-500" size={24} />,
    //   color: 'bg-blue-100',
    //   delay: 0.1,
    // },
    {
      title: language === 'he' ? 'תורים לביצוע' : 'Upcoming',
      value: upcomingAppointments,
      icon: <Hourglass className="text-violet-500" size={24} />,
      color: 'bg-violet-100',
      delay: 0.2,
    },
    // {
    //   title: language === 'he' ? 'הושלמו' : 'Completed',
    //   value: completedAppointments,
    //   icon: <CalendarCheck className="text-green-500" size={24} />,
    //   color: 'bg-green-100',
    //   delay: 0.3,
    // },
    // {
    //   title: language === 'he' ? 'בוטלו' : 'Cancelled',
    //   value: cancelledAppointments,
    //   icon: <XCircle className="text-red-500" size={24} />,
    //   color: 'bg-red-100',
    //   delay: 0.4,
    // },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {stats.map((stat, index) => (
        <StatCard
          key={index}
          title={stat.title}
          value={stat.value}
          icon={stat.icon}
          color={stat.color}
          delay={stat.delay}
        />
      ))}
    </div>
  );
};

export default AppointmentStats;