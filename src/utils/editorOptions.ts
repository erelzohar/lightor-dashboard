/**
 * LT-249 — the design choices the site editor offers. The values are the
 * server's enums (lightor-back webConfigModel designSchema) and the block
 * variants the public site draws (lightor-front ComposedPage); the names are
 * here rather than in the locale files because they are design vocabulary
 * offered in Hebrew and English (other UI languages read the English).
 */

import { blogLooksOf } from './blogLooks';

export type Lang = 'he' | 'en';
type Named = Record<string, { he: string; en: string }>;

export const optionLabel = (names: Named, value: string, lang: string): string => {
  const entry = names[value];
  if (!entry) return value;
  return lang === 'he' ? entry.he : entry.en;
};

/**
 * LT-605: a look whose value another section already names differently ('wall'
 * is the highlights' typographic wall and the products' wall of shelves).
 */
const OWN_NAMES: Record<string, Named> = {
  products: { wall: { he: 'קיר מדפים', en: 'Wall of shelves' } },
  // LT-610: the blog's section on the home page (Erel's pastes).
  blog: {
    latest: { he: 'הפוסטים האחרונים', en: 'Latest posts' },
    article: { he: 'כרטיסי מאמר רחבים', en: 'Wide article cards' },
    carousel: { he: 'קרוסלה מעוצבת', en: 'Designed carousel' },
  },
};
export const sectionLabel = (section: string, value: string, lang: string): string =>
  optionLabel(OWN_NAMES[section]?.[value] ? OWN_NAMES[section] : LAYOUTS, value, lang);

export const PRESETS: Named = {
  luxe: { he: 'יוקרתי', en: 'Luxe' },
  editorial: { he: 'מגזיני', en: 'Editorial' },
  boldStartup: { he: 'נועז', en: 'Bold' },
  corporate: { he: 'עסקי', en: 'Corporate' },
  playful: { he: 'שובב', en: 'Playful' },
  minimal: { he: 'מינימליסטי', en: 'Minimal' },
  warmOrganic: { he: 'חם וטבעי', en: 'Warm organic' },
  brutalist: { he: 'גולמי', en: 'Brutalist' },
  boutique: { he: 'בוטיק', en: 'Boutique' },
  bistro: { he: 'ביסטרו', en: 'Bistro' },
  industrial: { he: 'תעשייתי', en: 'Industrial' },
  atelier: { he: 'סטודיו', en: 'Atelier' },
  serene: { he: 'רגוע', en: 'Serene' },
  electric: { he: 'חשמלי', en: 'Electric' },
  underground: { he: 'אנדרגראונד', en: 'Underground' },
  festive: { he: 'חגיגי', en: 'Festive' },
  crisp: { he: 'נקי וחד', en: 'Crisp' },
  gallery: { he: 'גלריה', en: 'Gallery' },
  heritage: { he: 'מסורתי', en: 'Heritage' },
  earthy: { he: 'אדמתי', en: 'Earthy' },
};

/** LT-545: a product's card, and the layouts of a product's own page. */
export const PRODUCT_CARDS: Named = {
  plain: { he: 'נקי', en: 'Plain' },
  framed: { he: 'במסגרת', en: 'Framed' },
  overlay: { he: 'טקסט על התמונה', en: 'Words on the picture' },
  button: { he: 'עם כפתור', en: 'With a button' },
  // LT-588
  reveal: { he: 'פרטים שנחשפים', en: 'Details revealed' },
  options: { he: 'צבעים ומידות', en: 'Colours and sizes' },
};
export const PRODUCT_PAGE_LAYOUTS: Named = {
  side: { he: 'תמונות בצד', en: 'Pictures beside' },
  hero: { he: 'תמונה גדולה מעל', en: 'Large picture above' },
  gallery: { he: 'גלריה ופרטים צמודים', en: 'Gallery, details in view' },
  detail: { he: 'דף חנות', en: 'Shop page' },
  // LT-605
  stand: { he: 'על מדף לבן', en: 'On a white ledge' },
  stage: { he: 'במה מרחפת', en: 'Floating stage' },
};
/** LT-610: the blog's page and a post's page (Erel's pastes and the post's two). */
export const BLOG_PAGE_LAYOUTS: Named = {
  grid: { he: 'רשת כרטיסים', en: 'Grid of cards' },
  tagged: { he: 'תווית בפינה', en: 'Tagged cards' },
  glass: { he: 'כרטיסי זכוכית', en: 'Glass cards' },
};
export const POST_PAGE_LAYOUTS: Named = {
  classic: { he: 'עמודה מתחת לתמונה', en: 'A column under the picture' },
  wide: { he: 'תמונה רחבה מאחורי הכותרת', en: 'The picture wide behind the title' },
};
/** The products page's own layouts: the still ones (the moving ones suit a handful); LT-588 by category. */
export const PRODUCTS_PAGE_LAYOUTS = ['well', 'swap', 'bento', 'list', 'rows', 'shelves', 'shop', 'wall'];
/** The layouts that draw a card per product (the owner's card). */
export const CARD_LAYOUTS = ['well', 'swap', 'shop'];

