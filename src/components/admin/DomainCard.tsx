import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { AlertTriangle, Link2, RefreshCw, Unlink } from 'lucide-react';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Input from '../ui/Input';
import ConfirmDialog from '../ui/ConfirmDialog';
import StatusBadge from './StatusBadge';
import {
  fetchUserDomain,
  connectUserDomain,
  checkUserDomain,
  disconnectUserDomain,
  AdminUserDomain,
} from '../../services/adminApi';

/**
 * LT-661 (phase 1): the business's own domain for its site, connected by the
 * operator. The card reads `/api/admin/users/:id/domain` by itself, like the
 * billing card: a slow or failing Cloudflare is this card's error, never a
 * broken user page. Every route answers the same shape, so each action's
 * answer is the card's new state.
 */
interface DomainCardProps {
  /** The owner's user id (the page's id). */
  userId: string;
}

type Action = 'connect' | 'check' | 'disconnect';

/** The server's own words for a refusal (409 taken, 400 not a host, 503 not configured). */
const serverMessage = (error: unknown): string | undefined => {
  const data = (error as { response?: { data?: { error?: unknown; message?: unknown } } })?.response?.data;
  const text = data?.error ?? data?.message;
  return typeof text === 'string' && text.trim() ? text : undefined;
};

const DomainCard: React.FC<DomainCardProps> = ({ userId }) => {
  const { t, i18n } = useTranslation();
  const [state, setState] = useState<AdminUserDomain | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState<Action | null>(null);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      setState(await fetchUserDomain(userId));
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  // The page's own date style (he-IL / en-GB, short month), with the hour:
  // "checked" is read minutes after pressing the button.
  const formatTime = (value?: string | null) => {
    const date = value ? new Date(value) : null;
    return date && !Number.isNaN(date.getTime())
      ? date.toLocaleString(i18n.language === 'he' ? 'he-IL' : 'en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      : '-';
  };

  const host = typed.trim().toLowerCase();

  const connect = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!host || busy) return;
    setBusy('connect');
    setConnectError(null);
    try {
      setState(await connectUserDomain(userId, host));
      setTyped('');
      toast.success(t('admin.domain.connected'));
    } catch (error) {
      // Stays under the field, so the host can be fixed with the reason in view.
      setConnectError(serverMessage(error) ?? t('admin.errors.actionFailed'));
    } finally {
      setBusy(null);
    }
  };

  const act = async (action: 'check' | 'disconnect') => {
    if (busy) return;
    setBusy(action);
    try {
      if (action === 'check') {
        setState(await checkUserDomain(userId));
        toast.success(t('admin.domain.checked'));
      } else {
        setState(await disconnectUserDomain(userId));
        toast.success(t('admin.domain.disconnected'));
      }
      setConfirming(false);
    } catch (error) {
      toast.error(serverMessage(error) ?? t('admin.errors.actionFailed'));
    } finally {
      setBusy(null);
    }
  };

  const domain = state?.domain ?? null;
  const configured = state?.configured ?? false;
  // The record the owner adds at their DNS: the host's first label to our target.
  const record = (forHost: string) => `CNAME ${forHost.split('.')[0] || 'www'} -> ${state?.target ?? ''}`;
  const dnsHint = (forHost: string) => (
    <p className="text-xs text-gray-500 dark:text-gray-400" data-testid="domain-dns">
      {t('admin.domain.dnsHint')}{' '}
      <code dir="ltr" className="inline-block font-mono break-all text-gray-700 dark:text-gray-200">
        {record(forHost)}
      </code>
    </p>
  );

  return (
    <Card animate={false}>
      <h3 className="font-semibold text-gray-900 dark:text-dark-text mb-4 flex items-center gap-2">
        <Link2 size={16} className="text-primary" />
        {t('admin.domain.title')}
      </h3>

      {loading ? (
        <div className="space-y-2.5">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-4 rounded bg-gray-100 dark:bg-gray-800 animate-pulse w-3/4" />
          ))}
        </div>
      ) : failed || !state ? (
        <div className="flex flex-col items-start gap-2">
          <p className="text-sm text-red-500 flex items-center gap-1.5">
            <AlertTriangle size={14} />
            {t('admin.domain.loadError')}
          </p>
          <Button variant="ghost" size="sm" leftIcon={<RefreshCw size={13} />} onClick={load}>
            {t('admin.domain.retry')}
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {!configured && (
            <p
              className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 rounded-lg px-3 py-2"
              data-testid="domain-not-configured"
            >
              {t('admin.domain.notConfigured')}
            </p>
          )}

          {domain ? (
            <>
              <div className="flex flex-wrap items-center gap-2 min-w-0">
                {domain.status === 'active' ? (
                  <a
                    href={`https://${domain.host}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    dir="ltr"
                    className="min-w-0 font-medium text-primary hover:underline break-all"
                  >
                    {domain.host}
                  </a>
                ) : (
                  <p dir="ltr" className="min-w-0 font-medium text-gray-900 dark:text-dark-text break-all" data-testid="domain-host">
                    {domain.host}
                  </p>
                )}
                <StatusBadge status={domain.status} i18nPrefix="admin.domain.status" />
              </div>

              {domain.error && (
                <p
                  dir="auto"
                  role="alert"
                  className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 rounded-lg px-3 py-2 break-words"
                >
                  {domain.error}
                </p>
              )}

              <dl className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-3 text-sm">
                {(['connectedAt', 'checkedAt', 'activeAt'] as const).map((key) => (
                  <div key={key}>
                    <dt className="text-xs text-gray-400">{t(`admin.domain.${key}`)}</dt>
                    <dd className="mt-0.5 text-gray-800 dark:text-gray-200" data-testid={`domain-${key}`}>
                      {/* Its own direction: an English date inside Arabic keeps its order. */}
                      <span dir="auto" className="inline-block">{formatTime(domain[key])}</span>
                    </dd>
                  </div>
                ))}
              </dl>

              {domain.status !== 'active' && dnsHint(domain.host)}

              {configured && (
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    leftIcon={<RefreshCw size={14} />}
                    isLoading={busy === 'check'}
                    disabled={busy !== null}
                    onClick={() => act('check')}
                  >
                    {t('admin.domain.check')}
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    leftIcon={<Unlink size={14} />}
                    disabled={busy !== null}
                    onClick={() => setConfirming(true)}
                  >
                    {t('admin.domain.disconnect')}
                  </Button>
                </div>
              )}
            </>
          ) : configured ? (
            <form onSubmit={connect} className="space-y-3" noValidate>
              <Input
                label={t('admin.domain.hostLabel')}
                value={typed}
                onChange={(e) => {
                  setTyped(e.target.value);
                  setConnectError(null);
                }}
                placeholder="www.example.com"
                dir="ltr"
                inputMode="url"
                autoCapitalize="none"
                autoCorrect="off"
                autoComplete="off"
                spellCheck={false}
                error={connectError ?? undefined}
              />
              {dnsHint(host)}
              <Button
                type="submit"
                variant="primary"
                size="sm"
                isLoading={busy === 'connect'}
                disabled={!host || busy !== null}
              >
                {t('admin.domain.connect')}
              </Button>
            </form>
          ) : (
            <p className="text-sm text-gray-400">{t('admin.domain.none')}</p>
          )}
        </div>
      )}

      <ConfirmDialog
        open={confirming && Boolean(domain)}
        title={t('admin.domain.disconnectTitle')}
        message={t('admin.domain.disconnectConfirm', { host: domain?.host ?? '' })}
        confirmLabel={t('admin.domain.disconnect')}
        danger
        loading={busy === 'disconnect'}
        onClose={() => setConfirming(false)}
        onConfirm={() => act('disconnect')}
      />
    </Card>
  );
};

export default DomainCard;
