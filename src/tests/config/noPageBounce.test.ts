import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';

/**
 * LT-417: on an iPhone a tap on the phone tab bar whose finger slid a few
 * points started the page's rubber-band bounce, and iOS cancelled the tap
 * (pointercancel, no click). The page itself never scrolls - the content pane
 * does - so it must never bounce.
 */
describe('the page never bounces', () => {
  it('html and body have overscroll-behavior none', () => {
    const css = readFileSync(path.resolve(__dirname, '../../index.css'), 'utf8');
    const rule = css.match(/html,\s*body\s*\{([^}]*)\}/);
    expect(rule?.[1]).toMatch(/overscroll-behavior:\s*none/);
  });
});
