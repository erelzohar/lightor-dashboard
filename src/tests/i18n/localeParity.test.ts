import { describe, it, expect } from 'vitest';
import en from '../../i18n/locales/en.json';
import he from '../../i18n/locales/he.json';
import ar from '../../i18n/locales/ar.json';
import fr from '../../i18n/locales/fr.json';
import es from '../../i18n/locales/es.json';

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
  ar: flatten(ar as unknown as Tree),
  fr: flatten(fr as unknown as Tree),
  es: flatten(es as unknown as Tree),
};

// English is the canonical key set; every other locale must match it exactly.
const OTHER_LANGS = ['he', 'ar', 'fr', 'es'] as const;

/**
 * The dashboard ships in five languages (en, he, ar, fr, es) and i18next
 * falls back to Hebrew silently — so a key present in one locale but missing
 * from another shows fallback text mid-sentence with no error anywhere.
 * Every locale must carry exactly the English key set.
 */
describe('dashboard translations', () => {
  it.each(OTHER_LANGS)('%s has exactly the English key set', (lang) => {
    const target = locales[lang];
    const missing = Object.keys(locales.en).filter((key) => !(key in target));
    const extra = Object.keys(target).filter((key) => !(key in locales.en));
    expect({ lang, missing, extra }).toEqual({ lang, missing: [], extra: [] });
  });

  it.each(Object.keys(locales))('%s has no blank strings', (lang) => {
    const blank = Object.entries(locales[lang as keyof typeof locales])
      .filter(([, value]) => value.trim() === '')
      .map(([key]) => key);
    expect(blank).toEqual([]);
  });

  it.each(OTHER_LANGS)('%s keeps interpolation placeholders identical to English', (lang) => {
    const placeholders = (value: string) => (value.match(/\{\{\s*\w+\s*\}\}/g) ?? []).sort();
    const target = locales[lang];

    const mismatched = Object.keys(locales.en).filter(
      (key) =>
        JSON.stringify(placeholders(locales.en[key])) !==
        JSON.stringify(placeholders(target[key] ?? ''))
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
