import { useEffect, useMemo, useState } from 'react';
import { useAppSelector } from './useAppSelector';
import { fetchLeadStats } from '../services/leadsApi';
import { incomeIn, incomePeriods, samePointIn } from '../components/dashboard/IncomeStats';
import { momentum, type Momentum, type WeekFigure } from '../utils/momentum';

/**
 * LT-385: the week so far against last week to the same point, for Lighty's
 * mood on every screen. Income comes from the appointments already in the
 * store (the home page and the calendar load them; until then he goes by
 * inquiries alone); inquiries from /api/leads/stats, asked at most every ten
 * minutes however many Lightys ask.
 */

const REFRESH_MS = 10 * 60 * 1000;
const NO_APPOINTMENTS: never[] = [];
let cached: { at: number; leads: WeekFigure | null } | null = null;
let inflight: Promise<WeekFigure | null> | null = null;

const leadsWeek = (): Promise<WeekFigure | null> => {
  if (cached && Date.now() - cached.at < REFRESH_MS) return Promise.resolve(cached.leads);
  if (inflight) return inflight;
  inflight = fetchLeadStats()
    .then((s) => (typeof s.thisWeek === 'number' ? { now: s.thisWeek, before: s.lastWeekToDate ?? 0, count: s.thisWeek } : null))
    .catch(() => null)
    .then((leads) => {
      cached = { at: Date.now(), leads };
      inflight = null;
      return leads;
    });
  return inflight;
};

/** For tests: forget the cached inquiries. */
export const resetMomentumCache = () => { cached = null; inflight = null; };

export function useMomentum(enabled = true): Momentum {
  const appointments = useAppSelector((s) => s.appointments?.appointments) ?? NO_APPOINTMENTS;
  const [leads, setLeads] = useState<WeekFigure | null>(cached?.leads ?? null);
  // Moves "now" along, so the week's cut-off point keeps up.
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let live = true;
    const load = () => { void leadsWeek().then((l) => { if (live) setLeads(l); }); };
    load();
    const id = window.setInterval(() => { load(); setTick((n) => n + 1); }, REFRESH_MS);
    return () => { live = false; window.clearInterval(id); };
  }, [enabled]);

  return useMemo(() => {
    if (!enabled) return { mood: 0, kind: null, pct: null };
    const now = new Date();
    const { weeks } = incomePeriods(now);
    const thisWeek = weeks[weeks.length - 1];
    const lastWeek = samePointIn(weeks[weeks.length - 2], now, 'week');
    const cur = incomeIn(appointments, thisWeek);
    const prev = incomeIn(appointments, lastWeek);
    const income = appointments.length ? { now: cur.income, before: prev.income, count: cur.count } : null;
    return momentum(leads, income);
    // `tick` moves "now" on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, appointments, leads, tick]);
}
