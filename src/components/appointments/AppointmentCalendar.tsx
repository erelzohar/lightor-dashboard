import React, { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft, ChevronRight, X, Clock, User, Phone,
  Check, XCircle, ChevronDown, CalendarDays, Menu,
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
import { updateAppointmentStatus } from '../../store/slices/appointmentsSlice';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';
import { formatPhoneForDisplay } from '../../utils/phone';
import {
  Session, activeParticipants, groupSessions, isGroupSession, sessionDisplayStatus, withListedSessions,
} from '../../utils/sessions';
import SessionParticipants from './SessionParticipants';
import AnswersList from './AnswersList';
import { useOpenSession } from '../../hooks/useOpenSession';
import { useClassSessions } from '../../hooks/useClassSessions';
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
const TIME_GUTTER = 80;

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
}) => {
  const [currentDate, setCurrentDate]           = useState(new Date());
  const [viewMode,    setViewMode]              = useState<ViewMode>('week');
  const [visibleDays, setVisibleDays]           = useState(7);
  const [nowPx,       setNowPx]                 = useState(0);
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
  const listed     = useClassSessions(rangeStart, rangeEnd);
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
  const { auth } = useAuth();
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
    const tick = () => {
      const h = getHours(new Date()) + getMinutes(new Date()) / 60;
      setNowPx((h - HOUR_START) * HOUR_PX);
    };
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);

  // ── Auto-scroll ───────────────────────────────────────────────────────
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: Math.max(0, nowPx - 160) });
  }, [nowPx]);

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

  const hours       = useMemo(() => Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i), []);
  const totalHeight = (HOUR_END - HOUR_START) * HOUR_PX;
  const nowVisible  = nowPx >= 0 && nowPx <= totalHeight;

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
  }, [appointments, soonListed, nowPx]); // nowPx: looked at again each minute, so one that started moves on
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
  }, [nextSession, nowPx, language]);

  // Which day — the card used to show only the hours, so a booking days
  // away read like one today (LT-287).
  const nextDay = useMemo(() => {
    if (!nextSession) return null;
    const start = new Date(nextSession.startMs);
    if (isToday(start)) return language === 'he' ? 'היום' : 'Today';
    if (isTomorrow(start)) return language === 'he' ? 'מחר' : 'Tomorrow';
    return format(start, language === 'he' ? 'EEEE d/M' : 'EEE d MMM', { locale });
  }, [nextSession, language, locale, nowPx]);

  const getSessionPos = (session: Session) => {
    const ts   = new Date(session.startMs);
    const h    = getHours(ts) + getMinutes(ts) / 60;
    const durH = session.durationMS / 3_600_000;
    return { top: Math.max(0, (h - HOUR_START) * HOUR_PX), height: Math.max(durH * HOUR_PX, 36) };
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
  const goToday    = () => { goTo(new Date()); setMiniCalMonth(startOfMonth(new Date())); };
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
    if (!start || !p) return;
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

  const handleStatus = async (status: 'completed' | 'cancelled') => {
    if (!selectedAppt) return;
    if (status === 'cancelled' && !window.confirm(t('appointments.cancelConfirm'))) return;
    try {
      dispatch(updateAppointmentStatus({ id: selectedAppt._id, status }));
      toast.success(t('appointments.updateSuccess'));
      setSelectedAppt(null);
    } catch { toast.error(t('appointments.updateError')); }
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
              onClick={e => { e.stopPropagation(); goToday(); }}
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
                  onClick={e => { e.stopPropagation(); goTo(day); setMiniCalMonth(startOfMonth(day)); }}
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

          {/* Mobile menu + month label */}
          <div className="flex items-center gap-3 min-w-0">
            <button className="lg:hidden w-10 h-10 -ms-2 flex items-center justify-center rounded-xl text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors shrink-0"
              aria-label={language === 'he' ? 'פתח תפריט לוח שנה' : 'Open calendar menu'}
              onClick={e => { e.stopPropagation(); setSidebarOpen(true); }}>
              <Menu size={18} />
            </button>
            <h1 className="text-2xl font-semibold text-gray-800 dark:text-white truncate">
              <span className="sm:hidden">{format(currentDate, 'MMM yyyy', { locale })}</span>
              <span className="hidden sm:inline">{format(currentDate, 'MMMM, yyyy', { locale })}</span>
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
                <div key={day.toISOString()}
                  className={`flex flex-col items-center py-3 relative${slideClass}`}
                  style={{ borderLeft: '1px solid', borderColor: 'rgba(243,244,246,0.8)' }}>
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
          <div className="relative" style={{ paddingTop: 16, height: totalHeight + 16,
            display: 'grid',
            gridTemplateColumns: `${TIME_GUTTER}px repeat(${visibleDays}, 1fr)`,
          }}>

              {/* Time gutter */}
              <div className="relative border-e border-gray-100 dark:border-gray-800/60" style={{ gridRow: 1 }}>
                {hours.map(h => (
                  <div key={h} className="absolute w-full" style={{ top: (h - HOUR_START) * HOUR_PX }}>
                    <span className="absolute end-3 text-[11px] text-gray-400 dark:text-gray-500 -translate-y-[9px] select-none whitespace-nowrap bg-white dark:bg-gray-900 px-1">
                      {fmtHour(h)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Day columns */}
              {weekDays.map((day) => {
                const tod = isToday(day);
                const daySessions = getDaySessions(day);
                // Alternate subtle background for visual separation
                const isWeekend = day.getDay() === 0 || day.getDay() === 6;

                return (
                  <div key={day.toISOString()} className={`relative${slideClass}`}
                    style={{
                      borderLeft: '1px solid',
                      borderColor: 'rgba(243,244,246,0.9)',
                      background: tod
                        ? 'rgba(99,102,241,0.02)'
                        : isWeekend
                          ? 'rgba(249,250,251,0.6)'
                          : undefined,
                    }}>

                    {/* Hour grid lines */}
                    {hours.map(h => (
                      <React.Fragment key={h}>
                        <div className="absolute w-full border-t border-gray-100 dark:border-gray-800/40"
                          style={{ top: (h - HOUR_START) * HOUR_PX }} />
                        <div className="absolute w-full border-t border-dashed border-gray-50 dark:border-gray-800/20"
                          style={{ top: (h - HOUR_START) * HOUR_PX + HOUR_PX / 2 }} />
                      </React.Fragment>
                    ))}

                    {/* Now line */}
                    {tod && nowVisible && (
                      <div className="absolute w-full z-20 flex items-center pointer-events-none"
                        style={{ top: nowPx }}>
                        <div className="w-3 h-3 rounded-full -ms-1.5 shrink-0"
                          style={{ background: '#6366f1', boxShadow: '0 0 0 2px rgba(99,102,241,0.3)' }} />
                        <div className="flex-1 border-t-2" style={{ borderColor: 'rgba(99,102,241,0.5)' }} />
                      </div>
                    )}

                    {/* Event cards */}
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

                        return (
                          <motion.div
                            key={session.id}
                            initial={{ opacity: 0, scale: 0.94 }}
                            animate={{ opacity: status === 'cancelled' ? 0.45 : 1, scale: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ delay: idx * 0.02, duration: 0.15 }}
                            whileHover={{ scale: 1.025, zIndex: 25 }}
                            whileTap={{ scale: 0.97 }}
                            onClick={e => grouped ? handleSessionClick(session, e) : handleEventClick(appt, e)}
                            style={{ position: 'absolute', top, height, insetInlineStart: 4, insetInlineEnd: 4, zIndex: 10 }}
                            className={`
                              rounded-xl cursor-pointer overflow-hidden select-none
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
                                <span dir="ltr">{format(ts, 'HH:mm')} – {format(endTs, 'HH:mm')}</span>
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
                      })}
                    </AnimatePresence>
                  </div>
                );
              })}
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

              {/* Time range */}
              <div className="flex items-center gap-3">
                <Clock size={14} className="text-gray-400 shrink-0 ms-3" />
                <div className="flex items-center gap-2 flex-1">
                  <div className="flex-1 flex items-center justify-between bg-gray-50 dark:bg-gray-700/50 px-3 py-2 rounded-lg cursor-default">
                    <span className="text-sm text-gray-600 dark:text-gray-300">
                      {format(new Date(parseInt(selectedAppt.timestamp)), 'HH:mm')}
                    </span>
                    <ChevronDown size={11} className="text-gray-400" />
                  </div>
                  <div className="flex-1 flex items-center justify-between bg-gray-50 dark:bg-gray-700/50 px-3 py-2 rounded-lg cursor-default">
                    <span className="text-sm text-gray-600 dark:text-gray-300">
                      {format(new Date(parseInt(selectedAppt.timestamp) + Number(selectedAppt.type.durationMS)), 'HH:mm')}
                    </span>
                    <ChevronDown size={11} className="text-gray-400" />
                  </div>
                </div>
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
                <button onClick={() => handleStatus('completed')}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-medium text-white transition-colors hover:opacity-90"
                  style={{ background: '#111827' }}>
                  <Check size={14} />
                  {t('appointments.markCompleted')}
                </button>
                <button onClick={() => handleStatus('cancelled')}
                  title={t('appointments.cancelAppointment')}
                  className="w-10 h-10 flex items-center justify-center rounded-xl bg-rose-50 dark:bg-rose-900/20 hover:bg-rose-100 dark:hover:bg-rose-900/30 transition-colors">
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
    </div>
  );
};

export default AppointmentCalendar;
