import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { STAGGER_ROWS, staggerDelay, staggered } from '../../lib/stagger';

/**
 * LT-625 (Erel 2026-11-09, a screen recording from iOS 1.1 (26)): the
 * dashboard's 360 appointments slid in one after another for ~15 s, and iOS
 * sends no click while content keeps appearing, so no button answered.
 */
describe('a list settles at once, however long (LT-625)', () => {
  it('slides in only the first rows, and caps their delay', () => {
    expect(staggered(0)).toBe(true);
    expect(staggered(STAGGER_ROWS - 1)).toBe(true);
    expect(staggered(STAGGER_ROWS)).toBe(false);
    expect(staggered(359)).toBe(false);
    expect(staggerDelay(3, 0.04)).toBeCloseTo(0.12);
    expect(staggerDelay(359, 0.04)).toBeCloseTo(STAGGER_ROWS * 0.04);
    // The longest run a list can make: well under a second.
    expect(staggerDelay(10_000, 0.05)).toBeLessThan(0.5);
  });

  it('no list in the app delays a row by its index without the cap', () => {
    const root = path.resolve(__dirname, '../..');
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const name of fs.readdirSync(dir)) {
        const full = path.join(dir, name);
        if (fs.statSync(full).isDirectory()) {
          if (name !== 'tests') walk(full);
        } else if (/\.tsx?$/.test(name)) files.push(full);
      }
    };
    walk(root);
    // `delay: i * 0.04`, `delay: 0.04 * index`, `delay: idx * 0.02`... - a delay that grows with a list's row.
    const unbounded = /delay:\s*(?:(?:i|idx|index|row)\s*\*\s*[\d.]+|[\d.]+\s*\*\s*(?:i|idx|index|row))\b/;
    const offenders = files
      .filter((file) => unbounded.test(fs.readFileSync(file, 'utf8')))
      .map((file) => path.relative(root, file));
    expect(offenders).toEqual([]);
  });
});
