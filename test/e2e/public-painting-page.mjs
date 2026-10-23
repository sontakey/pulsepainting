// Real SSR template and response policy; public fixture image intercepted.
// Browser emulation only: no database writes or physical-phone claim.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, webkit } from 'playwright';
import { paintingPage } from '../../server/painting-page-view.js';
import handler from '../../api/painting-page.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const out = process.env.PPG_PUBLIC_PAGE_ARTIFACTS && path.resolve(root, process.env.PPG_PUBLIC_PAGE_ARTIFACTS);
if (out) await mkdir(out, { recursive: true });
const id = '11111111-1111-4111-8111-111111111111';
const imageURL = `https://hnexw2ri5lomm3rg.public.blob.vercel-storage.com/community/preview/${id}/22222222-2222-4222-8222-222222222222/painting.jpg`;
const origin = 'https://www.pulsepainting.com';
const hostileName = '"><img src=x onerror="window.pwned=1"> & <test>';
assert.ok([...hostileName].length <= 50, 'adversarial name fits the actual API bound');
const image = await readFile(path.join(root, 'app/assets/gallery/quiet-lake-share.jpg'));
const fonts = new Map(await Promise.all(['dm-sans-latin.woff2', 'water-brush-latin.woff2'].map(async name => [name, await readFile(path.join(root, 'app/fonts', name))])));

// Unsupported methods exercise the actual handler's common headers without
// needing database credentials or substituting its service implementation.
const headers = new Map(); let rejectedBody = '';
const response = { setHeader: (name, value) => headers.set(name.toLowerCase(), value), end: value => { rejectedBody = value || ''; } };
await handler({ method: 'POST', url: `/p/${id}` }, response);
assert.equal(response.statusCode, 405);
assert.equal(headers.get('cache-control'), 'no-store');
assert.equal(headers.get('referrer-policy'), 'no-referrer');
assert.match(headers.get('content-security-policy'), /default-src 'none'/);
assert.match(headers.get('content-security-policy'), /font-src 'self'/);
assert.ok(!rejectedBody.includes('property="og:image"'));

const server = createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const font = url.pathname.startsWith('/fonts/') && fonts.get(url.pathname.slice(7));
  if (font) { res.writeHead(200, { 'Content-Type': 'font/woff2' }); res.end(font); return; }
  if (url.pathname !== `/p/${id}`) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': headers.get('content-security-policy'), 'Referrer-Policy': headers.get('referrer-policy') });
  res.end(paintingPage({ id, displayName: url.searchParams.has('long') ? 'W'.repeat(50) : hostileName, imageURL, url: `${origin}/p/${id}` }, origin));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const url = `http://127.0.0.1:${server.address().port}/p/${id}`;
