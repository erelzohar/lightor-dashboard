import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useMomentum, resetMomentumCache, readMoodPreview } from '../../hooks/useMomentum';
import { fetchLeadStats } from '../../services/leadsApi';
import { incomePeriods, samePointIn } from '../../components/dashboard/IncomeStats';

const state = { appointments: { appointments: [] as unknown[] } };
vi.mock('../../hooks/useAppSelector', () => ({
  useAppSelector: (selector: (s: typeof state) => unknown): unknown => selector(state),
}));
vi.mock('../../services/leadsApi', () => ({ fetchLeadStats: vi.fn() }));

/** A completed appointment at `at`, for a service of `price`. */
const done = (at: Date, price: string) => ({
  _id: String(at.getTime()),
  timestamp: String(at.getTime()),
  status: 'completed',
  type: { price, durationMS: '1800000' },
});

/** LT-385: Lighty's mood from this week against last week - inquiries and income. */
describe('useMomentum', () => {
  beforeEach(() => {
    resetMomentumCache();
    vi.mocked(fetchLeadStats).mockReset();
    state.appointments.appointments = [];
    sessionStorage.clear();
  });

  it("goes by the week's inquiries", async () => {
    vi.mocked(fetchLeadStats).mockResolvedValue({ thisWeek: 13, lastWeekToDate: 10 } as never);
    const { result } = renderHook(() => useMomentum());
    await waitFor(() => expect(result.current).toEqual({ mood: 2, kind: 'leads', pct: 30 }));
  });

  it("and by the week's income, when it is the better of the two", async () => {
    vi.mocked(fetchLeadStats).mockResolvedValue({ thisWeek: 2, lastWeekToDate: 2 } as never);
    const now = new Date();
    const { weeks } = incomePeriods(now);
    const thisWeek = weeks[weeks.length - 1];
    const lastWeek = samePointIn(weeks[weeks.length - 2], now, 'week');
    // Two done this week (at its start, already past), one last week to the same point.
    const at = (p: { start: Date }, minutes: number) => new Date(p.start.getTime() + minutes * 60_000);
    if (now.getTime() - thisWeek.start.getTime() < 2 * 60 * 60_000) return; // the week is minutes old: nothing done yet
    state.appointments.appointments = [done(at(thisWeek, 30), '200'), done(at(thisWeek, 90), '200'), done(at(lastWeek, 30), '200')];
    const { result } = renderHook(() => useMomentum());
    await waitFor(() => expect(result.current).toEqual({ mood: 3, kind: 'income', pct: 100 }));
  });

  it('is calm when the server has no week figures yet (an older API)', async () => {
    vi.mocked(fetchLeadStats).mockResolvedValue({ thisMonth: 4 } as never);
    const { result } = renderHook(() => useMomentum());
    await waitFor(() => expect(fetchLeadStats).toHaveBeenCalled());
    expect(result.current.mood).toBe(0);
  });

  it('asks nothing when off', () => {
    renderHook(() => useMomentum(false));
    expect(fetchLeadStats).not.toHaveBeenCalled();
  });

  it('shows a mood to look at with ?lightyMood, for this tab, until ?lightyMood=off', async () => {
    vi.mocked(fetchLeadStats).mockResolvedValue({ thisWeek: 2, lastWeekToDate: 2 } as never);
    expect(readMoodPreview('?lightyMood=3')).toBe(3);
    expect(readMoodPreview('')).toBe(3); // kept for the tab
    const { result } = renderHook(() => useMomentum());
    expect(result.current).toEqual({ mood: 3, kind: 'leads', pct: 80 });
    expect(readMoodPreview('?lightyMood=off')).toBeNull();
    expect(readMoodPreview('?lightyMood=7')).toBeNull();
  });
});
