import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Check, Loader2, MessageSquare, Undo2, X } from 'lucide-react';
import { assistantService, type LightyAction, type LightyActionItem } from '../../services/assistantApi';

/**
 * LT-561 — a change Lighty proposed, as the server wrote it from the owner's
 * own data: what will change, whether customers get a text, what else to
 * know - and Confirm / No. Nothing happens until Confirm. A done change that
 * texted no one can be undone for 10 minutes; a closed card says how it
 * ended, and that nothing changed when nothing did.
 */

const ymdParts = (ymd: string) => ymd.split('-').map(Number) as [number, number, number];
const dateLabel = (ymd: string, lang: string): string => {
  const [y, m, d] = ymdParts(ymd);
  return new Intl.DateTimeFormat(lang, { weekday: 'short', day: 'numeric', month: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, d)));
};
// 7 January 2024 was a Sunday: the weekday's name in the dashboard's language.
const weekdayLabel = (day: number, lang: string): string =>
  new Intl.DateTimeFormat(lang, { weekday: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(2024, 0, 7 + day)));

/** A clock or a range keeps left to right in a right-to-left line. */
const Ltr: React.FC<{ children: React.ReactNode }> = ({ children }) => <bdi dir="ltr">{children}</bdi>;

const when = (date: string | undefined, time: string | undefined, lang: string): React.ReactNode =>
  date ? <>{dateLabel(date, lang)}{time ? <> <Ltr>{time}</Ltr></> : null}</> : null;

