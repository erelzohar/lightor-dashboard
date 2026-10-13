import { describe, it, expect } from 'vitest';
import type { TFunction } from 'i18next';
import { greetingEmoji, greetingFor } from '../../lib/greeting';

const t = ((k: string) => k) as unknown as TFunction;

/** LT-269: the greeting moved to Lighty's bubble; 04:00 is night, not afternoon. */
describe('greetingFor', () => {
  it.each([
    [0, 'greetings.night'],
    [4, 'greetings.night'],
    [5, 'greetings.morning'],
    [11, 'greetings.morning'],
    [12, 'greetings.afternoon'],
    [17, 'greetings.afternoon'],
    [18, 'greetings.evening'],
    [23, 'greetings.evening'],
  ])('%i:00 → %s', (hour, key) => {
    expect(greetingFor(t, hour)).toBe(key);
  });
});

/** LT-294: three kinds — morning, afternoon, evening and night together. */
describe('greetingEmoji', () => {
  it.each([
    [0, '🌙'],
    [4, '🌙'],
    [5, '🌅'],
    [11, '🌅'],
    [12, '☀️'],
    [17, '☀️'],
    [18, '🌙'],
    [23, '🌙'],
  ])('%i:00 → %s', (hour, emoji) => {
    expect(greetingEmoji(hour)).toBe(emoji);
  });
});
