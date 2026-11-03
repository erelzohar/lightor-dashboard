import type { Appointment, DateOverride } from '../types';
import { hoursForDate, localDateKey } from './bookingSlots';
import { DEFAULT_TIME_ZONE, zonedDateKey, zonedParts, zonedSlotMs } from './businessTime';
import { parseIntervals } from './ownerSchedule';

/**
 * LT-566: the ready questions on Lighty's page and in the floating Lighty,
 * picked from what the dashboard already holds - no AI call. A question that
 * does not apply is left out (Friday already closed, no new leads), one that
 * fits now comes first (the new leads, today's bookings in the morning and
 * tomorrow's in the evening), and a number says how many when it is known.
 * The chip sends its question alone; the number is only on the chip.
 */
export type SuggestKey =
  | 'today' | 'tomorrow' | 'tomorrowFree' | 'week' | 'weekAhead' | 'leads' | 'newLeads'
  | 'regulars' | 'blockDay' | 'month' | 'lastMonth' | 'services' | 'howHours' | 'products' | 'addProduct'
  | 'topProducts' | 'visits';

export interface Suggestion {
  key: SuggestKey;
  /** How many, shown on the chip: bookings on that day, leads waiting. */
  count?: number;
}

export interface SuggestFacts {
  /** 'lead' is a leads site (utils/siteMode); anything else books. */
  conversion?: 'book' | 'lead';
  timeZone?: string;
  workingDays?: (string | null)[];
  dateOverrides?: DateOverride[];
  vacations?: { startDate: string; endDate: string }[];
  /** The store's appointments, and whether they have been read yet (an empty list before that means "not yet"). */
  appointments: Appointment[];
  appointmentsLoaded: boolean;
  /** Leads still 'new' (/api/leads/stats); null while unknown. */
  waitingLeads: number | null;
  /** The site shows products (LT-540), and how many it has when the summary is there. */
  catalog?: boolean;
  productsTotal?: number;
}

/** From this hour on the business's clock, "what do I have" means tomorrow. */
export const EVENING_HOUR = 17;
/** Up to this day of the month, the summary asked for is last month's. */
const LAST_MONTH_UNTIL = 3;
const BOOKING_MAX = 6;
const LEADS_MAX = 5;
const FRIDAY = 5;

const addDays = (day: Date, n: number): Date => new Date(day.getFullYear(), day.getMonth(), day.getDate() + n);

/** The business is open on this carrier day: it has hours and no vacation over its opening. */
const openOn = (facts: SuggestFacts, day: Date, timeZone: string): boolean => {
  const intervals = parseIntervals(hoursForDate({ workingDays: facts.workingDays ?? [], dateOverrides: facts.dateOverrides }, day));
  if (!intervals.length) return false;
  const opening = zonedSlotMs(day, 0, intervals[0].startMin, timeZone);
  return !facts.vacations?.some((v) => opening >= Number(v.startDate) && opening < Number(v.endDate));
};

/** Bookings still ahead on this carrier day (today: from now on). */
const bookingsOn = (facts: SuggestFacts, day: Date, timeZone: string, now: number): number => {
  const key = localDateKey(day);
  return facts.appointments.filter((a) => {
    const at = Number(a.timestamp);
    return a.status === 'scheduled' && at > now && zonedDateKey(at, timeZone) === key;
  }).length;
};

const counted = (key: SuggestKey, count: number | undefined): Suggestion =>
  (count && count > 0 ? { key, count } : { key });

const leadsChip = (waiting: number | null): Suggestion | null => {
  if (waiting === null) return { key: 'leads' };
  return waiting > 0 ? { key: 'newLeads', count: waiting } : null;
};

// LT-569: with products on the site, the most viewed of them.
const productsChip = (facts: SuggestFacts): Suggestion | null => {
  if (!facts.catalog) return null;
  if (facts.productsTotal === 0) return { key: 'addProduct' };
  return { key: facts.productsTotal ? 'topProducts' : 'products' };
};

export const lightySuggestions = (facts: SuggestFacts, now = Date.now()): Suggestion[] => {
  const timeZone = facts.timeZone || DEFAULT_TIME_ZONE;
  const clock = zonedParts(now, timeZone);
  const today = new Date(clock.year, clock.month, clock.day);
  const tomorrow = addDays(today, 1);
  const list: (Suggestion | null)[] = [];

  if (facts.conversion === 'lead') {
    list.push(
      leadsChip(facts.waitingLeads),
      { key: clock.day <= LAST_MONTH_UNTIL ? 'lastMonth' : 'month' },
      // LT-569: a leads site's visits are counted.
      { key: 'visits' },
      productsChip(facts),
      { key: 'services' },
      { key: 'howHours' },
    );
    return list.filter((s): s is Suggestion => s !== null).slice(0, LEADS_MAX);
  }

  const known = facts.appointmentsLoaded;
  const todayLeft = known ? bookingsOn(facts, today, timeZone, now) : 0;
  // The evening asks about tomorrow; so does a closed day with nothing left on it.
  const askTomorrow = clock.hour >= EVENING_HOUR || (known && todayLeft === 0 && !openOn(facts, today, timeZone));
  list.push(askTomorrow
    ? counted('tomorrow', known ? bookingsOn(facts, tomorrow, timeZone, now) : undefined)
    : counted('today', todayLeft));

  list.push(leadsChip(facts.waitingLeads));
  if (openOn(facts, tomorrow, timeZone)) list.push({ key: 'tomorrowFree' });
  // The week starts on Sunday: at its start the question is what it holds.
  list.push({ key: today.getDay() <= 1 ? 'weekAhead' : 'week' });
  list.push(productsChip(facts));
  // No one has booked yet: no regulars to ask about.
  if (!known || facts.appointments.some((a) => Number(a.timestamp) <= now)) list.push({ key: 'regulars' });
  // The coming Friday, after today: offered only while it is open.
  const friday = addDays(today, ((FRIDAY - today.getDay() + 6) % 7) + 1);
  if (openOn(facts, friday, timeZone)) list.push({ key: 'blockDay' });

  return list.filter((s): s is Suggestion => s !== null).slice(0, BOOKING_MAX);
};
