import type { SiteBlock, WebConfig } from '../types';
import { getAt, setAt } from './editorPaths';
import { isLeadsSite } from './siteMode';

/**
 * LT-252 — the sections of a site, as the site editor lists, adds and moves
 * them. A composed page is its blocks. A legacy page (no blocks) is listed
 * as the blocks it would be — the site reports them (front
 * `services/legacyLayout.ts`, LT_LAYOUT) — and becomes them on the first
 * add, move or hide.
 *
 * What a section may be added with mirrors the server's composer
 * (readAvailability and reconcileBlocks): a block whose content is missing
 * is dropped on save there, so every section arrives with its content — from
 * the site's data, an AI draft, or fields the owner fills.
 */

/** A legacy page's section as the block it would be (front LT_LAYOUT). */
export interface LayoutBlock {
  key: string;
  type: string;
  variant?: string;
  source?: string;
  mod?: Record<string, unknown>;
}

/** One line of the sections list. `key`: the legacy section, while the page has no blocks yet. */
export interface SectionRow {
  id: string;
  type: string;
  hidden: boolean;
  key?: string;
}

export type SectionGroup = 'content' | 'images' | 'services' | 'info';
export type ContentSource = 'ready' | 'ai' | 'owner' | 'photos';
export type Unavailable =
  | 'max' | 'twoPhotos' | 'noServices' | 'noHours' | 'noAddress' | 'noSocial' | 'noLogo' | 'leadsSite' | 'noBookingText';
export interface SectionAvailability { ok: boolean; source?: ContentSource; reason?: Unavailable }

/** The server keeps at most this many blocks (webConfigDto blocksSchema). */
export const MAX_BLOCKS = 16;

/** What the owner can add, grouped, in the order the picker lists it. */
export const SECTION_CATALOG: { type: string; group: SectionGroup }[] = [
  { type: 'intro', group: 'content' },
  { type: 'features', group: 'content' },
  { type: 'faq', group: 'content' },
  { type: 'process', group: 'content' },
  { type: 'quote', group: 'content' },
  { type: 'stats', group: 'content' },
  { type: 'manifesto', group: 'content' },
  { type: 'pullQuote', group: 'content' },
  { type: 'announcement', group: 'content' },
  { type: 'gallery', group: 'images' },
  { type: 'interlude', group: 'images' },
  { type: 'photoPair', group: 'images' },
  { type: 'beforeAfter', group: 'images' },
  { type: 'ledger', group: 'services' },
  { type: 'priceCards', group: 'services' },
  { type: 'ticker', group: 'services' },
  { type: 'schedule', group: 'services' },
  { type: 'bookingBand', group: 'services' },
  { type: 'contact', group: 'info' },
  { type: 'hours', group: 'info' },
  { type: 'mapStrip', group: 'info' },
  { type: 'social', group: 'info' },
  { type: 'logoMark', group: 'info' },
  { type: 'footer', group: 'info' },
];

/** Headings a new section gets, in the site's own language (they are its content, not the dashboard's). */
const SITE_TITLES: Record<'faq' | 'testimonials' | 'about' | 'process', Record<string, string>> = {
  faq: { he: 'שאלות נפוצות', en: 'Frequently asked questions', ar: 'الأسئلة الشائعة', fr: 'Questions fréquentes', es: 'Preguntas frecuentes' },
  testimonials: { he: 'מה אומרים עלינו', en: 'What our clients say', ar: 'ماذا يقول عملاؤنا', fr: 'Ce que disent nos clients', es: 'Lo que dicen nuestros clientes' },
  about: { he: 'אודות', en: 'About us', ar: 'من نحن', fr: 'À propos', es: 'Sobre nosotros' },
  process: { he: 'איך זה עובד', en: 'How it works', ar: 'كيف يعمل', fr: 'Comment ça marche', es: 'Cómo funciona' },
};
const siteTitle = (config: WebConfig, of: keyof typeof SITE_TITLES): string =>
  SITE_TITLES[of][(config.defaultLanguage || 'he').slice(0, 2)] ?? SITE_TITLES[of].he;

