/**
 * LT-292: the floating Lighty can be dragged anywhere on screen. His place is
 * an offset from his home corner (bottom-end), kept per browser so he stays
 * where the owner left him; these are the pure rules behind it.
 */

export interface Offset {
  x: number;
  y: number;
}

/** His box where the offset is 0 — the home corner, in viewport px. */
export interface Home {
  left: number;
  top: number;
  width: number;
  height: number;
}

const STORE = 'lighty.floatOffset';
export const EDGE = 8;
/** A press that moves less than this is a tap (it opens his card), not a drag. */
export const DRAG_START_PX = 6;

/**
 * Keep him whole on screen: any column, from the top margin down to his home
 * line — never lower, where the phone's tab bar is.
 */
export function clampOffset(home: Home, x: number, y: number, vw: number, vh: number): Offset {
  const minX = EDGE - home.left;
  const maxX = vw - home.width - EDGE - home.left;
  const minY = EDGE - home.top;
  const maxY = Math.min(0, vh - home.height - EDGE - home.top);
  return {
    x: Math.round(Math.min(Math.max(x, minX), Math.max(minX, maxX))),
    y: Math.round(Math.min(Math.max(y, minY), Math.max(minY, maxY))),
  };
}

export function readOffset(): Offset {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE) ?? 'null') as Partial<Offset> | null;
    if (raw && Number.isFinite(raw.x) && Number.isFinite(raw.y)) return { x: raw.x as number, y: raw.y as number };
  } catch {
    // private mode, cleared storage: he starts at home
  }
  return { x: 0, y: 0 };
}

export function saveOffset(offset: Offset): void {
  try {
    localStorage.setItem(STORE, JSON.stringify(offset));
  } catch {
    // a nicety; nothing depends on it
  }
}

/**
 * Where his card opens, relative to his box: above him, or below when he is
 * near the top; lined up with his outer side and kept on screen.
 */
export function cardPlacement(rect: { left: number; right: number; top: number }, vw: number, cardWidth: number): { left: number; below: boolean } {
  const w = Math.min(cardWidth, vw - 2 * 12);
  const centre = (rect.left + rect.right) / 2;
  const wanted = centre >= vw / 2 ? rect.right - w : rect.left;
  const left = Math.min(Math.max(wanted, 12), vw - w - 12);
  return { left: Math.round(left - rect.left), below: rect.top < 380 };
}
