/**
 * LT-385: how the week is going, as Lighty feels it. This week so far
 * (Sunday to now) against last week up to the same weekday and hour - for
 * inquiries (the server counts them, /api/leads/stats) and for income (the
 * income card's own sums, components/dashboard/IncomeStats). The better of
 * the two sets his mood: his bolt crackles and he gets happier as it rises.
 */

export type Mood = 0 | 1 | 2 | 3;

export interface WeekFigure {
  /** This week so far. */
  now: number;
  /** Last week up to the same point. */
  before: number;
  /** How many things make up `now` - inquiries, or completed appointments. */
  count: number;
}

/** Fewer than this this week says nothing yet (one inquiry against none is not +100%). */
export const MIN_COUNT = 2;

/** The week's change in percent, or null when there is nothing to tell. */
export function weekChange(f: WeekFigure): number | null {
  if (f.count < MIN_COUNT) return null;
  if (f.before <= 0) return f.now > 0 ? 100 : null;
  return ((f.now - f.before) / f.before) * 100;
}

/** Under +10% he is his calm self; +10% a light spark; +30% cheers; +60% he dances. */
export function moodFor(pct: number | null): Mood {
  if (pct === null || pct < 10) return 0;
  if (pct < 30) return 1;
  if (pct < 60) return 2;
  return 3;
}

export interface Momentum {
  mood: Mood;
  /** Which figure set it - what his speech bubble talks about. */
  kind: 'leads' | 'income' | null;
  /** That figure's change, rounded; null when neither says anything. */
  pct: number | null;
}

export function momentum(leads: WeekFigure | null, income: WeekFigure | null): Momentum {
  const l = leads ? weekChange(leads) : null;
  const i = income ? weekChange(income) : null;
  if (l === null && i === null) return { mood: 0, kind: null, pct: null };
  const [kind, pct] = (l ?? -Infinity) >= (i ?? -Infinity) ? (['leads', l] as const) : (['income', i] as const);
  return { mood: moodFor(pct), kind, pct: pct === null ? null : Math.round(pct) };
}
