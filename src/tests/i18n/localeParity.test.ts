import { describe, it, expect } from 'vitest';
import en from '../../i18n/locales/en.json';
import he from '../../i18n/locales/he.json';

type Tree = { [key: string]: unknown };

const flatten = (tree: Tree, prefix = ''): Record<string, string> =>
  Object.entries(tree).reduce<Record<string, string>>((acc, [key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(acc, flatten(value as Tree, path));
    } else {
      // Arrays (day names, mostly) compare fine as a joined string: what
      // matters here is that both languages have one of the same length.
      acc[path] = String(value);
    }
    return acc;
  }, {});

const locales = {
  en: flatten(en as unknown as Tree),
  he: flatten(he as unknown as Tree),
};

/**
 * The dashboard ships in Hebrew and English only, and i18next falls back to
 * Hebrew silently — so an English-only user hitting a key that was added in
 * Hebrew alone sees Hebrew text mid-sentence with no error anywhere.
 */
describe('dashboard translations', () => {
  it('has no keys missing from English', () => {
    const missing = Object.keys(locales.he).filter((key) => !(key in locales.en));
    expect(missing).toEqual([]);
  });

  it('has no keys missing from Hebrew', () => {
    const missing = Object.keys(locales.en).filter((key) => !(key in locales.he));
    expect(missing).toEqual([]);
  });

  it.each(Object.keys(locales))('%s has no blank strings', (lang) => {
    const blank = Object.entries(locales[lang as keyof typeof locales])
      .filter(([, value]) => value.trim() === '')
      .map(([key]) => key);
    expect(blank).toEqual([]);
  });

  it('keeps interpolation placeholders identical across languages', () => {
    const placeholders = (value: string) => (value.match(/\{\{\s*\w+\s*\}\}/g) ?? []).sort();

    const mismatched = Object.keys(locales.he).filter(
      (key) =>
        JSON.stringify(placeholders(locales.he[key])) !==
        JSON.stringify(placeholders(locales.en[key] ?? ''))
    );
    expect(mismatched).toEqual([]);
  });

  it('does not describe the free plan as a trial (LT-036)', () => {
    // The upgrade bar used to read "30 days left in your trial" to accounts on
    // the permanent free tier, counting down a nextBillDate the backend seeded
    // at signup. As shown it implied the site would stop working. The free
    // plan has limits, not an expiry date — so this copy must not interpolate
    // a countdown.
    for (const lang of Object.keys(locales) as (keyof typeof locales)[]) {
      expect(locales[lang]['common.upgradePlanDesc']).toBeDefined();
      expect(locales[lang]['common.upgradePlanDesc']).not.toMatch(/\{\{\s*days\s*\}\}/);
      expect(locales[lang]).not.toHaveProperty('common.upgradePlanDescDays');
    }
  });
});