export const LightyActionCard: React.FC<{ action: LightyAction; onChange: (next: LightyAction) => void }> = ({ action, onChange }) => {
  const { t, i18n } = useTranslation();
  const lang = (i18n.language || 'he').split('-')[0];
  // "before → after" in the line's own direction.
  const arrow = ['he', 'ar'].includes(lang) ? '←' : '→';
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  // The undo button goes when its 10 minutes do; a pending card turns expired at its time.
  const until = action.status === 'done' && action.undoUntil ? new Date(action.undoUntil).getTime() : action.status === 'pending' ? new Date(action.expiresAt).getTime() : 0;
  useEffect(() => {
    if (!until || until <= Date.now()) return;
    const timer = window.setTimeout(() => setNow(Date.now()), until - Date.now() + 50);
    return () => window.clearTimeout(timer);
  }, [until]);

  const status = action.status === 'pending' && new Date(action.expiresAt).getTime() <= now ? 'expired' : action.status;
  const canUndo = status === 'done' && !!action.undoUntil && new Date(action.undoUntil).getTime() > now;
  const { items, texts, notes } = action.card;

  const answer = async (verb: 'confirm' | 'decline' | 'undo') => {
    setBusy(true);
    setError(false);
    try {
      onChange(await assistantService[verb](action.id));
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  const hours = (h: string | null | undefined) => (h ? <Ltr>{h.replace(/,/g, ', ')}</Ltr> : t('lighty.action.closed'));
  const minutes = (n: number) =>
    n === 0 ? t('lighty.action.anyTime') : n === 60 ? t('lighty.action.oneHour') : n % 60 === 0 ? t('lighty.action.hoursN', { count: n / 60 }) : t('lighty.action.minutesN', { count: n });
  const days = (n: number) => (n === 1 ? t('lighty.action.oneDay') : t('lighty.action.daysN', { count: n }));
  const leadStatus = (s?: string) => (s ? t(`leads.status.${s}`) : '');

  const line = (item: LightyActionItem): React.ReactNode => {
    switch (action.kind) {
      case 'vacation_add':
      case 'vacation_remove':
        return <>{item.title}: {item.from && dateLabel(item.from, lang)}{item.to && item.to !== item.from ? <> - {dateLabel(item.to, lang)}</> : null}</>;
      case 'hours':
        return <>{item.date ? dateLabel(item.date, lang) : weekdayLabel(item.weekday ?? 0, lang)}: {hours(item.before)} {arrow} {hours(item.after)}{item.regular ? ` (${t('lighty.action.regular')})` : ''}</>;
      case 'booking_rules':
        return item.rule === 'cancelUntilMinutes'
          ? <>{t('lighty.action.cancelUntil')}: {minutes(item.was ?? 0)} {arrow} {minutes(item.becomes ?? 0)}</>
          : <>{t('lighty.action.bookAhead')}: {days(item.was ?? 0)} {arrow} {days(item.becomes ?? 0)}</>;
      case 'appointment_book':
        return <>{item.customer}{item.phone ? <> (<Ltr>{item.phone}</Ltr>)</> : null} · {when(item.date, item.time, lang)} · {item.service}</>;
      case 'appointment_move':
        return (
          <>
            {item.customer} · {when(item.date, item.time, lang)} · {item.service}
            {item.newDate && <span className="block font-medium">{arrow} {when(item.newDate, item.newTime, lang)}</span>}
            {item.newService && <span className="block font-medium">{arrow} {item.newService}</span>}
          </>
        );
      case 'appointment_cancel':
      case 'appointment_complete':
        return <>{item.customer} · {when(item.date, item.time, lang)} · {item.service}</>;
      case 'lead_status':
        return <>{item.customer}: {leadStatus(item.previous)} {arrow} {leadStatus(item.status)}</>;
      case 'lead_to_customer':
        return <>{item.customer}{item.received ? <> · {when(item.received.slice(0, 10), item.received.slice(11), lang)}</> : null}</>;
      case 'customer_note':
        return <>{item.customer}: “{item.note}”</>;
      case 'customer_block':
        return <>{item.customer}{item.reason ? <span className="block text-gray-500 dark:text-slate-400">{t('lighty.action.reason', { reason: item.reason })}</span> : null}</>;
      default:
        return null;
    }
  };

  const several = items.length > 1;
  const title = (() => {
    switch (action.kind) {
      case 'appointment_cancel': return several ? t('lighty.action.title.cancelMany', { count: items.length }) : t('lighty.action.title.cancelOne');
      case 'appointment_complete': return several ? t('lighty.action.title.completeMany', { count: items.length }) : t('lighty.action.title.completeOne');
      case 'lead_status': return several ? t('lighty.action.title.leadStatusMany', { count: items.length }) : t('lighty.action.title.leadStatusOne');
      case 'customer_block': return items[0]?.block === false ? t('lighty.action.title.unblock') : t('lighty.action.title.block');
      default: return t(`lighty.action.title.${action.kind}`);
    }
  })();

  const ended: Partial<Record<typeof status, string>> = {
    declined: t('lighty.action.declined'),
    expired: t('lighty.action.expired'),
    undone: t('lighty.action.undone'),
  };

  return (
    <div
      data-testid="lighty-action"
      className={`rounded-2xl border bg-white dark:bg-slate-900 px-3.5 py-3 text-sm shadow-sm ${
        status === 'pending' || status === 'running' ? 'border-violet-200 dark:border-violet-800/60' : 'border-gray-200 dark:border-slate-700'
      }`}
    >
      <p className="font-semibold text-gray-800 dark:text-white">{title}</p>
      <ul className="mt-1.5 space-y-1 text-gray-700 dark:text-slate-200">
        {items.map((item, i) => <li key={i} className="leading-snug">{line(item)}</li>)}
      </ul>
      {(status === 'pending' || status === 'running') && (
        <>
          <p className="mt-2 flex items-start gap-1.5 text-xs text-gray-500 dark:text-slate-400">
            <MessageSquare className="w-3.5 h-3.5 mt-0.5 shrink-0" aria-hidden="true" />
            {texts === 0 ? t('lighty.action.textsNone') : texts === 1 ? t('lighty.action.textsOne') : t('lighty.action.textsMany', { count: texts })}
          </p>
          {notes.map((note) => (
            <p key={note.key} className="mt-1 flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-300">
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" aria-hidden="true" />
              {t(`lighty.action.note.${note.key}`, { count: note.count })}
            </p>
          ))}
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void answer('confirm')}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium bg-gradient-to-r from-primary to-violet-500 text-white shadow-sm disabled:opacity-60"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Check className="w-4 h-4" aria-hidden="true" />}
              {t('lighty.action.confirm')}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void answer('decline')}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-300 disabled:opacity-60"
            >
              <X className="w-4 h-4" aria-hidden="true" />
              {t('lighty.action.decline')}
            </button>
          </div>
        </>
      )}
      {status === 'done' && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <p className="flex items-center gap-1.5 text-sm font-medium text-emerald-700 dark:text-emerald-300" role="status">
            <Check className="w-4 h-4" aria-hidden="true" />
            {action.failedItems ? t('lighty.action.donePartly', { count: action.failedItems }) : t('lighty.action.done')}
          </p>
          {canUndo && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void answer('undo')}
              className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-300 disabled:opacity-60"
            >
              <Undo2 className="w-3.5 h-3.5" aria-hidden="true" />
              {t('lighty.action.undo')}
            </button>
          )}
          {action.untold ? <p className="basis-full text-xs text-amber-700 dark:text-amber-300">{t('lighty.action.untold', { count: action.untold })}</p> : null}
        </div>
      )}
      {status === 'failed' && (
        <p className="mt-2 flex items-start gap-1.5 text-sm text-red-600 dark:text-red-400" role="status">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
          {t(`lighty.action.failed.${action.failure ?? 'failed'}`)}
        </p>
      )}
      {ended[status] && <p className="mt-2 text-sm text-gray-500 dark:text-slate-400" role="status">{ended[status]}</p>}
      {error && <p className="mt-2 text-xs text-red-600 dark:text-red-400" role="alert">{t('lighty.action.sendFailed')}</p>}
    </div>
  );
};
