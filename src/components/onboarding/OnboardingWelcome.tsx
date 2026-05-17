import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Sparkles, MapPin, Phone, ArrowRight, Wand2,
  Briefcase, Clock, Image, Tag, CheckCircle2, Info,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Button from '../ui/Button';
import { useAppSelector } from '../../hooks/useAppSelector';
import { useAppDispatch } from '../../hooks/useAppDispatch';
import { fetchAppointmentTypes } from '../../store/slices/appointmentsSlice';
import { useAuth } from '../../contexts/AuthContext';

interface Props {
  userName: string;
  onGetStarted: () => void;
  isLoading: boolean;
  isLightyMode?: boolean;
}

const OnboardingWelcome: React.FC<Props> = ({ userName, onGetStarted, isLoading, isLightyMode = false }) => {
  const { t } = useTranslation();
  const { auth } = useAuth();
  const dispatch = useAppDispatch();
  const webConfig = useAppSelector(state => state.webConfig.data);
  const appointmentTypes = useAppSelector(state => state.appointments.appointmentTypes);

  const firstName = userName.split(' ')[0];

  // Fetch appointment types if not loaded yet (needed for accurate progress)
  useEffect(() => {
    if (isLightyMode) return;
    if (appointmentTypes.length === 0 && auth.user?.webConfig_id) {
      dispatch(fetchAppointmentTypes({ webConfig_id: auth.user.webConfig_id }));
    }
  }, [auth.user?.webConfig_id, isLightyMode]);

  const allSteps = [
    {
      key: 'businessName',
      icon: Briefcase,
      done: !!(webConfig?.businessName?.trim()),
    },
    {
      key: 'phone',
      icon: Phone,
      done: !!(webConfig?.contact?.phone?.trim()),
    },
    {
      key: 'address',
      icon: MapPin,
      done: !!(webConfig?.address?.city?.trim() && webConfig?.address?.street?.trim()),
    },
    {
      key: 'workingHours',
      icon: Clock,
      done: !!(webConfig?.workingDays?.some(d => d !== null)),
    },
    {
      key: 'serviceTypes',
      icon: Tag,
      done: appointmentTypes.length > 0,
    },
    {
      key: 'logo',
      icon: Image,
      done: !!(webConfig?.logoImageName?.trim()),
    },
  ];

  const missingSteps = allSteps.filter(s => !s.done);
  const doneCount = allSteps.length - missingSteps.length;

  if (isLightyMode) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="bg-white dark:bg-dark-surface rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
        >
          {/* Lighty gradient header */}
          <div className="bg-gradient-to-br from-violet-600 via-primary to-fuchsia-600 p-8 text-white text-center relative overflow-hidden">
            <div className="absolute inset-0 bg-black/10 pointer-events-none" />
            <motion.div
              initial={{ scale: 0, rotate: -20 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
              className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/20 mb-4 relative z-10"
            >
              <Wand2 size={32} className="text-white" />
            </motion.div>
            <h1 className="text-2xl font-bold mb-1 relative z-10">
              {t('onboarding.lightyWelcomeTitle', { name: firstName })}
            </h1>
            <p className="text-white/80 text-sm relative z-10">
              {t('onboarding.lightyWelcomeSubtitle')}
            </p>
          </div>

          {/* Body */}
          <div className="p-8">
            <p className="text-light-text dark:text-dark-text text-sm mb-6">
              {t('onboarding.lightyWelcomeDescription')}
            </p>

            <div className="mb-8 rounded-2xl bg-violet-50 dark:bg-violet-900/20 border border-violet-100 dark:border-violet-800 p-4 flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-violet-100 dark:bg-violet-800/40 flex items-center justify-center shrink-0 mt-0.5">
                <Sparkles size={16} className="text-violet-600 dark:text-violet-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-violet-800 dark:text-violet-300 mb-0.5">
                  {t('onboarding.lightyAssistantName')}
                </p>
                <p className="text-xs text-violet-600 dark:text-violet-400 leading-relaxed">
                  {t('onboarding.lightyAssistantDesc')}
                </p>
              </div>
            </div>

            <Button
              fullWidth
              onClick={onGetStarted}
              isLoading={isLoading}
              rightIcon={<Wand2 size={18} />}
            >
              {t('onboarding.lightyGetStarted')}
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="bg-white dark:bg-dark-surface rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
      >
        {/* Header gradient banner */}
        <div className="bg-gradient-to-br from-primary to-primary/70 p-8 text-white text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/20 mb-4"
          >
            <Sparkles size={32} className="text-white" />
          </motion.div>
          <h1 className="text-2xl font-bold mb-1">
            {t('onboarding.welcomeTitle', { name: firstName })}
          </h1>
          <p className="text-white/80 text-sm">
            {t('onboarding.welcomeSubtitle')}
          </p>

          {/* Progress pill */}
          <div className="mt-4 inline-flex items-center gap-2 bg-white/20 rounded-full px-4 py-1.5">
            <span className="text-xs font-medium text-white">
              {t('onboarding.setupProgress', { done: doneCount, total: allSteps.length })}
            </span>
          </div>
        </div>

        {/* Body */}
        <div className="p-8">
          {/* Review notice */}
          <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800 mb-5">
            <Info size={16} className="text-amber-500 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
              {t('onboarding.reviewGeneratedDetails')}
            </p>
          </div>

          {missingSteps.length > 0 ? (
            <div className="space-y-2 mb-7">
              <p className="text-xs font-semibold uppercase tracking-wider text-light-gray dark:text-dark-gray mb-3">
                {t('onboarding.setupSteps')}
              </p>
              {missingSteps.map(({ icon: Icon, key }) => (
                <div
                  key={key}
                  className="flex items-center gap-3 p-3 rounded-xl bg-light-bg dark:bg-dark-bg"
                >
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Icon size={16} className="text-primary" />
                  </div>
                  <span className="text-sm text-light-text dark:text-dark-text">
                    {t(`onboarding.step_${key}`)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-3 p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 mb-7">
              <CheckCircle2 size={20} className="text-emerald-500 shrink-0" />
              <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                {t('onboarding.allStepsComplete')}
              </span>
            </div>
          )}

          <Button
            fullWidth
            onClick={onGetStarted}
            isLoading={isLoading}
            rightIcon={<ArrowRight size={18} />}
          >
            {t('onboarding.getStarted')}
          </Button>
        </div>
      </motion.div>
    </div>
  );
};

export default OnboardingWelcome;
