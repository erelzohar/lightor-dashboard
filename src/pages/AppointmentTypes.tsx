import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Timer, DollarSign, Tag, Edit2, Trash2, ListPlus, Plus, ChevronDown, X } from 'lucide-react';
import { AppointmentType } from '../types';
import toast from 'react-hot-toast';
import { formatDuration } from '../utils/dateUtils';
import { useAuth } from '../contexts/AuthContext';
import { useAppSelector } from '../hooks/useAppSelector';
import {
  createAppointmentType,
  deleteAppointmentType,
  fetchAppointmentTypes,
  updateAppointmentType,
} from '../store/slices/appointmentsSlice';
import { useAppDispatch } from '../hooks/useAppDispatch';
import { useTranslation } from 'react-i18next';

const GLASS: React.CSSProperties = {
  background: 'rgba(255,255,255,0.03)',
  backdropFilter: 'blur(12px)',
  border: '1px solid rgba(149,142,160,0.18)',
};

const GLASS_INPUT: React.CSSProperties = {
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(149,142,160,0.25)',
};

const InputField: React.FC<{
  label: string;
  icon: React.ReactNode;
  prefix?: React.ReactNode;
  inputProps: React.InputHTMLAttributes<HTMLInputElement>;
}> = ({ label, icon, prefix, inputProps }) => (
  <div className="group/input flex flex-col gap-1">
    <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 ml-1 group-focus-within/input:text-primary transition-colors">
      {label}
    </label>
    <div
      className="flex items-center rounded-xl overflow-hidden transition-all duration-200 focus-within:ring-1 focus-within:ring-primary/50"
      style={GLASS_INPUT}
    >
      <div className="pl-3 pr-1.5 flex items-center text-gray-500 dark:text-gray-400 group-focus-within/input:text-primary transition-colors shrink-0">
        {prefix ?? icon}
      </div>
      <input
        {...inputProps}
        className="w-full bg-transparent border-none text-gray-900 dark:text-white text-sm py-2.5 pr-3 focus:ring-0 placeholder:text-gray-400/40 outline-none min-w-0"
      />
    </div>
  </div>
);

