import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Save, RefreshCcw, Calendar, Plus, Trash2, Edit3,
  CalendarClock, Info,
} from 'lucide-react';
import { WebConfig } from '../types';
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

interface WorkingHours {
  startTime: string;
  endTime: string;
}

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

  const parseWorkingHours = (workingHoursString: string | null): WorkingHours | null => {
    if (!workingHoursString) return null;
    const [startTime, endTime] = workingHoursString.split('-');
    if (!startTime || !endTime) return null;
    return { startTime: startTime.trim(), endTime: endTime.trim() };
  };

  const formatWorkingHours = (startTime: string, endTime: string): string => `${startTime}-${endTime}`;

  const hasChanges = () => {
    if (!webConfigLocalState || !originalConfig) return false;
    return JSON.stringify(webConfigLocalState.workingDays) !== JSON.stringify(originalConfig.workingDays);
  };

  const changesDetected = hasChanges();

  const handleSave = async () => {
    if (!webConfigLocalState) return;
    setIsSaving(true);
    try {
      await dispatch(updateWebConfig({ _id: webConfigLocalState._id, workingDays: webConfigLocalState.workingDays }));
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

  const handleWorkingTimeChange = (dayIndex: number, timeType: 'start' | 'end', value: string) => {
    const newWorkingDays = [...webConfigLocalState!.workingDays];
    const currentHours = parseWorkingHours(newWorkingDays[dayIndex]);
    if (!currentHours) return;
    const updatedHours = { ...currentHours, [timeType === 'start' ? 'startTime' : 'endTime']: value };
    newWorkingDays[dayIndex] = formatWorkingHours(updatedHours.startTime, updatedHours.endTime);
    handleChange('root', 'workingDays', newWorkingDays);
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
              const isWorking = webConfigLocalState.workingDays[index] !== null;
              const workingHours = parseWorkingHours(webConfigLocalState.workingDays[index]);

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

                  {/* time inputs — container follows page direction (RTL: start right, end left)
                      each pill is forced LTR so the clock icon and HH:MM value stay readable */}
                  <div className="flex items-center gap-3">
                    <div className="flex flex-col gap-1">
                      <span className="text-[9px] text-primary/70 uppercase font-bold tracking-widest">
                        {t('scheduleVacations.start')}
                      </span>
                      <div dir="ltr" className="bg-white/80 dark:bg-dark-bg border border-primary/30 rounded-xl px-3 py-2 hover:border-primary/60 transition-colors">
                        <input
                          type="time"
                          dir="ltr"
                          value={workingHours?.startTime || ''}
                          onChange={(e) => handleWorkingTimeChange(index, 'start', e.target.value)}
                          className="bg-transparent text-sm font-semibold text-light-text dark:text-dark-text outline-none w-[4.5rem]"
                        />
                      </div>
                    </div>

                    <div className="h-px w-3 bg-black/20 dark:bg-white/20 mt-4 flex-shrink-0" />

                    <div className="flex flex-col gap-1">
                      <span className="text-[9px] text-primary/70 uppercase font-bold tracking-widest">
                        {t('scheduleVacations.end')}
                      </span>
                      <div dir="ltr" className="bg-white/80 dark:bg-dark-bg border border-primary/30 rounded-xl px-3 py-2 hover:border-primary/60 transition-colors">
                        <input
                          type="time"
                          dir="ltr"
                          value={workingHours?.endTime || ''}
                          onChange={(e) => handleWorkingTimeChange(index, 'end', e.target.value)}
                          className="bg-transparent text-sm font-semibold text-light-text dark:text-dark-text outline-none w-[4.5rem]"
                        />
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Save / Discard footer */}
          <div className={`pt-6 border-t border-black/10 dark:border-white/5 flex gap-3 ${isRtl ? 'justify-start' : 'justify-end'}`}>
            <button
              onClick={handleDiscard}
              disabled={!changesDetected}
              className="px-6 py-2.5 rounded-xl bg-black/5 dark:bg-white/5 text-light-text dark:text-dark-text border border-black/10 dark:border-white/10 font-semibold text-sm hover:bg-black/10 dark:hover:bg-white/10 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || !changesDetected}
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