export const FONTS: Named = {
  inter: { he: 'Inter', en: 'Inter' },
  raleway: { he: 'Raleway', en: 'Raleway' },
  playfair: { he: 'Playfair', en: 'Playfair' },
  montserrat: { he: 'Montserrat', en: 'Montserrat' },
  poppins: { he: 'Poppins', en: 'Poppins' },
  anton: { he: 'Anton', en: 'Anton' },
  archivo: { he: 'Archivo', en: 'Archivo' },
  cormorant: { he: 'Cormorant', en: 'Cormorant' },
  bellefair: { he: 'Bellefair', en: 'Bellefair' },
  secularone: { he: 'Secular One', en: 'Secular One' },
  varela: { he: 'Varela Round', en: 'Varela Round' },
  sora: { he: 'Sora', en: 'Sora' },
  spacemono: { he: 'Space Mono', en: 'Space Mono' },
};

export const BUTTON_STYLES: Named = {
  solid: { he: 'מלא', en: 'Solid' },
  gradient: { he: 'מעבר צבע', en: 'Gradient' },
  outline: { he: 'מסגרת', en: 'Outline' },
  ghost: { he: 'שקוף', en: 'Ghost' },
  // LT-605: festive's raised button whose letters roll and whose lines splash out.
  splash: { he: 'תלת ממד', en: '3D splash' },
};

export const RADII: Named = {
  none: { he: 'ישרות', en: 'Square' },
  sm: { he: 'מעט מעוגלות', en: 'Slightly rounded' },
  md: { he: 'מעוגלות', en: 'Rounded' },
  lg: { he: 'מעוגלות מאוד', en: 'Very rounded' },
  xl: { he: 'רכות', en: 'Soft' },
  full: { he: 'עגולות', en: 'Round' },
};

export const CARD_STYLES: Named = {
  flat: { he: 'שטוחים', en: 'Flat' },
  elevated: { he: 'מוגבהים', en: 'Elevated' },
  glass: { he: 'זכוכית', en: 'Glass' },
  bordered: { he: 'עם מסגרת', en: 'Bordered' },
};

export const THEMES: Named = {
  light: { he: 'בהיר', en: 'Light' },
  dark: { he: 'כהה', en: 'Dark' },
};

/** Layout names across sections (a value means the same look wherever it appears). */
/**
 * The hero's animated background (LT-287) — `components.hero.bgType`, drawn by
 * the public site's Vanta effects (lightor-front Hero.tsx VANTA_IMPORTERS).
 * 'gradient', 'rings' and anything unknown render fog there, so they read as fog here.
 */
export const HERO_BACKGROUNDS = ['fog', 'clouds', 'clouds2', 'topology', 'trunk', 'birds', 'net', 'sonar', 'metal'] as const;
/** LT-531: these two are `design.decor`, which the site draws in place of `bgType`. */
export const DECOR_BACKGROUNDS: readonly string[] = ['sonar', 'metal'];
/** LT-531: the heroes that draw their own backdrop; a background chip would do nothing there. */
export const OWN_BACKDROP_HEROES: readonly string[] = ['parallax', 'expand', 'aero', 'collage', 'slant', 'mesh'];

