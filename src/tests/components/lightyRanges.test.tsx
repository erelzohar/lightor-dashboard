import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, resolve } from 'path';
import { LightyText } from '../../components/lighty/LightyChat';

/**
 * LT-315 (H2) — Lighty keeps "09:00–17:00" left to right inside a Hebrew
 * line, without the regex lookbehind that white-screened WebKit < 16.4
 * (iOS 15 and 16.0–16.3, where the app installs).
 */
const ranges = (text: string): string[] => {
  const { container } = render(
    <MemoryRouter>
      <LightyText text={text} />
    </MemoryRouter>
  );
  return Array.from(container.querySelectorAll('bdi[dir="ltr"]')).map((el) => el.textContent ?? '');
};

describe('LightyText time ranges (LT-315)', () => {
  it('wraps a range at the start of the line, mid-line and after a non-digit', () => {
    expect(ranges('09:00–17:00 פתוח')).toEqual(['09:00–17:00']);
    expect(ranges('שעות: 9–13 ו-16:30 \u2014 20:00')).toEqual(['9–13', '16:30 \u2014 20:00']);
    // LT-350: the server turns an em-dash into a spaced hyphen; that range needs the wrap too.
    expect(ranges('שעות: 9–13 ו-16:30 - 20:00')).toEqual(['9–13', '16:30 - 20:00']);
    expect(ranges('טלפון 050-1234567')).toEqual([]);
  });

  it('keeps the text around a range intact', () => {
    const { container } = render(
      <MemoryRouter>
        <LightyText text="פתוח 08:00–12:00 בלבד" />
      </MemoryRouter>
    );
    expect(container.textContent).toBe('פתוח 08:00–12:00 בלבד');
  });

  it('wraps two ranges separated by a single character', () => {
    expect(ranges('9–10,11–12')).toEqual(['9–10', '11–12']);
  });

  it('never starts or ends a range inside a longer number', () => {
    expect(ranges('2026–10')).toEqual([]);
    expect(ranges('10–123')).toEqual([]);
  });

  it('works inside bold text', () => {
    expect(ranges('**10:00–11:00** בדיוק')).toEqual(['10:00–11:00']);
  });
});

/**
 * A lookbehind assertion is a SyntaxError on WebKit < 16.4, and
 * esbuild does not refuse it for an older target — it rewrites the literal
 * into `new RegExp(…)`, which throws when the chunk evaluates. So the guard
 * lives here: no lookbehind anywhere in the app's source.
 */
describe('no regex lookbehind in src (LT-315)', () => {
  const root = resolve(__dirname, '../..');
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) {
        if (name !== 'tests') walk(full);
      } else if (/\.(tsx?|jsx?)$/.test(name)) files.push(full);
    }
  };
  walk(root);

  it('scans the source tree', () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it('finds no (?<= or (?<! in any source file', () => {
    const offenders = files.filter((f) => /\(\?<[=!]/.test(readFileSync(f, 'utf-8')));
    expect(offenders).toEqual([]);
  });
});
