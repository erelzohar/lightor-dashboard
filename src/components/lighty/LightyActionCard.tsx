import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle, Ban, CalendarCheck, CalendarClock, CalendarOff, CalendarPlus, CalendarX, Check, Clock, Loader2,
  MessageSquare, Settings2, StickyNote, Undo2, UserPlus, Users, X, type LucideIcon,
} from 'lucide-react';
import { assistantService, type LightyAction, type LightyActionItem, type LightyActionKind } from '../../services/assistantApi';

/**
 * LT-561 — a change Lighty proposed, as the server wrote it from the owner's
 * own data: what will change, whether customers get a text, what else to
 * know - and Confirm / No. Nothing happens until Confirm. A done change that
 * texted no one can be undone for 10 minutes; a closed card says how it
 * ended, and that nothing changed when nothing did.
 *
 * LT-562 (Erel: "messy and unreadable"): every line is its subject on top,
 * then what it is now and what it becomes as separate chips - each time
 * range its own left-to-right chip - so nothing runs together in a
 * right-to-left sentence.
 */

const ymdParts = (ymd: string) => ymd.split('-').map(Number) as [number, number, number];
const dateLabel = (ymd: string, lang: string): string => {
  const [y, m, d] = ymdParts(ymd);
  return new Intl.DateTimeFormat(lang, { weekday: 'short', day: 'numeric', month: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, d)));
};
// 7 January 2024 was a Sunday: the weekday's name in the dashboard's language.
const weekdayLabel = (day: number, lang: string): string =>
  new Intl.DateTimeFormat(lang, { weekday: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(2024, 0, 7 + day)));

const ICONS: Record<LightyActionKind, LucideIcon> = {
  vacation_add: CalendarOff,
  vacation_remove: CalendarCheck,
  hours: Clock,
  booking_rules: Settings2,
  appointment_book: CalendarPlus,
  appointment_move: CalendarClock,
  appointment_cancel: CalendarX,
  appointment_complete: CalendarCheck,
  lead_status: Users,
  lead_to_customer: UserPlus,
  customer_note: StickyNote,
  customer_block: Ban,
};

type Tone = 'old' | 'new' | 'closed' | 'plain';
const TONES: Record<Tone, string> = {
  old: 'bg-gray-100 text-gray-500 line-through decoration-gray-400/70 dark:bg-slate-800 dark:text-slate-400',
  new: 'bg-violet-100 text-violet-800 dark:bg-violet-900/50 dark:text-violet-100',
  closed: 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300',
  plain: 'bg-gray-50 text-gray-700 border border-gray-200 dark:bg-slate-800/70 dark:text-slate-200 dark:border-slate-700',
};

