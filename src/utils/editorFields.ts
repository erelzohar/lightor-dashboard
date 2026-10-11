/**
 * LT-249 — what the site editor knows about each field the public site
 * annotates (lightor-ai-split-plan.md §4.4): its label (a key under
 * `siteEditor.fields`, with the item number for lists), text or image,
 * one line or several, its length, and where it saves. The lengths follow the
 * server: the CTA's 24 and the stamp's 40 are refused above that
 * (webConfigDto), the rest are what keeps a design readable — the AI endpoint
 * holds the same ones (aiController ELEMENT_PATHS).
 */

export type FieldKind = 'text' | 'image';

export interface FieldInfo {
  kind: FieldKind;
  /** i18n key under `siteEditor.fields`. */
  label: string;
  /** 1-based item number, for "Question 2". */
  n?: number;
  multiline: boolean;
  maxLength?: number;
  /** Where it saves: the site config, or the services API. */
  store: 'site' | 'service';
}

type Rule = [RegExp, (m: RegExpMatchArray) => Omit<FieldInfo, 'store'> & { store?: FieldInfo['store'] }];

const item = (m: RegExpMatchArray, at = 1) => Number(m[at]) + 1;
const line = (label: string, maxLength?: number) => ({ kind: 'text' as const, label, multiline: false, maxLength });
const para = (label: string, maxLength = 1200) => ({ kind: 'text' as const, label, multiline: true, maxLength });
const image = (label: string) => ({ kind: 'image' as const, label, multiline: false });

const RULES: Rule[] = [
  [/^components\.hero\.title$/, () => line('heroTitle', 120)],
  [/^components\.hero\.subtitle$/, () => line('heroSubtitle', 120)],
  [/^components\.hero\.description$/, () => para('heroDescription')],
  [/^components\.hero\.cta$/, () => line('heroCta', 24)],
  [/^components\.hero\.stamp$/, () => line('heroStamp', 40)],
  [/^components\.hero\.heroImageSrc$/, () => image('heroImage')],
  [/^components\.services\.title$/, () => line('sectionTitle', 60)],
  [/^components\.(about|portfolio|testimonials|faq|schedule|contact)\.title$/, () => line('sectionTitle', 120)],
  [/^components\.(about|portfolio|schedule|contact)\.description$/, () => para('sectionDescription')],
  [/^components\.about\.paragraphs\.intro$/, () => para('aboutIntro')],
  [/^components\.about\.paragraphs\.mission$/, () => para('aboutMission')],
  [/^components\.about\.features\.(\d+)\.title$/, (m) => ({ ...line('featureTitle', 80), n: item(m) })],
  [/^components\.about\.features\.(\d+)\.description$/, (m) => ({ ...para('featureDescription'), n: item(m) })],
  [/^components\.portfolio\.items\.(\d+)\.url$/, (m) => ({ ...image('galleryImage'), n: item(m) })],
  [/^components\.portfolio\.items\.(\d+)\.title$/, (m) => ({ ...line('galleryTitle', 80), n: item(m) })],
  [/^components\.portfolio\.items\.(\d+)\.description$/, (m) => ({ ...para('galleryDescription'), n: item(m) })],
  [/^components\.testimonials\.items\.(\d+)\.text$/, (m) => ({ ...para('quoteText', 1000), n: item(m) })],
  [/^components\.testimonials\.items\.(\d+)\.name$/, (m) => ({ ...line('quoteName', 100), n: item(m) })],
  [/^components\.faq\.items\.(\d+)\.question$/, (m) => ({ ...line('faqQuestion', 300), n: item(m) })],
  [/^components\.faq\.items\.(\d+)\.answer$/, (m) => ({ ...para('faqAnswer', 2000), n: item(m) })],
  [/^components\.footer\.description$/, () => para('footerDescription')],
  [/^components\.introPopup\.value$/, () => para('popupText')],
  [/^blocks\.[^.]+\.props\.text$/, () => para('blockText', 600)],
  [/^blocks\.[^.]+\.props\.attribution$/, () => line('blockAttribution', 100)],
  [/^blocks\.[^.]+\.props\.title$/, () => line('blockTitle', 120)],
  [/^blocks\.[^.]+\.props\.image$/, () => image('blockImage')],
  [/^blocks\.[^.]+\.props\.items\.(\d+)\.value$/, (m) => ({ ...line('statValue', 20), n: item(m) })],
  [/^blocks\.[^.]+\.props\.items\.(\d+)\.label$/, (m) => ({ ...line('statLabel', 60), n: item(m) })],
  [/^blocks\.[^.]+\.props\.steps\.(\d+)\.title$/, (m) => ({ ...line('stepTitle', 80), n: item(m) })],
  [/^blocks\.[^.]+\.props\.steps\.(\d+)\.text$/, (m) => ({ ...para('stepText', 600), n: item(m) })],
  [/^services\.[^.]+\.name$/, () => ({ ...line('serviceName', 100), store: 'service' })],
  [/^services\.[^.]+\.price$/, () => ({ ...line('servicePrice', 20), store: 'service' })],
  [/^services\.[^.]+\.image$/, () => ({ ...image('serviceImage'), store: 'service' })],
  [/^businessName$/, () => line('businessName', 80)],
  [/^logoImageName$/, () => image('logo')],
];

