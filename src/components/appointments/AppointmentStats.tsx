import React from 'react';
import { Hourglass } from 'lucide-react';
import { motion } from 'framer-motion';
import { Appointment } from '../../types';
import { useTranslation } from 'react-i18next';

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
      className="glass-card rounded-lg p-6 relative overflow-hidden"
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
  const { t } = useTranslation();

  const upcomingAppointments = appointments.filter(
    (appointment) =>
      appointment.status === 'scheduled' &&
      parseInt(appointment.timestamp) > Date.now()
  ).length;

  const stats = [
    {
      title: t('appointmentStats.upcoming'),
      value: upcomingAppointments,
      icon: <Hourglass className="text-violet-500" size={24} />,
      color: 'bg-violet-100',
      delay: 0.2,
    },
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