/**
 * LT-570 (Erel 2026-11-03/04): the paid designs, by the section they lay out
 * (first the ten that move), and the two backdrops among them. A plan without
 * them (the free one) shows each one's section default (FREE_DEFAULTS, the
 * same as lightor-front services/paidDesigns.ts); the owner's pick is kept.
 * LT-583: the products' orbit (it turns by itself) joins them.
 */
export const PAID_LAYOUTS: Readonly<Record<string, readonly string[]>> = {
  // LT-605: the hero over a live field of colours.
  hero: ['parallax', 'expand', 'mesh'],
  gallery: ['clothesline', 'cascade', 'curve'],
  portfolio: ['clothesline', 'cascade', 'curve'],
  products: ['belt', 'hanger', 'coverflow', 'orbit'],
  // LT-588: the highlights that switch their pictures by themselves.
  features: ['stack'],
  // LT-591: the contact section with floating bubbles.
  contact: ['bubbles'],
  // LT-605: the product page whose product floats by itself.
  productPage: ['stage'],
};
export const PAID_BACKGROUNDS: readonly string[] = ['sonar', 'metal'];
export const FREE_DEFAULTS: Readonly<Record<string, string>> = { hero: 'fullbleed', gallery: 'masonry', portfolio: 'masonry', products: 'well', features: 'tiles', contact: 'split', productPage: 'side' };
export const isPaidDesign = (section: string, value: unknown): boolean =>
  typeof value === 'string' && (PAID_LAYOUTS[section] ?? []).includes(value);

export const HERO_BACKGROUND_NAMES: Named = {
  fog: { he: 'ערפל', en: 'Fog' },
  clouds: { he: 'עננים', en: 'Clouds' },
  clouds2: { he: 'שמיים', en: 'Sky' },
  topology: { he: 'קווי מתאר', en: 'Contours' },
  trunk: { he: 'ספירלה', en: 'Spiral' },
  birds: { he: 'ציפורים', en: 'Birds' },
  net: { he: 'רשת', en: 'Network' },
  sonar: { he: 'נקודות', en: 'Sonar' },
  metal: { he: 'מתכת נוזלית', en: 'Liquid metal' },
};
export const heroBackgroundOf = (raw: unknown, decor?: unknown): string => {
  if (typeof decor === 'string' && DECOR_BACKGROUNDS.includes(decor)) return decor;
  return typeof raw === 'string' && (HERO_BACKGROUNDS as readonly string[]).includes(raw) && !DECOR_BACKGROUNDS.includes(raw) ? raw : 'fog';
};

