import { describe, it, expect } from 'vitest';
import { bandHoursUnder, buildScale, markHours } from '../../utils/calendarScale';

/**
 * LT-359: hours nothing is in fold into thin bands, a run of them sharing
 * one; everything placed by time reads the same scale.
 */
const scaleOf = (busy: number[], open?: number[] | 'all') =>
  buildScale({
    firstHour: 6,
    lastHour: 22,
    hourPx: 88,
    bandPx: 32,
    busy: new Set(busy),
    open: open === 'all' ? 'all' : new Set(open ?? []),
  });

describe('the calendar scale (LT-359)', () => {
  it('folds each run of empty hours into one band, and keeps busy hours whole', () => {
    const scale = scaleOf([10, 14]);
    expect(scale.bands.map((b) => [b.from, b.to, b.top])).toEqual([
      [6, 10, 0],
      [11, 14, 32 + 88],
      [15, 22, 32 + 88 + 32 + 88],
    ]);
    expect(scale.total).toBe(3 * 32 + 2 * 88);
    // 10:30 is half way down its full hour, under the first band.
    expect(scale.yOf(10 * 60 + 30)).toBe(32 + 44);
    expect(scale.minutesAt(32 + 44)).toBe(10 * 60 + 30);
  });

  it('draws every hour in full when asked to, or while nothing folds', () => {
    expect(scaleOf([], 'all').total).toBe(16 * 88);
    expect(scaleOf([], 'all').bands).toEqual([]);
    expect(scaleOf(Array.from({ length: 16 }, (_, i) => 6 + i)).bands).toEqual([]);
  });

  it('keeps hours held open (a booking dragged over them) at full height', () => {
    const scale = scaleOf([10], [11, 12, 13]);
    expect(scale.bands.map((b) => [b.from, b.to])).toEqual([[6, 10], [14, 22]]);
    expect(scale.yOf(12 * 60)).toBe(32 + 2 * 88);
  });

  it('reads a time back from inside a band', () => {
    const scale = scaleOf([10]);
    // The 06:00-10:00 band is 32px: each hour 8px of it.
    expect(scale.minutesAt(4)).toBe(6 * 60 + 30);
    expect(scale.yOf(8 * 60)).toBe(16);
    expect(scale.minutesAt(-5)).toBe(6 * 60);
    expect(scale.minutesAt(10_000)).toBe(22 * 60);
  });

  it('marks the hours a span touches, and the whole bands one reaches into', () => {
    const hours = new Set<number>();
    markHours(10 * 60 + 45, 11 * 60 + 15, hours);
    markHours(17 * 60, 17 * 60, hours);
    expect([...hours].sort((a, b) => a - b)).toEqual([10, 11, 17]);

    const scale = scaleOf([10]);
    expect(bandHoursUnder(scale, 12 * 60, 13 * 60)).toEqual([11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21]);
    expect(bandHoursUnder(scale, 10 * 60, 11 * 60)).toEqual([]);
  });
});
