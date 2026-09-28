import React, { useState, useEffect } from 'react';
import { canOfferPurchases } from '../lib/platform';
import { motion } from 'framer-motion';
import { Sun, Moon, AlertTriangle, ArrowRight, ArrowLeft, Crown, ChevronDown, CheckCircle2, Phone, MapPin, Briefcase, Clock, Image, Tag, Mail, Loader2, Inbox } from 'lucide-react';
import { Appointment } from '../types';
import AppointmentDetails from '../components/appointments/AppointmentDetails';
import IncomeStats from '../components/dashboard/IncomeStats';
import AppointmentsGraph, { TimeRange } from '../components/dashboard/AppointmentsGraph';
import DashboardDonutChart from '../components/dashboard/DashboardDonutChart';
import DashboardAppointmentsList from '../components/dashboard/DashboardAppointmentsList';
import LeadsSummary from '../components/dashboard/LeadsSummary';
import { useTheme } from '../contexts/ThemeContext';
import { useAppDispatch } from '../hooks/useAppDispatch';
import { useAppSelector } from '../hooks/useAppSelector';
import { useAppointmentsAutoRefresh } from '../hooks/useAppointmentsAutoRefresh';
import { fetchAppointmentTypes } from '../store/slices/appointmentsSlice';
import { fetchWebConfig } from '../store/slices/webConfigSlice';
import { useAuth } from '../contexts/AuthContext';
import ErrorBoundaryWithLanguage from '../components/ui/ErrorBoundary';
import DashboardFallback from '../components/dashboard/DashboardFallback';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { resendVerification } from '../services/authApi';
import { fetchMyEntitlements, MyEntitlements } from '../services/entitlementsApi';
import toast from 'react-hot-toast';
import { useNewLeadsCount, setNewLeadsCount } from '../hooks/useNewLeadsCount';
import { fetchLeads, LeadsPage } from '../services/leadsApi';
import { isLeadsSite } from '../utils/siteMode';

const getGreeting = (t: any): string => {
  const hour = new Date().getHours();
  if (hour < 12 && hour > 4) return t('greetings.morning');
  if (hour < 12 && hour < 4) return t('greetings.night');
  if (hour < 18) return t('greetings.afternoon');
  return t('greetings.evening');
};

const getGreetingIcon = () => {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 18) return Sun;
  return Moon;
};

