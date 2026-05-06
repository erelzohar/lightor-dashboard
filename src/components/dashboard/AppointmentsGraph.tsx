import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { format, eachMonthOfInterval, eachDayOfInterval, startOfMonth, endOfMonth, subMonths, subYears, startOfYear, endOfYear, addMonths, addYears, addWeeks, subWeeks, startOfWeek, endOfWeek } from 'date-fns';
import { he } from 'date-fns/locale';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Appointment } from '../../types';
import { useTheme } from '../../contexts/ThemeContext';
import Card from '../ui/Card';
import Button from '../ui/Button';
import { ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';
import { getDisplayStatus } from '../../utils/appointmentUtils';
import { useTranslation } from 'react-i18next';

interface AppointmentsGraphProps {
  appointments: Appointment[];
}

type TimeRange = 'week' | 'month' | 'year' | 'all';

const AppointmentsGraph: React.FC<AppointmentsGraphProps> = ({ appointments }) => {
  const { language, direction, darkMode } = useTheme();
  const { t } = useTranslation();
  const [timeRange, setTimeRange] = useState<TimeRange>('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1300);

  React.useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 1300);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const getDateRange = () => {
    const now = currentDate;
    switch (timeRange) {
      case 'week':
        return { start: startOfWeek(now), end: endOfWeek(now) };
      case 'month':
        return { start: startOfMonth(now), end: endOfMonth(now) };
      case 'year':
        return { start: startOfYear(now), end: endOfYear(now) };
      case 'all':
        return { start: subYears(now, 2), end: addYears(now, 2) };
    }
  };

  const { start, end } = getDateRange();

  const filteredAppointments = appointments.filter(appointment => {
    const appointmentDate = new Date(parseInt(appointment.timestamp));
    return appointmentDate >= start && appointmentDate <= end;
  });

  const data = (() => {
    if (timeRange === 'year' || timeRange === 'all') {
      return eachMonthOfInterval({ start, end })
        .map(monthStart => {
          const monthEnd = endOfMonth(monthStart);
          const monthAppointments = filteredAppointments.filter(appointment => {
            const appointmentDate = new Date(parseInt(appointment.timestamp));
            return appointmentDate >= monthStart && appointmentDate <= monthEnd;
          });

          const expectedIncome = monthAppointments.reduce((total, app) => {
            return total + parseInt(app.type.price);
          }, 0);

          return {
            date: format(monthStart, 'MMM yyyy', { locale: language === 'he' ? he : undefined }),
            appointments: monthAppointments.length,
            scheduled: monthAppointments.filter(app => {
              const s = getDisplayStatus(app);
              return s === 'scheduled' || s === 'ongoing';
            }).length,
            completed: monthAppointments.filter(app => getDisplayStatus(app) === 'completed').length,
            cancelled: monthAppointments.filter(app => getDisplayStatus(app) === 'cancelled').length,
            expectedIncome
          };
        });
    } else {
      return eachDayOfInterval({ start, end })
        .map(date => {
          const dayAppointments = filteredAppointments.filter(appointment => {
            const appointmentDate = new Date(parseInt(appointment.timestamp));
            return (
              appointmentDate.getDate() === date.getDate() &&
              appointmentDate.getMonth() === date.getMonth()
            );
          });

          const expectedIncome = dayAppointments
            .filter(app => app.status !== 'cancelled')
            .reduce((total, app) => total + parseInt(app.type.price), 0);

          return {
            date: format(date, (timeRange === 'month' ? (isMobile ? 'd' : "d MMM") : 'E'), { locale: language === 'he' ? he : undefined }),
            appointments: dayAppointments.length,
            scheduled: dayAppointments.filter(app => {
              const s = getDisplayStatus(app);
              return s === 'scheduled' || s === 'ongoing';
            }).length,
            completed: dayAppointments.filter(app => getDisplayStatus(app) === 'completed').length,
            cancelled: dayAppointments.filter(app => getDisplayStatus(app) === 'cancelled').length,
            expectedIncome
          };
        });
    }
  })();

  const timeRangeOptions: { value: TimeRange; label: string }[] = [
    { value: 'week', label: t('appointmentsGraph.week') },
    { value: 'month', label: t('appointmentsGraph.month') },
    { value: 'year', label: t('appointmentsGraph.year') },
    { value: 'all', label: t('appointmentsGraph.all') }
  ];

  const getRangeTitle = () => {
    switch (timeRange) {
      case 'week': return t('appointmentsGraph.weekly');
      case 'month': return t('appointmentsGraph.monthly');
      case 'year': return t('appointmentsGraph.yearly');
      case 'all': return t('appointmentsGraph.allLabel');
    }
  };

  const handlePrevious = () => {
    switch (timeRange) {
      case 'week': setCurrentDate(prev => subWeeks(prev, 1)); break;
      case 'month': setCurrentDate(prev => startOfMonth(subMonths(prev, 1))); break;
      case 'year': setCurrentDate(prev => subYears(prev, 1)); break;
      case 'all': setCurrentDate(prev => subYears(prev, 1)); break;
    }
  };

  const handleNext = () => {
    switch (timeRange) {
      case 'week': setCurrentDate(prev => addWeeks(prev, 1)); break;
      case 'month': setCurrentDate(prev => startOfMonth(addMonths(prev, 1))); break;
      case 'year': setCurrentDate(prev => addYears(prev, 1)); break;
      case 'all': setCurrentDate(prev => addYears(prev, 1)); break;
    }
  };

  const handleReset = () => {
    const today = new Date();
    if (timeRange === 'month') setCurrentDate(startOfMonth(today));
    else setCurrentDate(today);
  };

  const getCurrentPeriodLabel = () => {
    switch (timeRange) {
      case 'week': {
        const weekStart = startOfWeek(currentDate);
        const weekEnd = endOfWeek(currentDate);
        return `${format(weekStart, 'd')} - ${format(weekEnd, 'd MMM yyyy', { locale: language === 'he' ? he : undefined })}`;
      }
      case 'month':
        return format(currentDate, 'MMMM yyyy', { locale: language === 'he' ? he : undefined });
      case 'year':
        return format(currentDate, 'yyyy', { locale: language === 'he' ? he : undefined });
      case 'all':
        return `${format(start, 'yyyy')} - ${format(end, 'yyyy')}`;
    }
  };

  const isAtPastLimit = () => {
    const twoYearsAgo = subYears(new Date(), 2);
    return currentDate <= twoYearsAgo;
  };

  const isAtFutureLimit = () => {
    const twoYearsAhead = addYears(new Date(), 2);
    return currentDate >= twoYearsAhead;
  };

  const PrevButton = direction === 'rtl' ? ChevronRight : ChevronLeft;
  const NextButton = direction === 'rtl' ? ChevronLeft : ChevronRight;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
    >
      <Card className="-mx-4.5 px-1">
        <div className="flex flex-col sm:flex-row justify-around items-center gap-4 mb-6">
          <h3 className="font-semibold text-lg flex items-center gap-2">
            {getRangeTitle()}
          </h3>
          {timeRange !== 'all' && (
            <div className="flex items-center gap-2">
              <Button
                variant="primary"
                size="sm"
                onClick={direction === 'rtl' ? handleNext : handlePrevious}
                disabled={direction === 'rtl' ? isAtFutureLimit() : isAtPastLimit()}
              >
                <PrevButton size={16} />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleReset}
                className="min-w-[2.5rem]"
              >
                <RotateCcw size={16} />
              </Button>
              <span className="min-w-[7.5rem] text-center">
                {getCurrentPeriodLabel()}
              </span>
              <Button
                variant="primary"
                size="sm"
                onClick={direction === 'rtl' ? handlePrevious : handleNext}
                disabled={direction === 'rtl' ? isAtPastLimit() : isAtFutureLimit()}
              >
                <NextButton size={16} />
              </Button>
            </div>
          )}
          <div className="flex gap-2">
            {timeRangeOptions.map((option) => (
              <Button
                key={option.value}
                variant={timeRange === option.value ? 'primary' : 'outline'}
                size="sm"
                onClick={() => setTimeRange(option.value)}
              >
                {option.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="h-[25rem] p-0 px-1">
          <ResponsiveContainer width={window.innerWidth < 500 ? '110%' : '100%'} height="100%">
            <BarChart
              data={data}
              margin={{ top: 10, right: 0, left: 0, bottom: 20 }}
              className={direction === 'rtl' ? 'direction-rtl' : ''}
            >
              <XAxis
                dataKey="date"
                tick={{ fill: '#64748b', fontSize: 12 }}
                tickLine
                axisLine
                interval={timeRange === 'all' ? 1 : 0}
                angle={isMobile ? -70 : timeRange === 'all' ? -45 : 0}
                textAnchor="end"
                height={60}
              />
              <YAxis
                tick={{ fill: '#64748b', fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: (darkMode ? '#2f2f2f' : '#fff'),
                  border: '0.0625rem solid ' + (darkMode ? '#464646' : '#e2e8f0'),
                  borderRadius: '0.5rem',
                }}
                formatter={(value: number, name: string) => {
                  const label = {
                    scheduled: t('appointmentsGraph.scheduled'),
                    completed: t('appointmentsGraph.completed'),
                    cancelled: t('appointmentsGraph.cancelled')
                  }[name] || name;
                  return [value, label];
                }}
                labelFormatter={(label) => {
                  const dayData = data.find(d => d.date === label);
                  return (
                    <>
                      <span>{label}</span>
                      <br />
                      <span className="text-primary font-medium mt-1">
                        {t('appointmentsGraph.expectedIncome')}
                        {t('appointments.currencySymbol')}
                        {dayData?.expectedIncome || 0}
                      </span>
                    </>
                  );
                }}
              />
              <Bar dataKey="scheduled" stackId="a" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={50} />
              <Bar dataKey="completed" stackId="a" fill="#22c55e" radius={[4, 4, 0, 0]} maxBarSize={50} />
              <Bar dataKey="cancelled" stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={50} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </motion.div>
  );
};

export default AppointmentsGraph;
