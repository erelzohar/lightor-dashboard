// LT-595: a picture of every design the site editor offers, rendered by the real front.
//   node shoot.js [lang=he,en] [filter]      filter: a key ("gallery-curve"), a group ("gallery-"), or a regex
// Raw viewport shots go to raw/<lang>/<key>.png (+ raw/<lang>/<key>/NNN.jpg frames for the moving
// ones) with raw/<lang>/<key>.json (height, background, crop); make.py turns them into out/.
// The list of designs is read from the dashboard's editorOptions.ts (EDITOR_OPTIONS to point elsewhere).
const fs = require('fs');
const os = require('os');
const path = require('path');
const { FRONT, launch, open } = require('./h.cjs');
const esbuild = require(path.join(FRONT, 'node_modules/esbuild'));
const { site, props } = require('./demo.cjs');

const OPTIONS = process.env.EDITOR_OPTIONS || path.resolve(__dirname, '../../src/utils/editorOptions.ts');
const load = () => {
  const { code } = esbuild.transformSync(fs.readFileSync(OPTIONS, 'utf8'), { loader: 'ts', format: 'cjs' });
  const m = { exports: {} };
  new Function('module', 'exports', code)(m, m.exports);
  return m.exports;
};
const O = load();

const RAW = process.env.RAW_DIR ? path.resolve(process.env.RAW_DIR) : path.join(os.tmpdir(), 'lightor-design-pictures', 'raw');
const W = 1280;
const H = 800;
/** Sections are shot in a taller frame, so up to SECTION_MAX of one fits a single shot. */
const SECTION_H = 1200;
const SECTION_MAX = 1000;
const tall = (d) => ['section', 'legacy', 'card'].includes(d.kind);
const SAME = { portfolio: 'gallery', testimonials: 'quote' };

