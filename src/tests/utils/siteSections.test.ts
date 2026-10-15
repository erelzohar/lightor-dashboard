import { describe, it, expect } from 'vitest';
import type { WebConfig } from '../../types';
import {
  MAX_BLOCKS, addGalleryPhoto, addSection, availabilityOf, canonicalLayout, cleanForSave, defaultInsertIndex, moveBlockTo, rowsOf, toBlocks,
  type LayoutBlock,
} from '../../utils/siteSections';

/**
 * LT-252 — the sections of a site: what can be added and with what content,
 * where it goes, how a legacy page becomes blocks, and what a save leaves out.
 */
const site = (over: Partial<WebConfig> = {}): WebConfig => ({
  _id: 'wc1',
  businessName: 'Nails',
  logoImageName: 'logo.webp',
  subDomain: 'nails',
  defaultLanguage: 'he',
  minCancelTimeMS: 3600000,
  workingDays: [null, '09:00-17:00', null, null, null, null, null],
  address: { street: 'Herzl 1', city: 'Haifa' },
  contact: { phone: '050', mail: 'a@b.co' },
  social: { instagram: '', facebook: '', x: '', tiktok: '' },
  pallete: { colorPrimary: '#d71676' },
  appointmentTypes: [{ _id: 'svc1', name: 'Gel', price: '140', durationMS: '3600000' }],
  components: {
    navbar: { visible: true },
    hero: { visible: true, title: 'Hi', heroImageSrc: 'hero.webp' },
    about: { visible: true, title: 'About', description: 'd', paragraphs: { intro: 'We do nails.', mission: 'Care.' }, features: [] },
    portfolio: { visible: true, title: 'Work', description: 'd', items: [{ url: 'one.webp', title: '', description: '' }] },
    schedule: { title: 'Book', description: 'Pick a time' },
    contact: { visible: true, title: 'Contact', description: 'd' },
    footer: { visible: true, description: 'd' },
    introPopup: { visible: false, value: '' },
    contactButton: { visible: true },
  },
  blocks: [
    { id: 'b1', type: 'hero', source: 'hero' },
    { id: 'b2', type: 'intro', source: 'about' },
    { id: 'b3', type: 'schedule', source: 'schedule' },
    { id: 'b7', type: 'contact', source: 'contact' },
    { id: 'b5', type: 'footer', source: 'footer' },
  ],
  ...over,
} as unknown as WebConfig);

describe('what can be added (LT-252)', () => {
  it('drafts what the site does not have, lets the owner write reviews and numbers, uses what it has', () => {
    const c = site();
    expect(availabilityOf(c, 'faq', 5)).toEqual({ ok: true, source: 'ai' });
    expect(availabilityOf(c, 'quote', 5)).toEqual({ ok: true, source: 'owner' });
    expect(availabilityOf(c, 'stats', 5)).toEqual({ ok: true, source: 'owner' });
    expect(availabilityOf(c, 'intro', 5)).toEqual({ ok: true, source: 'ready' });
    expect(availabilityOf(c, 'features', 5)).toEqual({ ok: true, source: 'ai' });
    const withFaq = site({ components: { ...site().components, faq: { visible: false, title: 'Q', items: [{ question: 'q', answer: 'a' }] } } });
    expect(availabilityOf(withFaq, 'faq', 5)).toEqual({ ok: true, source: 'ready' });
  });

  it('says what a section needs when the site lacks it', () => {
    const c = site();
    expect(availabilityOf(c, 'gallery', 5).ok).toBe(true);
    expect(availabilityOf(c, 'photoPair', 5)).toEqual({ ok: false, reason: 'twoPhotos' });
    expect(availabilityOf(site({ appointmentTypes: [] }), 'ledger', 5)).toEqual({ ok: false, reason: 'noServices' });
    expect(availabilityOf(site({ conversion: 'lead' }), 'schedule', 5)).toEqual({ ok: false, reason: 'leadsSite' });
    expect(availabilityOf(site({ address: undefined }), 'mapStrip', 5)).toEqual({ ok: false, reason: 'noAddress' });
    expect(availabilityOf(c, 'social', 5)).toEqual({ ok: false, reason: 'noSocial' });
    expect(availabilityOf(c, 'faq', MAX_BLOCKS)).toEqual({ ok: false, reason: 'max' });
  });
});