// The composer's reading of the about layout (lightor-back services/composer.ts).
const INTRO_VARIANT: Record<string, string> = { manifesto: 'manifesto', wall: 'columns' };
const FEATURES_VARIANT: Record<string, string> = { cards: 'tiles', band: 'band', split: 'band', manifesto: 'band', wall: 'wall', timeline: 'timeline', sticky: 'sticky' };

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const list = (v: unknown): Record<string, unknown>[] =>
  (Array.isArray(v) ? v : []).filter((x): x is Record<string, unknown> => !!x && typeof x === 'object');
const photosOf = (config: WebConfig): number => (config.components?.portfolio?.items ?? []).filter((i) => str(i?.url)).length;
const hasServices = (config: WebConfig): boolean => (config.appointmentTypes ?? []).some((a) => str(a?.name));

const READY: SectionAvailability = { ok: true, source: 'ready' };

/** Whether `type` can be added to this page now, and where its content comes from. */
export const availabilityOf = (config: WebConfig, type: string, pageSize: number): SectionAvailability => {
  if (pageSize >= MAX_BLOCKS) return { ok: false, reason: 'max' };
  const c = config.components;
  const photos = photosOf(config);
  switch (type) {
    case 'intro':
      return { ok: true, source: str(c?.about?.paragraphs?.intro) ? 'ready' : 'ai' };
    case 'features':
      return { ok: true, source: (c?.about?.features ?? []).some((f) => str(f?.title)) ? 'ready' : 'ai' };
    case 'faq':
      return { ok: true, source: (c?.faq?.items ?? []).some((i) => str(i?.question) && str(i?.answer)) ? 'ready' : 'ai' };
    case 'process':
    case 'manifesto':
    case 'pullQuote':
      return { ok: true, source: 'ai' };
    // Reviews and numbers are facts only the owner has: never drafted.
    case 'quote':
      return { ok: true, source: (c?.testimonials?.items ?? []).some((i) => str(i?.text)) ? 'ready' : 'owner' };
    case 'stats':
    case 'announcement':
      return { ok: true, source: 'owner' };
    // LT-320: an emptied gallery was a dead end ("add photos first", with no
    // way to add one here); now it comes back empty, ready for the owner's photos.
    case 'gallery':
      return photos > 0 ? READY : { ok: true, source: 'photos' };
    case 'interlude':
      return photos > 1 || str(c?.hero?.heroImageSrc) ? READY : { ok: false, reason: 'twoPhotos' };
    case 'photoPair':
    case 'beforeAfter':
      return photos > 1 ? READY : { ok: false, reason: 'twoPhotos' };
    case 'ledger':
    case 'priceCards':
    case 'ticker':
      return hasServices(config) ? READY : { ok: false, reason: 'noServices' };
    case 'schedule':
      if (isLeadsSite(config)) return { ok: false, reason: 'leadsSite' };
      return hasServices(config) ? READY : { ok: false, reason: 'noServices' };
    case 'bookingBand':
      if (isLeadsSite(config)) return { ok: false, reason: 'leadsSite' };
      return str(c?.schedule?.description) ? READY : { ok: false, reason: 'noBookingText' };
    case 'hours':
      return (config.workingDays ?? []).some((h) => str(h)) ? READY : { ok: false, reason: 'noHours' };
    case 'mapStrip':
      return str(config.address?.street) || str(config.address?.city) ? READY : { ok: false, reason: 'noAddress' };
    case 'social':
      return Object.values(config.social ?? {}).some((v) => str(v)) ? READY : { ok: false, reason: 'noSocial' };
    case 'logoMark':
      return str(config.logoImageName) ? READY : { ok: false, reason: 'noLogo' };
    case 'contact':
    case 'footer':
      return READY;
    default:
      return { ok: false };
  }
};

// ── The page as a list ──────────────────────────────────────────────────

const hiddenMod = (visible: boolean | undefined) => (visible === false ? { mod: { hidden: true } } : {});

/**
 * A legacy page's sections when the site has not reported them (an older
 * site build): the fixed order App draws without a vibe preset.
 */
