// Real SSR template, response CSP and deployed entry bundle with one public
// fixture image. Browser checks never publish records or access a camera.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, webkit } from 'playwright';
import { sketchbookPage } from '../../server/painting-page-view.js';
import handler from '../../api/painting-page.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const out = process.env.PPG_PUBLIC_BOOK_ARTIFACTS && path.resolve(root, process.env.PPG_PUBLIC_BOOK_ARTIFACTS);
if (out) await mkdir(out, { recursive: true });
// The public contract accepts UUID versions 1–8, including newer version 7.
const id = '11111111-1111-7111-8111-111111111111', origin = 'https://www.pulsepainting.com';
const canonical = `${origin}/book/${id}`;
const imageURL = `https://hnexw2ri5lomm3rg.public.blob.vercel-storage.com/community/preview/${id}/22222222-2222-4222-8222-222222222222/painting.jpg`;
const hostileName = '\"><img src=x onerror="window.pwned=1"> & <test>';
const image = await readFile(path.join(root, 'app/assets/gallery/quiet-lake-share.jpg'));
const headers = new Map();
const response = { setHeader: (name, value) => headers.set(name.toLowerCase(), value), end() {} };
// No database is used to select the real book policy; service creation fails
// closed after the route's policy is installed.
const savedURL = process.env.DATABASE_URL;
delete process.env.DATABASE_URL;
try { await handler({ method: 'GET', url: `/api/painting-page?id=${id}&view=book` }, response); }
finally { if (savedURL !== undefined) process.env.DATABASE_URL = savedURL; }
assert.equal(response.statusCode, 503);
assert.match(headers.get('content-security-policy'), /frame-src 'self'/);
assert.equal(headers.get('cache-control'), 'no-store');
const mime = { '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.jpg': 'image/jpeg' };
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === `/book/${id}`) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': headers.get('content-security-policy'), 'Referrer-Policy': 'no-referrer', 'Cache-Control': 'no-store' });
      res.end(sketchbookPage({ id, displayName: url.searchParams.has('long') ? 'W'.repeat(50) : url.searchParams.has('preview') ? 'Avery' : hostileName, imageURL, url: `${origin}/p/${id}` }, origin)); return;
    }
    const file = path.resolve(root, 'dist', '.' + url.pathname);
    if (!file.startsWith(path.join(root, 'dist') + '/')) throw new Error();
    const bytes = await readFile(file);
    res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', ...(url.pathname.startsWith('/sketchbook/') ? { 'Access-Control-Allow-Origin': '*' } : {}) }); res.end(bytes);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`, results = [];
