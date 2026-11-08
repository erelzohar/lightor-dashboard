/**
 * LT-625 (Erel 2026-11-09, a screen recording from iOS 1.1 (26): "every
 * button in the app stops working sometimes").
 *
 * A list that slid its rows in one after another (delay = row index × 40 ms)
 * kept the page changing for as long as it had rows: the dashboard's 360
 * appointments animated for about 15 seconds. While content keeps appearing,
 * iOS WebKit takes a tap for a "hover" and sends no click, so for those
 * seconds no button answered. Measured in the simulator: during the run a tap
 * on the floating Lighty gave touchstart and touchend and no click; once it
 * ended, the click came 11 ms after touchend.
 *
 * Only the first rows slide in now (the ones a phone shows at once); every
 * row after them is simply there, so a list of any length settles in well
 * under a second.
 */

/** How many rows of a list get an entrance animation. */
export const STAGGER_ROWS = 8;

/** Whether this row slides in, or is there at once (rows past the first few). */
export const staggered = (index: number): boolean => index < STAGGER_ROWS;

/** The row's entrance delay: `step` per row, never longer than the first rows' run. */
export const staggerDelay = (index: number, step: number): number => Math.min(index, STAGGER_ROWS) * step;
