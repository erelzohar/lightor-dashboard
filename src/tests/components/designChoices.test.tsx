import { describe, it, expect, vi } from 'vitest';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fireEvent, render, screen, within } from '@testing-library/react';
import DesignChoices, { designPicture, movesByItself, pictureGroup } from '../../components/siteEditor/DesignChoices';
import { HERO_BACKGROUNDS, PRODUCTS_PAGE_LAYOUTS, PRODUCT_CARDS, PRODUCT_PAGE_LAYOUTS, SECTIONS, BLOG_PAGE_LAYOUTS, POST_PAGE_LAYOUTS } from '../../utils/editorOptions';
import Select from '../../components/ui/Select';
import { ButtonSample, CardSample, CornerSample, FontSample, ThemeSample, useSampleFonts } from '../../components/siteEditor/ThemeSamples';
import { optionOf } from '../helpers/dropdown';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'he' } }) }));
vi.mock('../../services/entitlementsApi', () => ({ fetchMyEntitlements: vi.fn(async () => null) }));

/**
 * LT-595 (Erel): every design the editor offers shows a picture of itself,
 * drawn by the site; the ones that move by themselves show a short loop,
 * the still one when the device asks for less motion.
 */
describe('a picture of every design (LT-595)', () => {
  it('draws each choice as its picture and its name; a tap picks it', () => {
    const onPick = vi.fn();
    render(<DesignChoices name="looks" group="products" values={['well', 'belt']} current="well" labelOf={(v) => `name-${v}`} onPick={onPick} language="he" marked={(v) => v === 'belt'} />);
    const group = screen.getByRole('radiogroup', { name: 'looks' });
    const well = within(group).getByRole('radio', { name: 'name-well' });
    expect(well).toHaveAttribute('aria-checked', 'true');
    expect(well.querySelector('img')?.getAttribute('src')).toBe('/designs/he/products-well.webp');
    const belt = within(group).getByRole('radio', { name: 'name-belt' });
    // The conveyor moves by itself: its loop, and the still one for less motion.
    expect(belt.querySelector('img')?.getAttribute('src')).toBe('/designs/he/products-belt.anim.webp');
    expect(belt.querySelector('source')?.getAttribute('srcset')).toBe('/designs/he/products-belt.webp');
    expect(belt.querySelector('source')?.getAttribute('media')).toBe('(prefers-reduced-motion: reduce)');
    expect(within(belt).getByTestId('paid-mark')).toBeInTheDocument();
    expect(within(well).queryByTestId('paid-mark')).toBeNull();
    fireEvent.click(belt);
    expect(onPick).toHaveBeenCalledWith('belt');
  });

  it('a picture that fails to load leaves the name, without a broken image', () => {
    render(<DesignChoices name="looks" group="faq" values={['lines']} current={undefined} labelOf={(v) => v} onPick={vi.fn()} language="en" />);
    const img = screen.getByRole('radio', { name: 'lines' }).querySelector('img') as HTMLImageElement;
    expect(img.getAttribute('src')).toBe('/designs/en/faq-lines.webp');
    fireEvent.error(img);
    expect(screen.getByRole('radio', { name: 'lines' }).querySelector('img')).toBeNull();
  });

  it('the gallery and the reviews share their pictures under both their names; Arabic and others read the English ones', () => {
    expect(pictureGroup('portfolio')).toBe('gallery');
    expect(pictureGroup('testimonials')).toBe('quote');
    expect(pictureGroup('hero')).toBe('hero');
    expect(designPicture('hero', 'slant', 'ar')).toBe('/designs/en/hero-slant.webp');
    expect(designPicture('hero', 'slant', 'he-IL')).toBe('/designs/he/hero-slant.webp');
    expect(movesByItself('herobg', 'metal')).toBe(true);
    expect(movesByItself('herobg', 'fog')).toBe(false);
    expect(movesByItself('contact', 'bubbles')).toBe(true);
  });

  it('every design the editor offers has its picture in both languages, and a loop where it moves by itself', () => {
    const choices: [string, string][] = [
      ...Object.entries(SECTIONS).flatMap(([type, def]) => (def.variants ?? []).map((v): [string, string] => [pictureGroup(type), v])),
      ...HERO_BACKGROUNDS.map((v): [string, string] => ['herobg', v]),
      ...Object.keys(PRODUCT_CARDS).map((v): [string, string] => ['card', v]),
      ...PRODUCTS_PAGE_LAYOUTS.map((v): [string, string] => ['productsPage', v]),
      ...Object.keys(PRODUCT_PAGE_LAYOUTS).map((v): [string, string] => ['productPage', v]),
      // LT-610: the blog's page and a post's.
      ...Object.keys(BLOG_PAGE_LAYOUTS).map((v): [string, string] => ['blogPage', v]),
      ...Object.keys(POST_PAGE_LAYOUTS).map((v): [string, string] => ['postPage', v]),
    ];
    const missing: string[] = [];
    for (const [group, value] of choices) {
      for (const lang of ['he', 'en']) {
        const files = [designPicture(group, value, lang), ...(movesByItself(group, value) ? [designPicture(group, value, lang, true)] : [])];
        for (const file of files) if (!existsSync(resolve(__dirname, '../../../public', `.${file}`))) missing.push(file);
      }
    }
    expect(missing).toEqual([]);
  });

  // The design tab's lists: a sample beside each name in the open list, the name alone in the closed box.
  it("the design tab's lists show each choice's sample, as the site draws it", () => {
    const options = [
      { value: '', label: 'By style' },
      ...['cormorant', 'anton'].map((v) => ({ value: v, text: v, selected: v, label: <span><FontSample font={v} rtl />{v}</span> })),
    ];
    render(<Select id="font" label="Heading font" value="cormorant" options={options} onChange={vi.fn()} />);
    const trigger = screen.getByLabelText('Heading font');
    expect(trigger.querySelector('[data-sample]')).toBeNull();
    expect(trigger).toHaveTextContent('cormorant');
    const sample = optionOf(trigger, 'cormorant').querySelector('[data-sample="font-cormorant"]') as HTMLElement;
    // An RTL site draws each family's Hebrew face (lightor-front useTheme).
    expect(sample.style.fontFamily).toContain('David Libre');
    expect(sample).toHaveTextContent('אבגד');
  });

  it('draws the body and the Latin faces, the buttons, corners, cards and light/dark', () => {
    const { container } = render(<>
      <FontSample font="anton" rtl body />
      <FontSample font="anton" rtl={false} />
      <ButtonSample style="outline" color="#a0522d" />
      <ButtonSample style="solid" color="not-a-colour" />
      <CornerSample radius="full" />
      <CardSample card="glass" />
      <ThemeSample mode="dark" />
    </>);
    const at = (key: string) => container.querySelectorAll<HTMLElement>(`[data-sample="${key}"]`);
    // A Hebrew body in a display family is Heebo.
    expect(at('font-anton')[0].style.fontFamily).toContain('Heebo');
    expect(at('font-anton')[1].style.fontFamily).toContain('Anton');
    expect(at('button-outline')[0].style.border).toContain('solid');
    expect(at('button-solid')[0].style.background).toContain('rgb(124, 58, 237)');
    expect(at('corner-full')[0].style.borderRadius).toBe('9999px');
    expect(at('card-glass')).toHaveLength(1);
    expect(at('theme-dark')[0].className).toContain('bg-slate-900');
  });

  it("loads the sample fonts once, cut to the sample's letters", () => {
    const Probe = (): null => { useSampleFonts(); return null; };
    render(<><Probe /><Probe /></>);
    const links = document.querySelectorAll('link#lt-font-samples');
    expect(links).toHaveLength(1);
    const href = (links[0] as HTMLLinkElement).href;
    expect(href).toContain('family=Frank+Ruhl+Libre');
    expect(href).toContain('text=');
  });
});
