import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import { businessDateKey, businessDay, businessTimeOfDay, businessTimeToMs } from '../../utils/businessTime';
import { slotTimestamp } from '../../utils/bookingSlots';
import { freeSlots, isPastDay, sessionsOnDay, type ScheduleFacts } from '../../utils/ownerSchedule';
import { ChoiceSummary, DayTimes } from '../../components/customers/BookingSteps';
import type { AppointmentType } from '../../types';

/**
 * LT-315 (M1) — the owner's manual booking works on Israel's clock whatever
 * zone the device is in: an owner whose phone was on London time booked
 * 16:00 and stored 18:00 Israel time. Each block runs with the process's
 * zone switched to one that is not Israel's — west of it, and east of it,
 * where a calendar day built at local midnight is still yesterday in Israel.
 */
const { t } = vi.hoisted(() => ({ t: (key: string) => key }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t }) }));
vi.mock('../../contexts/ThemeContext', () => ({ useTheme: () => ({ language: 'en', direction: 'ltr' }) }));

const ZONES = ['Europe/London', 'America/New_York', 'Australia/Sydney', 'UTC'];
const original = process.env.TZ;

describe.each(ZONES)('on a device in %s', (zone) => {
  beforeAll(() => {
    process.env.TZ = zone;
  });
  afterAll(() => {
    // Assigning undefined would set the string "undefined".
    if (original === undefined) delete process.env.TZ;
    else process.env.TZ = original;
  });

  it('the device really is elsewhere', () => {
    expect(new Date(Date.UTC(2026, 9, 24, 12)).getTimezoneOffset()).not.toBe(-180);
  });

  it("turns Israel's wall clock into instants across the clock changes", () => {
    // Summer time (UTC+3) until 2026-10-25 02:00, then UTC+2.
    expect(businessTimeToMs(2026, 9, 24, 9)).toBe(Date.UTC(2026, 9, 24, 6));
    expect(businessTimeToMs(2026, 9, 25, 9)).toBe(Date.UTC(2026, 9, 25, 7));
    expect(businessTimeToMs(2026, 9, 26, 16)).toBe(Date.UTC(2026, 9, 26, 14));
    // And forward again on 2027-03-26.
    expect(businessTimeToMs(2027, 2, 25, 9)).toBe(Date.UTC(2027, 2, 25, 7));
    expect(businessTimeToMs(2027, 2, 26, 9)).toBe(Date.UTC(2027, 2, 26, 6));
    // Month overflow rolls over as Date.UTC's does (the month-end bound).
    expect(businessTimeToMs(2026, 12, 1)).toBe(businessTimeToMs(2027, 0, 1));
  });

  it("reads an instant's day and time on Israel's clock", () => {
    const halfPastMidnight = Date.UTC(2026, 9, 24, 21, 30); // 00:30 on the 25th in Israel
    expect(businessDateKey(halfPastMidnight)).toBe('2026-10-25');
    expect(businessTimeOfDay(halfPastMidnight)).toBe('00:30');
    const day = businessDay(halfPastMidnight);
    expect([day.getFullYear(), day.getMonth(), day.getDate()]).toEqual([2026, 9, 25]);
  });

  it('a 16:00 slot stores 16:00 Israel time', () => {
    expect(slotTimestamp(new Date(2026, 9, 26), '16:00')).toBe(Date.UTC(2026, 9, 26, 14));
    expect(slotTimestamp(new Date(2026, 9, 22), '16:00')).toBe(Date.UTC(2026, 9, 22, 13));
  });

  it("offers the business's hours, taken and past times by Israel's clock", () => {
    const facts: ScheduleFacts = {
      // Sunday 2026-10-25, the day the clocks go back.
      workingDays: ['09:00-11:00', null, null, null, null, null, null],
      busy: [{ timestamp: String(Date.UTC(2026, 9, 25, 7, 30)), durationMS: String(30 * 60_000) }], // 09:30 Israel
      classes: [],
    };
    const sunday = new Date(2026, 9, 25);
    // 08:00 in Israel: everything is ahead.
    expect(freeSlots(facts, sunday, 30 * 60_000, Date.UTC(2026, 9, 25, 6))).toEqual(['09:00', '10:00', '10:30']);
    // 10:10 in Israel: only 10:30 is left.
    expect(freeSlots(facts, sunday, 30 * 60_000, Date.UTC(2026, 9, 25, 8, 10))).toEqual(['10:30']);
  });

  it("knows today by Israel's calendar", () => {
    const lateOnThe25th = Date.UTC(2026, 9, 25, 20); // 22:00 in Israel, already the 26th in Sydney
    expect(isPastDay(new Date(2026, 9, 25), lateOnThe25th)).toBe(false);
    expect(isPastDay(new Date(2026, 9, 24), lateOnThe25th)).toBe(true);
  });

  it("puts a class session on its day in Israel", () => {
    const session = { type_id: 'c1', timestamp: String(Date.UTC(2026, 9, 25, 22, 30)), durationMS: '3600000', capacity: 10, booked: 0 };
    // 00:30 on the 26th in Israel, the evening of the 25th in New York.
    expect(sessionsOnDay([session], 'c1', new Date(2026, 9, 26))).toHaveLength(1);
    expect(sessionsOnDay([session], 'c1', new Date(2026, 9, 25))).toHaveLength(0);
  });

  it('shows the times and the day in Israel', () => {
    const service = { _id: 's1', name: 'Gel', webConfig_id: 'w1', price: '100', durationMS: String(60 * 60_000) } as AppointmentType;
    const start = Date.UTC(2026, 9, 26, 14); // Monday 26 October, 16:00 in Israel
    render(<ChoiceSummary service={service} startMs={start} />);
    expect(screen.getByTestId('booking-summary')).toHaveTextContent('Monday, October 26 · 16:00 – 17:00');

    const session = { type_id: 's1', timestamp: String(start), durationMS: '3600000', capacity: 10, booked: 3 };
    render(
      <DayTimes day={new Date(2026, 9, 26)} mode="sessions" loading={false} failed={false} slots={[]} time="" onPickTime={vi.fn()} sessions={[session]} sessionTs="" onPickSession={vi.fn()} />
    );
    expect(screen.getByRole('button', { name: '16:00 · 3/10' })).toBeInTheDocument();
  });
});
