import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Save, RefreshCcw, Calendar, Clock, Plus, Trash2, Edit3, AlertCircle, X, CalendarClock } from 'lucide-react';
import { WebConfig } from '../types';
import Card from '../components/ui/Card';
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

interface WorkingHours {
  startTime: string;
  endTime: string;
}

const ScheduleVacations: React.FC = () => {
  const [webConfigLocalState, setWebConfigLocalState] = useState<WebConfig | null>(null);
  const { auth } = useAuth();
  const [originalConfig, setOriginalConfig] = useState<WebConfig | null>(null);
  const [originalVacations, setOriginalVacations] = useState<Vacation[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [vacations, setVacations] = useState<Vacation[]>([]);
  const [isAddingVacation, setIsAddingVacation] = useState(false);
  const [editingVacation, setEditingVacation] = useState<string | null>(null);
  const [isEditingVacation, setIsEditingVacation] = useState<boolean>(false);
  const [newVacation, setNewVacation] = useState<Vacation>({
    title: '',
    startDate: new Date().toLocaleString('sv-SE').replace(' ', 'T').slice(0, 16),
    endDate: new Date().toLocaleString('sv-SE').replace(' ', 'T').slice(0, 16),
    webConfig_id: ''
  });

  const { language, direction } = useTheme();
  const locale = language === 'he' ? he : enUS;
  const dispatch = useAppDispatch();
  const webConfig = useAppSelector(state => state.webConfig);
  const isLoading = useAppSelector(state => state.webConfig.loading);

  const sentinelRef = useRef<HTMLDivElement>(null);
  const [isStuck, setIsStuck] = useState(false);

  document.title = language === "he" ? "לוח זמנים וחופשות" : "Schedule and vacations";


  useEffect(() => {

    if (auth.user && !webConfig.data && !isLoading) {
      dispatch(fetchWebConfig(auth.user.webConfig_id));
    }
    if (webConfig.data) {
      setOriginalConfig(JSON.parse(JSON.stringify(webConfig.data)));
      setWebConfigLocalState(webConfig.data);

      // Parse vacations from the new config structure
      //const parsedVacations = parseVacationsFromConfig(webConfig.data?.components.schedule.vacations);
      setVacations(webConfig.data?.vacations);
      setOriginalVacations(JSON.parse(JSON.stringify(webConfig.data?.vacations))); // Deep copy for comparison
    }
  }, [auth, dispatch, webConfig]);



  // Parse working hours from string format "09:00-17:00" to separate start/end times
  const parseWorkingHours = (workingHoursString: string | null): WorkingHours | null => {
    if (!workingHoursString) return null;

    const [startTime, endTime] = workingHoursString.split('-');
    if (!startTime || !endTime) return null;

    return { startTime: startTime.trim(), endTime: endTime.trim() };
  };

  // Convert separate start/end times back to string format "09:00-17:00"
  const formatWorkingHours = (startTime: string, endTime: string): string => {
    return `${startTime}-${endTime}`;
  };

  // Check if there are any changes
  const hasChanges = () => {
    if (!webConfigLocalState || !originalConfig) return false;

    // Compare working days
    const workingDaysChanged = JSON.stringify(webConfigLocalState.workingDays) !== JSON.stringify(originalConfig.workingDays);

    return workingDaysChanged;
  };

  const changesDetected = hasChanges();

  useEffect(() => {
    const mainElement = document.querySelector('main');
    if (!mainElement) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsStuck(!entry.isIntersecting);
      },
      {
        threshold: 0,
        rootMargin: '0px 0px 0px 0px'
      }
    );

    if (sentinelRef.current) {
      observer.observe(sentinelRef.current);
    }

    return () => observer.disconnect();
  }, [changesDetected]);



  const handleSave = async () => {
    if (!webConfigLocalState) return;

    setIsSaving(true);
    try {
      const updatedConfig: WebConfig = {
        ...webConfigLocalState
      };


      await dispatch(updateWebConfig({ _id: updatedConfig._id, workingDays: updatedConfig.workingDays }));
      setWebConfigLocalState(updatedConfig);
      setOriginalConfig(JSON.parse(JSON.stringify(updatedConfig)));

      toast.success(
        language === 'he'
          ? 'ההגדרות נשמרו בהצלחה'
          : 'Settings saved successfully'
      );
    } catch (error) {
      toast.error(
        language === 'he'
          ? 'אירעה שגיאה בשמירת ההגדרות'
          : 'Failed to save settings'
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleChange = (section: string, field: string, value: any) => {
    if (!webConfig) return;

    setWebConfigLocalState(prev => {
      if (!prev) return prev;

      if (section === 'root') {
        return { ...prev, [field]: value };
      }

      return {
        ...prev,
        [section]: {
          ...prev[section as keyof WebConfig],
          [field]: value
        }
      };
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

    const updatedHours = {
      ...currentHours,
      [timeType === 'start' ? 'startTime' : 'endTime']: value
    };

    newWorkingDays[dayIndex] = formatWorkingHours(updatedHours.startTime, updatedHours.endTime);
    handleChange('root', 'workingDays', newWorkingDays);
  };

  const handleAddVacation = async () => {
    if (vacations.length >= 5) {
      toast.error(
        language === 'he'
          ? 'מקסימום 5 חופשות'
          : 'Maximum 5 vacations'
      );
      return;
    }
    if (!newVacation.title || !newVacation.startDate || !newVacation.endDate) {
      toast.error(
        language === 'he'
          ? 'אנא מלא את כל השדות הנדרשים'
          : 'Please fill in all required fields'
      );
      return;
    }
    const start = new Date(newVacation.startDate).getTime().toString();
    const end = new Date(newVacation.endDate).getTime().toString();
    newVacation.startDate = start;
    newVacation.endDate = end;
    newVacation.webConfig_id = webConfig.data._id;


    if (+start > +end) {
      toast.error(
        language === 'he'
          ? 'תאריך התחלה חייב להיות לפני תאריך הסיום'
          : 'Start date must be before end date'
      );
      return;
    }
    try {
      await dispatch(createVacation(newVacation));
      setVacations(prev => [...prev, newVacation]);
      setNewVacation({ title: '', startDate: '', endDate: '', webConfig_id: '' });

      toast.success(
        language === 'he'
          ? 'החופשה נוספה בהצלחה'
          : 'Vacation added successfully'
      );
    } catch (error) {
      console.log(error);

      toast.error(
        language === 'he'
          ? 'שגיאה בשמירת החופשה'
          : 'Failed to save vacation'
      );
    } finally {
      setIsAddingVacation(false);
    }
  };

  const handleEditVacation = async (id: string, updatedVacation: Vacation) => {
    if (!updatedVacation.title || !updatedVacation.startDate || !updatedVacation.endDate) {
      toast.error(
        language === 'he'
          ? 'אנא מלא את כל השדות הנדרשים'
          : 'Please fill in all required fields'
      );
      return;
    }

    if (new Date(updatedVacation.startDate) > new Date(updatedVacation.endDate)) {
      toast.error(
        language === 'he'
          ? 'תאריך התחלה חייב להיות לפני תאריך הסיום'
          : 'Start date must be before end date'
      );
      return;
    }
    setIsEditingVacation(true);
    try {
      const start = new Date(updatedVacation.startDate).getTime().toString();
      const end = new Date(updatedVacation.endDate).getTime().toString();
      updatedVacation._id = id;

      await dispatch(updateVacation({ ...updatedVacation, startDate: start, endDate: end }))
      setVacations(prev => prev.map(vacation =>
        vacation._id === id ? { ...updatedVacation, id } : vacation
      ));


      toast.success(
        language === 'he'
          ? 'החופשה עודכנה בהצלחה'
          : 'Vacation updated successfully'
      );
    }
    catch (error) {
      console.log(error);
      toast.error(
        language === 'he'
          ? 'שגיאה במחיקת החופשה'
          : 'Error deleting vacation'
      );
    }
    finally {
      setEditingVacation(null);
      setIsEditingVacation(false);
    }
  };

  const handleDeleteVacation = async (id: string) => {
    try {
      if (!window.confirm(language === 'he'
        ? 'האם למחוק את החופשה?'
        : 'Delete vacation?')) return;
      await dispatch(deleteVacation(id));
      setVacations(prev => prev.filter(vacation => vacation._id !== id));
      toast.success(
        language === 'he'
          ? 'החופשה נמחקה בהצלחה'
          : 'Vacation deleted successfully'
      );
    }
    catch (error) {
      console.log(error);
      toast.error(
        language === 'he'
          ? 'שגיאה במחיקת החופשה'
          : 'Error deleting vacation'
      );
    }
  };

  const formatVacationDateTime = (dateTimeString: string): string => {
    try {
      let date;
      if (isNaN(+dateTimeString)) date = new Date(dateTimeString);
      else date = new Date(+dateTimeString);

      return format(date, 'PPP - p', { locale });
    }
    catch (err) {
      console.log(err);
      return '';
    }
  };

  const calculateVacationDuration = (startDate: string, endDate: string): number => {
    let start;
    let end;
    if (isNaN(+startDate)) {
      start = new Date(startDate);
      end = new Date(endDate);
    } else {
      start = new Date(+startDate);
      end = new Date(+endDate);
    }

    return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  };

  if (isLoading || !webConfig || !webConfigLocalState) {
    return (
      <div className="flex justify-center items-center h-96">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        >
          <RefreshCcw className="text-primary h-8 w-8" />
        </motion.div>
      </div>
    );
  }

  const dayNames = {
    he: ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'],
    en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-8"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <CalendarClock className="text-primary w-5 h-5" />
            <h1 className="font-semibold text-xl text-gray-800 dark:text-white">
              {language === 'he' ? 'ניהול זמנים וחופשות' : 'Schedule & Vacations'}
            </h1>
          </div>
          <p className="text-light-text dark:text-gray-400 text-sm mt-1 mb-2">
            {language === 'he'
              ? 'נהל את שעות העבודה והחופשות שלך'
              : 'Manage your working hours and vacation periods'
            }
          </p>
        </div>
      </div>

      {/* Mobile Sticky Save Bar Container */}
      <div className="md:hidden relative z-[40]">
        <div ref={sentinelRef} className="absolute w-full h-px invisible" />
        <AnimatePresence>
          {changesDetected && !isStuck && (
            <motion.div
              layout
              initial={{ opacity: 0, height: 0, marginBottom: 0 }}
              animate={{ opacity: 1, height: "auto", marginBottom: 16 }}
              exit={{ opacity: 0, height: 0, marginBottom: 0 }}
              className="overflow-hidden"
            >
              <div className="relative z-50 bg-orange-50 dark:bg-orange-500/10 border border-orange-200 dark:border-orange-500/30 rounded-xl p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertCircle size={16} className="text-orange-600 dark:text-orange-400" />
                    <span className="text-sm text-orange-700 dark:text-orange-300 font-medium">
                      {language === 'he' ? 'יש לך שינויים שלא נשמרו' : 'You have unsaved changes'}
                    </span>
                  </div>
                  <Button
                    onClick={handleSave}
                    rightIcon={<Save size={18} />}
                    isLoading={isSaving}
                    disabled={isSaving}
                    size="md"
                  >
                    {language === 'he' ? 'שמור' : 'Save'}
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {changesDetected && isStuck && typeof document !== 'undefined' && createPortal(
          <div className="md:hidden fixed top-0 left-0 right-0 z-[40] bg-white/95 dark:bg-dark-bg backdrop-blur-md shadow-md border-b border-orange-200 dark:border-orange-900/50 px-4 py-3 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle size={16} className="text-orange-600 dark:text-orange-400" />
                <span className="text-sm text-orange-700 dark:text-orange-300 font-medium">
                  {language === 'he' ? 'יש לך שינויים שלא נשמרו' : 'You have unsaved changes'}
                </span>
              </div>
              <Button
                onClick={handleSave}
                rightIcon={<Save size={18} />}
                isLoading={isSaving}
                disabled={isSaving}
                size="md"
              >
                {language === 'he' ? 'שמור' : 'Save'}
              </Button>
            </div>
          </div>,
          document.body
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        {/* Working Hours */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="h-full">
            <div className="flex items-center mb-6">
              <div className={`p-3 rounded-xl bg-blue-100 dark:bg-blue-900/30 ${direction === 'rtl' ? 'ml-4' : 'mr-4'}`}>
                <Clock className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h3 className="font-semibold text-xl text-light-text dark:text-dark-text">
                  {language === 'he' ? 'שעות עבודה' : 'Working Hours'}
                </h3>
                <p className="text-sm text-light-gray dark:text-dark-gray">
                  {language === 'he' ? 'הגדר את שעות הפעילות שלך' : 'Set your business hours'}
                </p>
              </div>
            </div>

            <div className="space-y-4">
              {dayNames[language].map((day, index) => {
                const isWorking = webConfigLocalState.workingDays[index] !== null;
                const workingHours = parseWorkingHours(webConfigLocalState.workingDays[index]);

                return (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 + index * 0.05 }}
                    className="p-4 rounded-xl bg-black/5 dark:bg-dark-bg transition-colors"
                  >
                    {/* Mobile Layout (< 640px) */}
                    <div className="sm:hidden">
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-medium text-light-text dark:text-dark-text">
                          {day}
                        </span>
                        <ToggleSwitch
                          checked={isWorking}
                          onChange={(checked) => handleWorkingDayToggle(index, checked)}
                          size="sm"
                        />
                      </div>

                      {isWorking && workingHours ? (
                        <div className="flex items-center justify-center gap-3">
                          <div className="flex flex-col items-center">
                            <label className="text-xs text-light-gray dark:text-dark-gray mb-1">
                              {language === 'he' ? 'התחלה' : 'Start'}
                            </label>
                            <input
                              type="time"
                              value={workingHours.startTime}
                              onChange={(e) => handleWorkingTimeChange(index, 'start', e.target.value)}
                              className="
                                px-2 py-1 text-sm rounded-md border border-light-gray dark:border-dark-gray
                                focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent
                                transition-all duration-200 bg-light-surface dark:bg-dark-surface 
                                text-light-text dark:text-dark-text w-20 text-center
                              "
                            />
                          </div>

                          <div className="flex items-center justify-center mt-5">
                            <span className="text-light-gray dark:text-dark-gray">-</span>
                          </div>

                          <div className="flex flex-col items-center">
                            <label className="text-xs text-light-gray dark:text-dark-gray mb-1">
                              {language === 'he' ? 'סיום' : 'End'}
                            </label>
                            <input
                              type="time"
                              value={workingHours.endTime}
                              onChange={(e) => handleWorkingTimeChange(index, 'end', e.target.value)}
                              className="
                                px-2 py-1 text-sm rounded-md border border-light-gray dark:border-dark-gray
                                focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent
                                transition-all duration-200 bg-light-surface dark:bg-dark-surface 
                                text-light-text dark:text-dark-text w-20 text-center
                              "
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center py-2">
                          <span className="text-sm text-light-gray dark:text-dark-gray italic">
                            {language === 'he' ? 'סגור' : 'Closed'}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Desktop Layout (>= 640px) */}
                    <div className="hidden sm:flex items-center min-h-[52px]">
                      {/* Day Name - Fixed width for alignment */}
                      <div className="flex items-center w-20 lg:w-24">
                        <span className="font-medium text-light-text dark:text-dark-text text-sm lg:text-base">
                          {day}
                        </span>
                      </div>

                      {/* Toggle Switch - Centered */}
                      <div className="flex-1 flex justify-center px-4">
                        <ToggleSwitch
                          checked={isWorking}
                          onChange={(checked) => handleWorkingDayToggle(index, checked)}
                        />
                      </div>

                      {/* Time Inputs or Closed Status - Fixed width container */}
                      <div className="w-56 lg:w-64 flex items-center justify-end">
                        {isWorking && workingHours ? (
                          <div className="flex items-center gap-2">
                            <div className="flex flex-col items-center">
                              <label className="text-xs text-light-gray dark:text-dark-gray mb-1">
                                {language === 'he' ? 'התחלה' : 'Start'}
                              </label>
                              <input
                                type="time"
                                value={workingHours.startTime}
                                onChange={(e) => handleWorkingTimeChange(index, 'start', e.target.value)}
                                className="
                                  px-2 lg:px-3 py-1.5 text-sm rounded-md border border-light-gray dark:border-dark-gray
                                  focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent
                                  transition-all duration-200 bg-light-surface dark:bg-dark-surface 
                                  text-light-text dark:text-dark-text w-24 lg:w-28 text-center
                                "
                              />
                            </div>

                            <div className="flex items-center justify-center mt-5">
                              <span className="text-light-gray dark:text-dark-gray">-</span>
                            </div>

                            <div className="flex flex-col items-center">
                              <label className="text-xs text-light-gray dark:text-dark-gray mb-1">
                                {language === 'he' ? 'סיום' : 'End'}
                              </label>
                              <input
                                type="time"
                                value={workingHours.endTime}
                                onChange={(e) => handleWorkingTimeChange(index, 'end', e.target.value)}
                                className="
                                  px-2 lg:px-3 py-1.5 text-sm rounded-md border border-light-gray dark:border-dark-gray
                                  focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent
                                  transition-all duration-200 bg-light-surface dark:bg-dark-surface 
                                  text-light-text dark:text-dark-text w-24 lg:w-28 text-center
                                "
                              />
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center h-[52px]">
                            <span className="text-sm text-light-gray dark:text-dark-gray italic">
                              {language === 'he' ? 'סגור' : 'Closed'}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </Card>
        </motion.div>

        {/* Vacation Management */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="h-full">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center">
                <div className={`p-3 rounded-xl bg-purple-100 dark:bg-purple-900/30 ${direction === 'rtl' ? 'ml-4' : 'mr-4'}`}>
                  <Calendar className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-xl text-light-text dark:text-dark-text">
                    {language === 'he' ? 'ניהול חופשות' : 'Vacation Management'}
                  </h3>
                  <p className="text-sm text-light-gray dark:text-dark-gray">
                    {language === 'he' ? 'הגדר תקופות חופשה וסגירות' : 'Set vacation periods and closures'}
                  </p>
                </div>
              </div>

              <Button
                onClick={() => setIsAddingVacation(true)}
                leftIcon={<Plus size={16} />}
                dir='ltr'
                variant="primary"
                size="sm"
              >
                {language === 'he' ? 'הוסף חופשה ' : 'Add Vacation'}
              </Button>
            </div>

            {/* Add Vacation Form */}
            {isAddingVacation && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-6 p-4 border border-primary/20 rounded-xl bg-primary/5"
              >
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-medium m-auto text-light-text dark:text-dark-text">
                    {language === 'he' ? 'חופשה חדשה' : 'New Vacation'}
                  </h4>
                  <button
                    onClick={() => setIsAddingVacation(false)}
                    className="p-1 hover:bg-light-gray/10 rounded-full transition-colors"
                  >
                    <X size={16} className="text-light-gray dark:text-dark-gray" />
                  </button>
                </div>

                <div className="space-y-4">
                  <Input
                    label={language === 'he' ? 'כותרת' : 'Title'}
                    value={newVacation.title}
                    onChange={(e) => setNewVacation(prev => ({ ...prev, title: e.target.value }))}
                    placeholder={language === 'he' ? 'חופשת קיץ' : 'Summer vacation'}
                  />

                  <div className="grid grid-cols-1 gap-4">
                    <Input
                      label={language === 'he' ? 'תאריך ושעת התחלה' : 'Start Date & Time'}
                      type="datetime-local"
                      fullWidth={false}
                      className='w-5/6 self-auto	'
                      value={newVacation.startDate}
                      min={new Date().toISOString().slice(0, 16)}
                      onChange={(e) => setNewVacation(prev => ({ ...prev, startDate: e.target.value }))}
                    />

                    <Input
                      fullWidth={false}
                      className='w-5/6 self-auto	'
                      label={language === 'he' ? 'תאריך ושעת סיום' : 'End Date & Time'}
                      type="datetime-local"
                      value={newVacation.endDate}
                      min={new Date().toISOString().slice(0, 16)}
                      onChange={(e) => setNewVacation(prev => ({ ...prev, endDate: e.target.value }))}
                    />
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setIsAddingVacation(false)}
                    >
                      {language === 'he' ? 'ביטול' : 'Cancel'}
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={handleAddVacation}
                    >
                      {language === 'he' ? 'הוסף' : 'Add'}
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Vacation List */}
            <div className="space-y-3 overflow-y-auto">
              {vacations.length > 0 ? (
                vacations.map((vacation, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="p-4 rounded-xl bg-black/5 dark:bg-dark-bg hover:bg-black/10 dark:hover:bg-black/10 transition-colors"
                  >
                    {editingVacation === vacation._id ? (
                      <VacationEditForm
                        vacation={vacation}
                        onSave={(updatedVacation) => handleEditVacation(vacation._id, updatedVacation)}
                        onCancel={() => setEditingVacation(null)}
                        isSaving={isEditingVacation}
                        language={language}
                      />
                    ) : (
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <h4 className="font-medium text-light-text dark:text-dark-text mb-1">
                            {vacation.title}
                          </h4>
                          <p className="text-sm text-light-gray dark:text-dark-gray">
                            {language === 'he' ? 'מ: ' : 'From: '}{formatVacationDateTime(vacation.startDate)}
                          </p>
                          <p className="text-sm text-light-gray dark:text-dark-gray">
                            {language === 'he' ? 'עד: ' : 'To: '}{formatVacationDateTime(vacation.endDate)}
                          </p>
                          <p className="text-xs text-light-gray dark:text-dark-gray mt-1">
                            {calculateVacationDuration(vacation.startDate, vacation.endDate)} {language === 'he' ? 'ימים' : 'days'}
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setEditingVacation(vacation._id)}
                            disabled={editingVacation !== null}
                            className="p-2 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-full transition-colors"
                            title={language === 'he' ? 'ערוך' : 'Edit'}
                          >
                            <Edit3 size={16} />
                          </button>

                          <button
                            onClick={() => handleDeleteVacation(vacation._id)}
                            className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors"
                            title={language === 'he' ? 'מחק' : 'Delete'}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    )}
                  </motion.div>
                ))
              ) : (
                <div className="py-8 text-center">
                  <Calendar size={48} className="mx-auto mb-4 text-light-gray/50 dark:text-dark-gray/50" />
                  <p className="text-light-gray dark:text-dark-gray">
                    {language === 'he' ? 'אין חופשות מתוכננות' : 'No vacations scheduled'}
                  </p>
                </div>
              )}
            </div>
          </Card>
        </motion.div>

      </div>


    </motion.div>
  );
};

// Vacation Edit Form Component
interface VacationEditFormProps {
  vacation: Vacation;
  onSave: (vacation: Omit<Vacation, '_id'>) => void;
  onCancel: () => void;
  isSaving: boolean;
  language: string;
}

const VacationEditForm: React.FC<VacationEditFormProps> = ({ vacation, onSave, onCancel, isSaving, language }) => {
  const [editData, setEditData] = useState<Omit<Vacation, '_id'>>(() => {
    const start = new Date(+vacation.startDate);
    const end = new Date(+vacation.endDate);
    const formatedStart = start.toLocaleString('sv-SE').replace(' ', 'T').slice(0, 16);
    const formatedEnd = end.toLocaleString('sv-SE').replace(' ', 'T').slice(0, 16); // this locale outputs ISO-like date (YYYY-MM-DD HH:mm:ss)  
    return {
      title: vacation.title,
      startDate: formatedStart,
      endDate: formatedEnd,
      webConfig_id: vacation.webConfig_id
    }
  });
  // useEffect(() => {
  //   const start = new Date(+vacation.startDate);
  //   const end = new Date(+vacation.endDate);
  //   const formatedStart = start.toLocaleString('sv-SE').replace(' ', 'T').slice(0, 16);
  //   const formatedEnd = end.toLocaleString('sv-SE').replace(' ', 'T').slice(0, 16);

  //   setEditData({
  //     title: vacation.title,
  //     startDate: formatedStart,
  //     endDate: formatedEnd,
  //     webConfig_id: vacation.webConfig_id,
  //   });
  // }, [vacation]);



  return (
    <div className="space-y-4">
      <Input
        label={language === 'he' ? 'כותרת' : 'Title'}
        value={editData.title}
        onChange={(e) => setEditData(prev => ({ ...prev, title: e.target.value }))}
      />

      <div className="grid grid-cols-1 gap-4">
        <Input
          fullWidth={false}
          className='w-5/6 self-auto	'
          label={language === 'he' ? 'תאריך ושעת התחלה' : 'Start Date & Time'}
          type="datetime-local"
          value={editData.startDate}
          onChange={(e) => setEditData(prev => ({ ...prev, startDate: e.target.value }))}
          min={new Date().toISOString().slice(0, 16)}
        />

        <Input
          fullWidth={false}
          className='w-5/6 self-auto	'
          label={language === 'he' ? 'תאריך ושעת סיום' : 'End Date & Time'}
          type="datetime-local"
          value={editData.endDate}
          onChange={(e) => setEditData(prev => ({ ...prev, endDate: e.target.value }))}
          min={new Date().toISOString().slice(0, 16)}
        />
      </div>

      <div className="flex justify-end gap-2">
        <Button
          variant="danger"
          size="sm"
          onClick={onCancel}
        >
          {language === 'he' ? 'ביטול' : 'Cancel'}
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={() => onSave(editData)}
          disabled={isSaving}
        >
          {language === 'he' ? 'שמור' : 'Save'}
        </Button>
      </div>
    </div>
  );
};

export default ScheduleVacations;