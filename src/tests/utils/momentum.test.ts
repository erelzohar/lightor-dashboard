import { describe, it, expect } from 'vitest';
import { MIN_COUNT, momentum, moodFor, weekChange } from '../../utils/momentum';

/** LT-385: how the week is going against last week, as Lighty feels it. */
describe('the week against last week', () => {
  it('measures the change, and says nothing on too little', () => {
    expect(weekChange({ now: 15, before: 10, count: 15 })).toBe(50);
    expect(weekChange({ now: 8, before: 10, count: 8 })).toBe(-20);
    // Nothing last week: up, if this week has enough to mean it.
    expect(weekChange({ now: 3, before: 0, count: 3 })).toBe(100);
    // One inquiry is not a trend.
    expect(weekChange({ now: 1, before: 0, count: MIN_COUNT - 1 })).toBeNull();
    expect(weekChange({ now: 0, before: 0, count: 0 })).toBeNull();
  });

  it('turns the change into his mood', () => {
    expect(moodFor(null)).toBe(0);
    expect(moodFor(-40)).toBe(0);
    expect(moodFor(9.9)).toBe(0);
    expect(moodFor(10)).toBe(1);
    expect(moodFor(29)).toBe(1);
    expect(moodFor(30)).toBe(2);
    expect(moodFor(59)).toBe(2);
    expect(moodFor(60)).toBe(3);
    expect(moodFor(250)).toBe(3);
  });

  it('goes by the better of inquiries and income', () => {
    expect(momentum({ now: 12, before: 10, count: 12 }, { now: 1800, before: 1000, count: 6 })).toEqual({ mood: 3, kind: 'income', pct: 80 });
    expect(momentum({ now: 14, before: 10, count: 14 }, { now: 900, before: 1000, count: 4 })).toEqual({ mood: 2, kind: 'leads', pct: 40 });
    expect(momentum(null, { now: 1150, before: 1000, count: 5 })).toEqual({ mood: 1, kind: 'income', pct: 15 });
    expect(momentum(null, null)).toEqual({ mood: 0, kind: null, pct: null });
    // Down on both: calm, but the figure is still known.
    expect(momentum({ now: 5, before: 10, count: 5 }, null)).toEqual({ mood: 0, kind: 'leads', pct: -50 });
  });
});
