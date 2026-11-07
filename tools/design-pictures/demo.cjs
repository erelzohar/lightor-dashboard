// LT-595: one demo business (a ceramics studio, "חומר וזמן" / "Clay & Time"), in Hebrew
// and English, with everything every section draws. Pictures: the Unsplash photos of the
// ceramics demo site (lightor-demo-products.json, chomer-vezman).
const U = (id, w = 1200, h) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}${h ? `&h=${h}` : ''}&q=75`;

const IMG = {
  hero: '1597696929736-6d13bed8e6a8',
  logo: '1666445759502-85124c28524e',
  gallery: ['1525973779373-015bdf68e579', '1523367118146-091f762cd8ea', '1536936812504-0e77dc3f0b40', '1567763745030-bfe9c51bec27', '1633856858940-42229cb53dd3', '1631125915902-d8abe9225ff2', '1612196808214-b8e1d6145a8c', '1769203905448-0ba060069e6f'],
};

const COPY = {
  he: {
    name: 'חומר וזמן',
    hero: { title: 'קרמיקה בעבודת יד', subtitle: 'סטודיו ירושלמי לכלים', description: 'כלים שימושיים שנוצרים על האובניים, בגלזורות טבעיות, בסטודיו קטן בירושלים.', stamp: 'ירושלים • עבודת אובניים', cta: 'להזמנת סדנה' },
    stats: [{ value: '12', label: 'שנים על האובניים' }, { value: '40', label: 'גלזורות בסטודיו' }],
    about: {
      title: 'על הסטודיו', description: 'סטודיו לקרמיקה בירושלים שיוצר כלים לשימוש יומיומי.',
      intro: 'חומר וזמן הוא סטודיו קטן בירושלים שבו כל כלי נוצר בידיים, על האובניים.',
      mission: 'כל כלי מקבל צורה משלו, עם גלזורות טבעיות שנותנות לחומר אופי.',
      features: [
        { icon: 'Sparkles', title: 'עבודת אובניים ידנית', description: 'כל ספל וקערה נבנים אחד אחד על האובניים.' },
        { icon: 'Heart', title: 'גלזורות טבעיות', description: 'גוונים ומרקמים שנולדים בתנור ולא חוזרים על עצמם.' },
        { icon: 'Users', title: 'סדנאות בקבוצות קטנות', description: 'עד שישה משתתפים, כדי שלכל אחד יהיה זמן על האובניים.' },
        { icon: 'MapPin', title: 'בלב ירושלים', description: 'סטודיו פתוח ברחוב הנביאים, חמש דקות ממרכז העיר.' },
      ],
    },
    gallery: { title: 'מהסטודיו', description: 'הצצה לעבודה ולכלים שיוצאים מהתנור', titles: ['קערות הגשה', 'ספלי אבן', 'על המדף', 'קערות צבעוניות', 'צלחות ערב', 'אגרטל דונאט', 'אגרטל לבן', 'כד גולמי'] },
    products: { title: 'הכלים שלנו', description: 'כלים בעבודת יד, כל אחד קצת אחר', cta: 'להזמנה' },
    items: [
      { name: 'ספל מחורץ', category: 'ספלים', price: 95, summary: 'ספל קפה גדול בגלזורה אפורה', imgs: ['1495100497150-fe209c585f50', '1536936812504-0e77dc3f0b40'], colors: [['אפור כחלחל', '#8a9aa5'], ['שחור מט', '#2b2b2b'], ['לבן חלבי', '#efe9df']], sizes: ['קטן', 'גדול'] },
      { name: 'ספל אבן מנומר', category: 'ספלים', price: 85, summary: 'חומר גולמי עם נקודות ברזל', imgs: ['1666445759502-85124c28524e', '1523367118146-091f762cd8ea'], colors: [['חול', '#d8c6a8'], ['פחם', '#3b3b3b']], sizes: ['250 מ"ל', '350 מ"ל'] },
      { name: 'ספל שחור מט', category: 'ספלים', price: 95, summary: 'גלזורה שחורה וידית רחבה', imgs: ['1518358246973-95637f1df901'] },
      { name: 'קערת הגשה גדולה', category: 'קערות', price: 260, summary: 'קערה לבנה רחבה לסלטים', imgs: ['1510035618584-c442b241abe7', '1525973779373-015bdf68e579'], colors: [['לבן שמנת', '#f1ead9'], ['טורקיז', '#3f9c9b']], sizes: ['24 ס"מ', '28 ס"מ'] },
      { name: 'זוג קערות מנומרות', category: 'קערות', price: 180, summary: 'שתי קערות עמוקות לבוקר', imgs: ['1530006498959-b7884e829a04'] },
      { name: 'סט קערות צבעוניות', category: 'קערות', price: 340, summary: 'שש קערות בגלזורות שונות', imgs: ['1577576223085-3eb295cd414f', '1567763745030-bfe9c51bec27'] },
      { name: 'אגרטל דונאט', category: 'אגרטלים', price: 220, summary: 'אגרטל עגול עם חור במרכז', imgs: ['1643569556871-91ec60671ed7', '1631125915902-d8abe9225ff2'] },
      { name: 'אגרטל לבן גבוה', category: 'אגרטלים', price: 290, summary: 'אגרטל רחב בגלזורה רכה', imgs: ['1612196808214-b8e1d6145a8c', '1597696929736-6d13bed8e6a8'] },
    ],
    details: ['עבודת יד', 'מתאים למדיח', 'גלזורה ללא עופרת'],
    description: 'כלי שנזרק על האובניים בסטודיו, עם גלזורה טבעית. כל כלי יוצא קצת אחר, כי כל שריפה שונה.',
    testimonials: { title: 'מה אומרים עלינו', items: [{ name: 'דנה', text: 'הכלים יפים ונעים להשתמש בהם כל יום.' }, { name: 'יונתן', text: 'הסדנה הייתה חוויה, יצאתי עם קערה משלי.' }, { name: 'מיכל', text: 'הספל הפך לחלק מהבוקר שלי.' }] },
    faq: { title: 'שאלות נפוצות', items: [
      { question: 'איך מזמינים כלי מהסטודיו?', answer: 'משאירים פנייה באתר עם הכלים שאהבתם, ואנחנו חוזרים לתיאום.' },
      { question: 'האם צריך ניסיון לסדנה?', answer: 'לא, הסדנה למתחילים מתחילה מהבסיס.' },
      { question: 'הכלים מתאימים למדיח?', answer: 'כן, כל הגלזורות שלנו מתאימות למדיח ולמיקרוגל.' },
      { question: 'איפה הסטודיו?', answer: 'ברחוב הנביאים 34 בירושלים.' },
    ] },
    services: [['סדנת אובניים למתחילים', 280, 3], ['שיעור פרטי', 350, 2], ['סדנה זוגית', 480, 3], ['חוג שבועי', 600, 2], ['ערב גלזורות', 220, 2]],
    servicesTitle: 'סדנאות ומחירים',
    schedule: { title: 'קביעת סדנה', description: 'סדנאות בקבוצות קטנות, כל שבוע בסטודיו' },
    contact: { title: 'נשמח לשמוע מכם', description: 'שאלה על כלי, הזמנה מיוחדת או סדנה לקבוצה? השאירו פרטים.' },
    footer: 'חומר וזמן • סטודיו לקרמיקה בירושלים',
    address: { state: 'ישראל', city: 'ירושלים', street: 'הנביאים 34' },
    manifesto: 'כל כלי נוצר פעם אחת, בידיים',
    process: [
      { title: 'בוחרים כלי', text: 'מעיינים בכלים באתר ובוחרים את מה שאהבתם.' },
      { title: 'משאירים פנייה', text: 'שולחים את הבחירה ופרטי קשר בטופס.' },
      { title: 'מתאמים', text: 'חוזרים אליכם לתיאום הצבע והמידה.' },
      { title: 'אוספים מהסטודיו', text: 'הכלי מחכה לכם עטוף, או נשלח עד הבית.' },
    ],
    processTitle: 'איך זה עובד',
  },
  en: {
    name: 'Clay & Time',
    hero: { title: 'Handmade ceramics', subtitle: 'A Jerusalem pottery studio', description: 'Everyday pieces thrown on the wheel and finished in natural glazes, in a small Jerusalem studio.', stamp: 'Jerusalem • Wheel-thrown', cta: 'Book a workshop' },
    stats: [{ value: '12', label: 'years at the wheel' }, { value: '40', label: 'glazes in the studio' }],
    about: {
      title: 'About the studio', description: 'A Jerusalem pottery studio making pieces for everyday use.',
      intro: 'Clay & Time is a small studio in Jerusalem where every piece is made by hand, on the wheel.',
      mission: 'Each piece takes its own shape, with natural glazes that give the clay its character.',
      features: [
        { icon: 'Sparkles', title: 'Thrown by hand', description: 'Every mug and bowl is made one by one on the wheel.' },
        { icon: 'Heart', title: 'Natural glazes', description: 'Colours and textures born in the kiln, never twice the same.' },
        { icon: 'Users', title: 'Small workshops', description: 'Six people at most, so everyone gets time at the wheel.' },
        { icon: 'MapPin', title: 'In central Jerusalem', description: 'An open studio on HaNevi\'im Street, five minutes from the centre.' },
      ],
    },
    gallery: { title: 'From the studio', description: 'A look at the work and what comes out of the kiln', titles: ['Serving bowls', 'Stoneware mugs', 'On the shelf', 'Colourful bowls', 'Dinner plates', 'Donut vase', 'White vase', 'Raw clay jug'] },
    products: { title: 'Our pieces', description: 'Made by hand, each one a little different', cta: 'Order' },
    items: [
      { name: 'Ribbed mug', category: 'Mugs', price: 95, summary: 'A large coffee mug in grey glaze', imgs: ['1495100497150-fe209c585f50', '1536936812504-0e77dc3f0b40'], colors: [['Blue grey', '#8a9aa5'], ['Matte black', '#2b2b2b'], ['Milk white', '#efe9df']], sizes: ['Small', 'Large'] },
      { name: 'Speckled stoneware mug', category: 'Mugs', price: 85, summary: 'Raw clay with iron specks', imgs: ['1666445759502-85124c28524e', '1523367118146-091f762cd8ea'], colors: [['Sand', '#d8c6a8'], ['Charcoal', '#3b3b3b']], sizes: ['250 ml', '350 ml'] },
      { name: 'Matte black mug', category: 'Mugs', price: 95, summary: 'Black glaze, a wide handle', imgs: ['1518358246973-95637f1df901'] },
      { name: 'Large serving bowl', category: 'Bowls', price: 260, summary: 'A wide white bowl for salads', imgs: ['1510035618584-c442b241abe7', '1525973779373-015bdf68e579'], colors: [['Cream', '#f1ead9'], ['Turquoise', '#3f9c9b']], sizes: ['24 cm', '28 cm'] },
      { name: 'Speckled bowl pair', category: 'Bowls', price: 180, summary: 'Two deep breakfast bowls', imgs: ['1530006498959-b7884e829a04'] },
      { name: 'Colourful bowl set', category: 'Bowls', price: 340, summary: 'Six bowls, six glazes', imgs: ['1577576223085-3eb295cd414f', '1567763745030-bfe9c51bec27'] },
      { name: 'Donut vase', category: 'Vases', price: 220, summary: 'A round vase with a hole', imgs: ['1643569556871-91ec60671ed7', '1631125915902-d8abe9225ff2'] },
      { name: 'Tall white vase', category: 'Vases', price: 290, summary: 'A wide vase in a soft glaze', imgs: ['1612196808214-b8e1d6145a8c', '1597696929736-6d13bed8e6a8'] },
    ],
    details: ['Made by hand', 'Dishwasher safe', 'Lead-free glaze'],
    description: 'Thrown on the wheel in the studio and finished in a natural glaze. Each piece comes out a little different, because every firing is.',
    testimonials: { title: 'What people say', items: [{ name: 'Dana', text: 'Beautiful pieces that are a pleasure to use every day.' }, { name: 'Jonathan', text: 'The workshop was a joy, I left with a bowl of my own.' }, { name: 'Michal', text: 'The mug is part of my morning now.' }] },
    faq: { title: 'Questions', items: [
      { question: 'How do I order a piece?', answer: 'Leave a request on the site with the pieces you liked and we get back to you.' },
      { question: 'Do I need experience for a workshop?', answer: 'No, the beginners\' workshop starts from the basics.' },
      { question: 'Are the pieces dishwasher safe?', answer: 'Yes, all our glazes are dishwasher and microwave safe.' },
      { question: 'Where is the studio?', answer: 'At 34 HaNevi\'im Street, Jerusalem.' },
    ] },
    services: [['Wheel workshop for beginners', 280, 3], ['Private lesson', 350, 2], ['Workshop for two', 480, 3], ['Weekly class', 600, 2], ['Glazing evening', 220, 2]],
    servicesTitle: 'Workshops and prices',
    schedule: { title: 'Book a workshop', description: 'Small-group workshops, every week in the studio' },
    contact: { title: 'We would love to hear from you', description: 'A question about a piece, a special order or a group workshop? Leave your details.' },
    footer: 'Clay & Time • A pottery studio in Jerusalem',
    address: { state: 'Israel', city: 'Jerusalem', street: '34 HaNevi\'im St' },
    manifesto: 'Every piece is made once, by hand',
    process: [
      { title: 'Pick a piece', text: 'Browse the pieces on the site and choose what you like.' },
      { title: 'Leave a request', text: 'Send your choice and your details in the form.' },
      { title: 'We get in touch', text: 'We call to settle the colour and the size.' },
      { title: 'Collect it', text: 'Your piece waits for you wrapped, or comes to your door.' },
    ],
    processTitle: 'How it works',
  },
};

const PALETTE = {
  colorPrimary: '#a0522d', colorPrimaryDark: '#e08a5c',
  colorLightBg: '#f8f4ee', colorLightSurface: '#fffdf9', colorLightGray: '#e6dccf', colorLightText: '#2f2722',
  colorDarkBg: '#14110f', colorDarkSurface: '#1e1a17', colorDarkGray: '#36302b', colorDarkText: '#f3eee8',
};

/** The site's one look: only the layout under test changes between shots. */
const DESIGN = {
  stylePreset: 'minimal', defaultTheme: 'light', decor: 'none',
  borderRadius: 'lg', cardStyle: 'elevated', buttonStyle: 'solid', headingFont: 'raleway', bodyFont: 'inter',
  navbarStyle: 'floating', sectionDivider: 'none', density: 'comfortable', typeScale: 'balanced', headingAccent: 'bar',
  imageTreatment: 'rounded', featureStyle: 'icons', sectionHeader: 'centered', bookingBand: 'none', revealStyle: 'fade',
  backdrop: 'none', sectionWidth: 'contained', productCard: 'plain',
};

exports.SLUG = (lang) => (lang === 'he' ? 'draft-0' : 'draft-0');

// LT-610: the studio's blog - four posts, and the first one's body for a post's page.
const POSTS = {
  he: [
    { title: 'איך בוחרים כלי קרמיקה לשימוש יומיומי', summary: 'חמישה דברים שכדאי לבדוק לפני שקונים ספל או קערה', category: 'טיפים', img: 1 },
    { title: 'מה עובר על כלי בתנור', summary: 'מהחומר הרך ועד הגלזורה: שלוש השריפות של כל כלי', category: 'מהסטודיו', img: 0 },
    { title: 'סדנת אובניים ראשונה: למה לצפות', summary: 'מה לובשים, כמה זמן זה לוקח ומה לוקחים הביתה', category: 'סדנאות', img: 3 },
    { title: 'איך שומרים על כלי קרמיקה לאורך שנים', summary: 'מדיח, מיקרוגל ושריטות: מה מותר ומה עדיף להימנע', category: 'טיפים', img: 5 },
  ],
  en: [
    { title: 'Choosing ceramics for every day', summary: 'Five things to check before you buy a mug or a bowl', category: 'Tips', img: 1 },
    { title: 'What a piece goes through in the kiln', summary: 'From soft clay to glaze: the three firings of every piece', category: 'From the studio', img: 0 },
    { title: 'Your first wheel workshop: what to expect', summary: 'What to wear, how long it takes and what you take home', category: 'Workshops', img: 3 },
    { title: 'Caring for ceramics for years', summary: 'Dishwasher, microwave and scratches: what is fine and what to avoid', category: 'Tips', img: 5 },
  ],
};
const BODY = {
  he: [
    { kind: 'p', text: 'כלי טוב מרגיש נכון ביד כבר בפעם הראשונה. כמה בדיקות פשוטות יעזרו לבחור כלי שתשתמשו בו כל יום, ולא רק תניחו על המדף.' },
    { kind: 'h2', text: 'משקל ואחיזה' },
    { kind: 'p', text: 'הרימו את הספל כמו שתשתו ממנו. ידית נוחה, שפה חלקה ומשקל מאוזן חשובים יותר מכל צבע.' },
    { kind: 'ul', items: ['שפה חלקה בלי סדקים', 'תחתית ישרה שלא מתנדנדת', 'גלזורה אחידה בפנים'] },
    { kind: 'quote', text: 'כל כלי שיוצא מהתנור עובר אצלי בדיקה ביד לפני שהוא יוצא לחנות.' },
    { kind: 'p', text: 'רוצים לנסות בעצמכם? בסדנה אצלנו בונים כלי מההתחלה ועד הגלזורה.' },
  ],
  en: [
    { kind: 'p', text: 'A good piece feels right in your hand the first time. A few simple checks help you choose something you will use every day, not only shelve.' },
    { kind: 'h2', text: 'Weight and grip' },
    { kind: 'p', text: 'Lift the mug as you would drink from it. A comfortable handle, a smooth rim and a balanced weight matter more than any colour.' },
    { kind: 'ul', items: ['A smooth rim with no cracks', 'A flat base that does not rock', 'An even glaze inside'] },
    { kind: 'quote', text: 'Every piece out of the kiln goes through my hands before it reaches the shop.' },
    { kind: 'p', text: 'Want to try it yourself? In our workshop you make a piece from the start to the glaze.' },
  ],
};
const postCard = (lang, p, i) => ({
  id: `post-${i}`, slug: `post-${i}`, title: p.title, summary: p.summary, category: p.category,
  cover: U(IMG.gallery[p.img], 1200, 800), publishedAt: `2026-11-0${6 - i}T09:00:00.000Z`, updatedAt: `2026-11-0${6 - i}T09:00:00.000Z`, minutes: 3 + i,
});
exports.posts = (lang) => POSTS[lang].map((p, i) => postCard(lang, p, i));
exports.post = (lang) => ({ ...postCard(lang, POSTS[lang][0], 0), body: BODY[lang] });
exports.POST_SLUG = 'post-0';

/** The demo site in `lang`; `over` = { design, blocks, components, navbar, ... } on top. */
exports.site = (lang, over = {}) => {
  const t = COPY[lang];
  const items = t.items.map((p, i) => ({
    id: `draft-${i}`, slug: `draft-${i}`, name: p.name, summary: p.summary, price: p.price * 100, category: p.category,
    images: p.imgs.map((id) => ({ url: U(id) })),
    ...(p.colors ? { colors: p.colors.map(([name, hex]) => ({ name, hex })) } : {}),
    ...(p.sizes ? { sizes: p.sizes } : {}),
    description: t.description, details: t.details,
  }));
  const config = {
    _id: 'demo595', user_id: 'demo595u', subDomain: 'clay-and-time', businessName: t.name, logoImageName: U(IMG.logo, 400),
    defaultLanguage: lang, timeZone: 'Asia/Jerusalem', currency: 'ILS', conversion: 'book', motion: true,
    minCancelTimeMS: 3600000, bookingHorizonDays: 60, bookingFields: [], leadFields: [], leadsOpen: true, bookingOpen: true,
    assistant: false, branding: false, accessibility: { widgetHidden: true }, vacations: [], dateOverrides: [],
    workingDays: [null, '09:00-17:00', '09:00-17:00', '09:00-17:00', '09:00-17:00', '09:00-13:00', null],
    address: t.address, contact: { phone: '+972501234567', mail: 'studio@claytime.co.il' },
    social: { instagram: 'https://instagram.com/claytime', facebook: 'https://facebook.com/claytime', tiktok: null },
    pallete: PALETTE,
    appointmentTypes: t.services.map(([name, price, hours], i) => ({ _id: `s${i}`, name, price: String(price), durationMS: String(hours * 3600000) })),
    components: {
      navbar: { visible: over.navbar !== false, darkMode: true, languageSwitcher: false },
      hero: { visible: true, ...t.hero, heroImageSrc: U(IMG.hero, 1800), bgType: over.bgType || 'fog', bordersType: 'round' },
      about: { visible: true, title: t.about.title, description: t.about.description, paragraphs: { intro: t.about.intro, mission: t.about.mission }, features: t.about.features },
      portfolio: { visible: true, title: t.gallery.title, description: t.gallery.description, items: IMG.gallery.map((id, i) => ({ url: [4, 7].includes(i) ? U(id, 900, 1200) : U(id, 1200, 800), title: t.gallery.titles[i], description: '' })) },
      products: { title: t.products.title, description: t.products.description, cta: t.products.cta },
      services: { title: t.servicesTitle },
      schedule: t.schedule,
      contact: { visible: true, ...t.contact },
      footer: { visible: true, description: t.footer },
      testimonials: { visible: true, ...t.testimonials },
      faq: { visible: true, ...t.faq },
      introPopup: { visible: false, value: '' },
      contactButton: { visible: false },
    },
    products: { total: items.length, pages: true, items },
    design: { ...DESIGN, ...(over.design || {}) },
    blocks: over.blocks || [],
    // LT-610: the blog's newest (the section, the blog's page in a preview) and a post's draft.
    ...(over.blog ? { blog: { total: 4, latest: exports.posts(lang) } } : {}),
    ...(over.post ? { previewPost: exports.post(lang) } : {}),
  };
  if (over.legacy) {
    // A page without blocks: only the named sections show (no products, nothing to book).
    for (const k of ['hero', 'about', 'portfolio', 'contact', 'footer', 'testimonials', 'faq']) config.components[k].visible = over.legacy.includes(k);
    delete config.products;
    config.conversion = 'lead';
  }
  return config;
};

/** The blocks' props that carry their own words (stats, steps, statement). */
exports.props = (lang, type) => {
  const t = COPY[lang];
  if (type === 'hero') return { items: t.stats };
  if (type === 'manifesto') return { text: t.manifesto };
  if (type === 'process') return { title: t.processTitle, steps: t.process };
  if (type === 'stats') return { items: t.stats };
  return undefined;
};