const Dashboard: React.FC = () => {
  const { t } = useTranslation();
  const { auth, updateUser } = useAuth();
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [stepsExpanded, setStepsExpanded] = useState(() => localStorage.getItem('onboardingExpanded') === 'true');
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSent, setResendSent] = useState(false);
  // The resolved plan (LT-187): under the pilot grant the subscription still
  // reads 'free' while the account has Plus, so the upgrade banner keys off
  // what /entitlements/me resolves rather than the raw status. `undefined`
  // until the meter answers — the banner waits instead of flashing in and
  // out — and a failed read (null) falls back to the status, as before.
  const [entitlements, setEntitlements] = useState<MyEntitlements | null | undefined>(undefined);
  useEffect(() => {
    let cancelled = false;
    fetchMyEntitlements().then((data) => {
      if (!cancelled) setEntitlements(data);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  const onFreePlan =
    entitlements !== undefined && (entitlements?.plan ?? auth.user?.subscription?.status) === 'free';

  const webConfig = useAppSelector(state => state.webConfig.data);
  // A leads site (LT-199) has no calendar: its home is the leads summary, not
  // the income, graph, donut and appointments list, and nothing polls the
  // appointments.
  const leadsSite = isLeadsSite(webConfig);

  // Contact-form leads (LT-197): the new ones wait on the home card, and a
  // capped plan is warned from 80% of the month's leads. On a leads site the
  // summary below reads the count itself and feeds the shared badge.
  const newLeads = useNewLeadsCount(!leadsSite);
  const leadsCap = entitlements?.limits.monthlyLeads ?? null;
  const leadsUsed = entitlements?.usage.leadsThisMonth ?? 0;
  const leadsNotice: 'near' | 'full' | null =
    leadsCap ? (leadsUsed >= leadsCap ? 'full' : leadsUsed >= Math.ceil(leadsCap * 0.8) ? 'near' : null) : null;

  // Shared date range state — controls both the graph and the donut chart
  const [timeRange, setTimeRange] = useState<TimeRange>('week');
  const [currentDate, setCurrentDate] = useState(() => new Date());

  const { language, direction } = useTheme();
  const navigate = useNavigate();
  const appointmentTypes = useAppSelector(state => state.appointments.appointmentTypes);

  // The leads summary (LT-199): the newest five, and the counts beside them.
  // `undefined` while it loads — the home shows neither Lighty's empty state
  // nor the summary until it knows which one applies.
  const [leadsPage, setLeadsPage] = useState<LeadsPage | null | undefined>(undefined);
  useEffect(() => {
    if (!leadsSite) return;
    let cancelled = false;
    fetchLeads({ limit: 5 })
      .then((page) => {
        if (cancelled) return;
        setLeadsPage(page);
        setNewLeadsCount(page.counts?.new ?? 0);
      })
      .catch(() => {
        if (!cancelled) setLeadsPage(null);
      });
    return () => {
      cancelled = true;
    };
  }, [leadsSite]);
  const leadsTotal = leadsPage
    ? (leadsPage.counts?.new ?? 0) + (leadsPage.counts?.contacted ?? 0) + (leadsPage.counts?.closed ?? 0)
    : undefined;

  const setupSteps = [
    { key: 'businessName', label: t('onboarding.step_businessName'), done: !!(webConfig?.businessName?.trim()), icon: Briefcase, tab: '/settings' },
    { key: 'phone', label: t('onboarding.step_phone'), done: !!(webConfig?.contact?.phone?.trim()), icon: Phone, tab: '/settings' },
    { key: 'address', label: t('onboarding.step_address'), done: !!(webConfig?.address?.city?.trim() && webConfig?.address?.street?.trim()), icon: MapPin, tab: '/settings' },
    { key: 'workingHours', label: t('onboarding.step_workingHours'), done: !!(webConfig?.workingDays?.some(d => d !== null)), icon: Clock, tab: '/schedule-vacations' },
    // Services seeded from the AI wizard arrive without a price on purpose
    // (LT-026), so merely having services is not "done" — the owner has to go
    // in and price them. Otherwise the checklist would tick itself and the
    // booking page would offer services with no price.
    // A leads site (LT-199) lists its services as content and prices them
    // only when the owner wants to, so the step is not asked there: "All set"
    // is the only way to boardingStatus 'active', and a leads account with no
    // services must still reach it.
    ...(leadsSite
      ? []
      : [
          {
            key: 'serviceTypes',
            label: appointmentTypes.length > 0 && appointmentTypes.some(type => !type.price?.toString().trim())
              ? t('onboarding.step_serviceTypesPricing')
              : t('onboarding.step_serviceTypes'),
            done: appointmentTypes.length > 0 && appointmentTypes.every(type => !!type.price?.toString().trim()),
            icon: Tag,
            tab: '/appointment-types',
          },
        ]),
    { key: 'logo', label: t('onboarding.step_logo'), done: !!(webConfig?.logoImageName?.trim()), icon: Image, tab: '/settings' },
  ];
  const doneCount = setupSteps.filter(s => s.done).length;
  const progressPct = Math.round((doneCount / setupSteps.length) * 100);

  const showOnboarding = auth.user?.boardingStatus === 'onboarded';


  const GreetingIcon = getGreetingIcon();

  const dispatch = useAppDispatch();
  const appointments = useAppSelector(state => state.appointments.appointments);
  const isLoading = useAppSelector(state => state.appointments.loading);
  document.title = t('common.dashboard');

  // No calendar on a leads site, so no 4-minute appointments poll (LT-199).
  useAppointmentsAutoRefresh(leadsSite ? undefined : auth.user?._id);

  useEffect(() => {
    if (!showOnboarding || !auth.user) return;
    if (!webConfig && auth.user.webConfig_id) {
      dispatch(fetchWebConfig(auth.user.webConfig_id));
    }
    if (appointmentTypes.length === 0 && auth.user.webConfig_id) {
      dispatch(fetchAppointmentTypes({ webConfig_id: auth.user.webConfig_id }));
    }
  }, [showOnboarding, auth.user?.webConfig_id]);

  const handleResendVerification = async () => {
    if (!auth.user?.email || resendLoading || resendSent) return;
    setResendLoading(true);
    try {
      await resendVerification(auth.user.email);
      setResendSent(true);
      toast.success(t('common.resendVerificationSent'));
    } catch {
      toast.error(t('common.resendVerificationError'));
    } finally {
      setResendLoading(false);
    }
  };

  const handleCompleteSetup = async () => {
    try {
      await updateUser({ boardingStatus: 'active' });
    } catch (e) {
      console.error(e);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
  };

  if (isLoading && !leadsSite) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-5"
    >
      {/* Page Title */}
      <div className="mb-2">
        <div className="flex items-center justify-center gap-3">
          <motion.div
            initial={{ rotate: -20, scale: 0.8, opacity: 0 }}
            animate={{ rotate: 0, scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 10, duration: 0.5 }}
            whileHover={{ scale: 1.1, rotate: 15 }}
            className={`p-1 rounded-full shadow-sm ${GreetingIcon === Sun
              ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-500 shadow-amber-200/50'
              : 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-500 shadow-indigo-200/50'
            }`}
          >
            <GreetingIcon className="w-7 h-7" />
          </motion.div>
          {/* Never wrap: "<greeting>, <name>" broke onto a second line on a
              phone. Sized to fit instead — an earlier attempt added `truncate`
              as a safety net and that was worse, ellipsising the name on the
              very screens it was meant to help. */}
          <h1 className="font-semibold text-lg sm:text-2xl text-gray-800 dark:text-white whitespace-nowrap">
            {t('common.greetingWithName', { greeting: getGreeting(t), name: auth.user.name })}
          </h1>
        </div>
      </div>

      {/* ── New account, no bookings (or, on a leads site, no inquiries) yet:
          Lighty says hello first ── */}
      {(leadsSite ? leadsTotal === 0 : appointments.length === 0) && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="flex flex-col items-center justify-center py-6 gap-6 text-center"
        >
          <img
            src="/lighty-welcome.png"
            alt="Welcome"
            className="w-56 h-56 object-contain drop-shadow-lg"
          />
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-white">
              {t('dashboard.emptyTitle')}
            </h2>
            <p className="text-lg font-medium text-primary">
              {t('dashboard.emptySubtitle')}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm mx-auto">
              {leadsSite ? t('dashboard.emptyDescLeads') : t('dashboard.emptyDesc')}
            </p>
          </div>
        </motion.div>
      )}

      {/* ── Account notices: verify + upgrade share one row when both apply ── */}
      {(!auth.user?.isVerified || (onFreePlan && canOfferPurchases())) && (
        <div className="flex flex-col lg:flex-row gap-4 items-stretch">
          {/* Unverified Alert */}
          {!auth.user?.isVerified && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-card glass-tint-red flex-1 min-w-0 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 dark:bg-red-800/40 rounded-full text-red-600 dark:text-red-400 shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-red-800 dark:text-red-300 text-sm">
                    {t('common.notVerifiedTitle')}
                  </h3>
                  <p className="text-red-600 dark:text-red-400 mt-0.5 text-xs">
                    {t('common.notVerifiedAlert')}
                  </p>
                </div>
              </div>
              <button
                onClick={handleResendVerification}
                disabled={resendLoading || resendSent}
                className={`shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors ${
                  resendSent
                    ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 cursor-default'
                    : 'bg-red-100 dark:bg-red-800/40 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-700/40 disabled:opacity-60'
                }`}
              >
                {resendLoading ? <Loader2 className="w-4 h-4 animate-spin" />
                  : resendSent ? <CheckCircle2 className="w-4 h-4" />
                  : <Mail className="w-4 h-4" />
                }
                {t('common.resendVerification')}
              </button>
            </motion.div>
          )}

          {/* Trial Bar — never in the app: it is a call to buy (LT-130, App Store 3.1.1). */}
          {onFreePlan && canOfferPurchases() && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex-1 min-w-0">
              <div className="glass-card glass-tint-amber h-full rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-100 dark:bg-amber-800/40 rounded-full text-amber-600 dark:text-amber-400 shrink-0">
                    <Crown className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-amber-800 dark:text-amber-300 text-sm">{t('common.upgradePlanTitle')}</h3>
                    <p className="text-amber-600 dark:text-amber-400 text-xs mt-0.5">
                      {t('common.upgradePlanDesc')}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => navigate('/account')}
                  className="shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors bg-amber-500 hover:bg-amber-600 text-white"
                >
                  {t('common.upgradePlanBtn')}
                </button>
              </div>
            </motion.div>
          )}

        </div>
      )}

      {/* Leads cap notice (LT-197). A statement about the account: the upgrade
          button only where purchases may be offered (LT-130). */}
      {leadsNotice && leadsCap !== null && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          data-testid="leads-cap-notice"
          className={`glass-card ${leadsNotice === 'full' ? 'glass-tint-red' : 'glass-tint-amber'} p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4`}
        >
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-full shrink-0 ${leadsNotice === 'full' ? 'bg-red-100 dark:bg-red-800/40 text-red-600 dark:text-red-400' : 'bg-amber-100 dark:bg-amber-800/40 text-amber-600 dark:text-amber-400'}`}>
              <Inbox className="w-5 h-5" />
            </div>
            <div>
              <h3 className={`font-semibold text-sm ${leadsNotice === 'full' ? 'text-red-800 dark:text-red-300' : 'text-amber-800 dark:text-amber-300'}`}>
                {leadsNotice === 'full' ? t('dashboard.leadsFullTitle') : t('dashboard.leadsNearTitle', { used: leadsUsed, cap: leadsCap })}
              </h3>
              <p className={`text-xs mt-0.5 ${leadsNotice === 'full' ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'}`}>
                {leadsNotice === 'full' ? t('dashboard.leadsFullDesc') : t('dashboard.leadsNearDesc')}
              </p>
            </div>
          </div>
          {canOfferPurchases() && (
            <button
              onClick={() => navigate('/account')}
              className="shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors bg-amber-500 hover:bg-amber-600 text-white"
            >
              {t('common.upgradePlanBtn')}
            </button>
          )}
        </motion.div>
      )}

      {/* New leads (LT-197): the way in from home — the bottom bar has no free
          slot. A leads site's summary below carries the count and the way in. */}
      {!leadsSite && !!newLeads && (
        <motion.button
          type="button"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={() => navigate('/leads')}
          data-testid="leads-home-card"
          className="glass-card w-full p-4 rounded-2xl flex items-center gap-3 text-start hover:border-primary/40 transition-colors"
        >
          <div className="p-2 bg-primary/10 rounded-full text-primary shrink-0">
            <Inbox className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm text-gray-800 dark:text-white">{t('dashboard.newLeadsTitle', { count: newLeads })}</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{t('dashboard.newLeadsDesc')}</p>
          </div>
          {direction === 'rtl' ? <ArrowLeft className="w-4 h-4 text-gray-400 shrink-0" /> : <ArrowRight className="w-4 h-4 text-gray-400 shrink-0" />}
        </motion.button>
      )}

      {/* Onboarding UI */}
      {showOnboarding && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-purple-600 to-fuchsia-600 shadow-xl">
            <div className="absolute top-0 right-0 w-72 h-72 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />
            <div className="absolute bottom-0 left-1/2 w-56 h-56 bg-black/10 rounded-full blur-2xl translate-y-1/3 pointer-events-none" />

            <div className="relative z-10 p-7 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              <div className="flex-1 text-white">
                <h2 className="text-2xl font-bold mb-1 tracking-tight">{t('common.onboardingCardTitle')}</h2>
                <p className="text-indigo-200 text-sm leading-relaxed">{t('common.onboardingCardDesc')}</p>
              </div>
              <div className="hidden lg:block relative shrink-0 w-28 h-28">
                <div className="absolute inset-0 bg-gradient-to-tr from-orange-400 to-pink-500 rounded-[40%_60%_70%_30%/40%_50%_60%_50%] animate-[spin_8s_linear_infinite] blur-[2px]" />
                <div className="absolute inset-3 bg-gradient-to-bl from-blue-400 to-purple-400 rounded-[60%_40%_30%_70%/60%_30%_70%_40%] animate-[spin_12s_linear_infinite_reverse] blur-[1px]" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-white font-bold text-xl drop-shadow-lg">{progressPct}%</span>
                </div>
              </div>
            </div>

            <div className="relative z-10 px-7 pb-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-white/80 text-xs font-medium">
                  {t('onboarding.setupProgress', { done: doneCount, total: setupSteps.length })}
                </span>
                <span className="text-white font-bold text-sm">{progressPct}%</span>
              </div>
              <div className="w-full h-2.5 bg-white/20 rounded-full overflow-hidden mb-4">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-300 to-green-400"
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPct}%` }}
                  transition={{ duration: 1, delay: 0.3, ease: 'easeOut' }}
                />
              </div>

              <button
                onClick={() => setStepsExpanded(p => {
                  localStorage.setItem('onboardingExpanded', String(!p));
                  return !p;
                })}
                className="flex items-center gap-2 text-white/70 hover:text-white text-xs font-medium transition-colors mb-1"
              >
                <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${stepsExpanded ? 'rotate-180' : ''}`} />
                {stepsExpanded ? t('onboarding.hideDetails') : t('onboarding.showDetails')}
              </button>

              <motion.div
                initial={false}
                animate={{ height: stepsExpanded ? 'auto' : 0, opacity: stepsExpanded ? 1 : 0 }}
                transition={{ duration: 0.35, ease: 'easeInOut' }}
                className="overflow-hidden"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 pb-3">
                  {setupSteps.map(step => {
                    const Icon = step.icon;
                    return (
                      <motion.button
                        key={step.key}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => navigate(step.tab)}
                        className={`flex items-center gap-3 px-4 py-2.5 rounded-2xl text-left transition-all duration-150 ${
                          step.done ? 'bg-white/10 opacity-60 cursor-default' : 'bg-white/15 hover:bg-white/25 hover:-translate-y-px cursor-pointer'
                        }`}
                        disabled={step.done}
                      >
                        <div className={`shrink-0 p-1.5 rounded-full ${step.done ? 'bg-emerald-400/30' : 'bg-white/20'}`}>
                          {step.done ? <CheckCircle2 className="w-4 h-4 text-emerald-300" /> : <Icon className="w-4 h-4 text-white/80" />}
                        </div>
                        <span className={`text-sm font-medium ${step.done ? 'line-through text-white/50' : 'text-white'}`}>
                          {step.label}
                        </span>
                        {!step.done && (
                          direction === 'rtl'
                            ? <ArrowLeft className="w-3.5 h-3.5 text-white/50 ms-auto shrink-0" />
                            : <ArrowRight className="w-3.5 h-3.5 text-white/50 ms-auto shrink-0" />
                        )}
                      </motion.button>
                    );
                  })}
                </div>

                {progressPct < 100 && (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => navigate('/settings')}
                    className="mt-1 mb-2 bg-black/80 hover:bg-black text-white font-medium px-5 py-2.5 rounded-2xl flex items-center gap-2 transition-colors text-sm shadow-lg"
                  >
                    {t('common.exploreAppBtn')}
                    {direction === 'rtl' ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
                  </motion.button>
                )}
              </motion.div>

              {progressPct === 100 && (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleCompleteSetup}
                  className="mt-2 mb-2 bg-emerald-500 hover:bg-emerald-600 text-white font-medium px-5 py-2.5 rounded-2xl flex items-center gap-2 transition-colors text-sm shadow-lg"
                >
                  {t('onboarding.allDoneBtn')}
                  <CheckCircle2 className="w-4 h-4" />
                </motion.button>
              )}
            </div>
          </div>
        </motion.div>
      )}

      {/* ── A leads site's home (LT-199): the summary replaces every booking widget ── */}
      {leadsSite && leadsPage !== undefined && !!(leadsTotal || leadsPage === null) && (
        <ErrorBoundaryWithLanguage
          fallback={<DashboardFallback language={language} title={t('leads.errors.loadFailed')} />}
        >
          <LeadsSummary page={leadsPage} thisMonth={entitlements?.usage.leadsThisMonth} direction={direction} />
        </ErrorBoundaryWithLanguage>
      )}

      {!leadsSite && appointments.length > 0 && (
        <>
          {/* ── Row 1: Income Stats ── */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <ErrorBoundaryWithLanguage
              fallback={<DashboardFallback language={language} title={t('common.errorLoadingIncome')} />}
            >
              <IncomeStats appointments={appointments} />
            </ErrorBoundaryWithLanguage>
          </motion.div>

          {/* ── Row 2: Bar Graph (2/3) + Donut Chart (1/3) — same date range ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-stretch">
            <div className="lg:col-span-2">
              <ErrorBoundaryWithLanguage
                fallback={<DashboardFallback language={language} title={t('common.errorLoadingGraph')} />}
              >
                <AppointmentsGraph
                  appointments={appointments}
                  timeRange={timeRange}
                  currentDate={currentDate}
                  onTimeRangeChange={setTimeRange}
                  onCurrentDateChange={setCurrentDate}
                />
              </ErrorBoundaryWithLanguage>
            </div>
            <div className="lg:col-span-1">
              <ErrorBoundaryWithLanguage
                fallback={<DashboardFallback language={language} title={t('common.errorLoadingStats')} />}
              >
                <DashboardDonutChart
                  appointments={appointments}
                  timeRange={timeRange}
                  currentDate={currentDate}
                />
              </ErrorBoundaryWithLanguage>
            </div>
          </div>
        </>
      )}

      {/* ── Appointments List — hidden until the first booking (the empty card said nothing) ── */}
      {!leadsSite && appointments.length > 0 && (
        <ErrorBoundaryWithLanguage
          fallback={<DashboardFallback language={language} title={t('common.errorLoadingAppointments')} />}
        >
          <DashboardAppointmentsList
            appointments={appointments}
            onAppointmentClick={setSelectedAppointment}
          />
        </ErrorBoundaryWithLanguage>
      )}

      {/* Appointment Details Modal */}
      {selectedAppointment && (
        <AppointmentDetails
          appointment={selectedAppointment}
          onClose={() => setSelectedAppointment(null)}
          onUpdate={() => { }}
        />
      )}
    </motion.div>
  );
};

export default Dashboard;
