import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft, ChevronRight, X, Clock, User, Phone,
  Check, XCircle, ChevronDown, CalendarDays, Menu,
} from 'lucide-react';
import {
  format, addDays, isToday, isSameDay, getHours, getMinutes,
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  addMonths, subMonths, eachDayOfInterval, isSameMonth,
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

interface AppointmentCalendarProps {
  appointments: Appointment[];
  onAppointmentClick: (appointment: Appointment) => void;
}

// ── Deterministic palette per appointment type ─────────────────────────────
const EVENT_PALETTES = [
  { bg: 'bg-blue-100',   border: 'border-l-blue-400',   text: 'text-blue-900',   sub: 'text-blue-700',   avatar: 'bg-blue-200 text-blue-800',   dot: 'bg-blue-400',   checkColor: '#60a5fa' },
  { bg: 'bg-green-100',  border: 'border-l-green-400',  text: 'text-green-900',  sub: 'text-green-700',  avatar: 'bg-green-200 text-green-800',  dot: 'bg-green-400',  checkColor: '#4ade80' },
  { bg: 'bg-purple-200', border: 'border-l-purple-400', text: 'text-purple-900', sub: 'text-purple-700', avatar: 'bg-purple-200 text-purple-800',dot: 'bg-purple-400', checkColor: '#c084fc' },
  { bg: 'bg-yellow-100', border: 'border-l-yellow-400', text: 'text-yellow-900', sub: 'text-yellow-700', avatar: 'bg-yellow-200 text-yellow-800',dot: 'bg-yellow-400', checkColor: '#facc15' },
  { bg: 'bg-pink-100',   border: 'border-l-pink-400',   text: 'text-pink-900',   sub: 'text-pink-700',   avatar: 'bg-pink-200 text-pink-800',   dot: 'bg-pink-400',   checkColor: '#f472b6' },
  { bg: 'bg-teal-100',   border: 'border-l-teal-400',   text: 'text-teal-900',   sub: 'text-teal-700',   avatar: 'bg-teal-200 text-teal-800',   dot: 'bg-teal-400',   checkColor: '#2dd4bf' },
  { bg: 'bg-orange-100', border: 'border-l-orange-400', text: 'text-orange-900', sub: 'text-orange-700', avatar: 'bg-orange-200 text-orange-800',dot: 'bg-orange-400', checkColor: '#fb923c' },
  { bg: 'bg-indigo-100', border: 'border-l-indigo-400', text: 'text-indigo-900', sub: 'text-indigo-700', avatar: 'bg-indigo-200 text-indigo-800',dot: 'bg-indigo-400', checkColor: '#818cf8' },
] as const;

const hashStr = (s: string): number => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h);
};
const getPalette = (appt: Appointment) =>
  EVENT_PALETTES[hashStr(appt.type._id || appt.type.name) % EVENT_PALETTES.length];

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
const AppointmentCalendar: React.FC<AppointmentCalendarProps> = ({
  appointments,
  onAppointmentClick,
}) => {
  const [currentDate, setCurrentDate]           = useState(new Date());
  const [viewMode,    setViewMode]              = useState<ViewMode>('week');
  const [visibleDays, setVisibleDays]           = useState(7);
  const [nowPx,       setNowPx]                 = useState(0);
  const [miniCalMonth,setMiniCalMonth]          = useState(startOfMonth(new Date()));
  const [selectedAppt,setSelectedAppt]          = useState<Appointment | null>(null);
  const [popupPos,    setPopupPos]              = useState<{ x: number; y: number } | null>(null);
  const [activeFilter,setActiveFilter]          = useState<FilterKey>('all');
  const [hiddenTypeIds,setHiddenTypeIds]        = useState<Set<string>>(new Set());
  const [calSecOpen,  setCalSecOpen]            = useState(true);
  const [catSecOpen,  setCatSecOpen]            = useState(true);
  const [sidebarOpen, setSidebarOpen]           = useState(false);
  const [laterApptId, setLaterApptId]           = useState<string | null>(null);

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
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') setSelectedAppt(null); };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, []);

  // ── Derived ───────────────────────────────────────────────────────────
  const miniCalDays = useMemo(() => eachDayOfInterval({
    start: startOfWeek(miniCalMonth, { weekStartsOn: 0 }),
    end:   endOfWeek(endOfMonth(miniCalMonth), { weekStartsOn: 0 }),
  }), [miniCalMonth]);

  const weekDays    = useMemo(() => Array.from({ length: visibleDays }, (_, i) => addDays(currentDate, i)), [currentDate, visibleDays]);
  const hours       = useMemo(() => Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i), []);
  const totalHeight = (HOUR_END - HOUR_START) * HOUR_PX;
  const nowVisible  = nowPx >= 0 && nowPx <= totalHeight;

  const uniqueTypes = useMemo(() => {
    const map = new Map<string, { type: AppointmentType; count: number }>();
    appointments.forEach(a => {
      const e = map.get(a.type._id);
      if (e) e.count++; else map.set(a.type._id, { type: a.type, count: 1 });
    });
    return Array.from(map.values()).sort((a, b) => b.count - a.count).slice(0, 5);
  }, [appointments]);

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

  const miniHasAppts = (day: Date) =>
    appointments.some(a => isSameDay(new Date(parseInt(a.timestamp)), day));

  const nextAppt = useMemo(() =>
    appointments
      .filter(a => getDisplayStatus(a) === 'scheduled' && parseInt(a.timestamp) > Date.now())
      .sort((a, b) => parseInt(a.timestamp) - parseInt(b.timestamp))[0]
  , [appointments]);

  const minutesUntilNext = useMemo(() => {
    if (!nextAppt) return null;
    const diff = parseInt(nextAppt.timestamp) - Date.now();
    if (diff <= 0) return null;
    const mins = Math.floor(diff / 60000);
    return mins < 60 ? `${mins} min` : `${Math.floor(mins / 60)}h ${mins % 60}m`;
  }, [nextAppt, nowPx]);

  const getApptPos = (a: Appointment) => {
    const ts   = new Date(parseInt(a.timestamp));
    const h    = getHours(ts) + getMinutes(ts) / 60;
    const durH = Number(a.type.durationMS) / 3_600_000;
    return { top: Math.max(0, (h - HOUR_START) * HOUR_PX), height: Math.max(durH * HOUR_PX, 36) };
  };

  // ── Handlers ──────────────────────────────────────────────────────────
  const prevPeriod = () => setCurrentDate(d => addDays(d, -visibleDays));
  const nextPeriod = () => setCurrentDate(d => addDays(d, visibleDays));
  const goToday    = () => { setCurrentDate(new Date()); setMiniCalMonth(startOfMonth(new Date())); };

  const handleViewMode = (m: ViewMode) => {
    setViewMode(m);
    setVisibleDays(m === 'day' ? 1 : window.innerWidth < 640 ? 1 : window.innerWidth < 1024 ? 3 : 7);
  };

  const handleEventClick = (appt: Appointment, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedAppt(appt);
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const PW = 308, PH = 380;
    let x = rect.right + 10;
    let y = rect.top;
    if (x + PW > window.innerWidth - 8) x = Math.max(8, rect.left - PW - 10);
    if (y + PH > window.innerHeight - 8) y = Math.max(8, window.innerHeight - PH - 8);
    setPopupPos({ x, y });
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
                  onClick={e => { e.stopPropagation(); setCurrentDate(day); setMiniCalMonth(startOfMonth(day)); }}
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
        {nextAppt && nextAppt._id !== laterApptId && (
          <div className="mx-4 mb-4 rounded-2xl p-4 relative overflow-hidden"
            style={{ background: 'linear-gradient(135deg,#1f2035,#252840)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs" style={{ color: '#6b7280' }}>
                {format(new Date(parseInt(nextAppt.timestamp)), 'HH:mm')}
                {' – '}
                {format(new Date(parseInt(nextAppt.timestamp) + Number(nextAppt.type.durationMS)), 'HH:mm')}
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
              {nextAppt.type.name}
              <span className="block text-xs font-normal mt-0.5" style={{ color: '#6b7280' }}>{nextAppt.name}</span>
            </h4>
            <div className="flex gap-2 relative z-10">
              <button className="px-4 py-1.5 rounded-full text-xs transition-colors"
                style={{ border: '1px solid rgba(255,255,255,0.18)', color: '#9ca3af' }}
                onClick={e => { e.stopPropagation(); setLaterApptId(nextAppt._id); }}
              >
                {language === 'he' ? 'אחר כך' : 'Later'}
              </button>
              <button className="px-4 py-1.5 rounded-full text-xs text-white transition-colors"
                style={{ background: '#6366f1' }}
                onClick={e => { e.stopPropagation(); onAppointmentClick(nextAppt); }}
              >
                {language === 'he' ? 'פרטים' : 'Details'}
              </button>
            </div>
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
              className={`fixed top-0 ${direction === 'rtl' ? 'right-0' : 'left-0'} h-full w-[300px] z-50 overflow-y-auto flex flex-col`}
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
            <div className="hidden sm:flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-1 gap-0.5">
              {(['week', 'day'] as ViewMode[]).map(m => (
                <button key={m}
                  onClick={e => { e.stopPropagation(); handleViewMode(m); }}
                  className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all
                    ${viewMode === m
                      ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'}`}
                >
                  {m === 'week' ? (language === 'he' ? 'שבוע' : 'Week') : (language === 'he' ? 'יום' : 'Day')}
                </button>
              ))}
            </div>

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

        {/* ── Scrollable calendar body ───────────────────────────────── */}
        <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto bg-white dark:bg-gray-900" onClick={() => setSelectedAppt(null)}>

          {/* ── Sticky day-column headers ───────────────────────────── */}
          <div className="sticky top-0 z-20 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-700/50"
            style={{ display: 'grid', gridTemplateColumns: `${TIME_GUTTER}px repeat(${visibleDays}, 1fr)` }}>

            {/* Calendar icon in time gutter */}
            <div className="flex items-center justify-center border-e border-gray-100 dark:border-gray-800/60 py-4">
              <CalendarDays size={16} className="text-gray-300 dark:text-gray-600" />
            </div>

            {weekDays.map(day => {
              const tod = isToday(day);
              const dots = Math.min(getDayAppts(day).length, 4);
              return (
                <div key={day.toISOString()}
                  className="flex flex-col items-center py-3 relative"
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
              {weekDays.map((day, colIdx) => {
                const tod = isToday(day);
                const dayAppts = getDayAppts(day);
                // Alternate subtle background for visual separation
                const isWeekend = day.getDay() === 0 || day.getDay() === 6;

                return (
                  <div key={day.toISOString()} className="relative"
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
                      {dayAppts.map((appt, idx) => {
                        const { top, height } = getApptPos(appt);
                        const pal    = getPalette(appt);
                        const status = getDisplayStatus(appt);
                        const ts     = new Date(parseInt(appt.timestamp));
                        const endTs  = new Date(parseInt(appt.timestamp) + Number(appt.type.durationMS));
                        const ini    = initials(appt.name);

                        return (
                          <motion.div
                            key={appt._id}
                            initial={{ opacity: 0, scale: 0.94 }}
                            animate={{ opacity: status === 'cancelled' ? 0.45 : 1, scale: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ delay: idx * 0.02, duration: 0.15 }}
                            whileHover={{ scale: 1.025, zIndex: 25 }}
                            whileTap={{ scale: 0.97 }}
                            onClick={e => handleEventClick(appt, e)}
                            style={{ position: 'absolute', top, height, insetInlineStart: 4, insetInlineEnd: 4, zIndex: 10 }}
                            className={`
                              rounded-xl cursor-pointer overflow-hidden select-none
                              border-s-[3px] ${pal.border} ${pal.bg}
                              px-2.5 py-2 shadow-sm hover:shadow-md transition-shadow duration-150
                            `}
                          >
                            <p className={`font-semibold text-[11px] leading-tight truncate ${pal.text}`}>
                              {appt.type.name}
                            </p>
                            {height > 42 && (
                              <p className={`text-[10px] mt-0.5 ${pal.sub}`}>
                                {format(ts, 'HH:mm')} – {format(endTs, 'HH:mm')}
                              </p>
                            )}
                            {height > 62 && (
                              <div className="flex items-center gap-1.5 mt-1.5">
                                <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[9px] font-bold ${pal.avatar}`}>
                                  {ini}
                                </div>
                                <span className={`text-[10px] truncate ${pal.sub}`}>{appt.name}</span>
                              </div>
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
        {selectedAppt && popupPos && (
          <motion.div
            key="popup"
            initial={{ opacity: 0, scale: 0.93, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.93 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
            onClick={e => e.stopPropagation()}
            style={{ position: 'fixed', top: popupPos.y, left: popupPos.x, zIndex: 9999, width: 308 }}
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-700 overflow-hidden"
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
      </AnimatePresence>
    </div>
  );
};

export default AppointmentCalendar;