export const canonicalLayout = (config: WebConfig): LayoutBlock[] => {
  const c = config.components;
  const aboutLayout = config.design?.aboutLayout ?? '';
  const out: LayoutBlock[] = [];
  if (c?.hero) out.push({ key: 'hero', type: 'hero', source: 'hero', ...hiddenMod(c.hero.visible) });
  if (c?.about) {
    out.push({ key: 'about', type: 'intro', variant: INTRO_VARIANT[aboutLayout] ?? 'plain', source: 'about', ...hiddenMod(c.about.visible) });
    if (c.about.features?.length) out.push({ key: 'about', type: 'features', variant: FEATURES_VARIANT[aboutLayout] ?? 'tiles', source: 'about.features', ...hiddenMod(c.about.visible) });
  }
  if (config.design?.servicesLayout === 'ledger' && hasServices(config)) out.push({ key: 'services', type: 'ledger', source: 'appointmentTypes' });
  if (c?.portfolio) out.push({ key: 'portfolio', type: 'gallery', source: 'portfolio', ...hiddenMod(c.portfolio.visible) });
  if (c?.testimonials?.items?.length) out.push({ key: 'testimonials', type: 'quote', source: 'testimonials', ...hiddenMod(c.testimonials.visible) });
  if (c?.schedule && !isLeadsSite(config) && hasServices(config)) out.push({ key: 'schedule', type: 'schedule', source: 'schedule' });
  if (c?.faq?.items?.length) out.push({ key: 'faq', type: 'faq', source: 'faq', ...hiddenMod(c.faq.visible) });
  if (c?.contact) out.push({ key: 'contact', type: 'contact', source: 'contact', ...hiddenMod(c.contact.visible) });
  if (c?.footer) out.push({ key: 'footer', type: 'footer', source: 'footer', ...hiddenMod(c.footer.visible) });
  return out;
};

/** The page's sections in order: its blocks, or — on a legacy page — the blocks it would be (ids b1…bn). */
export const rowsOf = (config: WebConfig, layout: LayoutBlock[] | null): SectionRow[] =>
  config.blocks?.length
    ? config.blocks.map((b) => ({ id: b.id, type: b.type, hidden: !!b.mod?.hidden }))
    : (layout?.length ? layout : canonicalLayout(config)).map((l, i) => ({ id: `b${i + 1}`, type: l.type, hidden: !!l.mod?.hidden, key: l.key }));

const VISIBLE_KEY: Record<string, string> = {
  hero: 'hero', about: 'about', portfolio: 'portfolio', testimonials: 'testimonials', faq: 'faq', contact: 'contact', footer: 'footer',
};

/**
 * A legacy page as blocks, ids b1…bn in the order it is drawn — the ids its
 * rows already carry. A section the owner hid becomes a hidden block with its
 * flag back on: the server keeps a section's content only while the flag is
 * on (composer readAvailability), and the block keeps it out of sight.
 * `idOf` maps each legacy section to its first block, for a selection.
 */
export const toBlocks = (config: WebConfig, layout: LayoutBlock[]): { config: WebConfig; idOf: Record<string, string> } => {
  const idOf: Record<string, string> = {};
  let next = config;
  const blocks: SiteBlock[] = layout.map(({ key, ...block }, i) => {
    const id = `b${i + 1}`;
    if (!(key in idOf)) idOf[key] = id;
    const vk = VISIBLE_KEY[key];
    if (block.mod?.hidden && vk && getAt(next, `components.${vk}.visible`) === false) next = setAt(next, `components.${vk}.visible`, true);
    return { id, ...block };
  });
  return { config: { ...next, blocks }, idOf };
};

/** The page with blocks: as it is, or a legacy page turned into its layout. */
export const withBlocks = (config: WebConfig, layout: LayoutBlock[] | null): { config: WebConfig; idOf: Record<string, string> } =>
  config.blocks?.length ? { config, idOf: {} } : toBlocks(config, layout?.length ? layout : canonicalLayout(config));

// ── Where a new section goes ────────────────────────────────────────────

const TAIL = ['faq', 'hours', 'mapStrip', 'logoMark', 'contact', 'visit', 'social', 'footer'];

/**
 * The recommended place for a new `type` among `types` (the page's sections
 * in order): the composer's page grammar — the work before the offer, the
 * reviews before booking, the FAQ after it, the business details at the
 * close. Never above the opening or below the footer.
 */
