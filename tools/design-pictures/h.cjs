// LT-595: the front's dist on preview.lightor.app, framed by a register-origin page
// that posts PREVIEW_DATA (the pattern of LT-525/588's h.js).
const fs = require('fs');
const path = require('path');
// The front checkout (built: `npm run build` there) whose dist draws the designs; its node_modules lend Playwright.
const FRONT = process.env.FRONT_DIR ? path.resolve(process.env.FRONT_DIR) : path.resolve(__dirname, '../../../lightor-front');
const { chromium } = require(path.join(FRONT, 'node_modules/playwright'));
const DIST = process.env.FRONT_DIST ? path.resolve(process.env.FRONT_DIST) : path.join(FRONT, 'dist');
exports.FRONT = FRONT;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.json': 'application/json', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };
const GPU = ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'];

exports.launch = () => chromium.launch({ channel: 'chrome', headless: true, args: GPU });

/** One framed preview at `at` (/, /products, /products/<slug>). */
exports.open = async (browser, { width = 1280, height = 800, at = '/', reducedMotion = 'no-preference' } = {}) => {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, reducedMotion });
  await ctx.route('https://api.lightor.app/**', async (route) => {
    const req = route.request();
    const u = new URL(req.url());
    const h = { 'access-control-allow-origin': req.headers().origin || '*', 'access-control-allow-credentials': 'true', 'access-control-allow-headers': '*' };
    if (req.method() === 'GET' && (u.pathname.startsWith('/packs') || u.pathname.startsWith('/api/images'))) return route.continue();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: h });
    return route.fulfill({ status: 200, headers: { ...h, 'content-type': 'application/json' }, body: '{"success":true,"data":[]}' });
  });
  await ctx.route('https://preview.lightor.app/**', (route) => {
    const u = new URL(route.request().url());
    let file = path.join(DIST, decodeURIComponent(u.pathname));
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST, 'index.html');
    route.fulfill({ status: 200, contentType: TYPES[path.extname(file)] || 'application/octet-stream', body: fs.readFileSync(file) });
  });
  await ctx.route('https://register.lightor.app/harness.html', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;overflow:hidden"><script>window.__ready=new Promise(function(r){window.addEventListener("message",function(e){if(e.data&&e.data.type==="LT_READY")r()})})</script><iframe id="f" src="https://preview.lightor.app${at}?preview" style="border:0;display:block;width:100vw;height:100vh"></iframe></body></html>` }));
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 300)));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|Failed to load resource|net::ERR/.test(m.text())) errors.push(m.text().slice(0, 300)); });
  await page.goto('https://register.lightor.app/harness.html', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => Promise.race([window.__ready, new Promise((r) => setTimeout(r, 15000))]));
  await page.waitForTimeout(400);
  const frame = page.frames().find((f) => f.url().includes('preview.lightor.app'));
  const show = async (cfg, wait = 1500) => {
    await frame.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await page.evaluate((x) => document.getElementById('f').contentWindow.postMessage({ type: 'PREVIEW_DATA', config: x }, '*'), cfg);
    await page.waitForTimeout(wait);
  };
  return { ctx, page, frame, show, errors };
};
