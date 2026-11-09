import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';

const read = (file: string) => readFileSync(path.resolve(__dirname, '../../..', file), 'utf8');

/**
 * LT-628: on an iPhone a focused field got iOS's form bar (^ v ✓) and a white
 * strip between the keyboard and the field (Lighty's page, the signup). The
 * keyboard plugin removes the bar and ends the web view at the keyboard's top;
 * the window behind the keyboard's rounded corners takes the body's colour.
 */
describe("the iPhone keyboard sits right under the page", () => {
  it('the keyboard plugin stays installed', () => {
    expect(JSON.parse(read('package.json')).dependencies['@capacitor/keyboard']).toBeTruthy();
  });

  it("paints the keyboard's backdrop the body's colour", () => {
    expect(read('capacitor.config.ts')).toMatch(/Keyboard:\s*\{[^}]*autoBackdropColor:\s*'dom'/);
  });
});