export const defaultInsertIndex = (types: string[], type: string): number => {
  const firstOf = (of: string[]) => { const i = types.findIndex((t) => of.includes(t)); return i === -1 ? types.length : i; };
  const afterLast = (of: string[]) => { let i = -1; types.forEach((t, k) => { if (of.includes(t)) i = k; }); return i === -1 ? null : i + 1; };
  let at: number;
  switch (type) {
    case 'announcement':
    case 'ticker':
      at = afterLast(['hero']) ?? 0; break;
    case 'intro':
    case 'manifesto':
    case 'stats':
    case 'pullQuote':
      at = afterLast(['hero', 'ticker', 'announcement']) ?? 0; break;
    case 'features':
    case 'process':
      at = afterLast(['intro']) ?? firstOf(['gallery', 'photoPair', 'beforeAfter', 'interlude', 'ledger', 'priceCards', 'quote', 'bookingBand', 'schedule', ...TAIL]); break;
    case 'gallery':
    case 'interlude':
    case 'photoPair':
    case 'beforeAfter':
      at = firstOf(['ledger', 'priceCards', 'quote', 'bookingBand', 'schedule', ...TAIL]); break;
    case 'ledger':
    case 'priceCards':
      at = firstOf(['quote', 'bookingBand', 'schedule', ...TAIL]); break;
    case 'quote':
      at = firstOf(['bookingBand', 'schedule', ...TAIL]); break;
    case 'bookingBand':
      at = firstOf(['schedule', ...TAIL]); break;
    case 'schedule':
      at = firstOf(TAIL); break;
    case 'faq':
      at = afterLast(['schedule']) ?? firstOf(TAIL.filter((t) => t !== 'faq')); break;
    case 'hours':
    case 'mapStrip':
    case 'logoMark':
      at = firstOf(['contact', 'visit', 'social', 'footer']); break;
    case 'contact':
      at = firstOf(['social', 'footer']); break;
    default:
      at = firstOf(['footer']);
  }
  return clampIndex(types, at);
};

/** An insert position kept below the opening and above the footer. */
export const clampIndex = (types: string[], at: number): number => {
  const lo = types[0] === 'hero' ? 1 : 0;
  const hi = types.length && types[types.length - 1] === 'footer' ? types.length - 1 : types.length;
  return Math.min(Math.max(at, lo), Math.max(lo, hi));
};

/** The page with block `id` moved to position `to`. */
export const moveBlockTo = <T extends WebConfig>(config: T, id: string, to: number): T => {
  const blocks = [...(config.blocks ?? [])];
  const from = blocks.findIndex((b) => b.id === id);
  if (from === -1 || to < 0 || to >= blocks.length || from === to) return config;
  const [moved] = blocks.splice(from, 1);
  blocks.splice(to, 0, moved);
  return { ...config, blocks };
};

// ── Adding a section ────────────────────────────────────────────────────

const nextBlockId = (blocks: SiteBlock[]): string => {
  const top = Math.max(0, ...blocks.map((b) => Number(/^b(\d+)$/.exec(b.id)?.[1] ?? 0)));
  return `b${top + 1}`;
};

const blockFor = (config: WebConfig, type: string, id: string): SiteBlock => {
  const aboutLayout = config.design?.aboutLayout ?? '';
  switch (type) {
    case 'intro': return { id, type, variant: INTRO_VARIANT[aboutLayout] ?? 'plain', source: 'about' };
    case 'features': return { id, type, variant: FEATURES_VARIANT[aboutLayout] ?? 'tiles', source: 'about.features' };
    case 'gallery':
    case 'interlude':
    case 'beforeAfter': return { id, type, source: 'portfolio' };
    case 'photoPair': return { id, type, variant: 'offset', source: 'portfolio', props: { from: photosOf(config) > 2 ? 1 : 0 } };
    case 'quote': return { id, type, source: 'testimonials' };
    case 'faq': return { id, type, source: 'faq' };
    case 'ledger':
    case 'priceCards':
    case 'ticker': return { id, type, source: 'appointmentTypes' };
    case 'schedule': return { id, type, source: 'schedule' };
    case 'bookingBand': return { id, type, source: 'schedule.description' };
    case 'hours': return { id, type, variant: 'table', source: 'workingDays' };
    case 'mapStrip': return { id, type, source: 'address' };
    case 'logoMark': return { id, type, source: 'logoImageName' };
    case 'social': return { id, type, source: 'social' };
    case 'contact': return { id, type, source: 'contact' };
    case 'footer': return { id, type, source: 'footer' };
    case 'process': return { id, type, variant: 'rail', props: { steps: [] } };
    case 'stats': return { id, type, props: { items: [] } };
    default: return { id, type, props: { text: '' } }; // announcement, manifesto, pullQuote
  }
};

