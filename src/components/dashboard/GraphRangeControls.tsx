import React from 'react';
import { format, startOfMonth, subMonths, subYears, addMonths, addYears, addWeeks, subWeeks, startOfWeek, endOfWeek } from 'date-fns';
import { he } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import Button from '../ui/Button';
import { Tabs, TabsList, TabsTrigger } from '../ui/segmented-tabs';
import type { TimeRange } from './AppointmentsGraph';

interface GraphRangeControlsProps {
  timeRange: TimeRange;
  currentDate: Date;
  onTimeRangeChange: (range: TimeRange) => void;
  onCurrentDateChange: (date: Date) => void;
}

/**
 * The period of the home's two charts. It sits outside both cards since it
 * drives both (LT-509): between them on a phone, above them on a desktop.
 */
const GraphRangeControls: React.FC<GraphRangeControlsProps> = ({
  timeRange,
  currentDate,
  onTimeRangeChange,
  onCurrentDateChange,
}) => {
  const { language, direction } = useTheme();
  const { t } = useTranslation();
  const dateLocale = language === 'he' ? he : undefined;

  const timeRangeOptions: { value: TimeRange; label: string }[] = [
    { value: 'week', label: t('appointmentsGraph.week') },
    { value: 'month', label: t('appointmentsGraph.month') },
    { value: 'year', label: t('appointmentsGraph.year') },
    { value: 'all', label: t('appointmentsGraph.all') }
  ];

  const handlePrevious = () => {
    switch (timeRange) {
      case 'week': onCurrentDateChange(subWeeks(currentDate, 1)); break;
      case 'month': onCurrentDateChange(startOfMonth(subMonths(currentDate, 1))); break;
      case 'year': onCurrentDateChange(subYears(currentDate, 1)); break;
      case 'all': onCurrentDateChange(subYears(currentDate, 1)); break;
    }
  };

  const handleNext = () => {
    switch (timeRange) {
      case 'week': onCurrentDateChange(addWeeks(currentDate, 1)); break;
      case 'month': onCurrentDateChange(startOfMonth(addMonths(currentDate, 1))); break;
      case 'year': onCurrentDateChange(addYears(currentDate, 1)); break;
      case 'all': onCurrentDateChange(addYears(currentDate, 1)); break;
    }
  };

  const handleReset = () => {
    const today = new Date();
    if (timeRange === 'month') onCurrentDateChange(startOfMonth(today));
    else onCurrentDateChange(today);
  };

  const getCurrentPeriodLabel = () => {
    switch (timeRange) {
      case 'week':
        return `${format(startOfWeek(currentDate), 'd')} - ${format(endOfWeek(currentDate), 'd MMM yyyy', { locale: dateLocale })}`;
      case 'month':
        return format(currentDate, 'MMMM yyyy', { locale: dateLocale });
      case 'year':
        return format(currentDate, 'yyyy', { locale: dateLocale });
      case 'all':
        return '';
    }
  };

  const isAtPastLimit = () => currentDate <= subYears(new Date(), 2);
  const isAtFutureLimit = () => currentDate >= addYears(new Date(), 2);

  const PrevButton = direction === 'rtl' ? ChevronRight : ChevronLeft;
  const NextButton = direction === 'rtl' ? ChevronLeft : ChevronRight;

  return (
    // flex-wrap: on a narrow screen the two groups stack instead of overflowing.
    <div data-testid="graph-range" className="flex flex-wrap items-center justify-center lg:justify-between gap-3">
      <Tabs value={timeRange} onValueChange={(range) => onTimeRangeChange(range as TimeRange)}>
        <TabsList>
          {timeRangeOptions.map((option) => (
            <TabsTrigger key={option.value} value={option.value}>{option.label}</TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      {timeRange !== 'all' && (
        <div className="flex items-center gap-2">
          {/* LT-423: the start-side button goes back, as the calendar's
              does - the icon was mirrored for RTL and the handler swapped
              too, so in Hebrew the right arrow went forward. */}
          <Button
            variant="primary"
            size="sm"
            onClick={handlePrevious}
            disabled={isAtPastLimit()}
            aria-label={t('appointments.calendar.prevPeriod')}
          >
            <PrevButton size={16} />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            className="min-w-[2.5rem]"
            aria-label={t('dashboard.graph.reset')}
          >
            <RotateCcw size={16} />
          </Button>
          <span className="min-w-[7.5rem] text-center text-sm">
            {getCurrentPeriodLabel()}
          </span>
          <Button
            variant="primary"
            size="sm"
            onClick={handleNext}
            disabled={isAtFutureLimit()}
            aria-label={t('appointments.calendar.nextPeriod')}
          >
            <NextButton size={16} />
          </Button>
        </div>
      )}
    </div>
  );
};

export default GraphRangeControls;
