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
type Lang = keyof typeof locales;

/**
 * LT-601: count texts are i18next plurals - `key_one`, `key_other` and the
 * forms a language adds (Hebrew `_two`, Arabic six). A family is one key in
 * the key set, and every language carries exactly the forms its plural rules
 * can pick: i18next never falls back from a missing form to `_other`, it falls
 * back to the bare key and from there to Hebrew, mid-sentence.
 */
const PLURAL = /_(zero|one|two|few|many|other)$/;
const PLURAL_FORMS: Record<Lang, string[]> = {
  en: ['one', 'other'],
  // "many" too: an iPhone on iOS 15 (CLDR before 42) still picks it for 20, 30...
  he: ['one', 'two', 'many', 'other'],
  ar: ['zero', 'one', 'two', 'few', 'many', 'other'],
  fr: ['one', 'many', 'other'],
  es: ['one', 'many', 'other'],
};
// A form that stands for one number may spell it out ("תור אחד", "موعدان");
// every other form shows it (French "one" is 0 and 1).
const SPELLED_OUT: Record<Lang, string[]> = { en: ['one'], he: ['one', 'two'], ar: ['zero', 'one', 'two'], fr: [], es: ['one'] };
const PLACEHOLDER = /\{\{\s*\w+\s*\}\}/g;
const COUNT = /^\{\{\s*count\s*\}\}$/;

const familyKey = (key: string) => key.replace(PLURAL, '_{plural}');

/** Plural families by their base key: form -> text. */
const families = (flat: Record<string, string>) => {
  const out: Record<string, Record<string, string>> = {};
  for (const [key, value] of Object.entries(flat)) {
    const form = key.match(PLURAL)?.[1];
    if (form) (out[key.slice(0, -form.length - 1)] ??= {})[form] = value;
  }
  return out;
};

/**
 * The dashboard ships in five languages (en, he, ar, fr, es) and i18next
 * falls back to Hebrew silently — so a key present in one locale but missing
 * from another shows fallback text mid-sentence with no error anywhere.
 * Every locale must carry exactly the English key set.
 */
describe('dashboard translations', () => {
  it.each(OTHER_LANGS)('%s has exactly the English key set', (lang) => {
    // A plural family counts once, whatever forms the language gives it.
    const keys = (l: Lang) => new Set(Object.keys(locales[l]).map(familyKey));
    const english = keys('en');
    const target = keys(lang);
    const missing = [...english].filter((key) => !target.has(key));
    const extra = [...target].filter((key) => !english.has(key));
    expect({ lang, missing, extra }).toEqual({ lang, missing: [], extra: [] });
  });

  it.each(Object.keys(locales) as Lang[])('%s gives every count text exactly its plural forms (LT-601)', (lang) => {
    const wrong = Object.entries(families(locales[lang]))
      .filter(([, forms]) => Object.keys(forms).sort().join() !== [...PLURAL_FORMS[lang]].sort().join())
      .map(([base, forms]) => `${base}: ${Object.keys(forms).join(' ')}`);
    expect(wrong).toEqual([]);
  });

  it('knows every plural form the plural rules can pick', () => {
    for (const lang of Object.keys(PLURAL_FORMS) as Lang[]) {
      const picked = new Intl.PluralRules(lang).resolvedOptions().pluralCategories;
      expect(PLURAL_FORMS[lang]).toEqual(expect.arrayContaining(picked));
    }
  });

  it.each(Object.keys(locales) as Lang[])(
    "%s's plural forms keep English's placeholders and show the number (LT-601)",
    (lang) => {
      const used = (text = '') => text.match(PLACEHOLDER) ?? [];
      const english = families(locales.en);
      const wrong = Object.entries(families(locales[lang])).flatMap(([base, forms]) => {
        const expected = [...new Set(Object.values(english[base] ?? {}).flatMap(used))].sort().join();
        const actual = [...new Set(Object.values(forms).flatMap(used))].sort().join();
        const showsCount = used(english[base]?.other).some((p) => COUNT.test(p));
        const hidden = Object.entries(forms)
          .filter(([form, text]) => showsCount && !SPELLED_OUT[lang].includes(form) && !used(text).some((p) => COUNT.test(p)))
          .map(([form]) => `${base}_${form}`);
        return expected === actual ? hidden : [base, ...hidden];
      });
      expect(wrong).toEqual([]);
    }
  );

  it.each(Object.keys(locales))('%s has no blank strings', (lang) => {
    const blank = Object.entries(locales[lang as keyof typeof locales])
      .filter(([, value]) => value.trim() === '')
      .map(([key]) => key);
    expect(blank).toEqual([]);
  });

  it.each(OTHER_LANGS)('%s keeps interpolation placeholders identical to English', (lang) => {
    const placeholders = (value: string) => (value.match(PLACEHOLDER) ?? []).sort();
    const target = locales[lang];

    // Plural forms are compared as a family, in the test above.
    const mismatched = Object.keys(locales.en).filter(
      (key) =>
        !PLURAL.test(key) &&
        JSON.stringify(placeholders(locales.en[key])) !==
        JSON.stringify(placeholders(target[key] ?? ''))
    );
    expect(mismatched).toEqual([]);
  });

  it("prices in the business's currency in every language (LT-218, LT-395)", () => {
    // The language never decides the money: the English, Arabic, French and
    // Spanish dashboards once showed every price in dollars (LT-218). Since
    // LT-395 the symbol is the business's own, passed into the label.
    for (const lang of Object.keys(locales) as (keyof typeof locales)[]) {
      expect(locales[lang]['appointments.currencySymbol']).toBe('₪');
      expect(locales[lang]['appointmentTypes.price']).toContain('({{symbol}})');
      expect(locales[lang]['appointmentTypes.price']).not.toMatch(/[₪$€£]/);
    }
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
