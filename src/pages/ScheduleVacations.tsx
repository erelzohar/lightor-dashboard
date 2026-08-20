import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Save, RefreshCcw, Calendar, Plus, Trash2, Edit3,
  CalendarClock, Info, Coffee, X,
} from 'lucide-react';
import { DateOverride, WebConfig } from '../types';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import ToggleSwitch from '../components/ui/ToggleSwitch';
import toast from 'react-hot-toast';
import { useTheme } from '../contexts/ThemeContext';
import { format } from 'date-fns';
import { he, enUS } from 'date-fns/locale';
import { useAppDispatch } from '../hooks/useAppDispatch';
import { useAppSelector } from '../hooks/useAppSelector';
import { useAuth } from '../contexts/AuthContext';
import { fetchWebConfig, updateWebConfig } from '../store/slices/webConfigSlice';
import { Vacation } from '../types';
import { createVacation, deleteVacation, updateVacation } from '../store/slices/vacationsSlice';
import { useTranslation } from 'react-i18next';

interface DayHours {
  startTime: string;
  endTime: string;
  /** Break window; both present when the day has a break, both absent otherwise. */
  breakStart?: string;
  breakEnd?: string;
}

type ParsedDay =
  | { kind: 'simple'; hours: DayHours }
  | { kind: 'complex'; ranges: string[] };

/**
 * Lenient editing-oriented parse of a day's serialized hours. One interval =
 * plain hours, two intervals = hours + break (the gap). Three or more
 * intervals can't be produced by this UI — they render read-only so the data
 * survives untouched. Incomplete values (a cleared time input mid-edit) keep
 * their empty parts so the inputs stay editable; validateDayHours flags them.
 */
const parseDayHours = (value: string): ParsedDay => {
  const parts = value.split(',');
  if (parts.length >= 3) return { kind: 'complex', ranges: parts.map(p => p.trim()) };

  const [start = '', firstEnd = ''] = parts[0].split('-').map(p => p.trim());
  if (parts.length === 2) {
    const [secondStart = '', end = ''] = parts[1].split('-').map(p => p.trim());
    return {
      kind: 'simple',
      hours: { startTime: start, endTime: end, breakStart: firstEnd, breakEnd: secondStart },
    };
  }
  return { kind: 'simple', hours: { startTime: start, endTime: firstEnd } };
};

/** "start-end", or "start-breakStart,breakEnd-end" when a break is set. */
const serializeDayHours = (hours: DayHours): string =>
  hours.breakStart !== undefined || hours.breakEnd !== undefined
    ? `${hours.startTime}-${hours.breakStart ?? ''},${hours.breakEnd ?? ''}-${hours.endTime}`
    : `${hours.startTime}-${hours.endTime}`;

const toMinutes = (time: string): number => {
  const [hh, mm] = time.split(':').map(Number);
  return hh * 60 + mm;
};

const toTimeString = (minutes: number): string =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

/** Default break centred in the day's hours; null when there is no room for one. */
const suggestBreak = (hours: DayHours): { breakStart: string; breakEnd: string } | null => {
  if (!hours.startTime || !hours.endTime) return null;
  const start = toMinutes(hours.startTime);
  const end = toMinutes(hours.endTime);
  if (Number.isNaN(start) || Number.isNaN(end) || end - start < 45) return null;

  const length = end - start >= 180 ? 60 : 15;
  let breakStart = start + Math.round((end - start - length) / 2 / 15) * 15;
  if (breakStart <= start) breakStart = start + 15;
  let breakEnd = breakStart + length;
  if (breakEnd >= end) {
    breakEnd = end - 15;
    breakStart = Math.max(start + 15, breakEnd - length);
  }
  if (breakStart >= breakEnd) return null;
  return { breakStart: toTimeString(breakStart), breakEnd: toTimeString(breakEnd) };
};

/**
 * Returns an i18n key suffix (under scheduleVacations) describing what is
 * wrong with a day's hours, or null when they are valid. Serialization is
 * valid exactly when start < breakStart < breakEnd < end (sorted,
 * non-overlapping ranges — what the backend enforces).
 */
const validateDayHours = (value: string | null): string | null => {
  if (value === null) return null;
  const parsed = parseDayHours(value);
  if (parsed.kind === 'complex') return null;

  const { startTime, endTime, breakStart, breakEnd } = parsed.hours;
  const hasBreak = breakStart !== undefined || breakEnd !== undefined;
  if (!startTime || !endTime || (hasBreak && (!breakStart || !breakEnd))) return 'fillRequired';
  if (toMinutes(endTime) <= toMinutes(startTime)) return 'invalidDayHours';
  if (hasBreak) {
    if (toMinutes(breakEnd!) <= toMinutes(breakStart!)) return 'invalidBreakOrder';
    if (toMinutes(breakStart!) <= toMinutes(startTime) || toMinutes(breakEnd!) >= toMinutes(endTime)) {
      return 'breakOutsideHours';
    }
  }
  return null;
};