/** What an AI draft brings (lightor-back draftSectionWithAI). */
export type SectionDraft = Record<string, unknown>;

/**
 * The page with a new `type` section at `at`, its content in place: what the
 * site already has (switched back on), the AI's `draft`, or empty fields for
 * the owner — `openPath` is the first one to fill, when there is one.
 * `config` must have its blocks (withBlocks).
 */
export const addSection = (
  config: WebConfig,
  type: string,
  at: number,
  draft: SectionDraft | null = null,
): { config: WebConfig; id: string; openPath: string | null } => {
  const blocks = config.blocks ?? [];
  const id = nextBlockId(blocks);
  const block = blockFor(config, type, id);
  let next: WebConfig = config;
  let openPath: string | null = null;
  const on = (key: string) => { if (getAt(next, `components.${key}.visible`) === false) next = setAt(next, `components.${key}.visible`, true); };
  const titled = (key: 'faq' | 'testimonials' | 'about', of: keyof typeof SITE_TITLES) => {
    if (!str(getAt(next, `components.${key}.title`))) next = setAt(next, `components.${key}.title`, siteTitle(next, of));
  };
  const source = availabilityOf(config, type, 0).source;

  switch (type) {
    case 'intro':
      on('about');
      titled('about', 'about');
      if (draft && str(draft.intro)) {
        next = setAt(next, 'components.about.paragraphs.intro', str(draft.intro));
        if (str(draft.mission)) next = setAt(next, 'components.about.paragraphs.mission', str(draft.mission));
      } else if (source !== 'ready') openPath = 'components.about.paragraphs.intro';
      break;
    case 'features': {
      on('about');
      const items = list(draft?.items).filter((i) => str(i.title));
      if (items.length) next = setAt(next, 'components.about.features', items.map((i) => ({ icon: str(i.icon) || 'Sparkles', title: str(i.title), description: str(i.description) })));
      else if (source !== 'ready') {
        next = setAt(next, 'components.about.features', [{ icon: 'Sparkles', title: '', description: '' }]);
        openPath = 'components.about.features.0.title';
      }
      break;
    }
    case 'faq': {
      const items = list(draft?.items).filter((i) => str(i.question) && str(i.answer));
      if (items.length) {
        next = setAt(next, 'components.faq', {
          visible: true,
          title: str(next.components?.faq?.title) || str(draft?.title) || siteTitle(next, 'faq'),
          items: items.map((i) => ({ question: str(i.question), answer: str(i.answer) })),
        });
      } else if (source === 'ready') {
        on('faq');
        titled('faq', 'faq');
      } else {
        next = setAt(next, 'components.faq', { visible: true, title: str(next.components?.faq?.title) || siteTitle(next, 'faq'), items: [{ question: '', answer: '' }] });
        openPath = 'components.faq.items.0.question';
      }
      break;
    }
    case 'quote':
      if (source === 'ready') {
        on('testimonials');
        titled('testimonials', 'testimonials');
      } else {
        next = setAt(next, 'components.testimonials', { visible: true, title: str(next.components?.testimonials?.title) || siteTitle(next, 'testimonials'), items: [{ text: '', name: '' }] });
        openPath = 'components.testimonials.items.0.text';
      }
      break;
    case 'process': {
      const steps = list(draft?.steps).filter((s) => str(s.title)).map((s) => ({ title: str(s.title), ...(str(s.text) ? { text: str(s.text) } : {}) }));
      block.props = { title: str(draft?.title) || siteTitle(next, 'process'), steps: steps.length ? steps : [{ title: '', text: '' }] };
      if (!steps.length) openPath = `blocks.${id}.props.steps.0.title`;
      break;
    }
    case 'stats':
      block.props = { items: [{ value: '', label: '' }, { value: '', label: '' }, { value: '', label: '' }] };
      openPath = `blocks.${id}.props.items.0.value`;
      break;
    case 'announcement':
    case 'manifesto':
    case 'pullQuote':
      block.props = { text: str(draft?.text) };
      if (!str(draft?.text)) openPath = `blocks.${id}.props.text`;
      break;
    case 'gallery':
    case 'interlude':
    case 'photoPair':
    case 'beforeAfter':
      on('portfolio');
      break;
    case 'contact':
      on('contact');
      break;
    case 'footer':
      on('footer');
      break;
    default:
      break;
  }

  const placed = [...(next.blocks ?? blocks)];
  placed.splice(Math.min(Math.max(at, 0), placed.length), 0, block);
  return { config: { ...next, blocks: placed }, id, openPath };
};

