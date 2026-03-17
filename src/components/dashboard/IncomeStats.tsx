import React from 'react';
import { motion } from 'framer-motion';
import { DollarSign, TrendingUp, Calendar } from 'lucide-react';
import { Appointment } from '../../types';
import { useTheme } from '../../contexts/ThemeContext';
import { getDisplayStatus } from '../../utils/appointmentUtils';
import Card from '../ui/Card';

interface IncomeStatsProps {
  appointments: Appointment[];
}

const IncomeStats: React.FC<IncomeStatsProps> = ({ appointments }) => {
  const { language } = useTheme();

  const calculateIncome = (appointments: Appointment[], startDate: Date, endDate: Date) => {
    return appointments
      .filter(appointment => {
        const appointmentDate = new Date(parseInt(appointment.timestamp));
        return appointmentDate >= startDate && appointmentDate <= endDate && getDisplayStatus(appointment) === "completed";
      })
      .reduce((total, appointment) => {
        return total + parseInt(appointment.type.price);
      }, 0);
  };

  const countAppointments = (appointments: Appointment[], startDate: Date, endDate: Date) => {
    return appointments.filter(appointment => {
      const appointmentDate = new Date(parseInt(appointment.timestamp));
      return appointmentDate >= startDate && appointmentDate <= endDate && getDisplayStatus(appointment) === "completed";
    }).length;
  };

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(startOfDay);
  startOfWeek.setDate(startOfDay.getDate() - startOfDay.getDay());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const todayIncome = calculateIncome(appointments, startOfDay, now);
  const weekIncome = calculateIncome(appointments, startOfWeek, now);
  const monthIncome = calculateIncome(appointments, startOfMonth, now);

  const todayAppointments = countAppointments(appointments, startOfDay, now);
  const weekAppointments = countAppointments(appointments, startOfWeek, now);
  const monthAppointments = countAppointments(appointments, startOfMonth, now);

  const stats = [
    {
      title: language === 'he' ? 'הכנסות היום' : "Today's Income",
      value: todayIncome,
      appointments: todayAppointments,
      icon: <Calendar className="text-blue-500" />,
      color: 'bg-blue-100',
      delay: 0.1,
    },
    {
      title: language === 'he' ? 'הכנסות השבוע' : 'Weekly Income',
      value: weekIncome,
      appointments: weekAppointments,
      icon: <TrendingUp className="text-green-500" />,
      color: 'bg-green-100',
      delay: 0.2,
    },
    {
      title: language === 'he' ? 'הכנסות החודש' : 'Monthly Income',
      value: monthIncome,
      appointments: monthAppointments,
      icon: <DollarSign className="text-violet-500" />,
      color: 'bg-violet-100',
      delay: 0.3,
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {stats.map((stat, index) => (
        <motion.div
          key={index}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: stat.delay }}
          className="relative overflow-hidden shadow-md rounded-lg"
        >
          <Card className="h-full">

            <div className="flex items-center justify-between">
              <div>
                <p className="text-light-gray text-sm">{stat.title}</p>
                <div className="flex items-baseline mt-1">
                  <h4 className="text-2xl font-bold">
                    {language === 'he' ? '₪' : '$'}{stat.value.toLocaleString()}
                  </h4>
                  <span className="text-light-gray text-sm italic mx-2">
                    / {stat.appointments} {language === 'he' ? 'תורים' : 'appointments'}
                  </span>
                </div>
              </div>
              <div className={`p-3 rounded-full ${stat.color}`}>
                {stat.icon}
              </div>
            </div>

            <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-primary/20 to-primary"></div>
          </Card>
        </motion.div>
      ))}
    </div>
  );
};

export default IncomeStats;