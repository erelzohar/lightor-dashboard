/**
 * LT-249 — the design choices the site editor offers. The values are the
 * server's enums (lightor-back webConfigModel designSchema) and the block
 * variants the public site draws (lightor-front ComposedPage); the names are
 * here rather than in the locale files because they are design vocabulary
 * offered in Hebrew and English (other UI languages read the English).
 */

export type Lang = 'he' | 'en';
type Named = Record<string, { he: string; en: string }>;

export const optionLabel = (names: Named, value: string, lang: string): string => {
  const entry = names[value];
  if (!entry) return value;
  return lang === 'he' ? entry.he : entry.en;
};

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
export const HERO_BACKGROUNDS = ['fog', 'clouds', 'clouds2', 'topology', 'trunk', 'birds', 'net'] as const;
export const HERO_BACKGROUND_NAMES: Named = {
  fog: { he: 'ערפל', en: 'Fog' },
  clouds: { he: 'עננים', en: 'Clouds' },
  clouds2: { he: 'שמיים', en: 'Sky' },
  topology: { he: 'קווי מתאר', en: 'Contours' },
  trunk: { he: 'ספירלה', en: 'Spiral' },
  birds: { he: 'ציפורים', en: 'Birds' },
  net: { he: 'רשת', en: 'Network' },
};
export const heroBackgroundOf = (raw: unknown): string =>
  typeof raw === 'string' && (HERO_BACKGROUNDS as readonly string[]).includes(raw) ? raw : 'fog';

export const LAYOUTS: Named = {
  // hero
  'image-right': { he: 'תמונה בצד', en: 'Image beside' },
  centered: { he: 'ממורכז', en: 'Centered' },
  split: { he: 'מפוצל', en: 'Split' },
  'text-first': { he: 'טקסט קודם', en: 'Text first' },
  'poster-split': { he: 'פוסטר מפוצל', en: 'Poster split' },
  'poster-statement': { he: 'פוסטר', en: 'Poster' },
  fullbleed: { he: 'תמונה מלאה', en: 'Full image' },
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

const HERO_LAYOUTS = ['image-right', 'centered', 'split', 'text-first', 'poster-split', 'poster-statement', 'fullbleed'];
const GALLERY_LAYOUTS = ['grid', 'masonry', 'filmstrip', 'polaroid', 'flash', 'bento', 'scroller', 'spotlight', 'carousel'];
const QUOTE_LAYOUTS = ['cards', 'quote', 'bubbles', 'marquee', 'spotlight'];
const FAQ_STYLES = ['cards', 'lines', 'numbered', 'pills', 'split'];
const SCHEDULE_STYLES = ['card', 'flat', 'inset', 'split'];
const CONTACT_LAYOUTS = ['split', 'stacked', 'poster', 'editorial', 'statement', 'band', 'cards'];
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
  features: { label: { he: 'יתרונות', en: 'Highlights' }, variants: ['tiles', 'band', 'wall', 'timeline', 'sticky'] },
  visit: { label: { he: 'פרטי ביקור', en: 'Visit' } },
  portfolio: { label: { he: 'גלריה', en: 'Gallery' }, variants: GALLERY_LAYOUTS, designToken: 'portfolioLayout', visibleKey: 'portfolio' },
  gallery: { label: { he: 'גלריה', en: 'Gallery' }, variants: GALLERY_LAYOUTS },
  testimonials: { label: { he: 'המלצות', en: 'Reviews' }, variants: QUOTE_LAYOUTS, designToken: 'testimonialsLayout', visibleKey: 'testimonials' },
  quote: { label: { he: 'המלצות', en: 'Reviews' }, variants: QUOTE_LAYOUTS },
  faq: { label: { he: 'שאלות נפוצות', en: 'FAQ' }, variants: FAQ_STYLES, designToken: 'faqStyle', visibleKey: 'faq' },
  services: { label: { he: 'מחירון', en: 'Price list' } },
  ledger: { label: { he: 'מחירון', en: 'Price list' } },
  priceCards: { label: { he: 'כרטיסי מחיר', en: 'Price cards' } },
  schedule: { label: { he: 'קביעת תור', en: 'Booking' }, variants: SCHEDULE_STYLES, designToken: 'scheduleStyle' },
  contact: { label: { he: 'צור קשר', en: 'Contact' }, variants: CONTACT_LAYOUTS, designToken: 'contactLayout', visibleKey: 'contact' },
  footer: { label: { he: 'כותרת תחתונה', en: 'Footer' }, variants: FOOTER_LAYOUTS, designToken: 'footerLayout', visibleKey: 'footer' },
  contactButton: { label: { he: 'כפתור יצירת קשר', en: 'Contact button' }, visibleKey: 'contactButton', outsideBlocks: true },
  interlude: { label: { he: 'תמונה מפרידה', en: 'Photo break' }, variants: ['photo', 'split'] },
  'booking-band': { label: { he: 'רצועת הזמנה', en: 'Booking band' } },
  bookingBand: { label: { he: 'רצועת הזמנה', en: 'Booking band' }, variants: ['plain', 'chips'] },
  ticker: { label: { he: 'רצועת שירותים', en: 'Services strip' } },
  announcement: { label: { he: 'הודעה', en: 'Announcement' } },
  manifesto: { label: { he: 'הצהרה', en: 'Statement' } },
  stats: { label: { he: 'מספרים', en: 'Numbers' } },
  pullQuote: { label: { he: 'ציטוט', en: 'Quote' } },
  process: { label: { he: 'שלבים', en: 'Steps' }, variants: ['rail', 'grid'] },
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

/** A block variant that stands for "the default look" — stored as no variant at all. */
export const DEFAULT_VARIANT: Record<string, string> = { interlude: 'photo', bookingBand: 'plain' };

export const sectionDef = (type: string | null | undefined): SectionDef =>
  (type && SECTIONS[type]) || { label: { he: 'אזור', en: 'Section' } };
