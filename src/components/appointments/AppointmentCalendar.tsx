import React, { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft, ChevronRight, X, Clock, User, Phone,
  Check, XCircle, ChevronDown, CalendarDays, CalendarClock,
} from 'lucide-react';
import {
  format, addDays, isToday, isTomorrow, isSameDay, getHours, getMinutes,
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  addMonths, subMonths, eachDayOfInterval, isSameMonth,
  startOfDay, endOfDay,
} from 'date-fns';
import { he } from 'date-fns/locale';
import { Appointment, AppointmentType } from '../../types';
import { getDisplayStatus } from '../../utils/appointmentUtils';
import { useTheme } from '../../contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import { useAppDispatch } from '../../hooks/useAppDispatch';
import { useAppSelector } from '../../hooks/useAppSelector';
import { hoursForDate } from '../../utils/bookingSlots';
import { fetchAppointments, updateAppointmentStatus } from '../../store/slices/appointmentsSlice';
import { DndContext, MouseSensor, TouchSensor, useSensor, useSensors, type DragStartEvent } from '@dnd-kit/core';
import { getEventCoordinates } from '@dnd-kit/utilities';
import { moveAppointment, swapAppointments } from '../../services/appointmentsApi';
import { apiErrorStatus, isApiErrorCode } from '../../services/customersApi';
import { dropVerdict, edgeAt, isDraggable, minutesOfDay, startAtMinutes, type DropVerdict } from '../../utils/calendarDrag';
import { buildScale, markHours } from '../../utils/calendarScale';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';
import { formatPhoneForDisplay } from '../../utils/phone';
import {
  Session, activeParticipants, groupSessions, isGroupSession, sessionDisplayStatus, withListedSessions,
} from '../../utils/sessions';
import SessionParticipants from './SessionParticipants';
import AnswersList from './AnswersList';
import MoveAppointmentModal from './MoveAppointmentModal';
import { DragBlock, DropConfirm, pointerTracker, type DragHandle, type PendingDrop, type Point } from './CalendarDrag';
import { useConfirm } from '../../hooks/useConfirm';
import { cancelBookingQuestion } from './cancelQuestion';
import { useOpenSession } from '../../hooks/useOpenSession';
import { useClassSessions, useClassSessionsState } from '../../hooks/useClassSessions';
import { lightTick } from '../../lib/haptics';
import { Tabs, TabsList, TabsTrigger } from '../ui/segmented-tabs';

interface AppointmentCalendarProps {
  appointments: Appointment[];
  onAppointmentClick: (appointment: Appointment) => void;
  /**
   * A day to open on, in the day view (LT-267): one a link names. Each new
   * Date jumps there, so the same day asked for twice is shown twice.
   */
  openDay?: Date | null;
  /** The bookings are not read yet (LT-358): placeholders instead of an empty week. */
  loading?: boolean;
  /** Fold the hours nothing is in (LT-359); off draws every hour at full height. */
  foldFreeHours?: boolean;
}

// ── Deterministic palette per appointment type ─────────────────────────────
// emptyDark*: an empty class block (LT-211) turns dark in dark mode while
// filled ones stay light, so it needs light text of its own hue (LT-278).
const EVENT_PALETTES = [
  { bg: 'bg-blue-100',   border: 'border-l-blue-400',   text: 'text-blue-900',   sub: 'text-blue-700',   avatar: 'bg-blue-200 text-blue-800',   dot: 'bg-blue-400',   checkColor: '#60a5fa', emptyDark: 'dark:text-blue-200', emptyDarkSub: 'dark:text-blue-300' },
  { bg: 'bg-green-100',  border: 'border-l-green-400',  text: 'text-green-900',  sub: 'text-green-700',  avatar: 'bg-green-200 text-green-800',  dot: 'bg-green-400',  checkColor: '#4ade80', emptyDark: 'dark:text-green-200', emptyDarkSub: 'dark:text-green-300' },
  { bg: 'bg-purple-200', border: 'border-l-purple-400', text: 'text-purple-900', sub: 'text-purple-700', avatar: 'bg-purple-200 text-purple-800',dot: 'bg-purple-400', checkColor: '#c084fc', emptyDark: 'dark:text-purple-200', emptyDarkSub: 'dark:text-purple-300' },
  { bg: 'bg-yellow-100', border: 'border-l-yellow-400', text: 'text-yellow-900', sub: 'text-yellow-700', avatar: 'bg-yellow-200 text-yellow-800',dot: 'bg-yellow-400', checkColor: '#facc15', emptyDark: 'dark:text-yellow-200', emptyDarkSub: 'dark:text-yellow-300' },
  { bg: 'bg-pink-100',   border: 'border-l-pink-400',   text: 'text-pink-900',   sub: 'text-pink-700',   avatar: 'bg-pink-200 text-pink-800',   dot: 'bg-pink-400',   checkColor: '#f472b6', emptyDark: 'dark:text-pink-200', emptyDarkSub: 'dark:text-pink-300' },
  { bg: 'bg-teal-100',   border: 'border-l-teal-400',   text: 'text-teal-900',   sub: 'text-teal-700',   avatar: 'bg-teal-200 text-teal-800',   dot: 'bg-teal-400',   checkColor: '#2dd4bf', emptyDark: 'dark:text-teal-200', emptyDarkSub: 'dark:text-teal-300' },
  { bg: 'bg-orange-100', border: 'border-l-orange-400', text: 'text-orange-900', sub: 'text-orange-700', avatar: 'bg-orange-200 text-orange-800',dot: 'bg-orange-400', checkColor: '#fb923c', emptyDark: 'dark:text-orange-200', emptyDarkSub: 'dark:text-orange-300' },
  { bg: 'bg-indigo-100', border: 'border-l-indigo-400', text: 'text-indigo-900', sub: 'text-indigo-700', avatar: 'bg-indigo-200 text-indigo-800',dot: 'bg-indigo-400', checkColor: '#818cf8', emptyDark: 'dark:text-indigo-200', emptyDarkSub: 'dark:text-indigo-300' },
] as const;

const hashStr = (s: string): number => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h);
};
const paletteOf = (type: AppointmentType) =>
  EVENT_PALETTES[hashStr(type._id || type.name) % EVENT_PALETTES.length];
const getPalette = (appt: Appointment) => paletteOf(appt.type);

// ── Constants ──────────────────────────────────────────────────────────────
const HOUR_START = 6;
const HOUR_END   = 22;
const HOUR_PX    = 88;
/** An empty hour, folded (LT-359): about a third, its label still read. */
const FOLDED_PX  = 34;
// Folding and unfolding glide while a booking is dragged (LT-359).
const FOLD_EASE  = 'cubic-bezier(.2,.8,.2,1)';
const FOLD_MOTION = `top 240ms ${FOLD_EASE}, height 240ms ${FOLD_EASE}`;
/** The minute of the day the clock is at: the now line's place. */
const nowMinutesOfDay = (): number => {
  const now = new Date();
  return getHours(now) * 60 + getMinutes(now);
};
// Placeholders while the bookings are read (LT-358): [start hour, length in
// hours] per column, spread over the day so some show wherever it is scrolled.
const SKELETON_BLOCKS = (column: number): [number, number][] => [
  [7 + (column % 3) * 0.5, 1],
  [10 + (column % 2), 1.5],
  [13.5 - (column % 3) * 0.5, 1],
  [16 + (column % 2) * 0.5, 1],
  [19 - (column % 2), 1.5],
];
const TIME_GUTTER = 80;
// Held this close to the far side, a dragged booking turns the page (LT-353);
// the hours column is the near side's.
const EDGE_PX = 44;
const PAGE_FIRST_MS = 600;
const PAGE_AGAIN_MS = 900;

const fmtHour = (h: number) => `${h.toString().padStart(2, '0')}:00`;

type FilterKey = 'all' | 'scheduled' | 'completed' | 'ongoing' | 'cancelled';
type ViewMode  = 'week' | 'day';

// ── Status config ──────────────────────────────────────────────────────────
const STATUS_CFG = [
  { key: 'scheduled' as FilterKey, dot: 'bg-violet-400', bar: 'bg-violet-400', label_he: 'מתוכנן',  label_en: 'Scheduled' },
  { key: 'completed' as FilterKey, dot: 'bg-emerald-400',bar: 'bg-emerald-400',label_he: 'הושלם',   label_en: 'Completed' },
  { key: 'ongoing'   as FilterKey, dot: 'bg-amber-400',  bar: 'bg-amber-400',  label_he: 'מתמשך',   label_en: 'Ongoing'   },
  { key: 'cancelled' as FilterKey, dot: 'bg-rose-400',   bar: 'bg-rose-400',   label_he: 'בוטל',    label_en: 'Cancelled' },
];

// ══════════════════════════════════════════════════════════════════════════
const NEXT_HIDDEN_KEY = 'lightor.nextApptHidden';
const NEXT_WINDOW_MS = 14 * 24 * 3_600_000;

