/**
 * The calendar's vertical scale (LT-359): where each hour is drawn. An hour
 * with nothing in it on any day on show is folded: drawn shorter, its label
 * and line still there, so a quiet week is not a wall of empty rows and the
 * day still reads hour by hour. Hours with a booking or a class, the hour the
 * clock is in on today's page, and any hour a dragged booking is held over
 * keep their full height. Everything that places something by time (the
 * blocks, the now line, a dragged booking's landing) reads it through this
 * scale.
 */

export interface ScaleRow {
  hour: number;
  top: number;
  height: number;
  folded: boolean;
}

export interface TimeScale {
  rows: ScaleRow[];
  total: number;
  /** Px from the grid's top for a minute of the day, inside the drawn hours. */
  yOf: (minutes: number) => number;
  /** The minute of the day drawn at `y` px from the grid's top. */
  minutesAt: (y: number) => number;
}

export const buildScale = ({
  firstHour,
  lastHour,
  hourPx,
  foldedPx,
  busy,
  open,
}: {
  firstHour: number;
  lastHour: number;
  hourPx: number;
  /** A folded hour's height. */
  foldedPx: number;
  /** Hours something is drawn in: never folded. */
  busy: ReadonlySet<number>;
  /** Hours kept open as well; 'all' folds nothing. */
  open?: ReadonlySet<number> | 'all';
}): TimeScale => {
  const rows: ScaleRow[] = [];
  let y = 0;
  for (let hour = firstHour; hour < lastHour; hour++) {
    const folded = open !== 'all' && !busy.has(hour) && !open?.has(hour);
    const height = folded ? foldedPx : hourPx;
    rows.push({ hour, top: y, height, folded });
    y += height;
  }
  const total = y;
  const first = firstHour * 60;
  const last = lastHour * 60;

  const yOf = (minutes: number): number => {
    if (minutes <= first) return 0;
    if (minutes >= last) return total;
    const row = rows[Math.floor(minutes / 60) - firstHour];
    return row.top + ((minutes % 60) / 60) * row.height;
  };
  const minutesAt = (py: number): number => {
    if (py <= 0) return first;
    if (py >= total) return last;
    const row = rows.find((r) => py < r.top + r.height) ?? rows[rows.length - 1];
    return row.hour * 60 + ((py - row.top) / row.height) * 60;
  };
  return { rows, total, yOf, minutesAt };
};

/** Marks the hours a span of minutes touches (at least the hour it starts in). */
export const markHours = (startMinutes: number, endMinutes: number, into: Set<number>): void => {
  const end = Math.max(endMinutes, startMinutes + 1);
  for (let hour = Math.floor(startMinutes / 60); hour < Math.ceil(end / 60); hour++) into.add(hour);
};