const results = [];
let browser;
try {
  for (const [name, engine] of [['chromium', chromium], ['webkit', webkit]]) {
    browser = await engine.launch(name === 'chromium' && process.platform === 'darwin' ? { channel: 'chrome' } : {});
    const context = await browser.newContext({ deviceScaleFactor: 1, reducedMotion: 'reduce' });
    await context.route(imageURL, route => route.fulfill({ body: image, contentType: 'image/jpeg' }));
    await context.addInitScript(() => {
      window.cspViolations = [];
      addEventListener('securitypolicyviolation', event => cspViolations.push({ directive: event.effectiveDirective, blocked: event.blockedURI }));
    });
    const page = await context.newPage(), errors = [], measurements = [];
    page.on('pageerror', error => errors.push(error.message));
    for (const width of [320, 390, 1440]) {
      const height = width === 320 ? 740 : width === 390 ? 844 : 1000;
      await page.setViewportSize({ width, height });
      await page.goto(url);
      await page.evaluate(async () => { await document.fonts.ready; await document.querySelector('figure img').decode(); });
      assert.equal(await page.locator('script').count(), 0, 'share arrival is script-free');
      assert.equal(await page.locator('img').count(), 1, 'display name cannot inject an image');
      assert.equal(await page.evaluate(() => window.pwned), undefined);
      assert.equal(await page.locator('.byline strong').textContent(), hostileName);
      assert.equal(await page.locator('figure img').getAttribute('alt'), `A pulse painting shared by ${hostileName}`);
      for (const selector of ['meta[property="og:title"]', 'meta[name="twitter:title"]']) assert.equal(await page.locator(selector).getAttribute('content'), `${hostileName}’s Pulse Painting`);
      for (const selector of ['meta[property="og:image"]', 'meta[name="twitter:image"]']) assert.equal(await page.locator(selector).getAttribute('content'), imageURL);
      assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'), `${origin}/p/${id}`);
      assert.equal(await page.locator('.actions a').count(), 2, 'public painting keeps its make and explore actions');
      assert.equal(await page.locator('.actions a').first().getAttribute('href'), `${origin}/`);
      assert.equal(await page.locator('.actions a').last().getAttribute('href'), `${origin}/?painting=${id}#landscapes`);
      assert.equal(await page.locator('a[href*="/book/"]').count(), 0, 'the painting arrival page does not promote a sketchbook');
      assert.doesNotMatch(await page.locator('main').innerText(), /sketchbook/i, 'public painting copy stays focused on the artwork');
      const layout = await page.evaluate(() => {
        const actions = document.querySelector('.actions'), rect = actions.getBoundingClientRect();
        return { width: innerWidth, height: innerHeight, scrollWidth: document.documentElement.scrollWidth, actions: rect.toJSON(), position: getComputedStyle(actions).position, fonts: { brush: document.fonts.check('48px Brush'), sans: document.fonts.check('17px DM') }, controls: [...document.querySelectorAll('a')].map(el => ({ text: el.textContent, width: el.getBoundingClientRect().width, height: el.getBoundingClientRect().height })), csp: cspViolations };
      });
      assert.equal(layout.scrollWidth, width, 'no horizontal overflow at supported widths');
      assert.deepEqual(layout.fonts, { brush: true, sans: true }, 'both self-hosted fonts load under the actual CSP');
      assert.deepEqual(layout.csp, [], 'no CSP blocked fonts/images/styles');
      assert.equal(layout.position, width <= 600 ? 'fixed' : 'static');
      for (const control of layout.controls.slice(0, 2)) { assert.ok(control.height >= 48 && control.width >= 44, `primary touch target: ${control.text}`); }
      if (width <= 600) {
        assert.ok(layout.actions.left >= 0 && layout.actions.right <= width && layout.actions.bottom <= height, 'floating CTA remains within phone viewport');
        await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
        const bottom = await page.evaluate(() => ({ footer: document.querySelector('.footer').getBoundingClientRect().bottom, dock: document.querySelector('.actions').getBoundingClientRect().top }));
        assert.ok(bottom.footer < bottom.dock, 'last content can scroll above the floating controls');
        await page.evaluate(() => scrollTo(0, 0));
      }
      // Safari's default macOS setting uses Option-Tab to include links.
      await page.keyboard.press(name === 'webkit' ? 'Alt+Tab' : 'Tab');
      assert.equal(await page.evaluate(() => document.activeElement.textContent), 'Make your own painting');
      assert.notEqual(await page.locator('.actions a').first().evaluate(el => getComputedStyle(el).outlineStyle), 'none', 'keyboard focus is visible');
      if (out) await page.screenshot({ path: path.join(out, `${name}-${width}.png`), fullPage: true });
      measurements.push(layout);
      await page.goto(`${url}?long=1`); await page.evaluate(() => document.fonts.ready);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), width, 'maximum unbroken display name wraps without overflow');
    }
    assert.deepEqual(errors, []);
    results.push({ browser: name, measurements });
    await context.close(); await browser.close(); browser = null;
    console.log(`PUBLIC_PAINTING_PAGE_PASS ${name}: 320/390/1440 layout, self-hosted fonts/CSP, keyboard focus and adversarial OG/name escaping`);
  }
  if (out) await writeFile(path.join(out, 'result.json'), JSON.stringify({ scope: 'SSR fixture browser checks; no database writes or real-phone validation', results }, null, 2));
} finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
