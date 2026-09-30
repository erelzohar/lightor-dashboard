import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Tag } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import type { ClassSessionAvailability } from '../../services/appointmentsApi';
import type { AppointmentType } from '../../types';
import { localDateKey } from '../../utils/bookingSlots';
import { formatTime } from '../../utils/dateUtils';
import { resolveImage } from '../../utils/images';
import { isPastDay, type DayStatus } from '../../utils/ownerSchedule';

/**
 * The site's booking flow in the owner's booking window (LT-211), one view
 * per step as on the site (lightor-front Schedule.tsx): the services as
 * cards with their pictures, then a month of days with the site's
 * availability dots (ScheduleCalendar.tsx's DateButton), then the chosen
 * day's free times — or, for a class, its sessions with their seats. Draws
 * only: what is free is ownerSchedule.ts's answer, handed in by the modal.
 */

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

const hint = (text: string) => <p className="text-sm text-gray-500 dark:text-gray-400 ms-0.5">{text}</p>;

/** A day as the site names it: "Sunday, 25 October". */
const useLongDate = () => {
  const { language } = useTheme();
  return (day: Date) => new Intl.DateTimeFormat(language, { weekday: 'long', day: 'numeric', month: 'long' }).format(day);
};

/** "30 min · ₪80 · Group class" — a service as the site describes it. */
const useServiceMeta = () => {
  const { t } = useTranslation();
  return (service: AppointmentType) => {
    const minutes = Math.round(Number(service.durationMS) / 60_000);
    return [
      minutes > 0 ? `${minutes} ${t('appointments.minutes')}` : '',
      service.price?.toString().trim() ? `${t('appointments.currencySymbol')}${service.price}` : '',
      service.kind === 'class' ? t('appointmentTypes.class.toggle') : '',
    ]
      .filter(Boolean)
      .join(' · ');
  };
};

/** A service's picture, or the site's tag when it has none or it fails to load. */
const ServiceThumb: React.FC<{ image?: string }> = ({ image }) => {
  const [failed, setFailed] = useState(false);
  if (image && !failed) {
    return (
      <img
        src={resolveImage(image)}
        alt=""
        loading="lazy"
        onError={() => setFailed(true)}
        className="w-14 h-14 rounded-lg object-cover shrink-0"
      />
    );
  }
  return (
    <span className="w-14 h-14 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
      <Tag size={20} className="text-primary" />
    </span>
  );
};

export interface ServicePickerProps {
  services: AppointmentType[];
  onPick: (service: AppointmentType) => void;
}

/**
 * The services as the site shows them (LT-154's first step): picture, name,
 * length, price, and "group class" for a class. A class with no timetable
 * has nothing to book yet, so it is shown but not offered.
 */