/** LT-320: a gallery emptied in the editor had no way back from there. */
describe('the gallery without photos', () => {
  const empty = () => site({ components: { ...site().components, portfolio: { visible: true, title: 'Work', description: 'd', items: [] } } });

  it('can be added empty, for the owner to upload photos into', () => {
    expect(availabilityOf(empty(), 'gallery', 5)).toEqual({ ok: true, source: 'photos' });
    expect(availabilityOf(empty(), 'photoPair', 5)).toEqual({ ok: false, reason: 'twoPhotos' });
  });

  it('takes an uploaded photo and puts the gallery back on a page that lost it', () => {
    const next = addGalleryPhoto(empty(), 'new.webp');
    expect(next.components?.portfolio?.items).toEqual([{ url: 'new.webp', title: '', description: '' }]);
    const types = (next.blocks ?? []).map((b) => b.type);
    expect(types.filter((t) => t === 'gallery')).toHaveLength(1);
    expect(types.indexOf('gallery')).toBe(defaultInsertIndex(['hero', 'intro', 'schedule', 'contact', 'footer'], 'gallery'));
  });

  it('adds to a gallery that is on the page without a second block, and shows a hidden one', () => {
    const withBlock = site({ blocks: [...(site().blocks ?? []), { id: 'b9', type: 'gallery', source: 'portfolio' }] as WebConfig['blocks'] });
    const next = addGalleryPhoto(withBlock, 'two.webp');
    expect(next.components?.portfolio?.items?.map((i) => i.url)).toEqual(['one.webp', 'two.webp']);
    expect((next.blocks ?? []).filter((b) => b.type === 'gallery')).toHaveLength(1);
    const hidden = site({ components: { ...site().components, portfolio: { visible: false, title: '', description: '', items: [] } }, blocks: undefined });
    const shown = addGalleryPhoto(hidden, 'x.webp');
    expect(shown.components?.portfolio?.visible).toBe(true);
    expect(shown.components?.portfolio?.title).toBe('גלריה');
    expect(shown.blocks).toBeUndefined();
  });
});

describe('where a new section goes (LT-252)', () => {
  const page = ['hero', 'intro', 'gallery', 'ledger', 'schedule', 'contact', 'footer'];
  it('follows the page grammar', () => {
    expect(defaultInsertIndex(page, 'faq')).toBe(5);        // right after the calendar
    expect(defaultInsertIndex(page, 'quote')).toBe(4);      // before booking
    expect(defaultInsertIndex(page, 'features')).toBe(2);   // after the intro
    expect(defaultInsertIndex(page, 'announcement')).toBe(1);
    expect(defaultInsertIndex(page, 'hours')).toBe(5);      // with the business details, before contact
    expect(defaultInsertIndex(page, 'photoPair')).toBe(3);  // with the work, before the prices
  });
  it('never above the opening or below the footer', () => {
    expect(defaultInsertIndex(['hero', 'footer'], 'intro')).toBe(1);
    expect(defaultInsertIndex(['hero', 'footer'], 'social')).toBe(1);
    expect(defaultInsertIndex(['hero', 'contact'], 'social')).toBe(2);
  });
});

describe('a legacy page becomes blocks (LT-252)', () => {
  const layout: LayoutBlock[] = [
    { key: 'hero', type: 'hero', source: 'hero' },
    { key: 'about', type: 'intro', variant: 'columns', source: 'about' },
    { key: 'about', type: 'features', source: 'about.features' },
    { key: 'faq', type: 'faq', source: 'faq', mod: { hidden: true } },
    { key: 'footer', type: 'footer', source: 'footer' },
  ];

  it('lists the blocks it would be, then becomes them - the same ids, hidden ones hidden with their flag back on', () => {
    const legacy = site({
      blocks: undefined,
      components: { ...site().components, faq: { visible: false, title: 'Q', items: [{ question: 'q', answer: 'a' }] } },
    });
    expect(rowsOf(legacy, layout)).toEqual([
      { id: 'b1', type: 'hero', hidden: false, key: 'hero' },
      { id: 'b2', type: 'intro', hidden: false, key: 'about' },
      { id: 'b3', type: 'features', hidden: false, key: 'about' },
      { id: 'b4', type: 'faq', hidden: true, key: 'faq' },
      { id: 'b5', type: 'footer', hidden: false, key: 'footer' },
    ]);
    const { config, idOf } = toBlocks(legacy, layout);
    expect(config.blocks?.map((b) => b.id)).toEqual(['b1', 'b2', 'b3', 'b4', 'b5']);
    expect(config.blocks?.[3]).toEqual({ id: 'b4', type: 'faq', source: 'faq', mod: { hidden: true } });
    expect(config.components.faq?.visible).toBe(true);
    expect(idOf).toEqual({ hero: 'b1', about: 'b2', faq: 'b4', footer: 'b5' });
  });

  it('without a report from the site, takes the fixed legacy order', () => {
    const legacy = site({ blocks: undefined, design: { aboutLayout: 'wall' } });
    expect(canonicalLayout(legacy).map((l) => `${l.type}${l.variant ? `:${l.variant}` : ''}`)).toEqual([
      'hero', 'intro:columns', 'gallery', 'schedule', 'contact', 'footer',
    ]);
  });
});

