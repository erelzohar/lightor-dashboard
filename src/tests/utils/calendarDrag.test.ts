import { describe, it, expect } from 'vitest';
import { droppedStart, dropVerdict, isDraggable, offsetPx } from '../../utils/calendarDrag';
import { groupSessions } from '../../utils/sessions';
import type { Appointment, AppointmentType } from '../../types';

const HOUR = 3_600_000;
const HOUR_PX = 88;
const service: AppointmentType = { _id: 't1', name: 'Massage', webConfig_id: 'w1', price: '100', durationMS: String(HOUR) };
const yoga: AppointmentType = { ...service, _id: 'c1', name: 'Yoga', kind: 'class', capacity: 10 };
const day = new Date(2030, 2, 5); // a Tuesday
const at = (hour: number, minute = 0, d = day) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), hour, minute).valueOf();
const NOW = new Date(2030, 2, 4, 8).valueOf();
const booking = (id: string, start: number, over: Partial<Appointment> = {}): Appointment => ({
  _id: id, name: id, phone: '0501234567', status: 'scheduled', user_id: 'u1', timestamp: String(start), type: service, ...over,
});

describe('where a dragged booking lands (LT-345)', () => {
  const drop = (dyPx: number, start = at(10), d = day) =>
    droppedStart({ startMs: start, durationMS: HOUR, day: d, dyPx, hourPx: HOUR_PX, firstHour: 6, lastHour: 22 });

  it('moves by the drag and lands on whole five minutes', () => {
    expect(drop(HOUR_PX)).toBe(at(11));
    // 44px is half an hour; 47px is 32 minutes, which rounds to 30.
    expect(drop(44)).toBe(at(10, 30));
    expect(drop(47)).toBe(at(10, 30));
    expect(drop(-HOUR_PX / 12)).toBe(at(9, 55));
  });

  it('keeps the whole booking inside the drawn hours', () => {
    expect(drop(-10 * HOUR_PX)).toBe(at(6));
    expect(drop(20 * HOUR_PX)).toBe(at(21));
  });

  it('lands on the day it is dropped on, at the minute shown', () => {
    const thursday = new Date(2030, 2, 7);
    expect(drop(HOUR_PX, at(10), thursday)).toBe(at(11, 0, thursday));
  });

  it('draws the landing place as far down as its minutes', () => {
    expect(offsetPx(at(10), at(11, 30), HOUR_PX)).toBe(1.5 * HOUR_PX);
    expect(offsetPx(at(10), at(9, 0, new Date(2030, 2, 7)), HOUR_PX)).toBe(-HOUR_PX);
  });
});

describe('what a drop means (LT-345)', () => {
  const dana = booking('dana', at(10));
  const verdict = (startMs: number, extra: Partial<Parameters<typeof dropVerdict>[0]> = {}, others: Appointment[] = []) =>
    dropVerdict({ appointment: dana, startMs, day, sessions: groupSessions([dana, ...others]), now: NOW, ...extra });

  it('moves to a free time', () => {
    expect(verdict(at(12))).toEqual({ kind: 'move', startMs: at(12) });
  });

  it('may move into its own old hour', () => {
    expect(verdict(at(10, 30))).toEqual({ kind: 'move', startMs: at(10, 30) });
  });

  it('does nothing when dropped back where it was', () => {
    expect(verdict(at(10))).toEqual({ kind: 'none' });
  });

  it('refuses the past and a time partly taken by another booking or a class', () => {
    expect(verdict(NOW - HOUR)).toEqual({ kind: 'refused', reason: 'past' });
    expect(verdict(at(12, 30), {}, [booking('avi', at(13))])).toEqual({ kind: 'refused', reason: 'taken' });
    expect(verdict(at(15), {}, [booking('class', at(15, 30), { type: yoga, status: 'cancelled' })])).toEqual({ kind: 'refused', reason: 'taken' });
  });

  it('lets a cancelled booking be dropped over', () => {
    expect(verdict(at(13), {}, [booking('gone', at(13), { status: 'cancelled' })])).toEqual({ kind: 'move', startMs: at(13) });
  });

  it('swaps when dropped onto another booking that could itself be moved', () => {
    const avi = booking('avi', at(13));
    expect(verdict(at(13), { overAppointment: avi }, [avi])).toEqual({ kind: 'swap', target: avi });
    // Onto a past or a class booking: no swap, and the time is taken.
    // (What has begun is read on the real clock, as the calendar reads it.)
    const past = booking('past', Date.now() - 2 * HOUR);
    expect(verdict(Date.now() - 2 * HOUR, { overAppointment: past }, [past]).kind).toBe('refused');
    const seat = booking('seat', at(15), { type: yoga });
    expect(verdict(at(15), { overAppointment: seat }, [seat])).toEqual({ kind: 'refused', reason: 'taken' });
  });

  it('warns, but moves, outside the opening hours and in a vacation', () => {
    const hours = { workingDays: Array(7).fill('09:00-17:00') as (string | null)[], dateOverrides: [] as { date: string; hours: string | null }[], vacations: [] as { startDate: string; endDate: string }[] };
    expect(verdict(at(16, 30), { hours })).toEqual({ kind: 'move', startMs: at(16, 30), warning: 'outsideHours' });
    expect(verdict(at(12), { hours })).toEqual({ kind: 'move', startMs: at(12) });
    const away = { ...hours, vacations: [{ startDate: String(at(0)), endDate: String(at(23, 59)) }] };
    expect(verdict(at(12), { hours: away })).toEqual({ kind: 'move', startMs: at(12), warning: 'vacation' });
  });
});

describe('what may be picked up (LT-345)', () => {
  it('a one-to-one booking ahead, nothing else', () => {
    const ahead = Date.now() + 48 * HOUR;
    expect(isDraggable(booking('a', ahead))).toBe(true);
    expect(isDraggable(booking('a', ahead, { status: 'cancelled' }))).toBe(false);
    expect(isDraggable(booking('a', Date.now() - 48 * HOUR))).toBe(false);
    expect(isDraggable(booking('a', ahead, { type: yoga }))).toBe(false);
  });
});