export const ServicePicker: React.FC<ServicePickerProps> = ({ services, onPick }) => {
  const { t } = useTranslation();
  const metaOf = useServiceMeta();
  if (!services.length) return hint(t('customers.booking.noServices'));
  return (
    <div role="group" aria-label={t('customers.booking.service')} className="grid grid-cols-1 sm:grid-cols-2 gap-3" data-testid="booking-services">
      {services.map((service) => {
        const noTimetable = service.kind === 'class' && !service.sessions?.length;
        return (
          <button
            key={service._id}
            type="button"
            onClick={() => onPick(service)}
            disabled={noTimetable}
            className="w-full flex items-center gap-3 p-3 rounded-xl border border-gray-200 dark:border-gray-700/80 bg-white dark:bg-dark-surface hover:border-primary/60 hover:bg-primary/5 transition-colors text-start disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ServiceThumb image={service.image} />
            <span className="min-w-0 flex-1">
              <span className="block font-semibold text-sm text-gray-900 dark:text-white truncate">{service.name}</span>
              <span className="block text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {noTimetable ? t('customers.booking.noTimetable') : metaOf(service)}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
};

export interface MonthDaysProps {
  /** The first day of the month on show. */
  month: Date;
  /** The earliest and latest months the owner may turn to. */
  minMonth: Date;
  maxMonth: Date;
  onMonthChange: (month: Date) => void;
  /** The chosen day as "YYYY-MM-DD", or ''. */
  dateKey: string;
  onPickDay: (dateKey: string) => void;
  /** A day's dot; undefined while the month's availability is on its way. */
  statusOf: (day: Date) => DayStatus | undefined;
}

/** A month of days with the site's dots, and the site's legend under them. */
export const MonthDays: React.FC<MonthDaysProps> = ({
  month,
  minMonth,
  maxMonth,
  onMonthChange,
  dateKey,
  onPickDay,
  statusOf,
}) => {
  const { t } = useTranslation();
  const { language, direction } = useTheme();
  const longDate = useLongDate();

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
  const todayKey = localDateKey(new Date());
  const turn = (by: number) => onMonthChange(new Date(month.getFullYear(), month.getMonth() + by, 1));
  const navButton =
    'w-9 h-9 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700/60 disabled:opacity-30 disabled:cursor-not-allowed transition-colors';

  return (
    <div data-testid="booking-calendar">
      <div className="flex items-center justify-between mb-2">
        <button
          type="button"
          onClick={() => turn(-1)}
          disabled={monthIndex(month) <= monthIndex(minMonth)}
          aria-label={t('customers.booking.prevMonth')}
          className={navButton}
        >
          {direction === 'rtl' ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
        <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">{monthLabel}</span>
        <button
          type="button"
          onClick={() => turn(1)}
          disabled={monthIndex(month) >= monthIndex(maxMonth)}
          aria-label={t('customers.booking.nextMonth')}
          className={navButton}
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

      {/* The site's legend (lightor-front Schedule.tsx). */}
      <div className="mt-4 pt-3 border-t border-gray-200/70 dark:border-gray-700/60 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-gray-600 dark:text-gray-300">
        {(['full', 'limited', 'vacation', 'none'] as const).map((status) => (
          <span key={status} className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className={`h-2 w-2 rounded-full ${DOT[status]}`} />
            {t(`customers.booking.day.${status}`)}
          </span>
        ))}
      </div>
    </div>
  );
};

export interface DayTimesProps {
  day: Date;
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

/** The chosen day's free times, or a class's sessions with their seats. */
export const DayTimes: React.FC<DayTimesProps> = ({
  day,
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
  const longDate = useLongDate();

  return (
    <div data-testid="booking-times" data-day={longDate(day)}>
      {/* The day itself is in the summary above. */}
      <p className="text-[0.875rem] font-medium text-gray-700 dark:text-gray-300 mb-2 ms-0.5">
        {mode === 'sessions' ? t('customers.booking.pickSession') : t('customers.booking.pickTime')}
      </p>
      {mode === 'sessions' ? (
        loading ? (
          hint(t('customers.booking.loadingSessions'))
        ) : failed ? (
          hint(t('customers.booking.sessionsFailed'))
        ) : sessions.length ? (
          <div role="group" aria-label={t('customers.booking.pickSession')} className="grid grid-cols-3 gap-2">
            {sessions.map((session) => {
              // Display only: the time is read off the server's timestamp in
              // the owner's browser; the booking sends the timestamp.
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
            <button key={slot} type="button" onClick={() => onPickTime(slot)} aria-pressed={slot === time} className={chip(slot === time)}>
              <span className="tabular-nums" dir="ltr">{slot}</span>
            </button>
          ))}
        </div>
      ) : (
        hint(t('customers.booking.noSlots'))
      )}
    </div>
  );
};

export interface ChoiceSummaryProps {
  service: AppointmentType;
  /** The start, epoch ms; absent before a time is chosen. */
  startMs?: number;
  /** The day, when no time is chosen yet. */
  day?: Date;
}

/** What was chosen so far — the service, and its day and time once picked. */
export const ChoiceSummary: React.FC<ChoiceSummaryProps> = ({ service, startMs, day }) => {
  const longDate = useLongDate();
  const metaOf = useServiceMeta();
  const durationMS = Number(service.durationMS) || 0;
  const when = startMs !== undefined ? new Date(startMs) : day;
  return (
    <div
      data-testid="booking-summary"
      className="flex items-center gap-3 rounded-xl border border-gray-200 dark:border-gray-700/80 bg-white/70 dark:bg-dark-surface/60 px-3 py-2.5"
    >
      <ServiceThumb image={service.image} />
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-gray-900 dark:text-white truncate">{service.name}</span>
        {!when && <span className="block text-xs text-gray-500 dark:text-gray-400 mt-0.5">{metaOf(service)}</span>}
        {when && (
          <span className="block text-sm text-gray-600 dark:text-gray-300 mt-0.5">
            {longDate(when)}
            {startMs !== undefined && (
              <>
                {' · '}
                <span dir="ltr">
                  {formatTime(startMs)} – {formatTime(startMs + durationMS)}
                </span>
              </>
            )}
          </span>
        )}
      </span>
    </div>
  );
};