let browser;
async function readyBook(page) {
  await page.waitForFunction(() => document.querySelector('.book-paper').classList.contains('ready'), null, { timeout: 30000 });
  const frame = page.frames().find(frame => frame !== page.mainFrame()); assert.ok(frame);
  await frame.waitForFunction(() => document.body.dataset.ready === '1');
  await frame.waitForTimeout(300);
  await frame.waitForFunction(() => !document.getElementById('sbWrap').classList.contains('intro'));
  return frame;
}
try {
  for (const [name, engine] of [['chromium', chromium], ['webkit', webkit]]) {
    browser = await engine.launch(name === 'chromium' && process.platform === 'darwin' ? { channel: 'chrome' } : {});
    for (const width of process.env.PPG_PUBLIC_BOOK_RECOVERY_ONLY === '1' ? [] : [320, 390, 1440]) {
      const height = width === 320 ? 568 : width === 390 ? 844 : 1000;
      const context = await browser.newContext({ viewport: { width, height }, isMobile: width < 640, hasTouch: width < 640, deviceScaleFactor: 1, reducedMotion: width === 390 ? 'no-preference' : 'reduce' });
      await context.route(imageURL, route => route.fulfill({ body: image, contentType: 'image/jpeg', headers: { 'Access-Control-Allow-Origin': '*' } }));
      await context.addInitScript(() => {
        window.cspViolations = [];
        addEventListener('securitypolicyviolation', event => cspViolations.push({ directive: event.effectiveDirective, blocked: event.blockedURI }));
        window.nativeShares = []; window.copied = [];
        window.publicFetchOptions = [];
        const originalFetch = window.fetch;
        window.fetch = (url, options) => { publicFetchOptions.push({ url: String(url), redirect: options?.redirect, credentials: options?.credentials }); return originalFetch(url, options); };
        Object.defineProperty(navigator, 'share', { configurable: true, value: data => { nativeShares.push({ ...data, active: navigator.userActivation?.isActive }); return Promise.resolve(); } });
        Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: value => { copied.push(value); return Promise.resolve(); } } });
      });
      const page = await context.newPage(), errors = [], failed = [], requests = [];
      page.on('pageerror', error => errors.push(error.message)); page.on('requestfailed', request => failed.push(request.url())); page.on('request', request => requests.push({ url: request.url(), method: request.method() }));
      await page.goto(`${base}/book/${id}`); const frame = await readyBook(page);
      if (out) await page.screenshot({ path: path.join(out, `${name}-${width}-arrival.png`), fullPage: true });
      assert.equal(await page.evaluate(() => window.pwned), undefined);
      assert.equal(await page.locator('.book-byline strong').textContent(), hostileName);
      assert.equal(await page.locator('meta[property="og:url"]').getAttribute('content'), canonical);
      assert.equal(await page.locator('meta[property="og:image"]').getAttribute('content'), imageURL);
      assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'), canonical);
      assert.equal(await page.locator('iframe').getAttribute('sandbox'), 'allow-scripts');
      assert.equal(await frame.locator('#plateList .plate').count(), 3);
      assert.equal(await frame.locator('#sbBook .sb-full img').evaluate(img => img.complete && img.naturalWidth === 1760 && img.naturalHeight === 1240), true);
      const bounds = await frame.evaluate(() => ({ height: innerHeight, width: innerWidth, scrollY, controls: [...document.querySelectorAll('.sb-tools,.tool,#sbCaptions,.sb-hint')].filter(el => getComputedStyle(el).display !== 'none').map(el => el.getBoundingClientRect().toJSON()) }));
      assert.equal(bounds.scrollY, 0);
      for (const control of bounds.controls) assert.ok(control.top >= -1 && control.bottom <= bounds.height + 1 && control.left >= -1 && control.right <= bounds.width + 1, 'book controls fit before interaction');
      await frame.locator('#sbRight').click(); await frame.waitForFunction(() => document.querySelector('#sbBook .sb-full img')?.alt === 'A closer look');
      await frame.locator('#sbRight').click(); await frame.waitForFunction(() => document.querySelector('#sbBook .sb-full img')?.alt === 'A moment to share');
      await frame.locator('#zIn').click(); assert.equal(await frame.locator('#zRead').innerText(), '116%');
      await frame.locator('#zOut').click(); await frame.locator('#sbLeft').click();
      await frame.waitForFunction(() => document.querySelector('#sbBook .sb-full img')?.alt === 'A closer look');
      await frame.locator('#sbRight').focus(); await page.keyboard.press('Enter');
      await frame.waitForFunction(() => document.querySelector('#sbBook .sb-full img')?.alt === 'A moment to share');
      const layout = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth, dock: document.querySelector('.book-actions').getBoundingClientRect().toJSON(), fixed: getComputedStyle(document.querySelector('.book-actions')).position, buttons: [...document.querySelectorAll('.book-actions > *')].map(el => el.getBoundingClientRect().toJSON()), fonts: [document.fonts.check('16px DM'), document.fonts.check('48px Brush')] }));
      assert.equal(layout.width, layout.scroll); assert.deepEqual(layout.fonts, [true, true]);
      assert.ok(layout.buttons.every(rect => rect.height >= 44 && rect.width >= 44));
      if (width < 640) { assert.equal(layout.fixed, 'fixed'); assert.ok(layout.dock.bottom <= height && layout.dock.left >= 0 && layout.dock.right <= width); }
      await page.locator('#share-public-book').click();
      const share = await page.evaluate(() => nativeShares.at(-1));
      assert.equal(share.url, canonical); assert.equal(share.active, true); assert.deepEqual(Object.keys(share).sort(), ['active', 'text', 'title', 'url']);
      await page.evaluate(() => Object.defineProperty(navigator, 'share', { configurable: true, value: () => Promise.reject(new DOMException('Canceled', 'AbortError')) }));
      await page.locator('#share-public-book').click(); assert.equal(await page.locator('#book-copy-fallback').isVisible(), false, 'native cancellation is quiet');
      await page.evaluate(() => Object.defineProperty(navigator, 'share', { configurable: true, value: undefined }));
      await page.locator('#share-public-book').click(); assert.equal(await page.locator('#book-link').inputValue(), canonical); assert.equal(await page.evaluate(() => copied.at(-1)), canonical);
      await page.evaluate(() => navigator.clipboard.writeText = () => Promise.reject(new Error('denied')));
      await page.locator('#copy-public-book').click(); assert.match(await page.locator('#book-share-status').textContent(), /Select and copy/);
      assert.equal(await page.locator('#book-link').evaluate(input => getComputedStyle(input).fontSize), '16px');
      assert.equal(await page.locator('#book-link').evaluate(input => input.selectionEnd - input.selectionStart), canonical.length);
      assert.deepEqual(await page.evaluate(() => cspViolations), []); assert.deepEqual(await frame.evaluate(() => cspViolations), []);
      assert.deepEqual(await page.evaluate(() => publicFetchOptions.filter(call => call.url.includes('blob.vercel-storage.com'))), [{ url: imageURL, redirect: 'error', credentials: 'omit' }]);
      assert.ok(requests.every(request => request.method === 'GET'), 'recipient opening/sharing never publishes');
      assert.ok(!requests.some(request => request.url.includes('/api/') || request.url.includes('ppg.global') || /(?:bloom|merlion|marina-bay|botany|singapore-river)\.(?:jpg|png)/.test(request.url)), 'recipient loads no camera runtime or authored travel plates');
      assert.deepEqual(errors, []); assert.deepEqual(failed, []);
      if (out) { await page.goto(`${base}/book/${id}?preview=1`); await readyBook(page); await page.screenshot({ path: path.join(out, `${name}-${width}.png`), fullPage: true }); }
      results.push({ browser: name, width, height, layout, bounds, passed: true });
      await context.close();
    }
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
    await context.route(imageURL, route => route.fulfill({ body: image, contentType: 'image/jpeg', headers: { 'Access-Control-Allow-Origin': '*' } }));
    const page = await context.newPage();
    await page.route('**/sketchbook-entry.js', route => route.abort());
    await page.goto(`${base}/book/${id}`); await page.locator('#public-book-retry').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#public-book-fallback').isVisible(), true); assert.equal(await page.locator('#share-public-book').isEnabled(), true);
    // Module failures recover through the actual retry button, which refreshes
    // this document because browsers cache failed dynamic module imports.
    await page.unroute('**/sketchbook-entry.js');
    await Promise.all([page.waitForNavigation(), page.locator('#public-book-retry').click()]); await readyBook(page);
    await page.goto(`${base}/book/${id}?long=1`); await readyBook(page); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 390);
    await page.evaluate(() => dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true })));
    assert.equal(await page.locator('iframe').count(), 0, 'leaving disposes the old book');
    await page.evaluate(() => dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })));
    await readyBook(page);

    // Accelerate only the public client's 45-second deadline, keeping the real
    // abort/retry lifecycle while leaving the authored renderer timers intact.
    await page.addInitScript(() => {
      const original = window.setTimeout;
      window.shortenBookDeadline = location.search.includes('stall=1');
      window.setTimeout = (fn, delay, ...args) => original(fn, window.shortenBookDeadline && delay === 45_000 ? 500 : delay, ...args);
    });
    let stalled = false;
    await page.route(imageURL, route => {
      if (route.request().resourceType() === 'fetch') { stalled = true; return; }
      return route.fulfill({ body: image, contentType: 'image/jpeg', headers: { 'Access-Control-Allow-Origin': '*' } });
    });
    await page.goto(`${base}/book/${id}?stall=1`); await page.locator('#public-book-retry').waitFor({ state: 'visible' });
    assert.ok(stalled, 'public JPEG request was left stalled');
    assert.equal(await page.locator('#public-book-fallback').isVisible(), true, 'deadline restores the painting');
    await page.evaluate(() => { window.shortenBookDeadline = false; });
    await page.unroute(imageURL); await page.locator('#public-book-retry').click(); await readyBook(page);
    // WebKit's interception API cannot fulfill a redirect response. Both
    // engines verify redirect:error above; Chromium also exercises a real 302.
    if (name === 'chromium') {
      await page.route(imageURL, route => route.request().resourceType() === 'fetch'
        ? route.fulfill({ status: 302, headers: { location: 'https://untrusted.example/painting.jpg', 'Access-Control-Allow-Origin': '*' } })
        : route.fulfill({ body: image, contentType: 'image/jpeg', headers: { 'Access-Control-Allow-Origin': '*' } }));
      const redirected = [];
      page.on('request', request => { if (request.url().startsWith('https://untrusted.example')) redirected.push(request.url()); });
      await page.goto(`${base}/book/${id}`); await page.locator('#public-book-retry').waitFor({ state: 'visible' });
      assert.deepEqual(redirected, [], 'public JPEG fetch never follows a redirect');
    }
    await context.close(); await browser.close(); browser = null;
    console.log(process.env.PPG_PUBLIC_BOOK_RECOVERY_ONLY === '1' ? `PUBLIC_SKETCHBOOK_RECOVERY_PASS ${name}` : `PUBLIC_SKETCHBOOK_PASS ${name}: shared recipient page/CSP, 320/390/1440, native URL activation, copy fallback, pages/zoom, failures and no writes`);
  }
  if (out) await writeFile(path.join(out, 'result.json'), JSON.stringify({ scope: 'Public fixture, actual SSR/CSP and book engine; browser emulation only, no database writes or native social delivery', results }, null, 2));
} catch (error) {
  if (out && browser) for (const context of browser.contexts()) for (const page of context.pages()) await page.screenshot({ path: path.join(out, 'failure.png'), fullPage: true }).catch(() => {});
  throw error;
} finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
