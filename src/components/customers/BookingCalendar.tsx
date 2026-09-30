import React, { useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import type { ClassSessionAvailability } from '../../services/appointmentsApi';
import { localDateKey } from '../../utils/bookingSlots';
import { formatTime } from '../../utils/dateUtils';
import { isPastDay, type DayStatus } from '../../utils/ownerSchedule';

/**
 * The site's booking calendar in the owner's booking window (LT-211): a month
 * of days, each with the site's availability dot (lightor-front
 * ScheduleCalendar.tsx's DateButton), then the chosen day's free times — or,
 * for a class, its sessions with their seats. Draws only: what is free is
 * ownerSchedule.ts's answer, handed in by the modal.
 */
export interface BookingCalendarProps {
  /** The first day of the month on show. */
  month: Date;
  /** The earliest and latest months the owner may turn to. */
  minMonth: Date;
  maxMonth: Date;
  onMonthChange: (month: Date) => void;
  /** The chosen day as "YYYY-MM-DD", or '' before one is chosen. */
  dateKey: string;
  onPickDay: (dateKey: string) => void;
  /** A day's dot; undefined while the month's availability is on its way. */
  statusOf: (day: Date) => DayStatus | undefined;
  /** A class offers its sessions; any other service, free start times. */
  mode: 'times' | 'sessions';
  loading: boolean;
  /** A class's sessions could not be read (a service falls back to its hours). */
  failed: boolean;
  slots: string[];
  time: string;
  onPickTime: (time: string) => void;
  sessions: ClassSessionAvailability[];
  sessionTs: string;
  onPickSession: (timestamp: string) => void;
}

const DOT: Record<Exclude<DayStatus, 'past'>, string> = {
  full: 'bg-emerald-500',
  limited: 'bg-amber-500',
  none: 'bg-red-500',
  vacation: 'bg-indigo-500',
};

// A Sunday, to name the week's days from (the week starts on Sunday, as on the site).
const A_SUNDAY = new Date(2026, 0, 4);

const monthIndex = (date: Date): number => date.getFullYear() * 12 + date.getMonth();

const chip = (chosen: boolean) =>
  `min-h-[44px] px-2 py-2 rounded-xl text-sm font-medium border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
    chosen
      ? 'bg-primary border-primary text-white'
      : 'bg-white dark:bg-dark-surface border-gray-200 dark:border-gray-700/80 text-gray-800 dark:text-gray-100 hover:border-primary/60 hover:bg-primary/5'
  }`;

const BookingCalendar: React.FC<BookingCalendarProps> = ({
  month,
  minMonth,
  maxMonth,
  onMonthChange,
  dateKey,
  onPickDay,
  statusOf,
  mode,
  loading,
  failed,
  slots,
  time,
  onPickTime,
  sessions,
  sessionTs,
  onPickSession,
}) => {
  const { t } = useTranslation();
  const { language, direction } = useTheme();

  const days = useMemo(() => {
    const count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    return Array.from({ length: count }, (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1));
  }, [month]);

  const weekdays = useMemo(() => {
    const format = new Intl.DateTimeFormat(language, { weekday: 'narrow' });
    return Array.from({ length: 7 }, (_, i) =>
      format.format(new Date(A_SUNDAY.getFullYear(), A_SUNDAY.getMonth(), A_SUNDAY.getDate() + i))
    );
  }, [language]);

  const monthLabel = new Intl.DateTimeFormat(language, { month: 'long', year: 'numeric' }).format(month);
  const longDate = (day: Date) =>
    new Intl.DateTimeFormat(language, { weekday: 'long', day: 'numeric', month: 'long' }).format(day);

  const todayKey = localDateKey(new Date());
  const chosenDay = days.find((day) => localDateKey(day) === dateKey);
  const turn = (by: number) => onMonthChange(new Date(month.getFullYear(), month.getMonth() + by, 1));
  const hint = (text: string) => <p className="text-sm text-gray-500 dark:text-gray-400 ms-0.5">{text}</p>;

  return (
    <div data-testid="booking-calendar">
      <div className="flex items-center justify-between mb-2">
        <button
          type="button"
          onClick={() => turn(-1)}
          disabled={monthIndex(month) <= monthIndex(minMonth)}
          aria-label={t('customers.booking.prevMonth')}
          className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700/60 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          {direction === 'rtl' ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
        <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">{monthLabel}</span>
        <button
          type="button"
          onClick={() => turn(1)}
          disabled={monthIndex(month) >= monthIndex(maxMonth)}
          aria-label={t('customers.booking.nextMonth')}
          className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700/60 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          {direction === 'rtl' ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
        </button>
      </div>

      <div className="grid grid-cols-7 text-center mb-1" aria-hidden="true">
        {weekdays.map((name, i) => (
          <span key={i} className="text-[11px] font-medium text-gray-400 dark:text-gray-500">
            {name}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1" data-testid="booking-days">
        {Array.from({ length: days[0].getDay() }, (_, i) => (
          <span key={`blank-${i}`} />
        ))}
        {days.map((day) => {
          const key = localDateKey(day);
          const status = statusOf(day);
          // While the month loads, any day from today on may be picked;
          // after, a day with room.
          const open = status === undefined ? !isPastDay(day) : status === 'full' || status === 'limited';
          const chosen = key === dateKey;
          const dot = status && status !== 'past' && !chosen ? DOT[status] : '';
          return (
            <button
              key={key}
              type="button"
              onClick={() => onPickDay(key)}
              disabled={!open}
              aria-pressed={chosen}
              aria-label={status && status !== 'past' ? `${longDate(day)} – ${t(`customers.booking.day.${status}`)}` : longDate(day)}
              className={`relative h-10 rounded-lg text-sm font-medium flex items-center justify-center transition-colors ${
                chosen
                  ? 'bg-primary text-white'
                  : open
                    ? 'text-gray-800 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700/60'
                    : 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
              } ${key === todayKey && !chosen ? 'ring-2 ring-inset ring-primary/70' : ''}`}
            >
              {day.getDate()}
              {dot && <span aria-hidden="true" className={`absolute bottom-1 h-1 w-3.5 rounded-full ${dot}`} />}
            </button>
          );
        })}
      </div>

      {chosenDay && (
        <div className="mt-4" data-testid="booking-times">
          <p className="text-[0.875rem] font-medium text-gray-700 dark:text-gray-300 mb-2 ms-0.5">{longDate(chosenDay)}</p>
          {mode === 'sessions' ? (
            loading ? (
              hint(t('customers.booking.loadingSessions'))
            ) : failed ? (
              hint(t('customers.booking.sessionsFailed'))
            ) : sessions.length ? (
              <div role="group" aria-label={t('customers.booking.pickSession')} className="grid grid-cols-3 gap-2">
                {sessions.map((session) => {
                  // Display only: the time is read off the server's timestamp
                  // in the owner's browser; the booking sends the timestamp.
                  const at = formatTime(Number(session.timestamp));
                  const seats = `${session.booked}/${session.capacity}`;
                  return (
                    <button
                      key={session.timestamp}
                      type="button"
                      onClick={() => onPickSession(session.timestamp)}
                      disabled={session.booked >= session.capacity}
                      aria-pressed={session.timestamp === sessionTs}
                      aria-label={`${at} · ${seats}`}
                      className={chip(session.timestamp === sessionTs)}
                    >
                      <span className="block tabular-nums" dir="ltr">{at}</span>
                      <span className="block text-[11px] opacity-75 tabular-nums" dir="ltr">{seats}</span>
                    </button>
                  );
                })}
              </div>
            ) : (
              hint(t('customers.booking.noSessions'))
            )
          ) : loading ? (
            hint(t('customers.booking.loadingTimes'))
          ) : slots.length ? (
            <div role="group" aria-label={t('customers.booking.pickTime')} className="grid grid-cols-4 gap-2">
              {slots.map((slot) => (
                <button
                  key={slot}
                  type="button"
                  onClick={() => onPickTime(slot)}
                  aria-pressed={slot === time}
                  className={chip(slot === time)}
                >
                  <span className="tabular-nums" dir="ltr">{slot}</span>
                </button>
              ))}
            </div>
          ) : (
            hint(t('customers.booking.noSlots'))
          )}
        </div>
      )}
    </div>
  );
};

export default BookingCalendar;
