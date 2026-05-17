import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DonutChart, DonutChartSegment } from '../ui/donut-chart';
import Card from '../ui/Card';
import { Appointment } from '../../types';
import { useTranslation } from 'react-i18next';
import { TimeRange } from './AppointmentsGraph';
import {
  startOfWeek, endOfWeek,
  startOfMonth, endOfMonth,
  startOfYear, endOfYear,
  subYears, addYears,
} from 'date-fns';

const SEGMENT_COLORS = [
  '#3b82f6', // blue
  '#22c55e', // green
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // violet
  '#f97316', // orange
  '#06b6d4', // cyan
];

interface DashboardDonutChartProps {
  appointments: Appointment[];
  timeRange: TimeRange;
  currentDate: Date;
}

const DashboardDonutChart: React.FC<DashboardDonutChartProps> = ({
  appointments,
  timeRange,
  currentDate,
}) => {
  const { t } = useTranslation();
  const [hoveredSegment, setHoveredSegment] = useState<string | null>(null);

  const getRange = () => {
    switch (timeRange) {
      case 'week': return { start: startOfWeek(currentDate), end: endOfWeek(currentDate) };
      case 'month': return { start: startOfMonth(currentDate), end: endOfMonth(currentDate) };
      case 'year': return { start: startOfYear(currentDate), end: endOfYear(currentDate) };
      case 'all': return { start: subYears(currentDate, 2), end: addYears(currentDate, 2) };
    }
  };

  const { start, end } = getRange();

  const filtered = appointments.filter(a => {
    const d = new Date(parseInt(a.timestamp));
    return d >= start && d <= end;
  });

  // Group by appointment type name
  const typeMap: Record<string, number> = {};
  filtered.forEach(a => {
    const name = a.type?.name || 'Unknown';
    typeMap[name] = (typeMap[name] || 0) + 1;
  });

  const donutData: DonutChartSegment[] = Object.entries(typeMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 7)
    .map(([name, count], i) => ({
      value: count,
      color: SEGMENT_COLORS[i % SEGMENT_COLORS.length],
      label: name,
    }));

  const total = filtered.length;
  const active = donutData.find(s => s.label === hoveredSegment);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.45 }}
      className="h-full"
    >
      <Card animate={false} className="h-full flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-base">{t('donutChart.title')}</h3>
          <span className="text-xs text-light-gray bg-light-gray/10 dark:bg-white/5 px-2.5 py-1 rounded-full">
            {total} {t('incomeStats.appointments')}
          </span>
        </div>

        {total === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-light-gray text-sm gap-2">
            <div className="w-12 h-12 rounded-full bg-light-gray/10 flex items-center justify-center">
              <span className="text-xl">📊</span>
            </div>
            <p>{t('appointments.noAppointments')}</p>
          </div>
        ) : (
          <>
            <div className="flex justify-center py-2">
              <DonutChart
                data={donutData}
                size={170}
                strokeWidth={24}
                animationDuration={1}
                animationDelayPerSegment={0.06}
                onSegmentHover={(seg) => setHoveredSegment(seg?.label ?? null)}
                centerContent={
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={active?.label ?? 'total'}
                      initial={{ opacity: 0, scale: 0.85 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.85 }}
                      transition={{ duration: 0.15 }}
                      className="flex flex-col items-center text-center"
                    >
                      <span className="text-3xl font-bold leading-none">
                        {active ? active.value : total}
                      </span>
                      <span className="text-[11px] text-light-gray mt-1 max-w-[90px] leading-tight line-clamp-2">
                        {active ? active.label : t('donutChart.total')}
                      </span>
                    </motion.div>
                  </AnimatePresence>
                }
              />
            </div>

            <div className="mt-3 space-y-1 flex-1 overflow-auto scrollbar-thin">
              {donutData.map((segment) => (
                <div
                  key={segment.label}
                  className={`flex items-center justify-between px-2 py-1.5 rounded-lg transition-colors cursor-default ${
                    hoveredSegment === segment.label
                      ? 'bg-light-gray/10 dark:bg-white/5'
                      : ''
                  }`}
                  onMouseEnter={() => setHoveredSegment(segment.label)}
                  onMouseLeave={() => setHoveredSegment(null)}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: segment.color }}
                    />
                    <span className="text-xs truncate text-light-text dark:text-dark-text">
                      {segment.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 ml-2">
                    <span className="text-xs font-bold">{segment.value}</span>
                    <span className="text-[10px] text-light-gray">
                      {((segment.value / total) * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </Card>
    </motion.div>
  );
};

export default DashboardDonutChart;
