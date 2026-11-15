import React, { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { AlertTriangle, CheckCircle2, Clock, ExternalLink, Globe, Lock, PauseCircle, RefreshCw, Unlink } from 'lucide-react';
import Button from '../ui/Button';
import Input from '../ui/Input';
import { ComingSoonRow } from '../ui/ComingSoon';
import StatusBadge from '../admin/StatusBadge';
import { DomainProofCard, DomainRecords } from './DomainRecords';
import { useConfirm } from '../../hooks/useConfirm';
import type { OwnDomain } from '../../hooks/useOwnDomain';
import { canOfferPurchases } from '../../lib/platform';
import { domainErrorCode, domainErrorKey, domainProofOf, type DomainProof } from '../../services/domainApi';

/**
 * LT-661 (phase 2): the owner's own domain, in Settings > Site, where the
 * "coming soon" row sat (LT-331). What it shows follows the server's answer:
 *  - no Cloudflare on the server: the "coming soon" row, as before;
 *  - a plan without it: a locked row and the way to the plans;
 *  - no domain: a field for the domain that was bought, and Connect;
 *  - a domain: its name, where it stands, what to do at the registrar,
 *    "check now" and "disconnect". While it waits, the server is asked again
 *    every 15 seconds as long as this is on screen;
 *  - a domain another site holds: the TXT record that proves whose it is.
 * The state itself is the page's (`useOwnDomain`), so it outlives the tab.
 */

const P = 'settings.customDomain';
/** How often a waiting domain is checked while the card is on screen. */
export const AUTO_CHECK_MS = 15_000;

const dateLocale = (lang: string): string =>
  lang === 'he' ? 'he-IL' : lang === 'ar' ? 'ar-u-nu-latn' : lang === 'fr' ? 'fr-FR' : lang === 'es' ? 'es-ES' : 'en-GB';

type View = 'pending' | 'active' | 'error' | 'paused';

interface DomainSectionProps {
  own: OwnDomain;
  /** The site's Lightor address as people read it: "dana.lightor.app". */
  lightorHost: string;
}

const DomainSection: React.FC<DomainSectionProps> = ({ own, lightorHost }) => {
  const { t, i18n } = useTranslation();
  const { confirm, dialog } = useConfirm();
  const { answer, busy, check } = own;
  const [typed, setTyped] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [proof, setProof] = useState<DomainProof | null>(null);
  const titleId = useId();
  const hostRef = useRef<HTMLElement | null>(null);
  const fieldRef = useRef<HTMLInputElement>(null);
  // Connect and Disconnect swap the form and the card: the pressed button
  // goes away, so the focus is handed to what took its place.
  const focusNext = useRef<'card' | 'field' | null>(null);

  const domain = answer?.configured ? answer.domain : null;
  // A plan without it holds a domain only paused, whatever was stored last.
  const view: View | null = !domain ? null : !answer?.allowed || domain.status === 'paused' ? 'paused' : domain.status;
  const waiting = view === 'pending';

  // While it waits and the page is in view, the server looks again every 15
  // seconds: no button to press, no page to refresh. It stops when the tab
  // is hidden, when the domain is no longer waiting, and when this unmounts.
  useEffect(() => {
    if (!waiting) return;
    let timer = 0;
    const stop = () => {
      window.clearInterval(timer);
      timer = 0;
    };
    const follow = () => {
      stop();
      if (document.visibilityState !== 'visible') return;
      timer = window.setInterval(() => {
        void check({ quiet: true });
      }, AUTO_CHECK_MS);
    };
    follow();
    document.addEventListener('visibilitychange', follow);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', follow);
    };
  }, [waiting, check]);

  // The moment it goes live, said once - whoever asked, the owner or the timer.
  const seen = useRef<View | 'none' | null>(null);
  useEffect(() => {
    if (!answer) return;
    const before = seen.current;
    seen.current = view ?? 'none';
    if (before !== null && before !== 'active' && view === 'active') toast.success(t(`${P}.connected`));
  }, [answer, view, t]);

  useEffect(() => {
    const target = focusNext.current;
    if (!target) return;
    if (target === 'card' && domain) {
      focusNext.current = null;
      hostRef.current?.focus();
    } else if (target === 'field' && !domain) {
      focusNext.current = null;
      fieldRef.current?.focus();
    }
  }, [domain]);

  const date = (iso?: string): string | null => {
    const at = iso ? new Date(iso) : null;
    return at && !Number.isNaN(at.getTime())
      ? at.toLocaleDateString(dateLocale(i18n.language), { day: 'numeric', month: 'long', year: 'numeric' })
      : null;
  };

  const header = (badge?: React.ReactNode) => (
    <div className="flex items-start gap-3">
      <Globe className="w-5 h-5 mt-0.5 shrink-0 text-primary" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <p id={titleId} className="text-sm font-semibold text-gray-800 dark:text-gray-100">{t(`${P}.title`)}</p>
          {badge}
        </div>
        <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{t(`${P}.desc`)}</p>
      </div>
    </div>
  );

  // The plans are offered where the build may sell one (never in the apps, LT-130).
  const plansLink = canOfferPurchases() && (
    <Link to="/account" className="inline-flex items-center gap-1.5 text-sm font-medium text-primary underline" data-testid="domain-upgrade">
      {t(`${P}.locked.upgrade`)}
    </Link>
  );

  const connect = async (event: React.FormEvent) => {
    event.preventDefault();
    const host = typed.trim();
    if (!host || busy) return;
    setFormError(null);
    // Set before the answer: the card is drawn as the answer lands.
    focusNext.current = 'card';
    try {
      const next = await own.connect(host);
      setTyped('');
      setProof(null);
      // "Connected" is said by the effect above when it is live at once.
      if (next.domain && next.domain.status !== 'active') toast.success(t(`${P}.saved`));
    } catch (error) {
      focusNext.current = null;
      setFormError(t(domainErrorKey(error)));
      setProof(domainProofOf(error));
      // The plan or the server changed under the form: show what is true now.
      const code = domainErrorCode(error);
      if (code === 'PLAN_REQUIRED' || code === 'DOMAINS_NOT_CONFIGURED') void own.reload();
    }
  };

  const checkNow = async () => {
    if (busy) return;
    try {
      const next = await check();
      if (next?.domain && next.domain.status !== 'active') toast.success(t(`${P}.checked`));
    } catch (error) {
      toast.error(t(domainErrorKey(error)));
    }
  };

  const disconnect = async () => {
    if (busy || !domain) return;
    const ok = await confirm({
      title: t(`${P}.disconnectTitle`),
      message: t(`${P}.disconnectConfirm`, { host: domain.host, address: lightorHost }),
      confirmLabel: t(`${P}.disconnect`),
      danger: true,
    });
    if (!ok) return;
    try {
      focusNext.current = 'field';
      await own.disconnect();
      toast.success(t(`${P}.disconnected`));
    } catch (error) {
      focusNext.current = null;
      toast.error(t(domainErrorKey(error)));
    }
  };

  let body: React.ReactNode;
  if (own.loading && !answer) {
    body = (
      <>
        {header()}
        <div className="mt-4 space-y-2.5" aria-busy="true" data-testid="domain-loading">
          <div className="h-4 w-2/3 rounded bg-gray-100 dark:bg-gray-800 animate-pulse" />
          <div className="h-4 w-1/2 rounded bg-gray-100 dark:bg-gray-800 animate-pulse" />
        </div>
      </>
    );
  } else if (!answer) {
    body = (
      <>
        {header()}
        <div className="mt-4 flex flex-col items-start gap-2" data-testid="domain-load-error">
          <p role="alert" className="text-sm text-red-600 dark:text-red-400 flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
            {t(`${P}.loadError`)}
          </p>
          <Button variant="ghost" size="sm" leftIcon={<RefreshCw size={13} />} onClick={() => void own.reload()}>
            {t(`${P}.retry`)}
          </Button>
        </div>
      </>
    );
  } else if (!answer.configured) {
    // Not on this server yet: the row as it was (LT-331, LT-334).
    body = (
      <ComingSoonRow
        icon={Globe}
        title={t(`${P}.title`)}
        description={t(`${P}.desc`)}
        className="p-0 rounded-none border-0 border-solid bg-transparent dark:bg-transparent"
      />
    );
  } else if (domain && view) {
    const stage = domain.stage === 'certificate' ? 'certificate' : 'dns';
    const until = date(domain.expiresAt);
    const status =
      view === 'pending'
        ? { Icon: Clock, tone: 'text-blue-700 dark:text-blue-300', text: t(`${P}.status.${stage}`) }
        : view === 'active'
          ? { Icon: CheckCircle2, tone: 'text-emerald-700 dark:text-emerald-300', text: t(`${P}.activeBody`, { address: lightorHost }) }
          : view === 'error'
            ? { Icon: AlertTriangle, tone: 'text-red-600 dark:text-red-400', text: t(`${P}.errorBody`) }
            : {
                Icon: PauseCircle,
                tone: 'text-amber-800 dark:text-amber-200',
                text: until ? t(`${P}.pausedBody`, { address: lightorHost, date: until }) : t(`${P}.pausedBodyNoDate`, { address: lightorHost }),
              };
    const records = <DomainRecords host={domain.host} target={answer.target} />;
    body = (
      <>
        {header()}
        <div className="mt-4 space-y-4" data-testid="domain-card" data-view={view}>
          <div className="flex flex-wrap items-center gap-2 min-w-0">
            {view === 'active' ? (
              <a
                ref={(el) => { hostRef.current = el; }}
                href={`https://${domain.host}`}
                target="_blank"
                rel="noopener noreferrer"
                dir="ltr"
                className="min-w-0 inline-flex items-center gap-1.5 font-medium text-primary hover:underline break-all"
                data-testid="domain-host"
              >
                {domain.host}
                <ExternalLink className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              </a>
            ) : (
              <p
                ref={(el) => { hostRef.current = el; }}
                tabIndex={-1}
                dir="ltr"
                className="min-w-0 font-medium text-gray-900 dark:text-white break-all focus:outline-none"
                data-testid="domain-host"
              >
                {domain.host}
              </p>
            )}
            <StatusBadge status={view} i18nPrefix={`${P}.badge`} />
          </div>

          {/* One line that stays put and changes its words: a screen reader hears each step. */}
          <p role="status" className={`flex items-start gap-2 text-sm ${status.tone}`} data-testid="domain-status">
            <status.Icon className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
            <span className="min-w-0">{status.text}</span>
          </p>

          {view === 'pending' && (
            <div className="space-y-1 text-xs text-gray-500 dark:text-gray-400">
              <p>{t(`${P}.autoCheck`)}</p>
              {until && <p data-testid="domain-expires">{t(`${P}.pendingUntil`, { date: until })}</p>}
            </div>
          )}

          {view === 'paused' && plansLink}

          {/* Live: the records are done with, kept a tap away. */}
          {view === 'active' ? (
            <details className="group" data-testid="domain-records-fold">
              <summary className="cursor-pointer text-sm font-medium text-primary">{t(`${P}.records.summary`)}</summary>
              <div className="mt-3">{records}</div>
            </details>
          ) : (
            view !== 'paused' && records
          )}

          <div className="flex flex-wrap gap-2">
            {view !== 'paused' && (
              <Button
                variant="outline"
                size="sm"
                leftIcon={<RefreshCw size={14} />}
                isLoading={busy === 'check'}
                disabled={busy !== null}
                onClick={() => void checkNow()}
              >
                {t(`${P}.check`)}
              </Button>
            )}
            <Button
              variant="danger"
              size="sm"
              leftIcon={<Unlink size={14} />}
              isLoading={busy === 'disconnect'}
              disabled={busy !== null}
              onClick={() => void disconnect()}
            >
              {t(`${P}.disconnect`)}
            </Button>
          </div>
        </div>
      </>
    );
  } else if (!answer.allowed) {
    body = (
      <>
        {header(
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-500/15 dark:text-amber-200">
            <Lock className="h-3 w-3" aria-hidden="true" /> <bdi>{t(`${P}.locked.badge`)}</bdi>
          </span>
        )}
        <div className="mt-3 space-y-2" data-testid="domain-locked">
          <p className="text-sm text-gray-700 dark:text-gray-300">{t(`${P}.locked.body`)}</p>
          {plansLink}
        </div>
      </>
    );
  } else {
    body = (
      <>
        {header()}
        <form onSubmit={connect} className="mt-4 space-y-3" noValidate data-testid="domain-form">
          <div className="max-w-md">
            <Input
              ref={fieldRef}
              label={t(`${P}.form.label`)}
              value={typed}
              onChange={(e) => {
                setTyped(e.target.value);
                setFormError(null);
                // The record proves one name: another name, another record.
                setProof(null);
              }}
              placeholder="dana-studio.co.il"
              dir="ltr"
              inputMode="url"
              autoCapitalize="none"
              autoCorrect="off"
              autoComplete="off"
              spellCheck={false}
              helperText={t(`${P}.form.help`)}
              error={formError ?? undefined}
            />
          </div>
          <Button type="submit" variant="primary" size="sm" isLoading={busy === 'connect'} disabled={!typed.trim() || busy !== null}>
            {t(`${P}.form.connect`)}
          </Button>
          {proof && <DomainProofCard proof={proof} />}
        </form>
      </>
    );
  }

  // Named by its title wherever the title is this component's own (the
  // "coming soon" row draws its own).
  const named = !answer || answer.configured;
  return (
    <div
      role={named ? 'group' : undefined}
      aria-labelledby={named ? titleId : undefined}
      // Lighty's tour points here only where there is something to connect
      // (not at a row that still says "coming soon"); on every plan.
      data-tour={answer?.configured ? 'settings-domain' : undefined}
      data-testid="own-domain"
    >
      {body}
      {/* A refusal is said aloud as it lands; the field's own line stays for reading back. */}
      <p role="alert" className="sr-only" data-testid="domain-alert">{formError ?? ''}</p>
      {dialog}
    </div>
  );
};

export default DomainSection;
