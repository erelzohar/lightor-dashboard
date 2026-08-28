import React, { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Clock,
  Pencil,
  ExternalLink,
  Globe,
  ShieldAlert,
  Trash2,
  UserCog,
  CalendarRange,
  CreditCard,
} from 'lucide-react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Select from '../../components/ui/Select';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import StatusBadge from '../../components/admin/StatusBadge';
import BillingCard from '../../components/admin/BillingCard';
import UserFormModal from '../../components/admin/UserFormModal';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import {
  fetchUser,
  verifyUserEmail,
  changeUserRole,
  cancelUserSubscription,
  resumeUserSubscription,
  deleteUser,
  AdminUserDetail as AdminUserDetailData,
} from '../../services/adminApi';

/**
 * Admin → user detail (LT-058): identity, site, usage-vs-limits, recent
 * bookings, and the operator actions. Subscription actions never write local
 * state — the page re-fetches and notes that Paddle's webhook confirms.
 */
const AdminUserDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const { direction } = useTheme();
  const { auth } = useAuth();
  const navigate = useNavigate();

  const [detail, setDetail] = useState<AdminUserDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [roleDraft, setRoleDraft] = useState<string>('');
  const [busy, setBusy] = useState<string | null>(null);
  const [dialog, setDialog] = useState<'cancel' | 'resume' | 'delete' | null>(null);
  const [editing, setEditing] = useState(false);

  document.title = t('admin.nav.userDetail');

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await fetchUser(id);
      setDetail(data);
      setRoleDraft(data.user.role);
    } catch {
      toast.error(t('admin.errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [id, t]);

  useEffect(() => {
    load();
  }, [load]);

  const run = async (
    key: string,
    action: () => Promise<unknown>,
    successKey: string,
    // Delete navigates away — refetching the record we just destroyed fires
    // a pointless 404 GET (Erel spotted it in the network tab).
    { reload = true }: { reload?: boolean } = {}
  ) => {
    setBusy(key);
    try {
      await action();
      toast.success(t(successKey));
      setDialog(null);
      if (reload) await load();
    } catch (error) {
      const message =
        (error as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(message ?? t('admin.errors.actionFailed'));
    } finally {
      setBusy(null);
    }
  };

  const formatDate = (value?: string | null) =>
    value
      ? new Date(value).toLocaleDateString(i18n.language === 'he' ? 'he-IL' : 'en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        })
      : '—';

  // Appointment.timestamp is a string of epoch-ms in production, but old
  // records may carry an ISO string — accept either.
  const appointmentDate = (ts?: string): Date | null => {
    if (!ts) return null;
    const n = Number(ts);
    const d = Number.isFinite(n) && ts.trim() !== '' ? new Date(n) : new Date(ts);
    return Number.isNaN(d.getTime()) ? null : d;
  };

  const formatDateTime = (value: Date | null) =>
    value
      ? value.toLocaleString(i18n.language === 'he' ? 'he-IL' : 'en-GB', {
          day: '2-digit',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
        })
      : '—';

  const BackIcon = direction === 'rtl' ? ArrowRight : ArrowLeft;

  if (loading || !detail) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const { user, webConfig, plan, limits, usage, counts, recentAppointments } = detail;
  const sub = user.subscription ?? { status: 'free' as const };
  const isSelf = auth.user?._id === user._id;
  const canCancel =
    Boolean(sub.subscriptionId) &&
    ['active', 'past_due'].includes(sub.status) &&
    !sub.cancelAtPeriodEnd;
  const canResume =
    Boolean(sub.subscriptionId) &&
    ['active', 'past_due'].includes(sub.status) &&
    Boolean(sub.cancelAtPeriodEnd);

  const usageRows = [
    {
      label: t('admin.userDetail.usage.appointments'),
      used: usage.appointmentsThisMonth,
      limit: limits.monthlyAppointments,
    },
    {
      label: t('admin.userDetail.usage.services'),
      used: usage.servicesCount,
      limit: limits.maxServices,
    },
    {
      label: t('admin.userDetail.usage.aiGenerations'),
      used: usage.aiGenerationsThisMonth,
      limit: limits.aiGenerationsPerMonth,
    },
    {
      label: t('admin.userDetail.usage.aiTokens'),
      used: usage.aiTokensThisMonth ?? 0,
      limit: limits.aiTokensPerMonth ?? null,
    },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <button
        onClick={() => navigate('/admin/users')}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 mb-4 transition-colors"
      >
        <BackIcon size={16} />
        {t('admin.userDetail.back')}
      </button>

      {/* ── Identity header ── */}
      <div className="flex flex-wrap items-center gap-4 mb-6">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-primary-dark text-white flex items-center justify-center text-xl font-bold shadow-lg shadow-primary/20">
          {user.name?.charAt(0).toUpperCase() || '?'}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-dark-text">{user.name}</h1>
            <StatusBadge status={user.role} i18nPrefix="admin.role" />
            <StatusBadge status={sub.status} />
            {sub.cancelAtPeriodEnd && <StatusBadge status="canceled" i18nPrefix="admin.flags" />}
          </div>
          <p className="text-sm text-gray-500 truncate" dir="ltr">
            {user.email}
            {user.phone ? ` · ${user.phone}` : ''}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          leftIcon={<Pencil size={14} />}
          onClick={() => setEditing(true)}
        >
          {t('admin.userForm.editButton')}
        </Button>
      </div>

      <UserFormModal
        open={editing}
        mode="edit"
        user={user}
        onClose={() => setEditing(false)}
        onSaved={() => load()}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* ── Left column: identity + site + usage ── */}
        <div className="lg:col-span-2 space-y-4">
          <Card animate={false}>
            <h3 className="font-semibold text-gray-900 dark:text-dark-text mb-4 flex items-center gap-2">
              <UserCog size={16} className="text-primary" />
              {t('admin.userDetail.identity.title')}
            </h3>
            <dl className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-3 text-sm">
              <div>
                <dt className="text-xs text-gray-400">{t('admin.userDetail.identity.verified')}</dt>
                <dd className="mt-0.5 flex items-center gap-1.5 text-gray-800 dark:text-gray-200">
                  {user.isVerified ? (
                    <>
                      <BadgeCheck size={14} className="text-emerald-500" />
                      {t('admin.userDetail.identity.verifiedYes')}
                    </>
                  ) : (
                    <>
                      <Clock size={14} className="text-amber-500" />
                      {t('admin.userDetail.identity.verifiedNo')}
                    </>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-gray-400">{t('admin.userDetail.identity.boarding')}</dt>
                <dd className="mt-0.5">
                  <StatusBadge status={user.boardingStatus} i18nPrefix="admin.boarding" />
                </dd>
              </div>
              <div>
                <dt className="text-xs text-gray-400">{t('admin.userDetail.identity.created')}</dt>
                <dd className="mt-0.5 text-gray-800 dark:text-gray-200">{formatDate(user.createdAt)}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-400">{t('admin.userDetail.identity.language')}</dt>
                <dd className="mt-0.5 text-gray-800 dark:text-gray-200 uppercase">{user.defaultLanguage}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-400">{t('admin.userDetail.identity.channel')}</dt>
                <dd className="mt-0.5 text-gray-800 dark:text-gray-200 uppercase">{user.channelType ?? 'sms'}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-400">{t('admin.userDetail.identity.lastBooked')}</dt>
                <dd className="mt-0.5 text-gray-800 dark:text-gray-200">{formatDate(counts.lastBookedAt)}</dd>
              </div>
            </dl>
          </Card>

          <Card animate={false}>
            <h3 className="font-semibold text-gray-900 dark:text-dark-text mb-4 flex items-center gap-2">
              <Globe size={16} className="text-primary" />
              {t('admin.userDetail.site.title')}
            </h3>
            {webConfig ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-gray-900 dark:text-dark-text truncate">
                    {webConfig.businessName}
                  </p>
                  <p className="text-sm text-gray-400" dir="ltr">
                    {webConfig.subDomain}.lightor.app
                  </p>
                </div>
                <a href={`https://${webConfig.subDomain}.lightor.app`} target="_blank" rel="noreferrer">
                  <Button variant="outline" size="sm" rightIcon={<ExternalLink size={14} />}>
                    {t('admin.userDetail.site.open')}
                  </Button>
                </a>
              </div>
            ) : (
              <p className="text-sm text-gray-400">{t('admin.userDetail.site.none')}</p>
            )}
          </Card>

          <Card animate={false}>
            <h3 className="font-semibold text-gray-900 dark:text-dark-text mb-4">
              {t('admin.userDetail.usage.title', { plan: t(`admin.plan.${plan}`) })}
            </h3>
            <div className="space-y-4">
              {usageRows.map((row) => {
                const unlimited = row.limit === null;
                const pct = unlimited ? 0 : Math.min((row.used / (row.limit || 1)) * 100, 100);
                const barColor = pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-primary';
                return (
                  <div key={row.label}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600 dark:text-gray-300">{row.label}</span>
                      <span className="text-gray-500 tabular-nums" dir="ltr">
                        {row.used.toLocaleString()} / {unlimited ? '∞' : row.limit?.toLocaleString()}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                      {!unlimited && (
                        <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card animate={false}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900 dark:text-dark-text flex items-center gap-2">
                <CalendarRange size={16} className="text-primary" />
                {t('admin.userDetail.appointments.title', { count: counts.appointmentsTotal })}
              </h3>
              <Link
                to={`/admin/appointments?userId=${user._id}`}
                className="text-sm text-primary hover:underline"
              >
                {t('admin.userDetail.appointments.viewAll')}
              </Link>
            </div>
            {recentAppointments.length === 0 ? (
              <p className="text-sm text-gray-400">{t('admin.userDetail.appointments.none')}</p>
            ) : (
              <ul className="divide-y divide-gray-50 dark:divide-gray-800/40">
                {recentAppointments.map((appointment) => (
                  <li key={appointment._id} className="py-2.5 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                        {appointment.name}
                      </p>
                      <p className="text-xs text-gray-400" dir="ltr">
                        {formatDateTime(appointmentDate(appointment.timestamp))}
                      </p>
                    </div>
                    <StatusBadge status={appointment.status} i18nPrefix="admin.appointmentStatus" />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        {/* ── Right column: actions ── */}
        <div className="space-y-4">
          <Card animate={false}>
            <h3 className="font-semibold text-gray-900 dark:text-dark-text mb-4 flex items-center gap-2">
              <ShieldAlert size={16} className="text-primary" />
              {t('admin.actions.title')}
            </h3>
            <div className="space-y-5">
              {!user.isVerified && (
                <div>
                  <p className="text-xs text-gray-400 mb-2">{t('admin.actions.verifyHint')}</p>
                  <Button
                    variant="success"
                    size="sm"
                    fullWidth
                    isLoading={busy === 'verify'}
                    onClick={() =>
                      run('verify', () => verifyUserEmail(user._id), 'admin.actions.verifySuccess')
                    }
                    leftIcon={<BadgeCheck size={15} />}
                  >
                    {t('admin.actions.verifyEmail')}
                  </Button>
                </div>
              )}

              <div>
                <Select
                  label={t('admin.actions.role')}
                  value={roleDraft}
                  disabled={isSelf}
                  onChange={(e) => setRoleDraft(e.target.value)}
                  options={[
                    { value: 'user', label: t('admin.role.user') },
                    { value: 'admin', label: t('admin.role.admin') },
                    { value: 'client', label: t('admin.role.client') },
                  ]}
                  helperText={isSelf ? t('admin.actions.roleSelfNote') : undefined}
                />
                {roleDraft !== user.role && !isSelf && (
                  <Button
                    variant="primary"
                    size="sm"
                    fullWidth
                    className="mt-2"
                    isLoading={busy === 'role'}
                    onClick={() =>
                      run(
                        'role',
                        () => changeUserRole(user._id, roleDraft as 'admin' | 'user' | 'client'),
                        'admin.actions.roleSuccess'
                      )
                    }
                  >
                    {t('admin.actions.saveRole')}
                  </Button>
                )}
              </div>

              <div className="pt-4 border-t border-gray-100 dark:border-gray-800/60">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2 flex items-center gap-1.5">
                  <CreditCard size={13} />
                  {t('admin.actions.billing')}
                </p>
                {canCancel && (
                  <Button variant="outline" size="sm" fullWidth onClick={() => setDialog('cancel')}>
                    {t('admin.actions.cancelSubscription')}
                  </Button>
                )}
                {canResume && (
                  <Button variant="outline" size="sm" fullWidth onClick={() => setDialog('resume')}>
                    {t('admin.actions.resumeSubscription')}
                  </Button>
                )}
                {!canCancel && !canResume && (
                  <p className="text-xs text-gray-400">{t('admin.actions.noBillingActions')}</p>
                )}
                {sub.nextBillDate && (
                  <p className="text-xs text-gray-400 mt-2">
                    {t('admin.actions.nextBill', { date: formatDate(String(sub.nextBillDate)) })}
                  </p>
                )}
              </div>

              {!isSelf && (
                <div className="pt-4 border-t border-red-100 dark:border-red-900/30">
                  <p className="text-xs font-semibold uppercase tracking-wide text-red-400 mb-2">
                    {t('admin.actions.dangerZone')}
                  </p>
                  <Button
                    variant="danger"
                    size="sm"
                    fullWidth
                    leftIcon={<Trash2 size={15} />}
                    onClick={() => setDialog('delete')}
                  >
                    {t('admin.actions.deleteAccount')}
                  </Button>
                </div>
              )}
            </div>
          </Card>

          {sub.subscriptionId && (
            <BillingCard
              userId={user._id}
              subscriptionId={sub.subscriptionId}
              customerId={sub.customerId}
            />
          )}
        </div>
      </div>

      {/* ── Dialogs ── */}
      <ConfirmDialog
        open={dialog === 'cancel'}
        title={t('admin.actions.cancelSubscription')}
        message={t('admin.actions.cancelConfirm', { name: user.name })}
        confirmLabel={t('admin.actions.cancelSubscription')}
        danger
        loading={busy === 'cancel'}
        onClose={() => setDialog(null)}
        onConfirm={() =>
          run('cancel', () => cancelUserSubscription(user._id), 'admin.actions.cancelSuccess')
        }
      />
      <ConfirmDialog
        open={dialog === 'resume'}
        title={t('admin.actions.resumeSubscription')}
        message={t('admin.actions.resumeConfirm', { name: user.name })}
        confirmLabel={t('admin.actions.resumeSubscription')}
        loading={busy === 'resume'}
        onClose={() => setDialog(null)}
        onConfirm={() =>
          run('resume', () => resumeUserSubscription(user._id), 'admin.actions.resumeSuccess')
        }
      />
      <ConfirmDialog
        open={dialog === 'delete'}
        title={t('admin.actions.deleteAccount')}
        message={t('admin.actions.deleteConfirm', { name: user.name })}
        confirmLabel={t('admin.actions.deleteAccount')}
        danger
        confirmText={user.email}
        loading={busy === 'delete'}
        onClose={() => setDialog(null)}
        onConfirm={() =>
          run(
            'delete',
            async () => {
              await deleteUser(user._id, user.email);
              navigate('/admin/users');
            },
            'admin.actions.deleteSuccess',
            { reload: false }
          )
        }
      />
    </motion.div>
  );
};

export default AdminUserDetail;