export const LAYOUTS: Named = {
  // hero
  'image-right': { he: 'תמונה בצד', en: 'Image beside' },
  centered: { he: 'ממורכז', en: 'Centered' },
  split: { he: 'מפוצל', en: 'Split' },
  'text-first': { he: 'טקסט קודם', en: 'Text first' },
  'poster-split': { he: 'פוסטר מפוצל', en: 'Poster split' },
  'poster-statement': { he: 'פוסטר', en: 'Poster' },
  fullbleed: { he: 'תמונה מלאה', en: 'Full image' },
  parallax: { he: 'שכבות בגלילה', en: 'Parallax' },
  expand: { he: 'תמונה נפתחת', en: 'Opening image' },
  aero: { he: 'חצי תמונה', en: 'Half image' },
  collage: { he: 'קולאז׳', en: 'Collage' },
  // about
  cards: { he: 'כרטיסים', en: 'Cards' },
  band: { he: 'רצועה', en: 'Band' },
  manifesto: { he: 'הצהרה', en: 'Statement' },
  wall: { he: 'קיר', en: 'Wall' },
  timeline: { he: 'ציר זמן', en: 'Timeline' },
  sticky: { he: 'צמוד', en: 'Sticky' },
  plain: { he: 'פשוט', en: 'Plain' },
  columns: { he: 'עמודות', en: 'Columns' },
  tiles: { he: 'אריחים', en: 'Tiles' },
  steps: { he: 'שורת שלבים', en: 'Steps in a row' },
  pinned: { he: 'פתקים נעוצים', en: 'Pinned notes' },
  orbs: { he: 'עיגולים', en: 'Medallions' },
  stack: { he: 'רשימה עם תמונות', en: 'List with pictures' },
  // products
  well: { he: 'אריחים שקטים', en: 'Quiet tiles' },
  list: { he: 'רשימה עם מחירים', en: 'List with prices' },
  swap: { he: 'תמונה מתחלפת', en: 'Swapping picture' },
  belt: { he: 'מסוע', en: 'Conveyor' },
  hanger: { he: 'קולב', en: 'Clothes rail' },
  coverflow: { he: 'קלפים בתלת ממד', en: 'Coverflow' },
  orbit: { he: 'מסלול', en: 'Orbit' },
  drops: { he: 'כרטיס מוצרים', en: 'Products card' },
  rows: { he: 'שורה לכל קטגוריה', en: 'A row per category' },
  shelves: { he: 'כרטיס לכל קטגוריה', en: 'A card per category' },
  shop: { he: 'חנות עם סינון', en: 'Shop with filters' },
  // gallery
  grid: { he: 'רשת', en: 'Grid' },
  masonry: { he: 'פסיפס', en: 'Masonry' },
  filmstrip: { he: 'פס צילום', en: 'Filmstrip' },
  polaroid: { he: 'פולארויד', en: 'Polaroid' },
  flash: { he: 'פלאש', en: 'Flash' },
  bento: { he: 'בנטו', en: 'Bento' },
  scroller: { he: 'גלילה', en: 'Scroller' },
  spotlight: { he: 'זרקור', en: 'Spotlight' },
  carousel: { he: 'קרוסלה', en: 'Carousel' },
  clothesline: { he: 'חבל תמונות', en: 'Clothesline' },
  curve: { he: 'קשת', en: 'Curve' },
  cascade: { he: 'מפל', en: 'Cascade' },
  // quotes
  quote: { he: 'ציטוט גדול', en: 'Big quote' },
  bubbles: { he: 'בועות', en: 'Bubbles' },
  marquee: { he: 'רצועה נעה', en: 'Marquee' },
  // faq
  lines: { he: 'שורות', en: 'Lines' },
  numbered: { he: 'ממוספר', en: 'Numbered' },
  pills: { he: 'כמוסות', en: 'Pills' },
  // schedule
  card: { he: 'כרטיס', en: 'Card' },
  flat: { he: 'שטוח', en: 'Flat' },
  inset: { he: 'משוקע', en: 'Inset' },
  // contact
  stacked: { he: 'מוערם', en: 'Stacked' },
  poster: { he: 'פוסטר', en: 'Poster' },
  editorial: { he: 'מגזיני', en: 'Editorial' },
  statement: { he: 'הצהרה', en: 'Statement' },
  // footer
  minimal: { he: 'מינימלי', en: 'Minimal' },
  line: { he: 'שורה', en: 'Line' },
  ticker: { he: 'טיקר', en: 'Ticker' },
  // navbar
  floating: { he: 'צף', en: 'Floating' },
  solid: { he: 'מלא', en: 'Solid' },
  transparent: { he: 'שקוף', en: 'Transparent' },
  pill: { he: 'כמוסה', en: 'Pill' },
  // price list
  ledger: { he: 'רשימה ממוספרת', en: 'Numbered list' },
  roman: { he: 'ספרות רומיות', en: 'Roman numerals' },
  menu: { he: 'תפריט', en: 'Menu' },
  board: { he: 'לוח גדול', en: 'Big board' },
  tags: { he: 'תגיות', en: 'Tags' },
  soft: { he: 'רך', en: 'Soft' },
  arch: { he: 'קשתות', en: 'Arches' },
  index: { he: 'אינדקס', en: 'Index' },
  // booking band and statement
  slant: { he: 'אלכסון', en: 'Slanted' },
  // LT-605: the hero over a live field of the site's colours.
  mesh: { he: 'צבעים חיים', en: 'Living colours' },
  quiet: { he: 'שקט', en: 'Quiet' },
  ticket: { he: 'כרטיס', en: 'Ticket' },
  display: { he: 'ענק', en: 'Display' },
  ruled: { he: 'בין קווים', en: 'Ruled' },
  outline: { he: 'קו מתאר', en: 'Outline' },
  marker: { he: 'מרקר', en: 'Marker' },
  // small blocks
  rail: { he: 'מסילה', en: 'Rail' },
  offset: { he: 'מוסט', en: 'Offset' },
  table: { he: 'טבלה', en: 'Table' },
  strip: { he: 'פס', en: 'Strip' },
  chips: { he: 'עם שירותים', en: 'With services' },
  photo: { he: 'תמונה', en: 'Photo' },
};