export const fieldInfo = (path: string): FieldInfo => {
  for (const [re, make] of RULES) {
    const m = path.match(re);
    if (m) return { store: 'site', ...make(m) };
  }
  return { kind: 'text', label: 'text', multiline: true, store: 'site' };
};

/**
 * Texts the AI endpoint takes (the server holds the same list): never an
 * image, a price or a design token.
 */
export const aiEditable = (path: string): boolean => {
  const info = fieldInfo(path);
  return info.kind === 'text' && info.label !== 'servicePrice' && info.label !== 'text';
};

/** Whether a gallery photo (removable from the gallery, unlike the hero or the logo). */
export const galleryItemPath = (path: string): string | null => {
  const m = path.match(/^(components\.portfolio\.items\.\d+)\.url$/);
  return m ? m[1] : null;
};

// ── A section's fields, read off the config ─────────────────────────────

/** Where each section draws its fields from (block types and legacy keys). */
const SECTION_SOURCES: Record<string, string[]> = {
  hero: ['components.hero'],
  about: ['components.about'],
  intro: ['components.about.title', 'components.about.description', 'components.about.paragraphs'],
  features: ['components.about.features'],
  portfolio: ['components.portfolio'],
  gallery: ['components.portfolio'],
  testimonials: ['components.testimonials'],
  quote: ['components.testimonials'],
  faq: ['components.faq'],
  schedule: ['components.schedule'],
  contact: ['components.contact'],
  footer: ['components.footer', 'businessName', 'logoImageName'],
  navbar: ['businessName', 'logoImageName', 'components.hero.cta'],
  services: ['components.services'],
  ledger: ['components.services'],
  priceCards: ['components.services'],
};

const leaves = (node: unknown, prefix: string, out: string[]) => {
  if (typeof node === 'string') out.push(prefix);
  else if (Array.isArray(node)) node.forEach((v, i) => leaves(v, `${prefix}.${i}`, out));
  else if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) leaves(v, `${prefix}.${k}`, out);
  }
};

/**
 * The fields of a section when the site has not listed them (the owner came
 * back to the section from one of its fields): every named text or image
 * under the section's sources, or under the block's own props.
 */
export const sectionFieldsFromConfig = (
  config: unknown,
  section: string,
  type: string | null,
): { path: string; kind: FieldKind }[] => {
  const root = (config ?? {}) as Record<string, unknown>;
  const paths: string[] = [];
  const block = Array.isArray(root.blocks) ? (root.blocks as { id: string; props?: unknown }[]).find((b) => b.id === section) : undefined;
  if (block?.props) leaves(block.props, `blocks.${section}.props`, paths);
  for (const source of SECTION_SOURCES[type ?? section] ?? []) {
    const value = source.split('.').reduce<unknown>((node, seg) => (node && typeof node === 'object' ? (node as Record<string, unknown>)[seg] : undefined), root);
    leaves(value, source, paths);
  }
  const seen = new Set<string>();
  return paths
    .filter((p) => !seen.has(p) && seen.add(p) && fieldInfo(p).label !== 'text')
    .map((p) => ({ path: p, kind: fieldInfo(p).kind }));
};
