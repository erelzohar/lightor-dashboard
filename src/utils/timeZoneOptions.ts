import { DEFAULT_TIME_ZONE, gmtOffsetLabel, isValidTimeZone, zoneOffsetMs } from './businessTime';

/**
 * The business's time zone picker (LT-318, Settings → Business): every zone
 * the browser knows, each as its city and its offset today — "Jerusalem
 * (GMT+3)" — west to east.
 */

// A browser without Intl.supportedValuesOf (Safari before 15.4) still offers these.
const FALLBACK_ZONES = [
  'Asia/Jerusalem',
  'Europe/London',
  'Europe/Paris',
  'America/New_York',
  'America/Los_Angeles',
  'Asia/Dubai',
];

const supportedTimeZones = (): string[] => {
  try {
    const supportedValuesOf = (Intl as unknown as { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf;
    const zones = supportedValuesOf?.call(Intl, 'timeZone');
    if (Array.isArray(zones) && zones.length) return zones;
  } catch {
    /* an engine that has it but refuses the key */
  }
  return FALLBACK_ZONES;
};

/** "America/Argentina/Buenos_Aires" → "Buenos Aires". */
export const timeZoneCity = (tz: string): string => (tz.split('/').pop() ?? tz).replace(/_/g, ' ');

export interface TimeZoneOption {
  value: string;
  label: string;
}

/** Every zone, the current one and the server's default always among them. */
export const timeZoneOptions = (current: string | undefined, now = Date.now()): TimeZoneOption[] => {
  const zones = new Set(supportedTimeZones().filter(isValidTimeZone));
  zones.add(DEFAULT_TIME_ZONE);
  if (isValidTimeZone(current)) zones.add(current);
  return Array.from(zones)
    .map((tz) => ({
      value: tz,
      label: `${timeZoneCity(tz)} (${gmtOffsetLabel(tz, now)})`,
      offset: zoneOffsetMs(now, tz),
    }))
    .sort((a, b) => a.offset - b.offset || a.label.localeCompare(b.label))
    .map(({ value, label }) => ({ value, label }));
};
