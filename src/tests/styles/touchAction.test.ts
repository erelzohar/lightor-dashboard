import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * LT-622 (Erel 2026-11-09 on iOS 1.1 (26): "a delay between the tap and the
 * page or the menu opening"). A page that can double-tap zoom makes WebKit
 * hold a still tap ~350 ms (measured in the simulator: 355 ms, and 36 ms with
 * the rule below). The whole app rides on this one global rule, so it is
 * guarded here: removing it brings the delay back on every tap.
 */
describe('taps answer at once (LT-622)', () => {
  const css = fs.readFileSync(path.resolve(__dirname, '../../index.css'), 'utf8');

  it('drops double-tap zoom on every element', () => {
    expect(css).toMatch(/(^|\n)\*\s*\{\s*touch-action:\s*manipulation;\s*\}/);
  });

  it('keeps pinch zoom: the viewport does not forbid scaling', () => {
    const html = fs.readFileSync(path.resolve(__dirname, '../../../index.html'), 'utf8');
    const viewport = html.match(/<meta name="viewport" content="([^"]+)"/)?.[1] ?? '';
    expect(viewport).toContain('width=device-width');
    expect(viewport).not.toMatch(/user-scalable\s*=\s*(no|0)|maximum-scale\s*=\s*1(\.0)?\b/);
  });
});