/** Weekday index (0 = Sunday, matching workingDays) of a local "YYYY-MM-DD". */
const weekdayOf = (dateString: string): number => {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day).getDay();
};

const getActiveDayStyle = (darkMode: boolean) => ({
  background: darkMode
    ? 'linear-gradient(#1e293b, #1e293b) padding-box, linear-gradient(45deg, rgba(139, 92, 246, 0.8), rgba(60, 221, 199, 0.4)) border-box'
    : 'linear-gradient(#f8fafc, #f8fafc) padding-box, linear-gradient(45deg, rgba(139, 92, 246, 0.8), rgba(60, 221, 199, 0.4)) border-box',
  border: '1px solid transparent',
});

const ScheduleVacations: React.FC = () => {
  const { t } = useTranslation();
  const [webConfigLocalState, setWebConfigLocalState] = useState<WebConfig | null>(null);
  const { auth } = useAuth();
  const [originalConfig, setOriginalConfig] = useState<WebConfig | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [vacations, setVacations] = useState<Vacation[]>([]);
  const [isAddingVacation, setIsAddingVacation] = useState(false);
  const [isAddingOverride, setIsAddingOverride] = useState(false);
  const [newOverrideDate, setNewOverrideDate] = useState('');
  const [editingVacation, setEditingVacation] = useState<string | null>(null);
  const [isEditingVacation, setIsEditingVacation] = useState<boolean>(false);
  const [newVacation, setNewVacation] = useState<Vacation>({
    title: '',
    startDate: new Date().toLocaleString('sv-SE').replace(' ', 'T').slice(0, 16),
    endDate: new Date().toLocaleString('sv-SE').replace(' ', 'T').slice(0, 16),
    webConfig_id: '',
  });

  const { language, direction, darkMode } = useTheme();
  const locale = language === 'he' ? he : enUS;
  const dispatch = useAppDispatch();
  const webConfig = useAppSelector(state => state.webConfig);
  const isLoading = useAppSelector(state => state.webConfig.loading);

  document.title = t('scheduleVacations.title');

  const dayNames = t('scheduleVacations.daysOfWeek', { returnObjects: true }) as string[];

  useEffect(() => {
    if (auth.user && !webConfig.data && !isLoading) {
      dispatch(fetchWebConfig(auth.user.webConfig_id));
    }
    if (webConfig.data) {
      setOriginalConfig(JSON.parse(JSON.stringify(webConfig.data)));
      setWebConfigLocalState(webConfig.data);
      setVacations(webConfig.data?.vacations);
    }
  }, [auth, dispatch, webConfig]);

  // Absent on configs saved before dateOverrides existed — treat as [].
  const dateOverrides = webConfigLocalState?.dateOverrides ?? [];
  const sortedOverrides = [...dateOverrides].sort((a, b) => a.date.localeCompare(b.date));
  const todayString = new Date().toLocaleDateString('sv-SE');

  const hasChanges = () => {
    if (!webConfigLocalState || !originalConfig) return false;
    return (
      JSON.stringify(webConfigLocalState.workingDays) !== JSON.stringify(originalConfig.workingDays) ||
      JSON.stringify(webConfigLocalState.dateOverrides ?? []) !== JSON.stringify(originalConfig.dateOverrides ?? [])
    );
  };

  const changesDetected = hasChanges();

  const workingDayErrors = (webConfigLocalState?.workingDays ?? []).map(validateDayHours);
  const overrideErrors: Record<string, string | null> = {};
  dateOverrides.forEach(override => { overrideErrors[override.date] = validateDayHours(override.hours); });
  const hasValidationErrors =
    workingDayErrors.some(Boolean) || Object.values(overrideErrors).some(Boolean);

  const handleSave = async () => {
    if (!webConfigLocalState) return;
    if (hasValidationErrors) {
      toast.error(t('scheduleVacations.fixErrorsBeforeSave'));
      return;
    }
    setIsSaving(true);
    try {
      await dispatch(updateWebConfig({
        _id: webConfigLocalState._id,
        workingDays: webConfigLocalState.workingDays,
        dateOverrides: webConfigLocalState.dateOverrides ?? [],
      }));
      setOriginalConfig(JSON.parse(JSON.stringify(webConfigLocalState)));
      toast.success(t('scheduleVacations.saveSuccess'));
    } catch (error) {
      toast.error(t('scheduleVacations.saveError'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDiscard = () => {
    if (originalConfig) {
      setWebConfigLocalState(JSON.parse(JSON.stringify(originalConfig)));
    }
  };

  const handleChange = (section: string, field: string, value: any) => {
    if (!webConfig) return;
    setWebConfigLocalState(prev => {
      if (!prev) return prev;
      if (section === 'root') return { ...prev, [field]: value };
      return { ...prev, [section]: { ...prev[section as keyof WebConfig], [field]: value } };
    });
  };

  const handleWorkingDayToggle = (dayIndex: number, checked: boolean) => {
    const newWorkingDays = [...webConfigLocalState!.workingDays];
    newWorkingDays[dayIndex] = checked ? '09:00-17:00' : null;
    handleChange('root', 'workingDays', newWorkingDays);
  };

  const handleDayHoursChange = (dayIndex: number, value: string) => {
    const newWorkingDays = [...webConfigLocalState!.workingDays];
    newWorkingDays[dayIndex] = value;
    handleChange('root', 'workingDays', newWorkingDays);
  };

  const setOverrides = (overrides: DateOverride[]) => {
    handleChange('root', 'dateOverrides', [...overrides].sort((a, b) => a.date.localeCompare(b.date)));
  };

  const handleAddOverride = () => {
    if (!newOverrideDate) {
      toast.error(t('scheduleVacations.selectDate'));
      return;
    }
    if (newOverrideDate < todayString) {
      toast.error(t('scheduleVacations.pastDate'));
      return;
    }
    if (dateOverrides.some(override => override.date === newOverrideDate)) {
      toast.error(t('scheduleVacations.duplicateDate'));
      return;
    }
    if (dateOverrides.length >= 50) {
      toast.error(t('scheduleVacations.maxDateOverrides'));
      return;
    }
    // Start from that weekday's regular hours; the owner tweaks from there.
    // A closed weekday still starts the override OPEN on the standard default —
    // adding a date means the owner wants hours there, closing stays one toggle away.
    const weekdayHours = webConfigLocalState!.workingDays[weekdayOf(newOverrideDate)] ?? '09:00-17:00';
    setOverrides([...dateOverrides, { date: newOverrideDate, hours: weekdayHours }]);
    setNewOverrideDate('');
    setIsAddingOverride(false);
  };

  const handleOverrideToggle = (date: string, open: boolean) => {
    setOverrides(dateOverrides.map(override => override.date === date
      ? { ...override, hours: open ? (webConfigLocalState!.workingDays[weekdayOf(date)] ?? '09:00-17:00') : null }
      : override));
  };

  const handleOverrideHoursChange = (date: string, value: string) => {
    setOverrides(dateOverrides.map(override =>
      override.date === date ? { ...override, hours: value } : override));
  };

  const handleDeleteOverride = (date: string) => {
    setOverrides(dateOverrides.filter(override => override.date !== date));
  };

  const formatOverrideDate = (dateString: string): string => {
    const [year, month, day] = dateString.split('-').map(Number);
    return format(new Date(year, month - 1, day), 'EEEE, PPP', { locale });
  };

  const handleAddVacation = async () => {
    if (vacations.length >= 5) {
      toast.error(t('scheduleVacations.maxVacations'));
      return;
    }
    if (!newVacation.title || !newVacation.startDate || !newVacation.endDate) {
      toast.error(t('scheduleVacations.fillRequired'));
      return;
    }
    const start = new Date(newVacation.startDate).getTime().toString();
    const end = new Date(newVacation.endDate).getTime().toString();
    newVacation.startDate = start;
    newVacation.endDate = end;
    newVacation.webConfig_id = webConfig.data._id;
    if (+start > +end) {
      toast.error(t('scheduleVacations.dateError'));
      return;
    }
    try {
      await dispatch(createVacation(newVacation));
      setVacations(prev => [...prev, newVacation]);
      setNewVacation({ title: '', startDate: '', endDate: '', webConfig_id: '' });
      toast.success(t('scheduleVacations.addSuccess'));
    } catch (error) {
      console.log(error);
      toast.error(t('scheduleVacations.addError'));
    } finally {
      setIsAddingVacation(false);
    }
  };

  const handleEditVacation = async (id: string, updatedVacation: Vacation) => {
    if (!updatedVacation.title || !updatedVacation.startDate || !updatedVacation.endDate) {
      toast.error(t('scheduleVacations.fillRequired'));
      return;
    }
    if (new Date(updatedVacation.startDate) > new Date(updatedVacation.endDate)) {
      toast.error(t('scheduleVacations.dateError'));
      return;
    }
    setIsEditingVacation(true);
    try {
      const start = new Date(updatedVacation.startDate).getTime().toString();
      const end = new Date(updatedVacation.endDate).getTime().toString();
      updatedVacation._id = id;
      await dispatch(updateVacation({ ...updatedVacation, startDate: start, endDate: end }));
      setVacations(prev => prev.map(vacation =>
        vacation._id === id ? { ...updatedVacation, id } : vacation
      ));
      toast.success(t('scheduleVacations.editSuccess'));
    } catch (error) {
      console.log(error);
      toast.error(t('scheduleVacations.deleteError'));
    } finally {
      setEditingVacation(null);
      setIsEditingVacation(false);
    }
  };

  const handleDeleteVacation = async (id: string) => {
    try {
      if (!window.confirm(t('scheduleVacations.deleteConfirm'))) return;
      await dispatch(deleteVacation(id));
      setVacations(prev => prev.filter(vacation => vacation._id !== id));
      toast.success(t('scheduleVacations.deleteSuccess'));
    } catch (error) {
      console.log(error);
      toast.error(t('scheduleVacations.deleteError'));
    }
  };

  const formatVacationDateTime = (dateTimeString: string): string => {
    try {
      const date = isNaN(+dateTimeString) ? new Date(dateTimeString) : new Date(+dateTimeString);
      return format(date, 'PPP - p', { locale });
    } catch (err) {
      console.log(err);
      return '';
    }
  };

  const calculateVacationDuration = (startDate: string, endDate: string): number => {
    const start = isNaN(+startDate) ? new Date(startDate) : new Date(+startDate);
    const end = isNaN(+endDate) ? new Date(endDate) : new Date(+endDate);
    return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  };

  if (isLoading || !webConfig || !webConfigLocalState) {
    return (
      <div className="flex justify-center items-center h-96">
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
          <RefreshCcw className="text-primary h-8 w-8" />
        </motion.div>
      </div>
    );
  }

  const isRtl = direction === 'rtl';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="relative"
    >
      {/* Ambient background glows */}
      <div className="fixed top-0 left-0 w-[35%] h-[35%] bg-primary/5 blur-[140px] rounded-full pointer-events-none -z-10" />
      <div className="fixed bottom-0 right-0 w-[30%] h-[40%] bg-violet-500/5 blur-[120px] rounded-full pointer-events-none -z-10" />

      {/* Page header */}
      <header className="mb-10 pb-8 border-b border-black/10 dark:border-white/5">
        <div className="flex items-center gap-3 mb-2">
          <CalendarClock className="text-primary w-6 h-6 shrink-0" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
            {t('scheduleVacations.title')}
          </h1>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {t('scheduleVacations.description')}
        </p>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">

        {/* ── Working Hours Panel ── */}
        <div className="xl:col-span-7 glass-panel rounded-3xl p-8 lg:p-10 flex flex-col gap-8">
          <div className="flex items-center gap-4 border-b border-black/10 dark:border-white/5 pb-6">
            <div>
              <h2 className="text-2xl font-semibold text-light-text dark:text-dark-text tracking-tight">
                {t('scheduleVacations.workingHours')}
              </h2>
              <p className="text-sm text-light-gray dark:text-dark-gray mt-1">
                {t('scheduleVacations.workingHoursDesc')}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {dayNames.map((day, index) => {
              const dayValue = webConfigLocalState.workingDays[index];
              const isWorking = dayValue !== null;
              const parsedDay = isWorking ? parseDayHours(dayValue) : null;

              if (!isWorking) {
                return (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.04 * index }}
                    className="flex items-center justify-between p-5 rounded-2xl bg-black/[0.04] dark:bg-white/[0.02] border border-black/10 dark:border-white/5 group hover:bg-black/[0.07] dark:hover:bg-white/[0.04] transition-colors"
                  >
                    <div className="flex items-center gap-6">
                      <span className="font-medium w-24 text-light-gray dark:text-dark-gray group-hover:text-light-text dark:group-hover:text-dark-text transition-colors text-sm">
                        {day}
                      </span>
                      <ToggleSwitch
                        checked={false}
                        onChange={(checked) => handleWorkingDayToggle(index, checked)}
                      />
                    </div>
                    <span className="text-sm text-light-gray/60 dark:text-dark-gray/50 italic">
                      {t('scheduleVacations.closed')}
                    </span>
                  </motion.div>
                );
              }

              // Multi-range days (3+ intervals) can't be edited with the
              // hours + break inputs — show them read-only so nothing is lost.
              if (parsedDay!.kind === 'complex') {
                return (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.04 * index }}
                    className="flex flex-col items-center md:flex-row md:items-center md:justify-between p-5 rounded-2xl gap-4"
                    style={getActiveDayStyle(darkMode)}
                  >
                    <span className="font-bold w-24 text-primary text-sm text-center md:text-start">
                      {day}
                    </span>
                    <ComplexHoursView ranges={parsedDay!.ranges} />
                  </motion.div>
                );
              }

              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.04 * index }}
                  className="flex flex-col items-center md:flex-row md:items-center md:justify-between p-5 rounded-2xl gap-4"
                  style={getActiveDayStyle(darkMode)}
                >
                  <div className="flex items-center gap-6">
                    <span className="font-bold w-24 text-primary text-sm text-center md:text-start">
                      {day}
                    </span>
                    <ToggleSwitch
                      checked={true}
                      onChange={(checked) => handleWorkingDayToggle(index, checked)}
                    />
                  </div>

                  <HoursEditor
                    value={dayValue as string}
                    onChange={(value) => handleDayHoursChange(index, value)}
                    error={workingDayErrors[index]}
                  />
                </motion.div>
              );
            })}
          </div>

          {/* ── Special hours (per-date overrides) ── */}
          <div className="pt-6 border-t border-black/10 dark:border-white/5 flex flex-col gap-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-light-text dark:text-dark-text tracking-tight">
                  {t('scheduleVacations.specialHours')}
                </h3>
                <p className="text-sm text-light-gray dark:text-dark-gray mt-1">
                  {t('scheduleVacations.specialHoursDesc')}
                </p>
              </div>
              <button
                onClick={() => setIsAddingOverride(prev => !prev)}
                title={t('scheduleVacations.addDate')}
                className={`w-10 h-10 rounded-full border flex items-center justify-center transition-all duration-300 shadow-sm flex-shrink-0 active:scale-90 ${
                  isAddingOverride
                    ? 'bg-red-500/10 border-red-400/30 text-red-400 hover:bg-red-500/20 hover:border-red-400/50'
                    : 'bg-black/5 dark:bg-white/5 border-black/10 dark:border-white/10 text-light-text dark:text-dark-text hover:bg-primary/20 hover:text-primary hover:border-primary/40'
                }`}
              >
                <motion.div
                  animate={{ rotate: isAddingOverride ? 45 : 0 }}
                  transition={{ type: 'spring', stiffness: 350, damping: 22 }}
                >
                  <Plus size={20} />
                </motion.div>
              </button>
            </div>

            {/* Add date form */}
            <AnimatePresence>
              {isAddingOverride && (
                <motion.div
                  initial={{ opacity: 0, height: 0, scale: 0.97 }}
                  animate={{ opacity: 1, height: 'auto', scale: 1 }}
                  exit={{ opacity: 0, height: 0, scale: 0.97 }}
                  transition={{
                    height: { type: 'spring', stiffness: 320, damping: 30 },
                    opacity: { duration: 0.22 },
                    scale: { type: 'spring', stiffness: 380, damping: 26 },
                  }}
                  className="overflow-hidden"
                >
                  <div className="p-5 border border-primary/25 rounded-2xl bg-gradient-to-br from-primary/5 to-primary/[0.02] shadow-inner shadow-primary/5">
                    <h4 className="font-semibold text-sm text-light-text dark:text-dark-text mb-5">
                      {t('scheduleVacations.addDate')}
                    </h4>
                    <div className="space-y-4">
                      <Input
                        label={t('scheduleVacations.dateLabel')}
                        type="date"
                        fullWidth={false}
                        className="w-5/6 self-auto"
                        value={newOverrideDate}
                        min={todayString}
                        onChange={(e) => setNewOverrideDate(e.target.value)}
                      />
                      <div className={`flex gap-2 pt-1 ${isRtl ? 'justify-start' : 'justify-end'}`}>
                        <Button variant="secondary" size="sm" onClick={() => { setIsAddingOverride(false); setNewOverrideDate(''); }}>
                          {t('common.cancel')}
                        </Button>
                        <Button variant="primary" size="sm" onClick={handleAddOverride}>
                          {t('common.add')}
                        </Button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {sortedOverrides.length === 0 && !isAddingOverride ? (
              <p className="text-sm text-light-gray/60 dark:text-dark-gray/50 italic">
                {t('scheduleVacations.noSpecialHours')}
              </p>
            ) : (
              <div className="space-y-3">
                {sortedOverrides.map((override, index) => {
                  const isOpen = override.hours !== null;
                  const parsedOverride = isOpen ? parseDayHours(override.hours as string) : null;

                  return (
                    <motion.div
                      key={override.date}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.03 * index }}
                      className={`flex flex-col p-5 rounded-2xl gap-4 ${
                        isOpen ? '' : 'bg-black/[0.04] dark:bg-white/[0.02] border border-black/10 dark:border-white/5'
                      }`}
                      style={isOpen ? getActiveDayStyle(darkMode) : undefined}
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-5 min-w-0">
                          <span className={`font-bold text-sm truncate ${isOpen ? 'text-primary' : 'text-light-gray dark:text-dark-gray'}`}>
                            {formatOverrideDate(override.date)}
                          </span>
                          {parsedOverride?.kind !== 'complex' && (
                            <ToggleSwitch
                              checked={isOpen}
                              onChange={(checked) => handleOverrideToggle(override.date, checked)}
                            />
                          )}
                        </div>
                        <button
                          onClick={() => handleDeleteOverride(override.date)}
                          className="p-2 text-light-gray dark:text-dark-gray hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors flex-shrink-0"
                          title={t('common.delete')}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>

                      {!isOpen ? (
                        <span className="text-sm text-light-gray/60 dark:text-dark-gray/50 italic">
                          {t('scheduleVacations.closedOnDate')}
                        </span>
                      ) : parsedOverride!.kind === 'complex' ? (
                        <ComplexHoursView ranges={parsedOverride!.ranges} />
                      ) : (
                        <div className="flex justify-center md:justify-end">
                          <HoursEditor
                            value={override.hours as string}
                            onChange={(value) => handleOverrideHoursChange(override.date, value)}
                            error={overrideErrors[override.date]}
                          />
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Save / Discard footer */}
          <div className="pt-6 border-t border-black/10 dark:border-white/5">
            {hasValidationErrors && (
              <p className={`text-xs text-red-500 font-medium mb-3 ${isRtl ? 'text-start' : 'text-end'}`}>
                {t('scheduleVacations.fixErrorsBeforeSave')}
              </p>
            )}
            <div className={`flex gap-3 ${isRtl ? 'justify-start' : 'justify-end'}`}>
              <button
                onClick={handleDiscard}
                disabled={!changesDetected}
                className="px-6 py-2.5 rounded-xl bg-black/5 dark:bg-white/5 text-light-text dark:text-dark-text border border-black/10 dark:border-white/10 font-semibold text-sm hover:bg-black/10 dark:hover:bg-white/10 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving || !changesDetected || hasValidationErrors}
                className="px-6 py-2.5 rounded-xl bg-primary text-white font-bold text-sm hover:opacity-90 hover:shadow-lg hover:shadow-primary/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isSaving
                  ? <RefreshCcw size={14} className="animate-spin" />
                  : <Save size={14} />
                }
                {t('common.save')}
              </button>
            </div>
          </div>
        </div>

        {/* ── Vacations Panel ── */}
        <div className="xl:col-span-5 flex flex-col gap-6">
          <div className="glass-panel rounded-3xl p-8 lg:p-10 flex flex-col group">

            {/* Panel header */}
            <div className="flex items-center justify-between mb-8 pb-6 border-b border-black/10 dark:border-white/5">
              <div>
                <h2 className="text-2xl font-semibold text-light-text dark:text-dark-text tracking-tight">
                  {t('scheduleVacations.vacationManagement')}
                </h2>
                <p className="text-sm text-light-gray dark:text-dark-gray mt-1">
                  {t('scheduleVacations.vacationManagementDesc')}
                </p>
              </div>
              <button
                onClick={() => setIsAddingVacation(prev => !prev)}
                className={`w-10 h-10 rounded-full border flex items-center justify-center transition-all duration-300 shadow-sm flex-shrink-0 active:scale-90 ${
                  isAddingVacation
                    ? 'bg-red-500/10 border-red-400/30 text-red-400 hover:bg-red-500/20 hover:border-red-400/50'
                    : 'bg-black/5 dark:bg-white/5 border-black/10 dark:border-white/10 text-light-text dark:text-dark-text hover:bg-primary/20 hover:text-primary hover:border-primary/40'
                }`}
              >
                <motion.div
                  animate={{ rotate: isAddingVacation ? 45 : 0 }}
                  transition={{ type: 'spring', stiffness: 350, damping: 22 }}
                >
                  <Plus size={20} />
                </motion.div>
              </button>
            </div>

            {/* Add vacation form */}
            <AnimatePresence>
              {isAddingVacation && (
                <motion.div
                  initial={{ opacity: 0, height: 0, scale: 0.97 }}
                  animate={{ opacity: 1, height: 'auto', scale: 1 }}
                  exit={{ opacity: 0, height: 0, scale: 0.97 }}
                  transition={{
                    height: { type: 'spring', stiffness: 320, damping: 30 },
                    opacity: { duration: 0.22 },
                    scale: { type: 'spring', stiffness: 380, damping: 26 },
                  }}
                  className="mb-6 overflow-hidden"
                >
                  <div className="p-5 border border-primary/25 rounded-2xl bg-gradient-to-br from-primary/5 to-primary/[0.02] shadow-inner shadow-primary/5">
                    <motion.h4
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.08, duration: 0.2 }}
                      className="font-semibold text-sm text-light-text dark:text-dark-text mb-5"
                    >
                      {t('scheduleVacations.newVacation')}
                    </motion.h4>

                    <div className="space-y-4">
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.12, type: 'spring', stiffness: 400, damping: 28 }}
                      >
                        <Input
                          label={t('scheduleVacations.titleLabel')}
                          value={newVacation.title}
                          onChange={(e) => setNewVacation(prev => ({ ...prev, title: e.target.value }))}
                          placeholder={t('scheduleVacations.vacationPlaceholder')}
                        />
                      </motion.div>

                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.18, type: 'spring', stiffness: 400, damping: 28 }}
                        className="grid grid-cols-1 gap-4"
                      >
                        <Input
                          label={t('scheduleVacations.startDateTime')}
                          type="datetime-local"
                          fullWidth={false}
                          className="w-5/6 self-auto"
                          value={newVacation.startDate}
                          min={new Date().toISOString().slice(0, 16)}
                          onChange={(e) => setNewVacation(prev => ({ ...prev, startDate: e.target.value }))}
                        />
                        <Input
                          fullWidth={false}
                          className="w-5/6 self-auto"
                          label={t('scheduleVacations.endDateTime')}
                          type="datetime-local"
                          value={newVacation.endDate}
                          min={new Date().toISOString().slice(0, 16)}
                          onChange={(e) => setNewVacation(prev => ({ ...prev, endDate: e.target.value }))}
                        />
                      </motion.div>

                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.24, type: 'spring', stiffness: 400, damping: 28 }}
                        className={`flex gap-2 pt-1 ${isRtl ? 'justify-start' : 'justify-end'}`}
                      >
                        <Button variant="secondary" size="sm" onClick={() => setIsAddingVacation(false)}>
                          {t('common.cancel')}
                        </Button>
                        <Button variant="primary" size="sm" onClick={handleAddVacation}>
                          {t('common.add')}
                        </Button>
                      </motion.div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Empty state */}
            {vacations.length === 0 && !isAddingVacation ? (
              <div className="flex-1 flex flex-col items-center justify-center py-12 text-center">
                <div className="relative mb-6">
                  <div className="absolute inset-0 bg-primary/10 blur-[30px] rounded-full transform scale-150" />
                  <div className="w-20 h-20 rounded-2xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 flex items-center justify-center relative z-10 shadow-lg rotate-3 group-hover:rotate-0 transition-transform duration-500">
                    <Calendar size={36} className="text-primary/70" />
                  </div>
                </div>
                <h3 className="text-lg font-semibold text-light-text dark:text-dark-text mb-2">
                  {t('scheduleVacations.noVacations')}
                </h3>
                <p className="text-light-gray dark:text-dark-gray text-sm max-w-[240px] leading-relaxed">
                  {t('scheduleVacations.noVacationsDesc')}
                </p>
              </div>
            ) : (
              <div className="space-y-3 overflow-y-auto">
                {vacations.map((vacation, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="p-4 rounded-2xl bg-black/[0.04] dark:bg-white/[0.03] border border-black/10 dark:border-white/5 hover:bg-black/[0.07] dark:hover:bg-white/5 transition-colors"
                  >
                    {editingVacation === vacation._id ? (
                      <VacationEditForm
                        vacation={vacation}
                        onSave={(updatedVacation) => handleEditVacation(vacation._id, updatedVacation)}
                        onCancel={() => setEditingVacation(null)}
                        isSaving={isEditingVacation}
                      />
                    ) : (
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                            <h4 className="font-semibold text-light-text dark:text-dark-text truncate text-sm">
                              {vacation.title}
                            </h4>
                          </div>
                          <p className="text-xs text-light-gray dark:text-dark-gray">
                            {t('scheduleVacations.from')}{formatVacationDateTime(vacation.startDate)}
                          </p>
                          <p className="text-xs text-light-gray dark:text-dark-gray">
                            {t('scheduleVacations.to')}{formatVacationDateTime(vacation.endDate)}
                          </p>
                          <span className="inline-block mt-2 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
                            {calculateVacationDuration(vacation.startDate, vacation.endDate)} {t('scheduleVacations.days')}
                          </span>
                        </div>
                        <div className={`flex items-center gap-1 ${isRtl ? 'mr-2' : 'ml-2'}`}>
                          <button
                            onClick={() => setEditingVacation(vacation._id)}
                            disabled={editingVacation !== null}
                            className="p-2 text-light-gray dark:text-dark-gray hover:text-primary hover:bg-primary/10 rounded-xl transition-colors disabled:opacity-40"
                            title={t('common.edit')}
                          >
                            <Edit3 size={15} />
                          </button>
                          <button
                            onClick={() => handleDeleteVacation(vacation._id)}
                            className="p-2 text-light-gray dark:text-dark-gray hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors"
                            title={t('common.delete')}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            )}

            {/* Info box */}
            <div className="mt-6 p-4 rounded-2xl bg-black/[0.04] dark:bg-white/[0.02] border border-black/10 dark:border-white/5">
              <div className="flex items-start gap-3">
                <Info size={15} className="text-primary/70 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-light-gray dark:text-dark-gray leading-relaxed">
                  {t('scheduleVacations.vacationInfoBox')}
                </p>
              </div>
            </div>
          </div>
        </div>

      </div>
    </motion.div>
  );
};

interface TimeFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

// Pill is forced LTR so the HH:MM value stays readable in RTL layouts.
const TimeField: React.FC<TimeFieldProps> = ({ label, value, onChange }) => (
  <div className="flex flex-col gap-1">
    <span className="text-[9px] text-primary/70 uppercase font-bold tracking-widest">
      {label}
    </span>
    <div dir="ltr" className="bg-white/80 dark:bg-dark-bg border border-primary/30 rounded-xl px-3 py-2 hover:border-primary/60 transition-colors">
      <input
        type="time"
        dir="ltr"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-transparent text-sm font-semibold text-light-text dark:text-dark-text outline-none w-[4.5rem]"
      />
    </div>
  </div>
);

interface HoursEditorProps {
  /** Serialized non-null hours: "start-end" or "start-breakStart,breakEnd-end". */
  value: string;
  onChange: (value: string) => void;
  /** i18n key suffix under scheduleVacations, or null when the hours are valid. */
  error: string | null;
}

/**
 * Start/end time pills plus the optional daily break. The break is stored as
 * the gap between two ranges — an implementation detail the owner never sees.
 */
const HoursEditor: React.FC<HoursEditorProps> = ({ value, onChange, error }) => {
  const { t } = useTranslation();

  const parsed = parseDayHours(value);
  if (parsed.kind === 'complex') return null; // callers render ComplexHoursView instead

  const hours = parsed.hours;
  const hasBreak = hours.breakStart !== undefined || hours.breakEnd !== undefined;
  const breakSuggestion = hasBreak ? null : suggestBreak(hours);

  const update = (patch: Partial<DayHours>) => onChange(serializeDayHours({ ...hours, ...patch }));

  return (
    <div className="flex flex-col items-center md:items-end gap-3">
      {/* time inputs — container follows page direction (RTL: start right, end left) */}
      <div className="flex items-center gap-3">
        <TimeField
          label={t('scheduleVacations.start')}
          value={hours.startTime}
          onChange={(v) => update({ startTime: v })}
        />
        <div className="h-px w-3 bg-black/20 dark:bg-white/20 mt-4 flex-shrink-0" />
        <TimeField
          label={t('scheduleVacations.end')}
          value={hours.endTime}
          onChange={(v) => update({ endTime: v })}
        />
      </div>

      {hasBreak ? (
        <div className="flex items-center gap-3">
          <Coffee size={14} className="text-primary/70 mt-4 flex-shrink-0" aria-label={t('scheduleVacations.break')} />
          <TimeField
            label={t('scheduleVacations.breakStart')}
            value={hours.breakStart ?? ''}
            onChange={(v) => update({ breakStart: v })}
          />
          <div className="h-px w-3 bg-black/20 dark:bg-white/20 mt-4 flex-shrink-0" />
          <TimeField
            label={t('scheduleVacations.breakEnd')}
            value={hours.breakEnd ?? ''}
            onChange={(v) => update({ breakEnd: v })}
          />
          <button
            onClick={() => onChange(serializeDayHours({ startTime: hours.startTime, endTime: hours.endTime }))}
            className="p-2 mt-4 text-light-gray dark:text-dark-gray hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors flex-shrink-0"
            title={t('scheduleVacations.removeBreak')}
          >
            <X size={14} />
          </button>
        </div>
      ) : breakSuggestion ? (
        <button
          onClick={() => update(breakSuggestion)}
          className="flex items-center gap-1.5 text-xs font-semibold text-primary/70 hover:text-primary transition-colors"
        >
          <Coffee size={13} />
          {t('scheduleVacations.addBreak')}
        </button>
      ) : null}

      {error && (
        <p className="text-xs text-red-500 font-medium">
          {t(`scheduleVacations.${error}`)}
        </p>
      )}
    </div>
  );
};

/** Read-only view of a day with 3+ ranges — not creatable here, never destroyed. */
const ComplexHoursView: React.FC<{ ranges: string[] }> = ({ ranges }) => {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col items-center md:items-end gap-2">
      <div dir="ltr" className="flex flex-wrap justify-center gap-2">
        {ranges.map((range) => (
          <span key={range} className="px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold">
            {range}
          </span>
        ))}
      </div>
      <p className="text-xs text-light-gray dark:text-dark-gray flex items-center gap-1.5">
        <Info size={12} className="text-primary/70 flex-shrink-0" />
        {t('scheduleVacations.complexHoursNote')}
      </p>
    </div>
  );
};

interface VacationEditFormProps {
  vacation: Vacation;
  onSave: (vacation: Omit<Vacation, '_id'>) => void;
  onCancel: () => void;
  isSaving: boolean;
}

const VacationEditForm: React.FC<VacationEditFormProps> = ({ vacation, onSave, onCancel, isSaving }) => {
  const { t } = useTranslation();
  const { direction } = useTheme();
  const isRtl = direction === 'rtl';

  const [editData, setEditData] = useState<Omit<Vacation, '_id'>>(() => {
    const start = new Date(+vacation.startDate);
    const end = new Date(+vacation.endDate);
    return {
      title: vacation.title,
      startDate: start.toLocaleString('sv-SE').replace(' ', 'T').slice(0, 16),
      endDate: end.toLocaleString('sv-SE').replace(' ', 'T').slice(0, 16),
      webConfig_id: vacation.webConfig_id,
    };
  });

  return (
    <div className="space-y-4">
      <Input
        label={t('scheduleVacations.titleLabel')}
        value={editData.title}
        onChange={(e) => setEditData(prev => ({ ...prev, title: e.target.value }))}
      />
      <div className="grid grid-cols-1 gap-4">
        <Input
          fullWidth={false}
          className="w-5/6 self-auto"
          label={t('scheduleVacations.startDateTime')}
          type="datetime-local"
          value={editData.startDate}
          onChange={(e) => setEditData(prev => ({ ...prev, startDate: e.target.value }))}
          min={new Date().toISOString().slice(0, 16)}
        />
        <Input
          fullWidth={false}
          className="w-5/6 self-auto"
          label={t('scheduleVacations.endDateTime')}
          type="datetime-local"
          value={editData.endDate}
          onChange={(e) => setEditData(prev => ({ ...prev, endDate: e.target.value }))}
          min={new Date().toISOString().slice(0, 16)}
        />
      </div>
      <div className={`flex gap-2 ${isRtl ? 'justify-start' : 'justify-end'}`}>
        <Button variant="danger" size="sm" onClick={onCancel}>
          {t('common.cancel')}
        </Button>
        <Button variant="primary" size="sm" onClick={() => onSave(editData)} disabled={isSaving}>
          {t('common.save')}
        </Button>
      </div>
    </div>
  );
};

export default ScheduleVacations;