export interface SectionDef {
  label: { he: string; en: string };
  /** The looks this section can take. On a composed page they are the block's `variant`. */
  variants?: string[];
  /** Without blocks (legacy pages), the same choice is this design token. */
  designToken?: string;
  /** Legacy pages show or hide the section by `components.<key>.visible`. */
  visibleKey?: string;
  /** Outside the block list: the navbar and the contact button. */
  outsideBlocks?: boolean;
}

const HERO_LAYOUTS = ['image-right', 'centered', 'split', 'text-first', 'poster-split', 'poster-statement', 'fullbleed', 'parallax', 'expand', 'aero', 'collage', 'slant', 'mesh'];
const GALLERY_LAYOUTS = ['grid', 'masonry', 'filmstrip', 'polaroid', 'flash', 'bento', 'scroller', 'spotlight', 'carousel', 'clothesline', 'curve', 'cascade'];
const QUOTE_LAYOUTS = ['cards', 'quote', 'bubbles', 'marquee', 'spotlight', 'editorial'];
const FAQ_STYLES = ['cards', 'lines', 'numbered', 'pills', 'split'];
const SCHEDULE_STYLES = ['card', 'flat', 'inset', 'split'];
const CONTACT_LAYOUTS = ['split', 'stacked', 'poster', 'editorial', 'statement', 'band', 'cards', 'bubbles'];
const FOOTER_LAYOUTS = ['columns', 'minimal', 'line', 'ticker'];