/** One value; a clock or a range reads left to right in any line. */
const Chip: React.FC<{ tone: Tone; ltr?: boolean; children: React.ReactNode }> = ({ tone, ltr = false, children }) => (
  <span dir={ltr ? 'ltr' : undefined} className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium whitespace-nowrap ${TONES[tone]}`}>
    {children}
  </span>
);

export const LightyActionCard: React.FC<{ action: LightyAction; onChange: (next: LightyAction) => void }> = ({ action, onChange }) => {
  const { t, i18n } = useTranslation();
  const lang = (i18n.language || 'he').split('-')[0];
  // "now → after" in the line's own direction.
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
  const Icon = ICONS[action.kind] ?? Clock;

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

  const minutes = (n: number) =>
    n === 0 ? t('lighty.action.anyTime') : n === 60 ? t('lighty.action.oneHour') : n % 60 === 0 ? t('lighty.action.hoursN', { count: n / 60 }) : t('lighty.action.minutesN', { count: n });
  const days = (n: number) => (n === 1 ? t('lighty.action.oneDay') : t('lighty.action.daysN', { count: n }));
  const leadStatus = (s?: string) => (s ? t(`leads.status.${s}`) : '');

  /** A day's hours as chips, one per range; closed is one chip. */
  const hours = (h: string | null | undefined, tone: 'old' | 'new') =>
    h
      ? h.split(',').map((range) => <Chip key={range} tone={tone} ltr>{range.replace('-', '–')}</Chip>)
      : <Chip tone={tone === 'old' ? 'old' : 'closed'}>{t('lighty.action.closed')}</Chip>;

  /** What it is now, an arrow, what it becomes. */
  const change = (from: React.ReactNode, to: React.ReactNode) => (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="flex flex-wrap gap-1">{from}</span>
      <span className="text-gray-400 dark:text-slate-500 text-sm leading-none" aria-hidden="true">{arrow}</span>
      <span className="flex flex-wrap gap-1">{to}</span>
    </div>
  );

  /** A booking's day, time and service. */
  const slot = (date: string | undefined, time: string | undefined, service: string | undefined, tone: Tone = 'plain') => (
    <span className="flex flex-wrap gap-1">
      {date && <Chip tone={tone}>{dateLabel(date, lang)}</Chip>}
      {time && <Chip tone={tone} ltr>{time}</Chip>}
      {service && <Chip tone={tone === 'old' ? 'old' : 'plain'}>{service}</Chip>}
    </span>
  );

  const row = (item: LightyActionItem): { head: React.ReactNode; body: React.ReactNode } => {
    switch (action.kind) {
      case 'vacation_add':
      case 'vacation_remove': {
        const range = <>{item.from && dateLabel(item.from, lang)}{item.to && item.to !== item.from ? <> – {dateLabel(item.to, lang)}</> : null}</>;
        return { head: item.title, body: <Chip tone={action.kind === 'vacation_remove' ? 'old' : 'new'}>{range}</Chip> };
      }
      case 'hours':
        return {
          head: item.date ? dateLabel(item.date, lang) : weekdayLabel(item.weekday ?? 0, lang),
          body: (
            <>
              {change(hours(item.before, 'old'), hours(item.after, 'new'))}
              {item.regular && <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">{t('lighty.action.regular')}</p>}
            </>
          ),
        };
      case 'booking_rules':
        return item.rule === 'cancelUntilMinutes'
          ? { head: t('lighty.action.cancelUntil'), body: change(<Chip tone="old">{minutes(item.was ?? 0)}</Chip>, <Chip tone="new">{minutes(item.becomes ?? 0)}</Chip>) }
          : { head: t('lighty.action.bookAhead'), body: change(<Chip tone="old">{days(item.was ?? 0)}</Chip>, <Chip tone="new">{days(item.becomes ?? 0)}</Chip>) };
      case 'appointment_book':
        return {
          head: <>{item.customer}{item.phone && <span className="block text-xs font-normal text-gray-500 dark:text-slate-400"><bdi dir="ltr">{item.phone}</bdi></span>}</>,
          body: slot(item.date, item.time, item.service, 'new'),
        };
      case 'appointment_move':
        return {
          head: item.customer,
          body: (
            <div className="space-y-1">
              {item.newDate || item.newTime
                ? change(slot(item.date, item.time, undefined, 'old'), slot(item.newDate, item.newTime, undefined, 'new'))
                : slot(item.date, item.time, undefined)}
              {item.newService ? change(<Chip tone="old">{item.service}</Chip>, <Chip tone="new">{item.newService}</Chip>) : <Chip tone="plain">{item.service}</Chip>}
            </div>
          ),
        };
      case 'appointment_cancel':
        return { head: item.customer, body: slot(item.date, item.time, item.service, 'old') };
      case 'appointment_complete':
        return { head: item.customer, body: slot(item.date, item.time, item.service) };
      case 'lead_status':
        return { head: item.customer, body: change(<Chip tone="old">{leadStatus(item.previous)}</Chip>, <Chip tone="new">{leadStatus(item.status)}</Chip>) };
      case 'lead_to_customer':
        return { head: item.customer, body: item.received ? slot(item.received.slice(0, 10), item.received.slice(11), undefined) : null };
      case 'customer_note':
        return {
          head: item.customer,
          body: <p className="rounded-lg border-s-2 border-violet-300 dark:border-violet-700 bg-violet-50/60 dark:bg-violet-950/30 px-2.5 py-1.5 text-sm text-gray-700 dark:text-slate-200 whitespace-pre-line break-words">{item.note}</p>,
        };
      case 'customer_block':
        return { head: item.customer, body: item.reason ? <p className="text-xs text-gray-500 dark:text-slate-400">{t('lighty.action.reason', { reason: item.reason })}</p> : null };
      default:
        return { head: null, body: null };
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
  const open = status === 'pending' || status === 'running';

  return (
    <div
      data-testid="lighty-action"
      className={`rounded-2xl border bg-white dark:bg-slate-900 p-3.5 text-sm shadow-sm ${open ? 'border-violet-200 dark:border-violet-800/60' : 'border-gray-200 dark:border-slate-700'}`}
    >
      <div className="flex items-center gap-2">
        <span className={`inline-flex w-7 h-7 shrink-0 items-center justify-center rounded-full ${open ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/60 dark:text-violet-200' : 'bg-gray-100 text-gray-500 dark:bg-slate-800 dark:text-slate-400'}`}>
          <Icon className="w-4 h-4" aria-hidden="true" />
        </span>
        <p className="font-semibold text-gray-800 dark:text-white">{title}</p>
      </div>
      <ul className="mt-2.5 divide-y divide-gray-100 dark:divide-slate-800">
        {items.map((item, i) => {
          const { head, body } = row(item);
          return (
            <li key={i} className="py-2 first:pt-0 last:pb-0">
              {head && <p className="text-sm font-medium text-gray-800 dark:text-slate-100 break-words">{head}</p>}
              {body && <div className="mt-1">{body}</div>}
            </li>
          );
        })}
      </ul>
      {open && (
        <>
          <div className="mt-3 space-y-1 rounded-xl bg-gray-50 dark:bg-slate-800/50 px-2.5 py-2">
            <p className="flex items-start gap-1.5 text-xs text-gray-600 dark:text-slate-300">
              <MessageSquare className="w-3.5 h-3.5 mt-0.5 shrink-0" aria-hidden="true" />
              {texts === 0 ? t('lighty.action.textsNone') : texts === 1 ? t('lighty.action.textsOne') : t('lighty.action.textsMany', { count: texts })}
            </p>
            {notes.map((note) => (
              <p key={note.key} className="flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-300">
                <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" aria-hidden="true" />
                {t(`lighty.action.note.${note.key}`, { count: note.count })}
              </p>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void answer('confirm')}
              className="inline-flex flex-1 sm:flex-none justify-center items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium bg-gradient-to-r from-primary to-violet-500 text-white shadow-sm disabled:opacity-60"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Check className="w-4 h-4" aria-hidden="true" />}
              {t('lighty.action.confirm')}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void answer('decline')}
              className="inline-flex flex-1 sm:flex-none justify-center items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-300 disabled:opacity-60"
            >
              <X className="w-4 h-4" aria-hidden="true" />
              {t('lighty.action.decline')}
            </button>
          </div>
        </>
      )}
      {status === 'done' && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
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
        <p className="mt-3 flex items-start gap-1.5 text-sm text-red-600 dark:text-red-400" role="status">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
          {t(`lighty.action.failed.${action.failure ?? 'failed'}`)}
        </p>
      )}
      {ended[status] && <p className="mt-3 text-sm text-gray-500 dark:text-slate-400" role="status">{ended[status]}</p>}
      {error && <p className="mt-2 text-xs text-red-600 dark:text-red-400" role="alert">{t('lighty.action.sendFailed')}</p>}
    </div>
  );
};
