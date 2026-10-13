import type { TFunction } from 'i18next';

/**
 * The time-of-day greeting (moved out of the home page in LT-269, where Lighty
 * now says it in his speech bubble). Night until 05:00 — 04:00 used to fall
 * through to "good afternoon".
 */
export const greetingFor = (t: TFunction, hour = new Date().getHours()): string => {
  if (hour < 5) return t('greetings.night');
  if (hour < 12) return t('greetings.morning');
  if (hour < 18) return t('greetings.afternoon');
  return t('greetings.evening');
};

/**
 * LT-294: a sun or a moon after Lighty's greeting — three kinds, as Erel
 * asked: sunrise for the morning, the sun for the afternoon, the moon for
 * the evening and the night. Same hours as greetingFor.
 */
export const greetingEmoji = (hour = new Date().getHours()): string => {
  if (hour < 5) return '🌙';
  if (hour < 12) return '🌅';
  if (hour < 18) return '☀️';
  return '🌙';
};