/** By block type on a composed page, by section key on a legacy one (the keys overlap where the section is the same). */
export const SECTIONS: Record<string, SectionDef> = {
  hero: { label: { he: 'פתיחה', en: 'Opening' }, variants: HERO_LAYOUTS, designToken: 'heroLayout', visibleKey: 'hero' },
  navbar: {
    label: { he: 'תפריט עליון', en: 'Top menu' },
    variants: ['floating', 'solid', 'transparent', 'minimal', 'centered', 'pill', 'split'],
    designToken: 'navbarStyle', visibleKey: 'navbar', outsideBlocks: true,
  },
  about: {
    label: { he: 'אודות', en: 'About' },
    variants: ['cards', 'split', 'band', 'manifesto', 'wall', 'timeline', 'sticky'],
    designToken: 'aboutLayout', visibleKey: 'about',
  },
  intro: { label: { he: 'אודות', en: 'About' }, variants: ['plain', 'manifesto', 'columns'] },
  features: { label: { he: 'יתרונות', en: 'Highlights' }, variants: ['tiles', 'bento', 'band', 'wall', 'timeline', 'sticky', 'orbs', 'stack'] },
  visit: { label: { he: 'פרטי ביקור', en: 'Visit' } },
  portfolio: { label: { he: 'גלריה', en: 'Gallery' }, variants: GALLERY_LAYOUTS, designToken: 'portfolioLayout', visibleKey: 'portfolio' },
  gallery: { label: { he: 'גלריה', en: 'Gallery' }, variants: GALLERY_LAYOUTS },
  products: { label: { he: 'מוצרים', en: 'Products' }, variants: ['well', 'swap', 'bento', 'list', 'belt', 'hanger', 'coverflow', 'orbit', 'drops', 'wall'], designToken: 'productsLayout' },
  // LT-610: the blog's newest posts (Pro; the section shows once a post is out).
  blog: { label: { he: 'בלוג', en: 'Blog' }, variants: ['latest', 'article', 'carousel'] },
  testimonials: { label: { he: 'המלצות', en: 'Reviews' }, variants: QUOTE_LAYOUTS, designToken: 'testimonialsLayout', visibleKey: 'testimonials' },
  quote: { label: { he: 'המלצות', en: 'Reviews' }, variants: QUOTE_LAYOUTS },
  faq: { label: { he: 'שאלות נפוצות', en: 'FAQ' }, variants: FAQ_STYLES, designToken: 'faqStyle', visibleKey: 'faq' },
  services: { label: { he: 'מחירון', en: 'Price list' } },
  ledger: { label: { he: 'מחירון', en: 'Price list' }, variants: ['ledger', 'roman', 'menu', 'board', 'table', 'tags', 'soft', 'arch', 'index'] },
  priceCards: { label: { he: 'כרטיסי מחיר', en: 'Price cards' } },
  schedule: { label: { he: 'קביעת תור', en: 'Booking' }, variants: SCHEDULE_STYLES, designToken: 'scheduleStyle' },
  contact: { label: { he: 'צור קשר', en: 'Contact' }, variants: CONTACT_LAYOUTS, designToken: 'contactLayout', visibleKey: 'contact' },
  footer: { label: { he: 'כותרת תחתונה', en: 'Footer' }, variants: FOOTER_LAYOUTS, designToken: 'footerLayout', visibleKey: 'footer' },
  contactButton: { label: { he: 'כפתור יצירת קשר', en: 'Contact button' }, visibleKey: 'contactButton', outsideBlocks: true },
  interlude: { label: { he: 'תמונה מפרידה', en: 'Photo break' }, variants: ['photo', 'split'] },
  'booking-band': { label: { he: 'רצועת הזמנה', en: 'Booking band' } },
  bookingBand: { label: { he: 'רצועת הזמנה', en: 'Booking band' }, variants: ['plain', 'chips', 'poster', 'slant', 'quiet', 'card', 'ticket', 'split'] },
  ticker: { label: { he: 'רצועת שירותים', en: 'Services strip' } },
  announcement: { label: { he: 'הודעה', en: 'Announcement' } },
  manifesto: { label: { he: 'הצהרה', en: 'Statement' }, variants: ['display', 'ruled', 'outline', 'marker', 'soft'] },
  stats: { label: { he: 'מספרים', en: 'Numbers' } },
  pullQuote: { label: { he: 'ציטוט', en: 'Quote' } },
  process: { label: { he: 'שלבים', en: 'Steps' }, variants: ['steps', 'rail', 'grid', 'pinned'] },
  hours: { label: { he: 'שעות פתיחה', en: 'Opening hours' }, variants: ['table', 'strip'] },
  photoPair: { label: { he: 'זוג תמונות', en: 'Photo pair' }, variants: ['offset', 'stacked'] },
  beforeAfter: { label: { he: 'לפני ואחרי', en: 'Before & after' } },
  mapStrip: { label: { he: 'מפה', en: 'Map' } },
  logoMark: { label: { he: 'לוגו', en: 'Logo' } },
  social: { label: { he: 'רשתות חברתיות', en: 'Social' } },
};