/** Every design as { key, group, value, kind, moving }. */
const designs = () => {
  const list = [];
  const seen = new Set();
  const paid = (group, value) => (O.PAID_LAYOUTS[group] || []).includes(value);
  for (const [section, def] of Object.entries(O.SECTIONS)) {
    if (!def.variants) continue;
    const group = SAME[section] || section;
    for (const value of def.variants) {
      const key = `${group}-${value}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const kind = group === 'hero' ? 'hero' : group === 'navbar' ? 'navbar' : group === 'about' ? 'legacy' : 'section';
      list.push({ key, group, value, kind, moving: paid(group, value) || paid(section, value) });
    }
  }
  for (const value of O.HERO_BACKGROUNDS) list.push({ key: `herobg-${value}`, group: 'herobg', value, kind: 'herobg', moving: O.PAID_BACKGROUNDS.includes(value) });
  for (const value of Object.keys(O.PRODUCT_CARDS)) list.push({ key: `card-${value}`, group: 'card', value, kind: 'card', moving: false });
  for (const value of O.PRODUCTS_PAGE_LAYOUTS) list.push({ key: `productsPage-${value}`, group: 'productsPage', value, kind: 'productsPage', moving: false });
  for (const value of Object.keys(O.PRODUCT_PAGE_LAYOUTS)) list.push({ key: `productPage-${value}`, group: 'productPage', value, kind: 'productPage', moving: false });
  return list;
};

const at = (d) => (d.kind === 'productsPage' ? '/products' : d.kind === 'productPage' ? '/products/draft-0' : '/');
let seq = 0;
const block = (lang, type, variant) => ({ id: `b${++seq}`, type, ...(variant ? { variant } : {}), ...(props(lang, type) ? { props: props(lang, type) } : {}) });

const configOf = (lang, d) => {
  switch (d.kind) {
    case 'hero':
      return site(lang, { blocks: [block(lang, 'hero', d.value), block(lang, 'intro', 'plain'), block(lang, 'gallery', 'grid'), block(lang, 'contact', 'split')] });
    case 'navbar':
      return site(lang, { design: { navbarStyle: d.value }, blocks: [block(lang, 'hero', 'image-right'), block(lang, 'intro', 'plain'), block(lang, 'gallery', 'grid')] });
    case 'herobg': {
      const decor = O.DECOR_BACKGROUNDS.includes(d.value);
      return site(lang, { bgType: decor ? 'fog' : d.value, design: { decor: decor ? d.value : 'none' }, blocks: [block(lang, 'hero', 'centered'), block(lang, 'intro', 'plain'), block(lang, 'gallery', 'grid')] });
    }
    case 'legacy':
      return site(lang, { navbar: false, legacy: ['about'], design: { aboutLayout: d.value } });
    case 'card':
      return site(lang, { navbar: false, design: { productCard: d.value }, blocks: [block(lang, 'products', 'well')] });
    case 'productsPage':
      return site(lang, { design: { productsPageLayout: d.value }, blocks: [block(lang, 'hero', 'image-right'), block(lang, 'products', 'well'), block(lang, 'footer', 'columns')] });
    case 'productPage':
      return site(lang, { design: { productPageLayout: d.value }, blocks: [block(lang, 'hero', 'image-right'), block(lang, 'products', 'well'), block(lang, 'footer', 'columns')] });
    default:
      return site(lang, { navbar: false, blocks: [block(lang, d.group, d.value)] });
  }
};

/** Wait for the pictures and fonts in the frame, at most `ms`. */
const settle = async (h, ms = 7000) => {
  await h.frame.evaluate(async (limit) => {
    const end = Date.now() + limit;
    await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 3000))]);
    while (Date.now() < end) {
      const imgs = [...document.querySelectorAll('img')].filter((i) => {
        const r = i.getBoundingClientRect();
        return r.bottom > 0 && r.top < window.innerHeight && r.width > 0;
      });
      if (imgs.every((i) => i.complete)) break;
      await new Promise((r) => setTimeout(r, 150));
    }
  }, ms);
};

/** The section under test: its height and background, in the frame. */
const measure = (h) => h.frame.evaluate(() => {
  const main = document.querySelector('main');
  const el = main && main.firstElementChild;
  if (!el) return { missing: true };
  const bgOf = (n) => {
    for (let x = n; x; x = x.parentElement) {
      const c = getComputedStyle(x).backgroundColor;
      if (c && !/rgba\(0, 0, 0, 0\)|transparent/.test(c)) return c;
    }
    return 'rgb(255, 255, 255)';
  };
  const r = main.getBoundingClientRect();
  return { height: Math.round(r.height), top: Math.round(r.top), bg: bgOf(el), tag: el.tagName, id: el.id || null, testids: [...new Set([...el.querySelectorAll('[data-testid]')].map((n) => n.getAttribute('data-testid')))].slice(0, 5) };
});

/** The first two product cards, grown to 16:10 within the viewport. */
const cardCrop = async (h, value) => {
  const boxes = await h.frame.evaluate(() => [...document.querySelectorAll('[data-testid="products-well"] > li')].slice(0, 2).map((li) => {
    const r = li.getBoundingClientRect();
    return { x: r.left, y: r.top, w: r.width, h: r.height };
  }));
  if (!boxes.length) return null;
  if (value === 'reveal') {
    const b = boxes[0];
    await h.page.mouse.move(b.x + b.w / 2, b.y + b.h / 2);
    await h.page.waitForTimeout(900);
  }
  const x0 = Math.min(...boxes.map((b) => b.x)), y0 = Math.min(...boxes.map((b) => b.y));
  const x1 = Math.max(...boxes.map((b) => b.x + b.w)), y1 = Math.max(...boxes.map((b) => b.y + b.h));
  const pad = 28;
  let w = Math.max(x1 - x0 + 2 * pad, (y1 - y0 + 2 * pad) * 1.6);
  let hh = w / 1.6;
  w = Math.min(w, W); hh = w / 1.6;
  let x = (x0 + x1) / 2 - w / 2, y = (y0 + y1) / 2 - hh / 2;
  x = Math.max(0, Math.min(W - w, x)); y = Math.max(0, Math.min(SECTION_H - hh, y));
  return { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(hh) };
};

const EXTRA_WAIT = { 'contact-bubbles': 9000 };

const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

/** Frames of a moving design: time-based, or by scrolling for the scroll heroes. */
const frames = async (h, d, dir, clip) => {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const shots = [];
  const snap = async () => {
    const file = path.join(dir, `${String(shots.length).padStart(3, '0')}.jpg`);
    await h.page.screenshot({ path: file, type: 'jpeg', quality: 88, clip });
    shots.push({ file: path.basename(file), t: Date.now() });
  };
  if (d.kind === 'hero') {
    // Scroll-driven: down through the hero, a breath, back up, a breath.
    const room = await h.frame.evaluate(() => {
      const el = document.querySelector('main').firstElementChild;
      return Math.round(el.getBoundingClientRect().height);
    });
    const range = Math.max(420, Math.min(room - 800 > 200 ? room - 800 : 640, 900));
    const steps = 16;
    const path_ = [...Array(steps + 1).keys()].map((i) => ease(i / steps) * range);
    const seqY = [...path_, range, range, ...[...path_].reverse(), 0, 0];
    for (const y of seqY) {
      await h.frame.evaluate((top) => window.scrollTo({ top, behavior: 'instant' }), Math.round(y));
      await h.page.waitForTimeout(110);
      await snap();
    }
    return { mode: 'scroll', range, shots, fixedMs: 85 };
  }
  const end = Date.now() + 3200;
  while (Date.now() < end) {
    const t = Date.now();
    await snap();
    const spent = Date.now() - t;
    if (spent < 90) await h.page.waitForTimeout(90 - spent);
  }
  return { mode: 'time', shots };
};

const shootOne = async (h, lang, d, out) => {
  const cfg = configOf(lang, d);
  h.errors.length = 0;
  await h.show(cfg, 700);
  await settle(h);
  await h.page.waitForTimeout(d.moving ? 2600 : 2200);
  // The contact bubbles start one after another over 10 s: wait until most are rising.
  if (EXTRA_WAIT[d.key]) await h.page.waitForTimeout(EXTRA_WAIT[d.key]);
  const meta = { key: d.key, lang, kind: d.kind, moving: d.moving, at: at(d) };
  if (tall(d)) Object.assign(meta, await measure(h));
  if (d.kind === 'card') meta.crop = await cardCrop(h, d.value);
  // What the picture is made of: the page's first screen, the section (up to SECTION_MAX), or the cards.
  meta.clip = d.kind === 'card' && meta.crop ? { x: meta.crop.x, y: meta.crop.y, width: meta.crop.w, height: meta.crop.h }
    : tall(d) ? { x: 0, y: 0, width: W, height: Math.max(1, Math.min(meta.height || H, SECTION_MAX)) }
    : { x: 0, y: 0, width: W, height: H };
  await h.page.screenshot({ path: path.join(out, `${d.key}.png`), clip: meta.clip });
  if (d.moving) meta.anim = await frames(h, d, path.join(out, d.key), meta.clip);
  meta.errors = h.errors.slice(0, 3);
  fs.writeFileSync(path.join(out, `${d.key}.json`), JSON.stringify(meta, null, 1));
  return meta;
};

(async () => {
  const langs = (process.argv[2] || 'he,en').split(',');
  const filter = process.argv[3];
  const match = (k) => !filter || k === filter || k.startsWith(filter) || new RegExp(filter).test(k);
  const all = designs().filter((d) => match(d.key));
  console.log(`${all.length} designs x ${langs.length} languages`);
  const browser = await launch();
  for (const lang of langs) {
    const out = path.join(RAW, lang);
    fs.mkdirSync(out, { recursive: true });
    // One framed page per address; a page is reused for its designs (each block a fresh id remounts).
    const pages = {};
    for (const d of all) {
      // A page without blocks keeps its sections mounted from one config to the next, and an entrance that
      // already ran never runs for the new layout's parts: those (and the products' own pages) get a fresh page.
      const fresh = ['legacy', 'productsPage', 'productPage'].includes(d.kind);
      const where = `${at(d)}|${tall(d) ? SECTION_H : H}${fresh ? `|${d.key}` : ''}`;
      if (!pages[where]) pages[where] = await open(browser, { width: W, height: tall(d) ? SECTION_H : H, at: at(d), reducedMotion: process.env.REDUCED ? 'reduce' : 'no-preference' });
      let meta;
      try {
        meta = await shootOne(pages[where], lang, d, out);
      } catch (e) {
        meta = { key: d.key, failed: String(e).slice(0, 300) };
        fs.writeFileSync(path.join(out, `${d.key}.json`), JSON.stringify(meta, null, 1));
        // A broken page is replaced for the next design.
        await pages[where].ctx.close().catch(() => {});
        delete pages[where];
      }
      if (fresh && pages[where]) { await pages[where].ctx.close().catch(() => {}); delete pages[where]; }
      console.log(lang, d.key, meta.failed ? `FAILED ${meta.failed}` : `h=${meta.height ?? '-'} ${meta.testids ? meta.testids.join(',') : ''} ${meta.anim ? `frames=${meta.anim.shots.length}` : ''} ${meta.errors && meta.errors.length ? 'ERR ' + meta.errors[0] : ''}`);
    }
    for (const p of Object.values(pages)) await p.ctx.close().catch(() => {});
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });

module.exports = { designs };