describe('adding a section (LT-252)', () => {
  it("an FAQ from the AI's draft, after the calendar, with a heading in the site's language", () => {
    const c = site({ defaultLanguage: 'en' });
    const at = defaultInsertIndex(c.blocks!.map((b) => b.type), 'faq');
    const { config, id, openPath } = addSection(c, 'faq', at, { items: [{ question: 'How do I cancel?', answer: 'Up to an hour before.' }] });
    expect(id).toBe('b8'); // past the highest id the page has used
    expect(config.blocks?.map((b) => b.type)).toEqual(['hero', 'intro', 'schedule', 'faq', 'contact', 'footer']);
    expect(config.components.faq).toEqual({ visible: true, title: 'Frequently asked questions', items: [{ question: 'How do I cancel?', answer: 'Up to an hour before.' }] });
    expect(openPath).toBeNull();
  });

  it('without a draft, opens the empty fields for the owner', () => {
    const faq = addSection(site(), 'faq', 3, null);
    expect(faq.config.components.faq).toEqual({ visible: true, title: 'שאלות נפוצות', items: [{ question: '', answer: '' }] });
    expect(faq.openPath).toBe('components.faq.items.0.question');

    const reviews = addSection(site(), 'quote', 3);
    expect(reviews.config.components.testimonials?.items).toEqual([{ text: '', name: '' }]);
    expect(reviews.openPath).toBe('components.testimonials.items.0.text');

    const stats = addSection(site(), 'stats', 2);
    expect(stats.config.blocks?.[2]).toMatchObject({ type: 'stats', props: { items: [{ value: '', label: '' }, { value: '', label: '' }, { value: '', label: '' }] } });
    expect(stats.openPath).toBe(`blocks.${stats.id}.props.items.0.value`);
  });

  it("switches back on the content a section shows, and drafts the steps into the block's own copy", () => {
    const hiddenGallery = site({ components: { ...site().components, portfolio: { ...site().components.portfolio, visible: false } } });
    expect(addSection(hiddenGallery, 'gallery', 2).config.components.portfolio.visible).toBe(true);

    const steps = addSection(site(), 'process', 2, { title: 'How it works', steps: [{ title: 'Pick', text: 'A service.' }, { title: 'Come in' }] });
    expect(steps.config.blocks?.[2]).toEqual({
      id: steps.id, type: 'process', variant: 'rail',
      props: { title: 'How it works', steps: [{ title: 'Pick', text: 'A service.' }, { title: 'Come in' }] },
    });
  });
});

describe('moving and saving (LT-252)', () => {
  it('moves a block to a position', () => {
    expect(moveBlockTo(site(), 'b7', 1).blocks?.map((b) => b.id)).toEqual(['b1', 'b7', 'b2', 'b3', 'b5']);
    expect(moveBlockTo(site(), 'nope', 1).blocks?.map((b) => b.id)).toEqual(['b1', 'b2', 'b3', 'b7', 'b5']);
  });

  it('leaves out what the owner left empty', () => {
    const c = site({
      components: {
        ...site().components,
        faq: { visible: true, title: 'Q', items: [{ question: 'Parking?', answer: 'Yes' }, { question: '', answer: '' }] },
        testimonials: { visible: true, title: 'R', items: [{ text: '', name: '' }] },
      },
      blocks: [
        ...site().blocks!,
        { id: 'b8', type: 'announcement', props: { text: '  ' } },
        { id: 'b9', type: 'process', props: { title: 'Steps', steps: [{ title: 'One' }, { title: '' }] } },
        { id: 'b10', type: 'stats', props: { items: [{ value: '', label: '' }] } },
      ],
    });
    const out = cleanForSave(c);
    expect(out.components.faq?.items).toEqual([{ question: 'Parking?', answer: 'Yes' }]);
    expect(out.components.testimonials?.items).toEqual([]);
    expect(out.blocks?.map((b) => b.id)).toEqual(['b1', 'b2', 'b3', 'b7', 'b5', 'b9']);
    expect(out.blocks?.[5].props).toEqual({ title: 'Steps', steps: [{ title: 'One' }] });
    // Nothing to leave out: the very same config.
    const clean = site();
    expect(cleanForSave(clean)).toBe(clean);
  });
});