const GALLERY_TITLES: Record<string, string> = { he: 'גלריה', en: 'Gallery', ar: 'معرض الصور', fr: 'Galerie', es: 'Galería' };

/**
 * LT-320: a photo uploaded in the editor joins the gallery, and the gallery
 * shows on the page: a composed page whose gallery block went with its last
 * photo (the server drops a block with no content) gets it back where it
 * belongs, as the server would on save.
 */
export const addGalleryPhoto = (config: WebConfig, imageName: string): WebConfig => {
  const portfolio = config.components?.portfolio;
  let next = setAt(config, 'components.portfolio.items', [...(portfolio?.items ?? []), { url: imageName, title: '', description: '' }]);
  if (portfolio?.visible === false) next = setAt(next, 'components.portfolio.visible', true);
  if (!str(portfolio?.title)) {
    next = setAt(next, 'components.portfolio.title', GALLERY_TITLES[(config.defaultLanguage || 'he').slice(0, 2)] ?? GALLERY_TITLES.he);
  }
  const types = (next.blocks ?? []).map((b) => b.type);
  if (types.length && !types.some((t) => t === 'gallery' || t === 'photoPair' || t === 'beforeAfter')) {
    next = addSection(next, 'gallery', defaultInsertIndex(types, 'gallery')).config;
  }
  return next;
};

// ── Before a save ───────────────────────────────────────────────────────

/**
 * What goes to the server: list items the owner left empty dropped, and the
 * own-copy blocks with nothing left in them removed (an empty FAQ, review or
 * step must not reach the live site; the server drops a block whose section
 * has no content, but it cannot tell an empty step from a written one).
 */
export const cleanForSave = (config: WebConfig): WebConfig => {
  let next = config;
  const faq = config.components?.faq?.items;
  if (faq?.some((i) => !str(i?.question) || !str(i?.answer))) {
    next = setAt(next, 'components.faq.items', faq.filter((i) => str(i?.question) && str(i?.answer)));
  }
  const reviews = config.components?.testimonials?.items;
  if (reviews?.some((i) => !str(i?.text))) {
    next = setAt(next, 'components.testimonials.items', reviews.filter((i) => str(i?.text)));
  }
  const features = config.components?.about?.features;
  if (features?.some((f) => !str(f?.title) && !str(f?.description))) {
    next = setAt(next, 'components.about.features', features.filter((f) => str(f?.title) || str(f?.description)));
  }
  if (next.blocks?.length) {
    let changed = false;
    const blocks = next.blocks.flatMap((b) => {
      const p = (b.props ?? {}) as Record<string, unknown>;
      if (b.type === 'process' && Array.isArray(p.steps)) {
        const steps = list(p.steps).filter((s) => str(s.title));
        if (steps.length === p.steps.length) return [b];
        changed = true;
        return steps.length ? [{ ...b, props: { ...p, steps } }] : [];
      }
      if (b.type === 'stats' && Array.isArray(p.items)) {
        const items = list(p.items).filter((s) => str(s.value) && str(s.label));
        if (items.length === p.items.length) return [b];
        changed = true;
        return items.length ? [{ ...b, props: { ...p, items } }] : [];
      }
      if ((b.type === 'announcement' || b.type === 'manifesto' || b.type === 'pullQuote') && 'text' in p && !str(p.text)) {
        changed = true;
        return [];
      }
      return [b];
    });
    if (changed) next = { ...next, blocks };
  }
  return next;
};
