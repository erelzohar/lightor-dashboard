import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { OWN_BACKDROP_HEROES, isPaidDesign, sectionDef, sectionLabel } from '../../utils/editorOptions';

/**
 * LT-667 (Erel's Hero10): the editor offers gallery's fan hero, the words
 * centred over three of the site's pictures fanned like cards. It moves only
 * once, on arrival, so it is for every plan; it draws its own backdrop, so no
 * background chip beside it.
 */
describe("the editor's fan hero (LT-667)", () => {
  it('is offered by name, in Hebrew and English, with its pictures', () => {
    expect(sectionDef('hero')?.variants).toContain('fan');
    expect(sectionLabel('hero', 'fan', 'he')).toBe('מניפת תמונות');
    expect(sectionLabel('hero', 'fan', 'en')).toBe('Fanned pictures');
    for (const lang of ['he', 'en']) expect(existsSync(resolve(__dirname, `../../../public/designs/${lang}/hero-fan.webp`))).toBe(true);
  });

  it('is free, and has no background to pick', () => {
    expect(isPaidDesign('hero', 'fan')).toBe(false);
    expect(OWN_BACKDROP_HEROES).toContain('fan');
  });
});