/** LT-252: one line on what each section is, in the add-section list. */
export const SECTION_HINTS: Named = {
  intro: { he: 'כמה מילים על העסק', en: 'A few words about the business' },
  features: { he: 'מה מייחד אתכם', en: 'What sets you apart' },
  faq: { he: 'שאלות ותשובות ללקוחות', en: 'Questions and answers for customers' },
  process: { he: 'איך זה עובד, צעד אחר צעד', en: 'How it works, step by step' },
  quote: { he: 'מה הלקוחות אומרים', en: 'What customers say' },
  stats: { he: 'מספרים בולטים על העסק', en: 'Standout numbers about the business' },
  manifesto: { he: 'משפט גדול שמסכם את העסק', en: 'One big line that sums you up' },
  pullQuote: { he: 'משפט מודגש בקול שלכם', en: 'A highlighted line in your voice' },
  announcement: { he: 'שורה בראש הדף: מבצע, חדשות', en: 'A line at the top: an offer, news' },
  gallery: { he: 'התמונות מהגלריה', en: 'Your gallery photos' },
  products: { he: 'המוצרים שלך, עם תמונה ומחיר', en: 'Your products, with pictures and prices' },
  blog: { he: 'הפוסטים החדשים מהבלוג', en: 'The newest posts from the blog' },
  interlude: { he: 'תמונה רחבה בין אזורים', en: 'A wide photo between sections' },
  photoPair: { he: 'שתי תמונות זו לצד זו', en: 'Two photos side by side' },
  beforeAfter: { he: 'השוואה בין שתי תמונות', en: 'Two photos compared' },
  ledger: { he: 'השירותים והמחירים ברשימה', en: 'Your services and prices, listed' },
  priceCards: { he: 'השירותים ככרטיסים', en: 'Your services as cards' },
  ticker: { he: 'שמות השירותים בפס נע', en: 'Service names in a moving strip' },
  schedule: { he: 'יומן קביעת התורים', en: 'The booking calendar' },
  bookingBand: { he: 'רצועה שמזמינה לקבוע תור', en: 'A band that invites booking' },
  contact: { he: 'טופס ופרטי התקשרות', en: 'A form and your contact details' },
  hours: { he: 'השעות שהגדרתם', en: 'The hours you set' },
  mapStrip: { he: 'מפה לפי הכתובת', en: 'A map of your address' },
  social: { he: 'הקישורים לרשתות', en: 'Your social links' },
  logoMark: { he: 'הלוגו בגדול', en: 'Your logo, large' },
  footer: { he: 'סוף הדף', en: 'The bottom of the page' },
};

/**
 * LT-573: the design token the site draws a block by when the block has no
 * look of its own (lightor-front ComposedPage: `variant ?? design.<token>`).
 * An AI edit of the token drops the block's own look for it (lightor-back
 * composer SHADOWED_BY_VARIANT), so a block with none is common.
 */
export const BLOCK_TOKEN: Record<string, string> = {
  hero: 'heroLayout', gallery: 'portfolioLayout', products: 'productsLayout', quote: 'testimonialsLayout',
  faq: 'faqStyle', schedule: 'scheduleStyle', contact: 'contactLayout', footer: 'footerLayout',
};

/** The look the site draws for a block with no look of its own and no token to go by. */
export const DEFAULT_VARIANT: Record<string, string> = { products: 'well', interlude: 'photo', bookingBand: 'plain', ledger: 'ledger', manifesto: 'display' };

/**
 * LT-573: the look the site draws for a block: its own, else the design's
 * token, else its default. Every interlude but the split is drawn as the photo
 * (the styles store 'full').
 */
export const blockLookOf = (type: string, variant: unknown, design: Record<string, unknown>): string | undefined => {
  // LT-610: the blog's section takes its style's own look when it has none.
  if (type === 'blog') return typeof variant === 'string' && variant ? variant : blogLooksOf(design).section;
  const token = BLOCK_TOKEN[type];
  const fromDesign = token ? design[token] : undefined;
  const look = typeof variant === 'string' && variant ? variant
    : typeof fromDesign === 'string' && fromDesign ? fromDesign
    : DEFAULT_VARIANT[type];
  if (type === 'interlude') return look === 'split' ? 'split' : 'photo';
  return look;
};

/**
 * The look a pick is stored as. A default the site draws the same without a
 * look is stored as none; where a design token stands behind the block, none
 * would draw the token, so the pick is stored as it is (LT-573: the quiet tiles
 * on a site whose style drew the conveyor).
 */
export const variantToStore = (type: string, value: string): string | undefined =>
  value === DEFAULT_VARIANT[type] && !BLOCK_TOKEN[type] ? undefined : value;

export const sectionDef = (type: string | null | undefined): SectionDef =>
  (type && SECTIONS[type]) || { label: { he: 'אזור', en: 'Section' } };
