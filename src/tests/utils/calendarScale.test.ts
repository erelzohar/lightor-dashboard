import { describe, it, expect } from 'vitest';
import { buildScale, markHours } from '../../utils/calendarScale';

/**
 * LT-359: an hour nothing is in is drawn shorter (its label kept); every
 * thing placed by time reads the same scale.
 */
const scaleOf = (busy: number[], open?: number[] | 'all') =>
  buildScale({
    firstHour: 6,
    lastHour: 22,
    hourPx: 88,
    foldedPx: 34,
    busy: new Set(busy),
    open: open === 'all' ? 'all' : new Set(open ?? []),
  });

describe('the calendar scale (LT-359)', () => {
  it('folds each empty hour on its own and keeps busy hours whole', () => {
    const scale = scaleOf([10, 14]);
    expect(scale.rows.filter((r) => !r.folded).map((r) => r.hour)).toEqual([10, 14]);
    expect(scale.rows).toHaveLength(16);
    expect(scale.total).toBe(14 * 34 + 2 * 88);
    // 10:30 is half way down its full hour, under four folded ones.
    expect(scale.yOf(10 * 60 + 30)).toBe(4 * 34 + 44);
    expect(scale.minutesAt(4 * 34 + 44)).toBe(10 * 60 + 30);
  });

  it('draws every hour in full when asked to', () => {
    expect(scaleOf([], 'all').total).toBe(16 * 88);
    expect(scaleOf([], 'all').rows.some((r) => r.folded)).toBe(false);
  });

  it('keeps hours held open (a booking dragged over them) at full height', () => {
    const scale = scaleOf([10], [11, 12]);
    expect(scale.rows.filter((r) => !r.folded).map((r) => r.hour)).toEqual([10, 11, 12]);
    expect(scale.yOf(13 * 60)).toBe(4 * 34 + 3 * 88);
  });

  it('reads a time back from inside a folded hour, and clamps outside the day', () => {
    const scale = scaleOf([10]);
    expect(scale.minutesAt(17)).toBe(6 * 60 + 30);
    expect(scale.yOf(8 * 60)).toBe(68);
    expect(scale.minutesAt(-5)).toBe(6 * 60);
    expect(scale.minutesAt(10_000)).toBe(22 * 60);
  });

  it('marks the hours a span touches', () => {
    const hours = new Set<number>();
    markHours(10 * 60 + 45, 11 * 60 + 15, hours);
    markHours(17 * 60, 17 * 60, hours);
    expect([...hours].sort((a, b) => a - b)).toEqual([10, 11, 17]);
  });
});
