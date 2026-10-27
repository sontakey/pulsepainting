// Built-app layout coverage using accepted public pulse samples. Camera and
// metric display states are controlled: this is not physical-phone validation.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, devices, webkit } from 'playwright';
import { replayPublicFixture } from '../landscape-fixture.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const dist = path.join(root, 'dist');
const out = path.resolve(root, process.env.PPG_IMMERSIVE_ARTIFACTS || '.dream-loop/immersive-capture/verification');
mkdirSync(out, { recursive: true });
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json', '.woff2': 'font/woff2' };
const server = createServer((request, response) => {
  const pathname = new URL(request.url, 'http://localhost').pathname;
  const file = path.resolve(dist, '.' + (pathname === '/' ? '/index.html' : pathname));
  if (!file.startsWith(dist + '/') || !existsSync(file) || !statSync(file).isFile()) {
    response.writeHead(404); response.end(); return;
  }
  response.writeHead(200, { 'content-type': mime[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
  response.end(readFileSync(file));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const url = process.env.PPG_IMMERSIVE_URL || `http://127.0.0.1:${server.address().port}/`;
const engines = (process.env.PPG_IMMERSIVE_ENGINES || 'chromium,webkit').split(',');
assert.ok(engines.every(engine => ['chromium', 'webkit'].includes(engine)));
const viewports = [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 430, height: 932 }, { width: 844, height: 390 }];
const { segments } = replayPublicFixture(1, 0, 180);
const settle = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const result = {
  scope: 'Chromium and WebKit phone viewport emulation, built app, public accepted pulse samples and controlled readouts. No physical camera, safe-area hardware, physiological accuracy or FPS claim.',
  url,
  builtSha256: Object.fromEntries(['index.html', 'app.css', 'app.js', 'landscape.js', 'landscape.css'].map(file => [file, createHash('sha256').update(readFileSync(path.join(dist, file))).digest('hex')])),
  browsers: [],
};

async function inspect(page) {
  return page.evaluate(() => {
    const rect = selector => {
      const node = document.querySelector(selector), bounds = node.getBoundingClientRect(), style = getComputedStyle(node);
      return { left: bounds.left, top: bounds.top, right: bounds.right, bottom: bounds.bottom, width: bounds.width, height: bounds.height, radius: parseFloat(style.borderTopLeftRadius), position: style.position, fontSize: parseFloat(style.fontSize) };
    };
    const probe = document.createElement('div');
    probe.style.cssText = 'position:fixed;visibility:hidden;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)';
    document.body.append(probe);
    const safeStyle = getComputedStyle(probe), safeArea = { top: parseFloat(safeStyle.paddingTop) || 0, right: parseFloat(safeStyle.paddingRight) || 0, bottom: parseFloat(safeStyle.paddingBottom) || 0, left: parseFloat(safeStyle.paddingLeft) || 0 };
    probe.remove();
    const buttons = ['#btn-cancel-reading', '#btn-stop'].map(selector => {
      const box = rect(selector), node = document.querySelector(selector), hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
      return { selector, text: node.textContent.trim(), disabled: node.disabled, hit: hit === node || node.contains(hit), ...box };
    });
    const stats = window.__pulseLandscapeStats;
    return {
      width: innerWidth, height: innerHeight, scrollWidth: document.documentElement.scrollWidth, scrollHeight: document.documentElement.scrollHeight, scrollX, scrollY,
      safeArea, art: rect('#landscape-view'), frame: rect('.manuscript-frame'), hud: rect('.capture-hud'), title: rect('.capture-title'), metrics: rect('.live-metrics'), camera: rect('.capture-camera'), signalHint: rect('#quality-pill'), summary: rect('.live-details > summary'), dock: rect('.painting-actions'), buttons,
      labels: [...document.querySelectorAll('#screen-measuring .metric-label')].map(node => node.textContent),
      metricValues: [...document.querySelectorAll('#screen-measuring .metric-number')].map(node => node.textContent),
      detailsOpen: document.querySelector('.live-details').open,
      detailsBody: document.querySelector('.live-details').open ? rect('.live-details-body') : null,
      signalOpen: !document.querySelector('#signal-preview').hidden,
      signalText: document.querySelector('#quality-text').textContent,
      projection: stats?.projection && { kind: stats.projection.kind, baseline: stats.projection.baseline, amplitude: stats.projection.amplitude, windowSeconds: stats.projection.windowSeconds }, strokes: stats?.strokes, frontier: stats?.frontier && { t: stats.frontier.t, v: stats.frontier.v },
    };
  });
}

function checkLayout(layout, label) {
  const near = (actual, expected, description) => assert.ok(Math.abs(actual - expected) <= 1, `${label}: ${description} (${actual} vs ${expected})`);
  near(layout.art.left, 0, 'art touches the left viewport edge');
  near(layout.art.top, 0, 'art touches the top viewport edge');
  near(layout.art.right, layout.width, 'art touches the right viewport edge');
  near(layout.art.bottom, layout.height, 'art touches the bottom viewport edge');
  near(layout.art.radius, 0, 'art has no inset rounded corners');
  assert.ok(layout.scrollWidth <= layout.width + 1 && layout.scrollHeight <= layout.height + 1, `${label}: recording has no document overflow`);
  assert.equal(layout.scrollX, 0, `${label}: viewport never shifts horizontally`);
  assert.equal(layout.scrollY, 0, `${label}: recording remains at its viewport origin`);
  assert.ok(layout.projection?.kind === 'continuous-source-time-value' && layout.strokes > 0, `${label}: actual accepted waveform is mounted`);
  near(layout.art.top + layout.projection.baseline, layout.height / 2, 'waveform baseline remains centered');
  const waveTop = layout.art.top + layout.projection.baseline - layout.projection.amplitude / 2;
  assert.ok(layout.metrics.bottom <= waveTop - 8, `${label}: overlaid metrics leave space above the central pulse`);
  assert.ok(layout.title.bottom <= waveTop - 8 && layout.camera.bottom <= waveTop - 8, `${label}: header stays above the pulse corridor`);
  assert.ok(layout.signalHint.top >= layout.camera.bottom - 1, `${label}: brief signal coaching remains beneath the camera preview`);
  assert.deepEqual(layout.labels, ['Pulse', 'HRV', 'Signal'], `${label}: compact live readouts remain available`);
  assert.ok(layout.dock.bottom <= layout.height - layout.safeArea.bottom - 8, `${label}: actions clear the bottom safe area`);
  assert.ok(layout.dock.left >= layout.safeArea.left && layout.dock.right <= layout.width - layout.safeArea.right, `${label}: action dock clears side safe areas`);
  assert.ok(layout.summary.width >= 44 && layout.summary.height >= 44, `${label}: disclosure is a usable touch target`);
  const overlap = Math.min(layout.summary.right, layout.dock.right) - Math.max(layout.summary.left, layout.dock.left) > 1
    && Math.min(layout.summary.bottom, layout.dock.bottom) - Math.max(layout.summary.top, layout.dock.top) > 1;
  assert.equal(overlap, false, `${label}: disclosure never overlaps the floating actions`);
  for (const button of layout.buttons) {
    assert.ok(button.width >= 44 && button.height >= 44 && button.fontSize >= 14, `${label}: ${button.text} is readable and at least 44px`);
    assert.ok(button.left >= 0 && button.right <= layout.width && button.top >= 0 && button.bottom <= layout.height && button.hit && !button.disabled, `${label}: ${button.text} stays visible and accessible`);
  }
  if (layout.detailsBody) {
    assert.ok(layout.detailsBody.top >= layout.safeArea.top - 1 && layout.detailsBody.bottom <= layout.height && layout.detailsBody.left >= 0 && layout.detailsBody.right <= layout.width, `${label}: details fit in an independently scrolling overlay`);
  }
}

let browser;
try {
  for (const engine of engines) {
    browser = await (engine === 'webkit' ? webkit : chromium).launch(engine === 'chromium' && process.platform === 'darwin' ? { channel: 'chrome' } : {});
    const context = await browser.newContext({ ...devices['iPhone 13'], viewport: viewports[1], deviceScaleFactor: 1, reducedMotion: 'no-preference' });
    const item = { engine, version: browser.version(), cases: [], errors: [], writes: [], cameraRequests: 0 };
    result.browsers.push(item);
    await context.route('**/*', route => {
      if (!['GET', 'HEAD', 'OPTIONS'].includes(route.request().method())) { item.writes.push(route.request().method()); return route.abort('blockedbyclient'); }
      return route.continue();
    });
    await context.addInitScript(() => {
      window.__testCameraRequests = 0;
      if (navigator.mediaDevices) navigator.mediaDevices.getUserMedia = () => { window.__testCameraRequests++; return Promise.reject(Error('Layout replay cannot acquire a camera')); };
    });
    const page = await context.newPage();
    page.on('pageerror', error => item.errors.push(String(error)));
    await page.goto(url); await page.evaluate(() => document.fonts.ready);
    await page.evaluate(segments => {
      __demoState('measuring');
      landscapeView?.dispose();
      landscape = PulseLandscape.create({ family: 'quiet-lake', seed: 39293 });
      manuscript.segments = segments;
      segments.forEach(segment => PulseLandscape.append(landscape, segment));
      landscapeView = PulseLandscape.createView(document.getElementById('landscape-view'), landscape);
      document.getElementById('manuscript-empty').hidden = true;
    }, segments.slice(0, 12));
    await page.waitForFunction(() => __pulseLandscapeStats.streamTime >= 3 && __pulseLandscapeStats.nib && __pulseLandscapeStats.warmStrokes > 0, null, { timeout: 30000 });
    for (const viewport of viewports) {
      await page.setViewportSize(viewport); await settle(page);
      const id = `${engine}-${viewport.width}x${viewport.height}`;
      let closed;
      for (const state of ['ready', 'estimating', 'bad']) {
        await page.evaluate(state => {
          resetLiveSignal();
          updateMeasuringScreen({ t: 100, heartRate: 94, rmssd: 45, qualityScore: state === 'estimating' ? undefined : 92, quality: { good: state !== 'bad' } });
        }, state);
        await settle(page);
        const layout = await inspect(page);
        if (state === 'ready') {
          // Capture the settled measured value rather than a random point in
          // its CSS easing; reduced motion reaches the same target immediately.
          await page.waitForFunction(() => {
            const track = document.getElementById('signal-quality-track');
            const target = Number(track.getAttribute('aria-valuenow')) / 100;
            const transform = getComputedStyle(document.getElementById('signal-quality-fill')).transform;
            return Math.abs(new DOMMatrix(transform).m11 - target) <= .005;
          }, null, { timeout: 3000 });
          await page.screenshot({ path: path.join(out, `${id}-recording.png`) });
        }
        checkLayout(layout, `${id}/${state}`);
        if (state === 'ready') {
          assert.equal(layout.signalText.trim(), '', `${id}: a good signal needs no extra words`);
        }
        item.cases.push({ viewport, state, layout }); closed = layout;
      }
      await page.locator('.live-details > summary').click(); await settle(page);
      const expanded = await inspect(page); checkLayout(expanded, `${id}/details`);
      assert.deepEqual(expanded.art, closed.art, `${id}: opening readings does not resize or move the art`);
      assert.deepEqual(expanded.projection, closed.projection, `${id}: opening readings keeps the central waveform projection`);
      assert.equal(expanded.signalOpen, false, `${id}: raw graphs are optional`);
      await page.screenshot({ path: path.join(out, `${id}-details.png`) });
      await page.getByRole('button', { name: 'View signal', exact: true }).click(); await settle(page);
      const signal = await inspect(page); checkLayout(signal, `${id}/signal`);
      assert.deepEqual(signal.art, closed.art, `${id}: opening raw graphs does not resize or move the art`);
      assert.equal(signal.signalOpen, true, `${id}: raw graphs can be expanded`);
      await page.screenshot({ path: path.join(out, `${id}-signal.png`) });
      item.cases.push({ viewport, state: 'details', layout: expanded }, { viewport, state: 'signal', layout: signal });
      await page.locator('#btn-signal-preview').click();
      await page.locator('.live-details > summary').click(); await settle(page);
    }
    item.cameraRequests = await page.evaluate(() => window.__testCameraRequests);
    assert.equal(item.cameraRequests, 0, `${engine}: layout replay never opens a physical camera`);
    assert.deepEqual(item.writes, [], `${engine}: layout verification does not publish user data`);
    assert.deepEqual(item.errors, [], `${engine}: no browser errors`);
    await context.close(); await browser.close(); browser = null;
    console.log(`${engine}: immersive capture fits all four phone viewports, with fixed artwork, overlaid readouts and accessible floating actions`);
  }
  result.passed = true;
} catch (error) {
  result.failure = String(error?.stack || error); throw error;
} finally {
  writeFileSync(path.join(out, 'layout-results.json'), JSON.stringify(result, null, 2));
  await browser?.close(); await new Promise(resolve => server.close(resolve));
}
