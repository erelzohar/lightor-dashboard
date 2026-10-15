/**
 * The calendar's vertical scale (LT-359): where each hour is drawn. An hour
 * with nothing in it on any day on show is folded, and a run of such hours
 * shares one thin band ("07:00-10:00"), so a quiet week is not a wall of
 * empty rows. Hours with a booking or a class, the hour the clock is in on
 * today's page, and any hour a dragged booking is held over keep their full
 * height. Everything that places something by time (the blocks, the now
 * line, a dragged booking's landing) reads it through this scale.
 */

export interface ScaleRow {
  hour: number;
  top: number;
  height: number;
  folded: boolean;
}

/** A run of folded hours, [from, to), drawn as one band. */
export interface FoldedBand {
  from: number;
  to: number;
  top: number;
  height: number;
}

export interface TimeScale {
  rows: ScaleRow[];
  bands: FoldedBand[];
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
  bandPx,
  busy,
  open,
}: {
  firstHour: number;
  lastHour: number;
  hourPx: number;
  bandPx: number;
  /** Hours something is drawn in: never folded. */
  busy: ReadonlySet<number>;
  /** Hours kept open as well; 'all' folds nothing. */
  open?: ReadonlySet<number> | 'all';
}): TimeScale => {
  const foldable = (hour: number) => open !== 'all' && !busy.has(hour) && !open?.has(hour);
  const rows: ScaleRow[] = [];
  const bands: FoldedBand[] = [];
  let y = 0;
  let hour = firstHour;
  while (hour < lastHour) {
    if (!foldable(hour)) {
      rows.push({ hour, top: y, height: hourPx, folded: false });
      y += hourPx;
      hour += 1;
      continue;
    }
    let end = hour;
    while (end < lastHour && foldable(end)) end += 1;
    const each = bandPx / (end - hour);
    bands.push({ from: hour, to: end, top: y, height: bandPx });
    for (let h = hour; h < end; h++) rows.push({ hour: h, top: y + (h - hour) * each, height: each, folded: true });
    // Whole pixels past the band, not a sum of its fractions.
    y += bandPx;
    hour = end;
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
  return { rows, bands, total, yOf, minutesAt };
};

/** Marks the hours a span of minutes touches (at least the hour it starts in). */
export const markHours = (startMinutes: number, endMinutes: number, into: Set<number>): void => {
  const end = Math.max(endMinutes, startMinutes + 1);
  for (let hour = Math.floor(startMinutes / 60); hour < Math.ceil(end / 60); hour++) into.add(hour);
};

/** The folded hours a span of minutes reaches into, whole bands at a time. */
export const bandHoursUnder = (scale: TimeScale, startMinutes: number, endMinutes: number): number[] =>
  scale.bands
    .filter((band) => band.from * 60 < endMinutes && startMinutes < band.to * 60)
    .flatMap((band) => Array.from({ length: band.to - band.from }, (_, i) => band.from + i));