const AppointmentTypes: React.FC = () => {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [currentType, setCurrentType] = useState<AppointmentType | null>(null);
  const [formData, setFormData] = useState({ name: '', price: '', durationMS: '1800000' });
  const [onlineBooking, setOnlineBooking] = useState(true);
  const { auth } = useAuth();
  const appointmentTypes = useAppSelector(state => state.appointments.appointmentTypes);
  const dispatch = useAppDispatch();

  document.title = t('appointmentTypes.title');

  useEffect(() => {
    if (appointmentTypes.length === 0 && auth.user) {
      dispatch(fetchAppointmentTypes({ webConfig_id: auth.user.webConfig_id })).finally(() =>
        setIsLoading(false)
      );
    } else setIsLoading(false);
  }, [appointmentTypes]);

  const openForNew = () => {
    setCurrentType(null);
    setFormData({ name: '', price: '', durationMS: '1800000' });
    setIsFormOpen(true);
  };

  const openForEdit = (type: AppointmentType) => {
    setCurrentType(type);
    setFormData({ name: type.name, price: type.price, durationMS: type.durationMS });
    setIsFormOpen(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setTimeout(() => {
      setCurrentType(null);
      setFormData({ name: '', price: '', durationMS: '1800000' });
    }, 300);
  };

  const toggleForm = () => {
    if (isFormOpen) {
      closeForm();
    } else {
      openForNew();
    }
  };

  const handleDelete = async (type: AppointmentType) => {
    if (!confirm(t('appointmentTypes.deleteConfirm', { name: type.name }))) return;
    try {
      await dispatch(deleteAppointmentType(type._id));
      toast.success(t('appointmentTypes.deleteSuccess'));
      if (currentType?._id === type._id) closeForm();
    } catch {
      toast.error(t('appointmentTypes.deleteError'));
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (name === 'durationMinutes') {
      const minutes = parseInt(value) || 0;
      setFormData(prev => ({ ...prev, durationMS: (minutes * 60 * 1000).toString() }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (currentType) {
        await dispatch(updateAppointmentType({ id: currentType._id, data: { ...formData } }));
        toast.success(t('appointmentTypes.updateSuccess'));
      } else {
        await dispatch(createAppointmentType({ ...formData, webConfig_id: auth.user.webConfig_id }));
        toast.success(t('appointmentTypes.addSuccess'));
      }
      closeForm();
    } catch {
      toast.error(t('appointmentTypes.saveError'));
    }
  };

  const getDurationMinutes = () => Math.floor(parseInt(formData.durationMS) / 60000);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5 max-w-3xl mx-auto">

      {/* Page Header */}
      <div className="mb-2">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
          {t('appointmentTypes.title')}
        </h1>
        <p className="mt-1.5 text-sm text-gray-500 dark:text-gray-400">
          {t('appointmentTypes.description')}
        </p>
      </div>

      {/* ── Expandable Add / Edit Form ── */}
      <div
        className="rounded-3xl overflow-hidden transition-shadow duration-500"
        style={{
          ...GLASS,
          boxShadow: isFormOpen
            ? '0 16px 40px -12px rgba(139,92,246,0.35)'
            : '0 4px 20px -8px rgba(139,92,246,0.1)',
        }}
      >
        {/* Trigger row */}
        <button
          type="button"
          onClick={toggleForm}
          className="w-full flex items-center gap-4 px-6 py-5 text-left transition-colors hover:bg-white/[0.02] group"
        >
          {/* Animated + / × circle */}
          <motion.div
            animate={{ rotate: isFormOpen ? 45 : 0, scale: isFormOpen ? 0.9 : 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            className="w-11 h-11 rounded-full flex items-center justify-center shrink-0 shadow-lg"
            style={{ background: 'linear-gradient(135deg, #8b5cf6, #c084fc)' }}
          >
            <Plus size={22} className="text-white" strokeWidth={2.5} />
          </motion.div>

          <div className="flex-grow min-w-0">
            <p className="text-sm font-semibold text-gray-900 dark:text-white">
              {currentType && isFormOpen
                ? t('appointmentTypes.editService')
                : t('appointmentTypes.newService')}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
              {isFormOpen
                ? currentType
                  ? `Editing "${currentType.name}"`
                  : 'Fill in the details below'
                : 'Click to add a new service'}
            </p>
          </div>

          <motion.div
            animate={{ rotate: isFormOpen ? 180 : 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 22 }}
            className="text-gray-400 dark:text-gray-500 shrink-0"
          >
            <ChevronDown size={18} />
          </motion.div>
        </button>

        {/* Expandable form body */}
        <AnimatePresence initial={false}>
          {isFormOpen && (
            <motion.div
              key="form-body"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 280, damping: 28 }}
              style={{ overflow: 'hidden' }}
            >
              {/* Thin divider */}
              <div className="mx-6 h-px bg-white/10" />

              {/* Decorative glow blob */}
              <div
                className="absolute pointer-events-none w-64 h-64 rounded-full opacity-30"
                style={{
                  background: 'radial-gradient(circle, rgba(139,92,246,0.3) 0%, transparent 70%)',
                  filter: 'blur(40px)',
                  top: 0,
                  right: '10%',
                }}
              />

              <form onSubmit={handleSubmit}>
                <div className="px-6 pt-5 pb-6 flex flex-col gap-5 relative">

                  {/* Name (full width) */}
                  <InputField
                    label={t('appointmentTypes.serviceName')}
                    icon={<Tag size={16} />}
                    inputProps={{
                      name: 'name',
                      value: formData.name,
                      onChange: handleChange,
                      required: true,
                      autoFocus: true,
                      placeholder: 'e.g. Executive Haircut',
                    }}
                  />

                  {/* Price + Duration side by side */}
                  <div className="grid grid-cols-2 gap-4">
                    <InputField
                      label={t('appointmentTypes.price')}
                      icon={<DollarSign size={16} />}
                      prefix={
                        <span className="text-sm font-semibold text-gray-500 dark:text-gray-400 group-focus-within/input:text-primary transition-colors">
                          $
                        </span>
                      }
                      inputProps={{
                        name: 'price',
                        type: 'number',
                        min: '0',
                        step: '1',
                        value: formData.price,
                        onChange: handleChange,
                        required: true,
                        placeholder: '0.00',
                      }}
                    />
                    <InputField
                      label={t('appointmentTypes.duration')}
                      icon={<Timer size={16} />}
                      inputProps={{
                        name: 'durationMinutes',
                        type: 'number',
                        min: '5',
                        step: '5',
                        value: getDurationMinutes(),
                        onChange: handleChange,
                        required: true,
                        placeholder: 'min',
                      }}
                    />
                  </div>

                  {/* Online Booking toggle + action buttons on same row */}
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4 pt-1">
                    {/* Toggle */}
                    <div
                      className="flex items-center gap-3 px-4 py-3 rounded-xl flex-grow"
                      style={{
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(149,142,160,0.14)',
                      }}
                    >
                      <div className="flex-grow">
                        <p className="text-xs font-semibold text-gray-900 dark:text-white">Online Booking</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Allow clients to book online.</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer shrink-0">
                        <input
                          type="checkbox"
                          className="sr-only peer"
                          checked={onlineBooking}
                          onChange={() => setOnlineBooking(v => !v)}
                        />
                        <div className="w-10 h-[22px] bg-gray-300 dark:bg-gray-600 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-[18px] after:w-[18px] after:transition-all peer-checked:bg-primary" />
                      </label>
                    </div>

                    {/* Action buttons */}
                    <div className="flex gap-2 sm:shrink-0">
                      <button
                        type="button"
                        onClick={closeForm}
                        className="flex items-center gap-1.5 px-4 py-3 rounded-full text-xs font-semibold text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-white/5 border border-white/10 active:scale-95 transition-all"
                      >
                        <X size={14} />
                        {t('common.cancel')}
                      </button>
                      <button
                        type="submit"
                        className="flex items-center gap-1.5 px-5 py-3 rounded-full text-xs font-semibold text-white hover:opacity-90 active:scale-95 transition-all"
                        style={{
                          background: 'linear-gradient(to right, #8b5cf6, #c084fc)',
                          boxShadow: '0 8px 24px -8px rgba(139,92,246,0.6)',
                        }}
                      >
                        <DollarSign size={14} />
                        {currentType ? t('common.save') : t('appointmentTypes.addNew')}
                      </button>
                    </div>
                  </div>
                </div>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Services List ── */}
      <div className="rounded-3xl overflow-hidden" style={GLASS}>
        {/* List header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.06]">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
            {t('appointmentTypes.services')}
          </h3>
          {!isLoading && appointmentTypes.length > 0 && (
            <span
              className="text-xs font-semibold px-2.5 py-1 rounded-full text-primary"
              style={{ background: 'rgba(139,92,246,0.12)' }}
            >
              {appointmentTypes.length}
            </span>
          )}
        </div>

        {/* List body */}
        <div className="p-3">
          {isLoading ? (
            <div className="space-y-2 p-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-16 rounded-2xl animate-pulse bg-white/[0.04]" />
              ))}
            </div>
          ) : appointmentTypes.length > 0 ? (
            <AnimatePresence initial={false}>
              {appointmentTypes.map((type, i) => (
                <motion.div
                  key={type._id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -16, transition: { duration: 0.2 } }}
                  transition={{ delay: i * 0.04, type: 'spring', stiffness: 300, damping: 25 }}
                  className={`flex items-center justify-between px-4 py-3.5 rounded-2xl mb-1 last:mb-0 transition-all cursor-pointer group ${
                    currentType?._id === type._id && isFormOpen
                      ? 'border border-primary/30'
                      : 'border border-transparent hover:border-white/[0.08]'
                  }`}
                  style={
                    currentType?._id === type._id && isFormOpen
                      ? { background: 'rgba(139,92,246,0.08)' }
                      : undefined
                  }
                  onMouseEnter={e =>
                    !(currentType?._id === type._id && isFormOpen) &&
                    ((e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)')
                  }
                  onMouseLeave={e =>
                    !(currentType?._id === type._id && isFormOpen) &&
                    ((e.currentTarget as HTMLElement).style.background = '')
                  }
                  onClick={() => openForEdit(type)}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: 'rgba(139,92,246,0.13)' }}
                    >
                      <Tag size={16} className="text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                        {type.name}
                      </p>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                          <DollarSign size={11} className="text-green-400" />
                          {t('appointments.currencySymbol')}{type.price}
                        </span>
                        <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                          <Timer size={11} className="text-blue-400" />
                          {formatDuration(type.durationMS)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-2">
                    <button
                      onClick={e => { e.stopPropagation(); openForEdit(type); }}
                      className="p-2 rounded-xl text-gray-400 hover:text-primary transition-colors"
                      style={{ background: 'transparent' }}
                      onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = 'rgba(139,92,246,0.1)')}
                      onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); handleDelete(type); }}
                      className="p-2 rounded-xl text-gray-400 hover:text-red-400 transition-colors"
                      style={{ background: 'transparent' }}
                      onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.1)')}
                      onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          ) : (
            /* Empty state */
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-16 text-center relative overflow-hidden"
            >
              <ListPlus
                size={120}
                className="absolute text-white/[0.04] -right-4 -bottom-4 rotate-12 pointer-events-none select-none"
              />
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
                style={{ background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)' }}
              >
                <ListPlus size={28} className="text-primary/70" />
              </div>
              <p className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
                {t('appointmentTypes.noServices')}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 max-w-xs">
                Click the button above to add your first service.
              </p>
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default AppointmentTypes;