const AppointmentCalendar: React.FC<AppointmentCalendarProps> = ({
  appointments,
  onAppointmentClick,
  openDay = null,
  loading = false,
  foldFreeHours = true,
}) => {
  const [currentDate, setCurrentDate]           = useState(new Date());
  const [viewMode,    setViewMode]              = useState<ViewMode>('week');
  const [visibleDays, setVisibleDays]           = useState(7);
  // Measured at once (LT-315): the first auto-scroll reads it on mount.
  const [nowMinutes,  setNowMinutes]            = useState(nowMinutesOfDay);
  const [miniCalMonth,setMiniCalMonth]          = useState(startOfMonth(new Date()));
  const [selectedAppt,setSelectedAppt]          = useState<Appointment | null>(null);
  const [popupPos,    setPopupPos]              = useState<{ x: number; y: number } | null>(null);
  // The clicked event block and the details card: the card is placed from
  // both MEASURED rects, and re-placed on every scroll (LT-244).
  const anchorRef = useRef<HTMLElement | null>(null);
  const popupRef  = useRef<HTMLDivElement>(null);
  const [activeFilter,setActiveFilter]          = useState<FilterKey>('all');
  const [hiddenTypeIds,setHiddenTypeIds]        = useState<Set<string>>(new Set());
  const [calSecOpen,  setCalSecOpen]            = useState(true);
  const [catSecOpen,  setCatSecOpen]            = useState(true);
  const [sidebarOpen, setSidebarOpen]           = useState(false);
  // LT-287: the next appointment always shows — beside the calendar, and on a
  // phone above the grid — until the owner hides it; that choice is remembered.
  const [nextHidden, setNextHiddenState] = useState(() => {
    try { return localStorage.getItem(NEXT_HIDDEN_KEY) === '1'; } catch { return false; }
  });
  const setNextHidden = (hidden: boolean) => {
    setNextHiddenState(hidden);
    try {
      if (hidden) localStorage.setItem(NEXT_HIDDEN_KEY, '1');
      else localStorage.removeItem(NEXT_HIDDEN_KEY);
    } catch { /* private mode: the choice lasts this visit */ }
  };

  const weekDays    = useMemo(() => Array.from({ length: visibleDays }, (_, i) => addDays(currentDate, i)), [currentDate, visibleDays]);

  // The classes on show, booked or not (LT-211): a class nobody has booked
  // into holds no appointment, so the server's list of its sessions is what
  // puts it on the grid, with its roster one click away.
  const rangeStart = startOfDay(weekDays[0]).valueOf();
  const rangeEnd   = endOfDay(weekDays[weekDays.length - 1]).valueOf();
  const { sessions: listed, pending: listedPending } = useClassSessionsState(rangeStart, rangeEnd);
  // Placeholders until the bookings, and the classes the first time, are
  // read (LT-358), so the two appear together; a page turned later draws at
  // once.
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    if (!loading && !listedPending) setSettled(true);
  }, [loading, listedPending]);
  const showSkeleton = loading || (listedPending && !settled);
  // LT-293: the classes of the next two weeks, wherever the grid is — the
  // next-appointment card counts a class nobody has booked yet, too.
  const soonFrom   = startOfDay(new Date()).valueOf();
  const soonListed = useClassSessions(soonFrom, soonFrom + NEXT_WINDOW_MS);
  const rosterable = useMemo(() => withListedSessions(listed, soonListed), [listed, soonListed]);
  // The open roster follows every booking, whatever the filters show (LT-204):
  // a walk-in seated from it appears once the appointments are fetched again.
  const { openSession, openRoster, closeRoster } = useOpenSession(appointments, rosterable);

  const scrollRef = useRef<HTMLDivElement>(null);
  const { direction, language } = useTheme();
  const { t }    = useTranslation();
  const dispatch = useAppDispatch();
  const { confirm, dialog } = useConfirm();
  // The business's own hours (LT-340), to grey out the days it is closed.
  const openingHours = useAppSelector(state => state.webConfig.data);
  // The booking being moved (LT-341); the popup closes under the window.
  const [moving, setMoving] = useState<Appointment | null>(null);
  const canMove = (appt: Appointment) => getDisplayStatus(appt) === 'scheduled' && appt.type?.kind !== 'class';
  const { auth } = useAuth();

  // ── Dragging a booking (LT-345) ──────────────────────────────────────
  // To another time, or onto another booking to swap the two; a window asks
  // before anything is sent (each sends the customer a message). Held at
  // either side, the page turns under it (LT-353): a day on a phone, a week
  // (or the three days on show) on a bigger screen.
  const sensors = useSensors(
    // A click stays a click: a drag starts once the mouse has moved.
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    // On a phone a long press picks the booking up, so scrolling through the
    // hours and the day swipe stay as they were.
    useSensor(TouchSensor, { activationConstraint: { delay: 400, tolerance: 8 } }),
  );
  // The booking held, and where it would land: its day's column on show and
  // its new start, drawn there (LT-353); the block it was picked up from
  // stays put, faded, and may leave the screen as the page turns.
  const [held, setHeld] = useState<Appointment | null>(null);
  const [dropPreview, setDropPreview] = useState<{ index: number; startMs: number; verdict: DropVerdict } | null>(null);
  const [pendingDrop, setPendingDrop] = useState<PendingDrop | null>(null);
  const [dropSaving, setDropSaving] = useState(false);
  // The side it is held at (-1 back, 1 ahead), lit while the page waits to turn.
  const [dragEdge, setDragEdge] = useState<-1 | 0 | 1>(0);
  const draggingRef = useRef(false);
  // The click a drag ends with is not a click on the booking, nor its touch a swipe.
  const draggedAtRef = useRef(0);
  const justDragged = () => draggingRef.current || Date.now() - draggedAtRef.current < 400;
  // Where the pointer is, from dnd-kit's own coordinates, and how far below
  // the booking's top it was picked up.
  const pointerRef = useRef<Point | null>(null);
  const trackPointer = useMemo(() => pointerTracker(pointerRef), []);
  const grabRef = useRef<{ appointment: Appointment; grabDy: number } | null>(null);
  const columnRefs = useRef<(HTMLDivElement | null)[]>([]);
  const edgeRef = useRef<{ side: -1 | 0 | 1; timer?: ReturnType<typeof setTimeout> }>({ side: 0 });
  useEffect(() => () => clearTimeout(edgeRef.current.timer), []);
  const locale   = language === 'he' ? he : undefined;

  // ── Resize handler ────────────────────────────────────────────────────
  useEffect(() => {
    const onResize = () => {
      if (viewMode === 'day' || window.innerWidth < 640) setVisibleDays(1);
      else if (window.innerWidth < 1024) setVisibleDays(3);
      else setVisibleDays(7);
    };
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [viewMode]);

  // ── Now indicator ─────────────────────────────────────────────────────
  useEffect(() => {
    const tick = () => setNowMinutes(nowMinutesOfDay());
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);

  // ── Close popup on Escape ─────────────────────────────────────────────
  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') { setSelectedAppt(null); closeRoster(); } };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [closeRoster]);

  // ── Derived ───────────────────────────────────────────────────────────
  const miniCalDays = useMemo(() => eachDayOfInterval({
    start: startOfWeek(miniCalMonth, { weekStartsOn: 0 }),
    end:   endOfWeek(endOfMonth(miniCalMonth), { weekStartsOn: 0 }),
  }), [miniCalMonth]);


  const uniqueTypes = useMemo(() => {
    const map = new Map<string, { type: AppointmentType; count: number }>();
    appointments.forEach(a => {
      const e = map.get(a.type._id);
      if (e) e.count++; else map.set(a.type._id, { type: a.type, count: 1 });
    });
    // A class on show with nobody booked yet can be hidden too (LT-211).
    listed.forEach(s => { if (!map.has(s.type._id)) map.set(s.type._id, { type: s.type, count: 0 }); });
    return Array.from(map.values()).sort((a, b) => b.count - a.count).slice(0, 5);
  }, [appointments, listed]);

  const statusCounts = useMemo(() => {
    const total = appointments.length || 1;
    return STATUS_CFG.map(s => ({
      ...s,
      count: appointments.filter(a => getDisplayStatus(a) === s.key).length,
      pct: Math.round((appointments.filter(a => getDisplayStatus(a) === s.key).length / total) * 100),
    }));
  }, [appointments]);

  const filteredAppointments = useMemo(() => {
    let r = appointments;
    if (activeFilter !== 'all') r = r.filter(a => getDisplayStatus(a) === activeFilter);
    if (hiddenTypeIds.size > 0)  r = r.filter(a => !hiddenTypeIds.has(a.type._id));
    return r;
  }, [appointments, activeFilter, hiddenTypeIds]);

  const getDayAppts = (day: Date) =>
    filteredAppointments
      .filter(a => isSameDay(new Date(parseInt(a.timestamp)), day))
      .sort((a, b) => parseInt(a.timestamp) - parseInt(b.timestamp));

  // Bookings sharing a service and a start time draw as ONE block (LT-152).
  // Before this the grid pinned every booking to the full column width with no
  // lane splitting, so a class of twelve stacked twelve deep and only the last
  // one was clickable. A class session nobody has booked joins them (LT-211),
  // under the same filters: its service shown, its status by the clock.
  const getDaySessions = (day: Date) => withListedSessions(
    groupSessions(getDayAppts(day)),
    listed.filter(s =>
      isSameDay(new Date(s.startMs), day)
      && !hiddenTypeIds.has(s.type._id)
      && (activeFilter === 'all' || sessionDisplayStatus(s) === activeFilter)),
  );

  // ── The hours, folded where nothing is (LT-359) ───────────────────────
  // An hour no day on show has anything in is drawn about a third as tall,
  // hatched, its label kept; today's current hour stays open for the now
  // line, and an hour a dragged booking is held over opens to full height
  // until it is dropped. While a booking is held (and a moment after, as the
  // hours fold back) the rows glide to their new places instead of jumping.
  const [dragOpen, setDragOpen] = useState<ReadonlySet<number>>(() => new Set());
  const [foldMotion, setFoldMotion] = useState(false);
  const foldMotionTimer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(foldMotionTimer.current), []);
  const glide = foldMotion ? FOLD_MOTION : undefined;
  const busyHours = new Set<number>();
  weekDays.forEach(day => getDaySessions(day).forEach(session => {
    const start = minutesOfDay(session.startMs);
    markHours(start, start + session.durationMS / 60_000, busyHours);
  }));
  if (weekDays.some(day => isToday(day))) markHours(nowMinutes, nowMinutes, busyHours);
  const scale = buildScale({
    firstHour: HOUR_START,
    lastHour: HOUR_END,
    hourPx: HOUR_PX,
    foldedPx: FOLDED_PX,
    busy: busyHours,
    open: !foldFreeHours || showSkeleton ? 'all' : dragOpen,
  });
  // What the layout is, for effects to follow it.
  const scaleKey = scale.rows.filter(row => row.folded).map(row => row.hour).join(',');
  const totalHeight = scale.total;
  const nowPx       = scale.yOf(nowMinutes);
  const nowVisible  = nowMinutes >= HOUR_START * 60 && nowMinutes <= HOUR_END * 60;

  // ── Auto-scroll ───────────────────────────────────────────────────────
  // To the hours around now: on opening, when the days on show change, and
  // on "Today" (LT-315). Not on the minute tick, which moves only the line —
  // since the grid scrolls inside its own box (LT-307), following the tick
  // snapped an owner reading 17:00 back to the morning every minute.
  const [scrollAsk, setScrollAsk] = useState(0);
  const scrolledFor = useRef<string | null>(null);
  useEffect(() => {
    const grid = scrollRef.current;
    // Again once the placeholders give way: the hours may have folded.
    const key = `${startOfDay(currentDate).valueOf()}|${scrollAsk}|${showSkeleton}`;
    if (!grid || scrolledFor.current === key) return;
    scrolledFor.current = key;
    // A page turned under a held booking keeps its hours where they were (LT-353).
    if (draggingRef.current) return;
    grid.scrollTo({ top: Math.max(0, nowPx - 160) });
  }, [currentDate, scrollAsk, nowPx, showSkeleton]);

  const miniHasAppts = (day: Date) =>
    appointments.some(a => isSameDay(new Date(parseInt(a.timestamp)), day));

  // What comes next: a booking, or a class — booked into or not (LT-293:
  // a class with no one in it yet holds no appointment, so the card said
  // nothing was coming while one was on the grid tomorrow).
  const nextSession = useMemo((): Session | null => {
    const now = Date.now();
    return withListedSessions(
      groupSessions(appointments.filter(a => getDisplayStatus(a) === 'scheduled' && parseInt(a.timestamp) > now)),
      soonListed.filter(s => s.startMs > now),
    )[0] ?? null;
  }, [appointments, soonListed, nowMinutes]); // nowMinutes: looked at again each minute, so one that started moves on
  const nextIsGroup = !!nextSession && isGroupSession(nextSession);
  const nextEndMs = nextSession ? nextSession.startMs + nextSession.durationMS : 0;
  // Who: the customer; for a class, how full it is.
  const nextWho = !nextSession ? '' : nextSession.type?.kind === 'class'
    ? `${activeParticipants(nextSession).length}/${Number(nextSession.type.capacity) || 0} ${language === 'he' ? 'משתתפים' : 'booked'}`
    : nextSession.participants.map(p => p.name).join(', ');
  const openNext = () => {
    if (!nextSession) return;
    if (nextIsGroup) { setSelectedAppt(null); openRoster(nextSession); }
    else onAppointmentClick(nextSession.participants[0]);
  };

  // How soon, within the next day; further off, the day itself says it (LT-287).
  const minutesUntilNext = useMemo(() => {
    if (!nextSession) return null;
    const diff = nextSession.startMs - Date.now();
    if (diff <= 0 || diff >= 24 * 3_600_000) return null;
    const mins = Math.floor(diff / 60000);
    const h = Math.floor(mins / 60), m = mins % 60;
    if (language === 'he') return mins < 60 ? `בעוד ${mins} דק׳` : `בעוד ${h} ש׳${m ? ` ו-${m} דק׳` : ''}`;
    return mins < 60 ? `in ${mins} min` : `in ${h}h${m ? ` ${m}m` : ''}`;
  }, [nextSession, nowMinutes, language]);

  // Which day — the card used to show only the hours, so a booking days
  // away read like one today (LT-287).
  const nextDay = useMemo(() => {
    if (!nextSession) return null;
    const start = new Date(nextSession.startMs);
    if (isToday(start)) return language === 'he' ? 'היום' : 'Today';
    if (isTomorrow(start)) return language === 'he' ? 'מחר' : 'Tomorrow';
    return format(start, language === 'he' ? 'EEEE d/M' : 'EEE d MMM', { locale });
  }, [nextSession, language, locale, nowMinutes]);

  const getSessionPos = (session: Session) => {
    const start = minutesOfDay(session.startMs);
    const top = scale.yOf(start);
    return { top, height: Math.max(scale.yOf(start + session.durationMS / 60_000) - top, 36) };
  };

  // ── Handlers ──────────────────────────────────────────────────────────
  // Page turns slide the new days in from the side they come from (LT-247).
  // Off until the first navigation, so opening the calendar does not animate.
  const [slideDir, setSlideDir] = useState<1 | -1 | 0>(0);
  const goTo = (target: Date) => {
    setSlideDir(startOfDay(target) < startOfDay(currentDate) ? -1 : 1);
    setCurrentDate(target);
    lightTick();
  };
  // A day asked for from outside (LT-267): no slide, the day on its own.
  useEffect(() => {
    if (!openDay) return;
    setSlideDir(0);
    setSelectedAppt(null);
    setCurrentDate(openDay);
    setMiniCalMonth(startOfMonth(openDay));
    setViewMode('day');
    setVisibleDays(1);
  }, [openDay]);
  const prevPeriod = () => goTo(addDays(currentDate, -visibleDays));
  const nextPeriod = () => goTo(addDays(currentDate, visibleDays));
  const goToday    = () => { goTo(new Date()); setMiniCalMonth(startOfMonth(new Date())); setScrollAsk((n) => n + 1); };
  // Forward content enters from the end side: the right in LTR, the left in RTL.
  const slideFrom = `${slideDir * (direction === 'rtl' ? -1 : 1) * 48}px`;
  const slideClass = slideDir ? ' cal-slide-in' : '';

  // Swipe the grid sideways to page through days (LT-246) — one day on a
  // phone, where the grid shows one. Only a clearly horizontal, quick stroke
  // counts, so scrolling through the hours is untouched; a grid that scrolls
  // sideways itself keeps the gesture. Forward is right-to-left in LTR and
  // left-to-right in RTL, where tomorrow sits to the left.
  const swipeRef = useRef<{ x: number; y: number; t: number } | null>(null);
  const handleTouchStart = (e: React.TouchEvent) => {
    const p = e.touches[0];
    swipeRef.current = e.touches.length === 1 ? { x: p.clientX, y: p.clientY, t: Date.now() } : null;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    const start = swipeRef.current;
    swipeRef.current = null;
    const p = e.changedTouches[0];
    if (!start || !p || justDragged()) return;
    const dx = p.clientX - start.x;
    const dy = p.clientY - start.y;
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5 || Date.now() - start.t > 800) return;
    const grid = scrollRef.current;
    if (grid && grid.scrollWidth > grid.clientWidth + 1) return;
    setSelectedAppt(null);
    if (direction === 'rtl' ? dx > 0 : dx < 0) nextPeriod();
    else prevPeriod();
  };

  const handleViewMode = (m: ViewMode) => {
    setViewMode(m);
    setVisibleDays(m === 'day' ? 1 : window.innerWidth < 640 ? 1 : window.innerWidth < 1024 ? 3 : 7);
  };

  /**
   * Where the held booking would land and what that would mean, read off the
   * pointer and the columns as drawn now (LT-353): the column under the
   * pointer (or the nearest), the start its top would be drawn at, in
   * five-minute steps, and a booking under the pointer to swap with.
   */
  const locateDrop = () => {
    const grab = grabRef.current;
    const pointer = pointerRef.current;
    if (!grab || !pointer) return null;
    let index = -1;
    let nearest = Infinity;
    columnRefs.current.slice(0, weekDays.length).forEach((column, i) => {
      if (!column) return;
      const r = column.getBoundingClientRect();
      const off = pointer.x < r.left ? r.left - pointer.x : pointer.x > r.right ? pointer.x - r.right : 0;
      if (off < nearest) { nearest = off; index = i; }
    });
    const column = columnRefs.current[index];
    if (!column) return null;
    const day = weekDays[index];
    const { appointment, grabDy } = grab;
    const durationMS = Number(appointment.type?.durationMS) || 0;
    const startMs = startAtMinutes({
      minutes: scale.minutesAt(pointer.y - grabDy - column.getBoundingClientRect().top),
      day,
      durationMS,
      firstHour: HOUR_START,
      lastHour: HOUR_END,
    });
    // A folded hour it reaches opens to full height (LT-359) for the rest of
    // the drag: the effect below reads the landing again off it.
    const startMin = minutesOfDay(startMs);
    const reached = new Set<number>();
    markHours(startMin, startMin + Math.max(durationMS / 60_000, 1), reached);
    const opening = scale.rows.filter(row => row.folded && reached.has(row.hour)).map(row => row.hour);
    if (opening.length) setDragOpen(open => new Set([...open, ...opening]));
    const under = Array.from(column.querySelectorAll<HTMLElement>('[data-booking-id]')).find(el => {
      if (el.dataset.bookingId === appointment._id) return false;
      const r = el.getBoundingClientRect();
      return pointer.x >= r.left && pointer.x <= r.right && pointer.y >= r.top && pointer.y <= r.bottom;
    });
    const verdict = dropVerdict({
      appointment,
      startMs,
      day,
      overAppointment: under ? filteredAppointments.find(a => a._id === under.dataset.bookingId) : undefined,
      sessions: getDaySessions(day),
      hours: openingHours,
    });
    return { index, startMs, verdict };
  };

  // Held at a side: after a moment the page turns that way, and again while
  // it stays there — by what is on show, as the arrows do.
  const holdAtEdge = () => {
    const pointer = pointerRef.current;
    const box = scrollRef.current?.getBoundingClientRect();
    const side = pointer && box
      ? edgeAt({ x: pointer.x, left: box.left, right: box.right, rtl: direction === 'rtl', startPx: TIME_GUTTER, endPx: EDGE_PX })
      : 0;
    if (side === edgeRef.current.side) return;
    clearTimeout(edgeRef.current.timer);
    const turn = () => {
      setSlideDir(side === 1 ? 1 : -1);
      setCurrentDate(d => addDays(d, side * visibleDays));
      lightTick();
      edgeRef.current.timer = setTimeout(turn, PAGE_AGAIN_MS);
    };
    edgeRef.current = { side, timer: side ? setTimeout(turn, PAGE_FIRST_MS) : undefined };
    setDragEdge(side);
  };

  // The page turned, or a band opened, under a held booking: where it lands
  // is read again off the new layout, though the pointer has not moved.
  useLayoutEffect(() => {
    if (grabRef.current) setDropPreview(locateDrop());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDate, scaleKey]);

  const endDrag = () => {
    draggingRef.current = false;
    draggedAtRef.current = Date.now();
    grabRef.current = null;
    pointerRef.current = null;
    clearTimeout(edgeRef.current.timer);
    edgeRef.current = { side: 0 };
    setDragEdge(0);
    setHeld(null);
    setDropPreview(null);
    setDragOpen(open => (open.size ? new Set() : open));
    // The hours fold back gliding, then page turns jump again.
    clearTimeout(foldMotionTimer.current);
    foldMotionTimer.current = setTimeout(() => setFoldMotion(false), 400);
  };
  const handleDragStart = ({ active, activatorEvent }: DragStartEvent) => {
    const appointment = active.data.current?.appointment as Appointment | undefined;
    if (!appointment) return;
    const start = getEventCoordinates(activatorEvent);
    const block = scrollRef.current?.querySelector<HTMLElement>(`[data-booking-id="${appointment._id}"]`);
    grabRef.current = { appointment, grabDy: start && block ? start.y - block.getBoundingClientRect().top : 0 };
    pointerRef.current = start;
    draggingRef.current = true;
    clearTimeout(foldMotionTimer.current);
    setFoldMotion(true);
    setHeld(appointment);
    setSelectedAppt(null);
    lightTick();
  };
  const handleDragMove = () => {
    setDropPreview(locateDrop());
    holdAtEdge();
  };
  const handleDragEnd = () => {
    const appointment = grabRef.current?.appointment;
    const drop = locateDrop();
    endDrag();
    if (!appointment || !drop) return;
    const { verdict } = drop;
    if (verdict.kind === 'move') setPendingDrop({ kind: 'move', appointment, startMs: verdict.startMs, warning: verdict.warning });
    else if (verdict.kind === 'swap') setPendingDrop({ kind: 'swap', appointment, target: verdict.target });
    else if (verdict.kind === 'refused') toast.error(t(`appointments.drag.${verdict.reason}`));
  };

  const SWAP_REFUSALS: Record<string, string> = {
    SWAP_DOES_NOT_FIT: 'appointments.drag.swapDoesNotFit',
    NOT_SWAPPABLE: 'appointments.drag.notSwappable',
    CHANGED_MEANWHILE: 'appointments.drag.changed',
  };
  const confirmDrop = async () => {
    if (!pendingDrop || dropSaving) return;
    setDropSaving(true);
    try {
      if (pendingDrop.kind === 'move') {
        await moveAppointment(pendingDrop.appointment._id, String(pendingDrop.startMs));
        toast.success(t('appointments.move.success'));
      } else {
        await swapAppointments(pendingDrop.appointment._id, pendingDrop.target._id);
        toast.success(t('appointments.drag.swapped'));
      }
      if (auth?.user?._id) dispatch(fetchAppointments({ user_id: auth.user._id, limit: 5000 }));
    } catch (error) {
      const refusal = Object.keys(SWAP_REFUSALS).find(code => isApiErrorCode(error, code));
      toast.error(t(refusal ? SWAP_REFUSALS[refusal] : apiErrorStatus(error) === 409 ? 'appointments.drag.taken' : 'appointments.drag.failed'));
    } finally {
      setDropSaving(false);
      setPendingDrop(null);
    }
  };

  const handleEventClick = (appt: Appointment, e: React.MouseEvent) => {
    e.stopPropagation();
    anchorRef.current = e.currentTarget as HTMLElement;
    setSelectedAppt(appt);
    // A first guess so the card can mount; placePopup corrects it from the
    // card's real size before the browser paints.
    const rect = anchorRef.current.getBoundingClientRect();
    setPopupPos({ x: rect.right + 10, y: rect.top });
  };

  // The card sits beside its event block, flipping to the other side when
  // there is no room, and is clamped into the viewport using its REAL height
  // (a fixed 380px guess let taller cards — booking answers, buttons — run off
  // the top or bottom of the screen). Called again on every scroll so it
  // travels with its appointment; once the block scrolls out of the calendar
  // the card closes rather than floating next to nothing.
  const placePopup = useCallback(() => {
    const anchor = anchorRef.current;
    const pop = popupRef.current;
    if (!anchor || !pop) return;
    const r = anchor.getBoundingClientRect();
    const box = scrollRef.current?.getBoundingClientRect();
    if (!anchor.isConnected || (box && (r.bottom <= box.top || r.top >= box.bottom))) {
      setSelectedAppt(null);
      return;
    }
    const PW = pop.offsetWidth;
    const PH = pop.offsetHeight;
    let x = r.right + 10;
    if (x + PW > window.innerWidth - 8) x = Math.max(8, r.left - PW - 10);
    const y = Math.min(Math.max(8, r.top), Math.max(8, window.innerHeight - PH - 8));
    setPopupPos(p => (p && p.x === x && p.y === y ? p : { x, y }));
  }, []);

  useLayoutEffect(() => {
    if (selectedAppt) placePopup();
  }, [selectedAppt, popupPos, placePopup]);

  useEffect(() => {
    if (!selectedAppt) return;
    // Capture phase: scrolls of the calendar grid and of the page's own
    // scrolling <main> never bubble to window.
    window.addEventListener('scroll', placePopup, true);
    window.addEventListener('resize', placePopup);
    const ro = popupRef.current && typeof ResizeObserver !== 'undefined' ? new ResizeObserver(placePopup) : null;
    if (ro && popupRef.current) ro.observe(popupRef.current);
    return () => {
      window.removeEventListener('scroll', placePopup, true);
      window.removeEventListener('resize', placePopup);
      ro?.disconnect();
    };
  }, [selectedAppt, placePopup]);

  const handleSessionClick = (session: Session, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedAppt(null);
    openRoster(session);
  };

  // Success is said only once the server agrees (LT-315): the thunk was not
  // awaited, so an offline phone or a refused request still read "updated"
  // and closed, with the customer still booked.
  const [statusBusy, setStatusBusy] = useState(false);
  const handleStatus = async (status: 'completed' | 'cancelled') => {
    if (!selectedAppt || statusBusy) return;
    if (status === 'cancelled' && !(await confirm(cancelBookingQuestion(t, selectedAppt.timestamp)))) return;
    setStatusBusy(true);
    try {
      await dispatch(updateAppointmentStatus({ id: selectedAppt._id, status })).unwrap();
      toast.success(t('appointments.updateSuccess'));
      setSelectedAppt(null);
    } catch {
      toast.error(t('appointments.updateError'));
    } finally {
      setStatusBusy(false);
    }
  };

  const initials = (name: string) => name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  const getStatusBadgeClass = (s: string) => ({
    scheduled: 'bg-violet-100 text-violet-700',
    completed: 'bg-emerald-100 text-emerald-700',
    ongoing:   'bg-amber-100 text-amber-700',
    cancelled: 'bg-rose-100 text-rose-700',
  }[s] ?? 'bg-gray-100 text-gray-700');

  // ── Day header label ──────────────────────────────────────────────────
  const DAY_HEADS_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const DAY_HEADS_HE = ['א\'', 'ב\'', 'ג\'', 'ד\'', 'ה\'', 'ו\'', 'ש\''];
  const dayHead = (d: Date) => language === 'he' ? DAY_HEADS_HE[d.getDay()] : DAY_HEADS_EN[d.getDay()];

  // ── Mini-cal day headers ──────────────────────────────────────────────
  const miniDayHds = language === 'he'
    ? ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש']
    : ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  // ══════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════
  const userName = auth?.user?.name ?? '';

  // Side panel (mini calendar, next appointment, calendars, categories).
  // Rendered in the desktop aside AND the phone drawer (LT-127) — the drawer
  // used to be an empty shell.
  const sidePanel = (
    <>
        {/* ── Profile ─────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 pt-6 pb-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0"
              style={{ background: 'linear-gradient(135deg,#6366f1,#a855f7)', border: '2px solid rgba(99,102,241,0.5)' }}>
              {initials(userName)}
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: '#f1f5f9' }}>{userName}</p>
              <p className="text-xs" style={{ color: '#6b7280' }}>
                {language === 'he' ? 'חשבון עסקי' : 'Business Account'}
              </p>
            </div>
          </div>
          <div className="relative">
            <button className="w-8 h-8 rounded-full flex items-center justify-center transition-colors"
              style={{ background: 'rgba(255,255,255,0.08)' }}
              // A day picked here closes the phone's drawer on it (LT-355).
              onClick={e => { e.stopPropagation(); goToday(); setSidebarOpen(false); }}
            >
              <CalendarDays size={14} style={{ color: '#9ca3af' }} />
            </button>
            {appointments.filter(a => getDisplayStatus(a) === 'scheduled' && parseInt(a.timestamp) > Date.now()).length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-[10px] font-bold flex items-center justify-center text-white"
                style={{ background: '#6366f1', border: '2px solid #1a1b26' }}>
                {Math.min(9, appointments.filter(a => getDisplayStatus(a) === 'scheduled' && parseInt(a.timestamp) > Date.now()).length)}
              </span>
            )}
          </div>
        </div>

        {/* ── Mini Calendar ───────────────────────────────────────── */}
        <div className="mx-4 my-4 rounded-2xl p-4" style={{ background: '#15161e' }}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium" style={{ color: '#f1f5f9' }}>
              {format(miniCalMonth, 'MMMM yyyy', { locale })}
            </span>
            <div className="flex gap-1" dir="ltr">
              {[{ dir: -1, Icon: ChevronLeft }, { dir: 1, Icon: ChevronRight }].map(({ dir, Icon }) => (
                <button key={dir}
                  onClick={e => { e.stopPropagation(); setMiniCalMonth(m => (dir < 0) !== (direction === 'rtl') ? subMonths(m, 1) : addMonths(m, 1)); }}
                  className="w-6 h-6 rounded flex items-center justify-center transition-colors"
                  style={{ background: 'rgba(255,255,255,0.05)' }}
                >
                  <Icon size={12} style={{ color: '#6b7280' }} />
                </button>
              ))}
            </div>
          </div>

          {/* Day-of-week header */}
          <div className="grid grid-cols-7 text-center mb-2">
            {miniDayHds.map((d, i) => (
              <div key={i} className="text-[10px] font-semibold" style={{ color: '#4b5563' }}>{d}</div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7 gap-y-1 text-center">
            {miniCalDays.map(day => {
              const inMonth = isSameMonth(day, miniCalMonth);
              const tod = isToday(day);
              const sel = isSameDay(day, currentDate) && !tod;
              const hasA = miniHasAppts(day);
              return (
                <button key={day.toISOString()}
                  onClick={e => { e.stopPropagation(); goTo(day); setMiniCalMonth(startOfMonth(day)); setSidebarOpen(false); }}
                  className="relative w-7 h-7 mx-auto text-[11px] rounded-full flex items-center justify-center transition-all"
                  style={{
                    color: !inMonth ? '#374151' : tod ? '#fff' : sel ? '#818cf8' : '#d1d5db',
                    background: tod ? '#6366f1' : sel ? 'rgba(99,102,241,0.15)' : undefined,
                    fontWeight: tod || sel ? 600 : undefined,
                    boxShadow: tod ? '0 0 0 2px rgba(99,102,241,0.3)' : undefined,
                  }}
                >
                  {format(day, 'd')}
                  {hasA && !tod && (
                    <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
                      style={{ background: '#6366f1', opacity: 0.7 }} />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Upcoming appointment card ────────────────────────────── */}
        {nextSession && !nextHidden && (
          <div className="mx-4 mb-4 rounded-2xl p-4 relative overflow-hidden"
            style={{ background: 'linear-gradient(135deg,#1f2035,#252840)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="flex items-center justify-between mb-2">
              {/* A range reads left to right in Hebrew too (LT-211): "19:00 – 19:30". */}
              <span className="text-xs" style={{ color: '#9ca3af' }} data-testid="next-appt-when">
                <span className="font-medium" style={{ color: '#c7d2fe' }}>{nextDay}</span>
                {' · '}
                <span dir="ltr">
                  {format(new Date(nextSession.startMs), 'HH:mm')}
                  {' – '}
                  {format(new Date(nextEndMs), 'HH:mm')}
                </span>
              </span>
              {minutesUntilNext && (
                <span className="text-[11px] px-2 py-0.5 rounded-full flex items-center gap-1"
                  style={{ background: 'rgba(255,255,255,0.08)', color: '#9ca3af' }}>
                  <Clock size={10} style={{ color: '#fbbf24' }} />
                  {minutesUntilNext}
                </span>
              )}
            </div>
            <h4 className="text-sm font-medium mb-4 pe-10 leading-snug" style={{ color: '#f1f5f9' }}>
              {nextSession.type.name}
              <span className="block text-xs font-normal mt-0.5" style={{ color: '#6b7280' }}>{nextWho}</span>
            </h4>
            <div className="flex gap-2 relative z-10">
              <button className="px-4 py-1.5 rounded-full text-xs transition-colors"
                style={{ border: '1px solid rgba(255,255,255,0.18)', color: '#9ca3af' }}
                onClick={e => { e.stopPropagation(); setNextHidden(true); }}
              >
                {language === 'he' ? 'הסתר' : 'Hide'}
              </button>
              <button className="px-4 py-1.5 rounded-full text-xs text-white transition-colors"
                style={{ background: '#6366f1' }}
                onClick={e => { e.stopPropagation(); openNext(); }}
              >
                {language === 'he' ? 'פרטים' : 'Details'}
              </button>
            </div>
          </div>
        )}

        {nextHidden ? (
          <div className="mx-4 mb-4">
            <button className="text-xs underline-offset-2 hover:underline" style={{ color: '#9ca3af' }}
              onClick={e => { e.stopPropagation(); setNextHidden(false); }}>
              {language === 'he' ? 'הצג את התור הבא' : 'Show the next appointment'}
            </button>
          </div>
        ) : !nextSession && (
          <div className="mx-4 mb-4 rounded-2xl px-4 py-3 text-xs"
            style={{ background: 'linear-gradient(135deg,#1f2035,#252840)', border: '1px solid rgba(255,255,255,0.08)', color: '#9ca3af' }}>
            {language === 'he' ? 'אין תורים קרובים' : 'No upcoming appointments'}
          </div>
        )}

        {/* ── My Calendars (appointment types) ────────────────────── */}
        <div className="px-6 mb-5" style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '1.25rem' }}>
          <button className="flex items-center justify-between w-full mb-3"
            onClick={e => { e.stopPropagation(); setCalSecOpen(o => !o); }}>
            <span className="text-sm font-medium" style={{ color: '#f1f5f9' }}>
              {language === 'he' ? 'היומנים שלי' : 'My Calendars'}
            </span>
            <ChevronDown size={13} style={{
              color: '#4b5563',
              transform: calSecOpen ? 'rotate(180deg)' : undefined,
              transition: 'transform 0.2s',
            }} />
          </button>
          <AnimatePresence initial={false}>
            {calSecOpen && (
              <motion.ul initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }}
                className="overflow-hidden space-y-3">
                {uniqueTypes.map(({ type, count }) => {
                  const pal = EVENT_PALETTES[hashStr(type._id || type.name) % EVENT_PALETTES.length];
                  const hidden = hiddenTypeIds.has(type._id);
                  return (
                    <li key={type._id} className="flex items-center justify-between">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            setHiddenTypeIds(prev => {
                              const n = new Set(prev);
                              hidden ? n.delete(type._id) : n.add(type._id);
                              return n;
                            });
                          }}
                          className="w-4 h-4 rounded flex items-center justify-center shrink-0 transition-all"
                          style={{
                            border: `2px solid ${hidden ? '#374151' : pal.checkColor}`,
                            background: hidden ? 'transparent' : pal.checkColor,
                          }}
                        >
                          {!hidden && <Check size={10} color="#fff" strokeWidth={3} />}
                        </button>
                        <span className="text-sm" style={{ color: hidden ? '#4b5563' : '#d1d5db' }}>
                          {type.name}
                        </span>
                      </label>
                      {count > 0 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                          style={{ background: 'rgba(99,102,241,0.2)', color: '#818cf8' }}>
                          {count}
                        </span>
                      )}
                    </li>
                  );
                })}
              </motion.ul>
            )}
          </AnimatePresence>
        </div>

        {/* ── Categories (status distribution) ────────────────────── */}
        <div className="px-6 pb-6">
          <button className="flex items-center justify-between w-full mb-3"
            onClick={e => { e.stopPropagation(); setCatSecOpen(o => !o); }}>
            <span className="text-sm font-medium" style={{ color: '#f1f5f9' }}>
              {language === 'he' ? 'קטגוריות' : 'Categories'}
            </span>
            <ChevronDown size={13} style={{
              color: '#4b5563',
              transform: catSecOpen ? 'rotate(180deg)' : undefined,
              transition: 'transform 0.2s',
            }} />
          </button>
          <AnimatePresence initial={false}>
            {catSecOpen && (
              <motion.ul initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }}
                className="overflow-hidden space-y-3">
                {statusCounts.map(s => (
                  <li key={s.key} className="flex items-center justify-between gap-3">
                    <button
                      className="flex items-center gap-2.5 flex-1 text-left"
                      onClick={e => { e.stopPropagation(); setActiveFilter(activeFilter === s.key ? 'all' : s.key); }}
                    >
                      <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${s.dot}`} />
                      <span className="text-sm" style={{ color: activeFilter === s.key ? '#f1f5f9' : '#9ca3af', fontWeight: activeFilter === s.key ? 600 : undefined }}>
                        {language === 'he' ? s.label_he : s.label_en}
                      </span>
                    </button>
                    <div className="w-16 h-1.5 rounded-full overflow-hidden shrink-0" style={{ background: 'rgba(255,255,255,0.08)' }}>
                      <div className={`h-full rounded-full ${s.bar} transition-all duration-500`} style={{ width: `${s.pct}%` }} />
                    </div>
                  </li>
                ))}
              </motion.ul>
            )}
          </AnimatePresence>
        </div>
    </>
  );

  return (
    <div
      className="flex h-full overflow-hidden"
      onClick={() => setSelectedAppt(null)}
    >

      {/* ─────────────────────────────────────────────────────────────────
          SIDEBAR — always dark, fixed colors
      ───────────────────────────────────────────────────────────────── */}
      <aside
        className="hidden lg:block w-[300px] flex-shrink-0 overflow-y-auto"
        style={{ background: '#1a1b26', borderRight: '1px solid rgba(255,255,255,0.06)', color: '#9ca3af' }}
      >
        {sidePanel}
      </aside>

      {/* ─────────────────────────────────────────────────────────────────
          MOBILE SIDEBAR DRAWER
      ───────────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 lg:hidden" style={{ background: 'rgba(0,0,0,0.5)' }}
              onClick={() => setSidebarOpen(false)} />
            <motion.div
              initial={{ x: direction === 'rtl' ? '100%' : '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: direction === 'rtl' ? '100%' : '-100%' }}
              transition={{ type: 'spring', stiffness: 280, damping: 28 }}
              className={`fixed top-0 ${direction === 'rtl' ? 'right-0' : 'left-0'} h-full w-[300px] z-50 overflow-y-auto flex flex-col pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]`}
              style={{ background: '#1a1b26' }}
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <span className="font-semibold text-sm" style={{ color: '#f1f5f9' }}>
                  {language === 'he' ? 'לוח שנה' : 'Calendar'}
                </span>
                <button className="w-7 h-7 rounded-full flex items-center justify-center"
                  style={{ background: 'rgba(255,255,255,0.08)' }} onClick={() => setSidebarOpen(false)}>
                  <X size={14} style={{ color: '#9ca3af' }} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto" style={{ color: '#9ca3af' }}>
                {sidePanel}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ─────────────────────────────────────────────────────────────────
          MAIN CALENDAR AREA
      ───────────────────────────────────────────────────────────────── */}
      <section className="flex-1 flex flex-col min-w-0 bg-gray-50 dark:bg-gray-900 overflow-hidden">

        {/* ── Header ────────────────────────────────────────────────── */}
        <header className="h-[72px] flex items-center justify-between px-4 sm:px-6 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700/60 shrink-0 gap-3">

          {/* Under lg the side panel (the month, the next booking, the
              filters) is a drawer. Its button stands out in the primary
              colour (LT-355: a grey hamburger went unnoticed), and the month
              itself opens it too. */}
          <div className="flex items-center gap-2 min-w-0">
            <button className="lg:hidden w-10 h-10 flex items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-inset ring-primary/30 hover:bg-primary/15 dark:bg-primary/25 dark:text-violet-200 transition-colors shrink-0"
              aria-label={language === 'he' ? 'פתח תפריט לוח שנה' : 'Open calendar menu'}
              onClick={e => { e.stopPropagation(); setSidebarOpen(true); }}>
              <CalendarDays size={20} />
            </button>
            <h1 className="text-2xl font-semibold text-gray-800 dark:text-white min-w-0">
              <button type="button" className="lg:hidden flex items-center gap-1 max-w-full" data-testid="month-opens-drawer"
                onClick={e => { e.stopPropagation(); setSidebarOpen(true); }}>
                <span className="truncate">
                  <span className="sm:hidden">{format(currentDate, 'MMM yyyy', { locale })}</span>
                  <span className="hidden sm:inline">{format(currentDate, 'MMMM, yyyy', { locale })}</span>
                </span>
                <ChevronDown size={18} className="shrink-0 text-gray-400" />
              </button>
              <span className="hidden lg:block truncate">{format(currentDate, 'MMMM, yyyy', { locale })}</span>
            </h1>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {/* View tabs */}
            <Tabs value={viewMode} onValueChange={m => handleViewMode(m as ViewMode)} className="hidden sm:block" onClick={e => e.stopPropagation()}>
              <TabsList>
                {(['week', 'day'] as ViewMode[]).map(m => (
                  <TabsTrigger key={m} value={m} className="px-4">
                    {m === 'week' ? (language === 'he' ? 'שבוע' : 'Week') : (language === 'he' ? 'יום' : 'Day')}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>

            {/* Navigation */}
            <div className="flex items-center gap-1" dir="ltr">
              <button onClick={e => { e.stopPropagation(); (direction === 'rtl' ? nextPeriod : prevPeriod)(); }}
                className="w-10 h-10 sm:w-8 sm:h-8 flex items-center justify-center rounded-lg border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                <ChevronLeft size={14} />
              </button>
              <button onClick={e => { e.stopPropagation(); goToday(); }}
                className="px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                {language === 'he' ? 'היום' : 'Today'}
              </button>
              <button onClick={e => { e.stopPropagation(); (direction === 'rtl' ? prevPeriod : nextPeriod)(); }}
                className="w-10 h-10 sm:w-8 sm:h-8 flex items-center justify-center rounded-lg border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </header>

        {/* LT-287: on a phone the side panel is a drawer, so the next
            appointment rides above the grid. Tap: its details; ✕: hide it
            (the same remembered choice as the panel's "Hide"). */}
        {nextSession && !nextHidden && (
          <div className="lg:hidden flex items-center gap-1 ps-3 pe-1.5 py-1.5 shrink-0 bg-indigo-50 dark:bg-indigo-950/40 border-b border-indigo-100 dark:border-indigo-900/50" data-testid="next-appt-bar">
            <button type="button" className="flex-1 min-w-0 flex items-center gap-2 text-start"
              onClick={e => { e.stopPropagation(); openNext(); }}>
              <Clock size={14} className="text-indigo-500 dark:text-indigo-300 shrink-0" />
              <span className="text-[11px] font-semibold text-indigo-700 dark:text-indigo-300 shrink-0">
                {language === 'he' ? 'התור הבא' : 'Next'}
              </span>
              <span className="text-xs text-gray-700 dark:text-gray-200 truncate">
                {nextDay} <span dir="ltr">{format(new Date(nextSession.startMs), 'HH:mm')}</span>
                {' · '}{nextSession.type.name}{' · '}{nextWho}
              </span>
              {minutesUntilNext && (
                <span className="shrink-0 rounded-full bg-white/80 dark:bg-white/10 px-2 py-0.5 text-[10px] text-indigo-700 dark:text-indigo-200">
                  {minutesUntilNext}
                </span>
              )}
            </button>
            <button type="button" aria-label={language === 'he' ? 'הסתר את התור הבא' : 'Hide the next appointment'}
              className="w-8 h-8 shrink-0 flex items-center justify-center rounded-full text-gray-400 hover:bg-white/70 dark:hover:bg-white/10"
              onClick={e => { e.stopPropagation(); setNextHidden(true); }}>
              <X size={14} />
            </button>
          </div>
        )}

        {/* ── Scrollable calendar body ───────────────────────────────── */}
        <div className="relative flex-1 min-h-0 flex flex-col">
        {/* While a booking is held (LT-353): the sides that turn the page —
            back over the hours column, ahead at the far side. */}
        {held && ([-1, 1] as const).map(side => (
          <div key={side} aria-hidden="true" data-testid={side === 1 ? 'drag-edge-ahead' : 'drag-edge-back'}
            className={`pointer-events-none absolute inset-y-0 z-30 flex items-center justify-center transition-colors ${side === 1 ? 'end-0' : 'start-0'} ${dragEdge === side ? 'bg-primary/20' : 'bg-gray-500/5'}`}
            style={{ width: side === 1 ? EDGE_PX : TIME_GUTTER }}>
            <span className={`w-8 h-8 rounded-full flex items-center justify-center shadow ${dragEdge === side ? 'bg-primary text-white' : 'bg-white/90 dark:bg-gray-800/90 text-gray-500 dark:text-gray-300'}`}>
              {(side === 1) === (direction === 'rtl') ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
            </span>
          </div>
        ))}
        <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden bg-white dark:bg-gray-900" onClick={() => setSelectedAppt(null)}
          style={{ ['--cal-slide-from' as string]: slideFrom }}
          onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd} onTouchCancel={() => { swipeRef.current = null; }}>

          {/* ── Sticky day-column headers ───────────────────────────── */}
          <div className="sticky top-0 z-20 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-700/50"
            style={{ display: 'grid', gridTemplateColumns: `${TIME_GUTTER}px repeat(${visibleDays}, 1fr)` }}>

            {/* Calendar icon in time gutter */}
            <div className="flex items-center justify-center border-e border-gray-100 dark:border-gray-800/60 py-4">
              <CalendarDays size={16} className="text-gray-300 dark:text-gray-600" />
            </div>

            {weekDays.map(day => {
              const tod = isToday(day);
              const dots = Math.min(getDaySessions(day).length, 4);
              return (
                // No slide on the sticky header (LT-327): iPhone Safari painted
                // its first frame and never the rest, leaving the day stuck to
                // the side over the grid. The columns below still slide.
                <div key={day.toISOString()}
                  className="flex flex-col items-center py-3 relative border-l border-gray-100 dark:border-gray-800/60">
                  {/* Today gets a dark rounded header card */}
                  {tod ? (
                    <div className="flex flex-col items-center px-4 py-2 rounded-xl mx-1 shadow-md"
                      style={{ background: '#1f2937', color: '#fff', minWidth: 56 }}>
                      <span className="text-[10px] font-medium mb-0.5" style={{ color: '#9ca3af' }}>
                        {dayHead(day)}
                      </span>
                      <span className="text-2xl font-semibold leading-none">{format(day, 'd')}</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center">
                      <span className="text-[10px] font-medium text-gray-400 dark:text-gray-500 mb-0.5">
                        {dayHead(day)}
                      </span>
                      <span className="text-2xl font-semibold text-gray-700 dark:text-gray-200 leading-none">
                        {format(day, 'd')}
                      </span>
                    </div>
                  )}
                  {dots > 0 && (
                    <div className="flex gap-0.5 mt-1.5">
                      {Array.from({ length: dots }).map((_, i) => (
                        <span key={i} className={`w-1 h-1 rounded-full ${tod ? 'bg-white/50' : 'bg-gray-300 dark:bg-gray-600'}`} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* ── Time grid ───────────────────────────────────────────── */}
          {/* overflow-x: clip (LT-328): a day sliding in starts 48px past the
              side it comes from. Going forward in Hebrew that is the left —
              the scrollable side of an RTL scroller — and the overflow it made
              threw iPhone Safari's sticky day row out of line, for good. Clip
              (unlike hidden) clips without making a scroll box, so the slide
              never reaches the scroller. */}
          {showSkeleton && <span role="status" className="sr-only">{t('appointments.loading')}</span>}
          <DndContext
            sensors={sensors}
            collisionDetection={trackPointer}
            onDragStart={handleDragStart}
            onDragMove={handleDragMove}
            onDragEnd={handleDragEnd}
            onDragCancel={endDrag}
            accessibility={{
              screenReaderInstructions: { draggable: t('appointments.drag.instructions') },
              announcements: {
                onDragStart: () => t('appointments.drag.picked'),
                onDragOver: () => undefined,
                onDragEnd: () => undefined,
                onDragCancel: () => t('appointments.drag.cancelled'),
              },
            }}
          >
          <div className="relative overflow-x-clip" style={{ paddingTop: 16, height: totalHeight + 16, transition: glide,
            display: 'grid',
            gridTemplateColumns: `${TIME_GUTTER}px repeat(${visibleDays}, 1fr)`,
          }}>

              {/* Time gutter */}
              <div className="relative border-e border-gray-100 dark:border-gray-800/60" style={{ gridRow: 1 }}>
                {/* Every hour at its line, folded or not (LT-359). Keyed by
                    the days on show too, so a page turn draws afresh rather
                    than gliding. */}
                {scale.rows.map(row => (
                  <div key={`${rangeStart}-${row.hour}`} className="absolute w-full" style={{ top: row.top, transition: glide }}>
                    <span className="absolute end-3 text-[11px] text-gray-400 dark:text-gray-500 -translate-y-[9px] select-none whitespace-nowrap bg-white dark:bg-gray-900 px-1">
                      {fmtHour(row.hour)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Day columns */}
              {weekDays.map((day, dayIndex) => {
                const tod = isToday(day);
                const daySessions = getDaySessions(day);
                // Greyed when the business is closed that day (LT-340). It
                // was Saturday and Sunday for everyone — a working Sunday in
                // Israel read as a day off.
                const isClosed = openingHours?.workingDays?.length === 7 && hoursForDate(openingHours, day) === null;

                return (
                  <div key={day.toISOString()} ref={el => { columnRefs.current[dayIndex] = el; }}
                    className={`relative border-l border-gray-100 dark:border-gray-800/60${slideClass}`}
                    style={{
                      background: tod
                        ? 'rgba(99,102,241,0.02)'
                        : isClosed
                          ? 'rgba(249,250,251,0.6)'
                          : undefined,
                    }}>

                    {/* Hour grid lines; a folded hour (LT-359) is hatched and
                        has no half-hour line. The hatch is always there and
                        only its paint changes, so it glides with its hour. */}
                    {scale.rows.map(row => (
                      <React.Fragment key={row.hour}>
                        <div aria-hidden="true" data-testid={row.folded ? 'folded-hour' : undefined}
                          className={`absolute inset-x-0${row.folded ? ' bg-gray-50/70 dark:bg-gray-800/20' : ''}`}
                          style={{
                            top: row.top, height: row.height, transition: glide,
                            backgroundImage: row.folded ? 'repeating-linear-gradient(135deg, transparent 0 7px, rgba(148,163,184,0.14) 7px 8px)' : undefined,
                          }} />
                        <div className="absolute w-full border-t border-gray-100 dark:border-gray-800/40"
                          style={{ top: row.top, transition: glide }} />
                        {!row.folded && (
                          <div className="absolute w-full border-t border-dashed border-gray-50 dark:border-gray-800/20"
                            style={{ top: row.top + row.height / 2, transition: glide }} />
                        )}
                      </React.Fragment>
                    ))}

                    {/* Now line */}
                    {tod && nowVisible && (
                      <div className="absolute w-full z-20 flex items-center pointer-events-none"
                        style={{ top: nowPx, transition: glide }}>
                        <div className="w-3 h-3 rounded-full -ms-1.5 shrink-0"
                          style={{ background: '#6366f1', boxShadow: '0 0 0 2px rgba(99,102,241,0.3)' }} />
                        <div className="flex-1 border-t-2" style={{ borderColor: 'rgba(99,102,241,0.5)' }} />
                      </div>
                    )}

                    {/* Placeholders while the bookings are read (LT-358). */}
                    {showSkeleton && SKELETON_BLOCKS(dayIndex).map(([hour, length], i) => (
                      <div key={i} aria-hidden="true" data-testid="calendar-skeleton"
                        className="absolute rounded-xl bg-gray-200/70 dark:bg-gray-700/40 animate-pulse"
                        style={{ top: scale.yOf(hour * 60), height: length * HOUR_PX - 6, insetInlineStart: 4, insetInlineEnd: 4 }} />
                    ))}

                    {/* Event cards */}
                    {!showSkeleton && (
                    <AnimatePresence>
                      {daySessions.map((session, idx) => {
                        // Absent only for a class nobody has booked yet (LT-211),
                        // which is always a group session.
                        const appt    = session.participants[0];
                        const grouped = isGroupSession(session);
                        const going   = activeParticipants(session);
                        const empty   = grouped && going.length === 0;
                        const seats   = Number(session.type?.capacity) || 0;
                        const { top, height } = getSessionPos(session);
                        const pal    = paletteOf(session.type);
                        const status = grouped ? sessionDisplayStatus(session) : getDisplayStatus(appt);
                        const ts     = new Date(session.startMs);
                        const endTs  = new Date(session.startMs + session.durationMS);
                        const ini    = appt ? initials(appt.name) : '';
                        // One-to-one and ahead: may be dragged, and dropped onto (LT-345).
                        const movable = !grouped && !!appt && isDraggable(appt);

                        const renderBlock = (drag?: DragHandle) => {
                          // Held (LT-353): it stays where it was, faded; the
                          // landing place shows where it would go.
                          const lifted = !!drag?.isDragging;
                          const swapTarget = dropPreview?.verdict.kind === 'swap' && dropPreview.verdict.target._id === appt?._id;
                          return (
                          <motion.div
                            key={session.id}
                            ref={drag?.setNodeRef}
                            {...(drag?.attributes ?? {})}
                            {...(drag?.listeners ?? {})}
                            initial={{ opacity: 0, scale: 0.94 }}
                            animate={{ opacity: lifted ? 0.35 : status === 'cancelled' ? 0.45 : 1, scale: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ delay: idx * 0.02, duration: 0.15 }}
                            whileHover={lifted ? undefined : { scale: 1.025, zIndex: 25 }}
                            whileTap={movable ? undefined : { scale: 0.97 }}
                            onClick={e => {
                              if (justDragged()) return;
                              if (grouped) handleSessionClick(session, e);
                              else handleEventClick(appt, e);
                            }}
                            style={{
                              position: 'absolute', top, height, insetInlineStart: 4, insetInlineEnd: 4,
                              zIndex: 10,
                              transition: glide,
                              ...(movable ? { touchAction: 'manipulation', WebkitTouchCallout: 'none' } : {}),
                            }}
                            data-booking-id={movable ? appt._id : undefined}
                            className={`
                              rounded-xl cursor-pointer overflow-hidden select-none${swapTarget ? ' ring-2 ring-amber-400' : ''}
                              border-s-[3px] ${pal.border}
                              ${empty ? 'bg-white/90 dark:bg-gray-800/90 border border-dashed border-gray-300 dark:border-gray-600' : pal.bg}
                              px-2.5 py-2 shadow-sm hover:shadow-md transition-shadow duration-150
                            `}
                            data-testid={empty ? 'empty-session' : 'session-block'}
                          >
                            {/* A headcount that survives a half-hour block, where
                                there is no room for the roster row below; a
                                class's against its seats. No dir of its own: an
                                element's dir sets which side its `end` is, and an
                                "ltr" badge sat on the right in Hebrew, over the
                                start of the name (LT-211). */}
                            {grouped && (
                              <span className={`absolute top-1 end-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full tabular-nums ${pal.avatar}`}>
                                {seats ? `${going.length}/${seats}` : going.length}
                              </span>
                            )}
                            {/* The name takes its own direction (LT-211): an English
                                name in a Hebrew calendar is cut at its end ("full
                                body wo…"), not its start. The room for the badge
                                is the block's, on the wrapper. */}
                            <div className={grouped ? 'pe-9' : ''}>
                              <p dir="auto" className={`font-semibold text-[11px] leading-tight truncate text-start ${pal.text} ${empty ? pal.emptyDark : ''}`}>
                                {session.type.name}
                              </p>
                            </div>
                            {height > 42 && (
                              <p className={`text-[10px] mt-0.5 ${pal.sub} ${empty ? pal.emptyDarkSub : ''}`}>
                                <span dir="ltr">{`${format(ts, 'HH:mm')} – ${format(endTs, 'HH:mm')}`}</span>
                              </p>
                            )}
                            {height > 62 && (
                              empty ? (
                                <p className={`text-[10px] mt-1.5 truncate ${pal.sub} ${pal.emptyDarkSub}`}>
                                  {t('appointments.session.empty')}
                                </p>
                              ) : grouped ? (
                                <div className="flex items-center gap-1.5 mt-1.5">
                                  <div className="flex -space-s-1.5">
                                    {going.slice(0, 3).map(person => (
                                      <div key={person._id}
                                        className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[9px] font-bold ring-2 ring-white/70 dark:ring-gray-800/70 ${pal.avatar}`}>
                                        {initials(person.name)}
                                      </div>
                                    ))}
                                  </div>
                                  <span className={`text-[10px] truncate ${pal.sub}`}>
                                    {t('appointments.session.participants', { count: going.length })}
                                  </span>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1.5 mt-1.5">
                                  <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[9px] font-bold ${pal.avatar}`}>
                                    {ini}
                                  </div>
                                  <span className={`text-[10px] truncate ${pal.sub}`}>{appt.name}</span>
                                </div>
                              )
                            )}
                          </motion.div>
                          );
                        };
                        return appt
                          ? <DragBlock key={session.id} appointment={appt} enabled={movable}>{renderBlock}</DragBlock>
                          : renderBlock();
                      })}
                    </AnimatePresence>
                    )}

                    {/* Where the held booking would land (LT-353), in five-
                        minute steps: ringed in the primary colour, red where it
                        may not go, amber over a booking it would swap with. */}
                    {held && dropPreview?.index === dayIndex && (() => {
                      const pal = getPalette(held);
                      const durationMS = Number(held.type?.durationMS) || 0;
                      const landingTop = scale.yOf(minutesOfDay(dropPreview.startMs));
                      const height = Math.max(scale.yOf(minutesOfDay(dropPreview.startMs) + durationMS / 60_000) - landingTop, 36);
                      const kind = dropPreview.verdict.kind;
                      return (
                        <div aria-hidden="true" data-testid="drag-landing"
                          className={`absolute rounded-xl overflow-hidden select-none pointer-events-none border-s-[3px] ${pal.border} ${pal.bg} px-2.5 py-2 shadow-xl ring-2 ${
                            kind === 'refused' ? 'ring-rose-400' : kind === 'swap' ? 'ring-amber-400 opacity-80' : 'ring-primary'}`}
                          style={{ top: landingTop, height, insetInlineStart: 4, insetInlineEnd: 4, zIndex: 40, transition: glide }}>
                          <p dir="auto" className={`font-semibold text-[11px] leading-tight truncate text-start ${pal.text}`}>{held.type.name}</p>
                          <p className={`text-[10px] mt-0.5 font-semibold ${pal.sub}`}>
                            <span dir="ltr">{`${format(new Date(dropPreview.startMs), 'HH:mm')} – ${format(new Date(dropPreview.startMs + durationMS), 'HH:mm')}`}</span>
                          </p>
                          {height > 62 && (
                            <div className="flex items-center gap-1.5 mt-1.5">
                              <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[9px] font-bold ${pal.avatar}`}>
                                {initials(held.name)}
                              </div>
                              <span className={`text-[10px] truncate ${pal.sub}`}>{held.name}</span>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                );
              })}
          </div>
          </DndContext>
        </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────
          EVENT DETAIL POPUP  — styled like the reference's form card
      ───────────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {openSession && (
          <SessionParticipants
            session={openSession}
            onClose={closeRoster}
          />
        )}
      </AnimatePresence>
      {dialog}

      {/* On document.body (LT-244, the LT-204 pattern): a glass card's
          backdrop-filter is the containing block of anything fixed inside it,
          so the card's viewport coordinates were off and it moved with the page. */}
      {createPortal(
      <AnimatePresence>
        {selectedAppt && popupPos && (
          <motion.div
            ref={popupRef}
            dir={direction}
            key="popup"
            initial={{ opacity: 0, scale: 0.93, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.93 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
            onClick={e => e.stopPropagation()}
            style={{ position: 'fixed', top: popupPos.y, left: popupPos.x, zIndex: 9999, width: 308, maxHeight: 'calc(100vh - 16px)' }}
            className="glass-modal rounded-2xl overflow-hidden overflow-y-auto"
          >
            {/* Title row */}
            <div className="flex items-start justify-between px-5 pt-5 pb-3 gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-0.5">
                  {selectedAppt.type.name}
                </p>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white leading-snug truncate">
                  {selectedAppt.name}
                </h3>
              </div>
              <button onClick={() => setSelectedAppt(null)}
                className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 shrink-0 transition-colors mt-0.5">
                <X size={14} />
              </button>
            </div>

            {/* Detail rows */}
            <div className="px-5 pb-4 space-y-2">
              {/* Date */}
              <div className="flex items-center gap-3 bg-gray-50 dark:bg-gray-700/50 px-3 py-2 rounded-lg">
                <CalendarDays size={14} className="text-gray-400 shrink-0" />
                <span className="text-sm text-gray-600 dark:text-gray-300">
                  {format(new Date(parseInt(selectedAppt.timestamp)), 'EEEE, d MMMM', { locale })}
                </span>
              </div>

              {/* Time range, and the way to move it (LT-341). The two boxes
                  carried a dropdown's arrow and changed nothing. */}
              <div className="flex items-center gap-3 bg-gray-50 dark:bg-gray-700/50 px-3 py-2 rounded-lg">
                <Clock size={14} className="text-gray-400 shrink-0" />
                <span dir="ltr" className="text-sm text-gray-600 dark:text-gray-300">
                  {format(new Date(parseInt(selectedAppt.timestamp)), 'HH:mm')} – {format(new Date(parseInt(selectedAppt.timestamp) + Number(selectedAppt.type.durationMS)), 'HH:mm')}
                </span>
                {canMove(selectedAppt) && (
                  <button
                    type="button"
                    onClick={() => { setMoving(selectedAppt); setSelectedAppt(null); }}
                    className="ms-auto flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                  >
                    <CalendarClock size={12} />
                    {t('appointments.move.button')}
                  </button>
                )}
              </div>

              {/* Client */}
              <div className="flex items-center gap-3 bg-gray-50 dark:bg-gray-700/50 px-3 py-2 rounded-lg">
                <User size={14} className="text-gray-400 shrink-0" />
                <span className="text-sm text-gray-600 dark:text-gray-300 truncate">{selectedAppt.name}</span>
              </div>

              {/* Phone */}
              <div className="flex items-center gap-3 px-3 py-1">
                <Phone size={14} className="text-gray-400 shrink-0" />
                <a href={`tel:${formatPhoneForDisplay(selectedAppt.phone)}`}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                  onClick={e => e.stopPropagation()}>
                  <Phone size={11} />
                  {formatPhoneForDisplay(selectedAppt.phone)}
                </a>
              </div>

              {/* Booking answers (LT-178) — 308px wide, so these wrap rather than truncate. */}
              <AnswersList answers={selectedAppt.answers} />
            </div>

            {/* Tags */}
            <div className="flex flex-wrap gap-2 px-5 pb-4">
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusBadgeClass(getDisplayStatus(selectedAppt))}`}>
                {t(`appointments.${getDisplayStatus(selectedAppt)}`)}
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                {selectedAppt.type.name}
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-medium bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400">
                ₪{selectedAppt.type.price}
              </span>
            </div>

            {/* Client avatar row */}
            <div className="flex items-center justify-between px-5 pb-4">
              <div className="flex -space-x-2">
                {[selectedAppt].map((a, i) => {
                  const pal = getPalette(a);
                  return (
                    <div key={i} className={`w-8 h-8 rounded-full border-2 border-white dark:border-gray-800 flex items-center justify-center text-xs font-bold ${pal.avatar}`}>
                      {initials(a.name)}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Action buttons */}
            {getDisplayStatus(selectedAppt) === 'scheduled' ? (
              <div className="flex gap-2 px-5 pb-5">
                <button onClick={() => handleStatus('completed')} disabled={statusBusy}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-medium text-white transition-colors hover:opacity-90 disabled:opacity-60"
                  style={{ background: '#111827' }}>
                  <Check size={14} />
                  {t('appointments.markCompleted')}
                </button>
                <button onClick={() => handleStatus('cancelled')} disabled={statusBusy}
                  title={t('appointments.cancelAppointment')}
                  className="w-10 h-10 flex items-center justify-center rounded-xl bg-rose-50 dark:bg-rose-900/20 hover:bg-rose-100 dark:hover:bg-rose-900/30 transition-colors disabled:opacity-60">
                  <XCircle size={16} className="text-rose-500" />
                </button>
              </div>
            ) : (
              <div className="px-5 pb-5">
                <div className={`py-2 rounded-xl text-center text-sm font-medium ${getStatusBadgeClass(getDisplayStatus(selectedAppt))}`}>
                  {t(`appointments.${getDisplayStatus(selectedAppt)}`)}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>,
      document.body,
      )}

      <MoveAppointmentModal appointment={moving} onClose={() => setMoving(null)} />
      <DropConfirm pending={pendingDrop} saving={dropSaving} onConfirm={confirmDrop} onClose={() => setPendingDrop(null)} />
    </div>
  );
};

export default AppointmentCalendar;
