// Public recorded PPG with real workers and a stepped presentation clock.
// This guards bounded live resources and source/export fidelity, not phone FPS,
// screen-recording load, camera delivery or thermal behavior.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, webkit } from 'playwright';
import { replayPublicFixture } from '../landscape-fixture.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const renderer = readFileSync(path.resolve(root, process.env.PPG_LONG_CAPTURE_SOURCE || 'app/landscape.js'), 'utf8');
const { segments } = replayPublicFixture(1, 0, 180);
assert.ok(segments.length > 20, 'the public recording supplies a full accepted session');
const engines = (process.env.PPG_LONG_CAPTURE_ENGINES || 'chromium,webkit').split(',');
assert.ok(engines.every(name => ['chromium', 'webkit'].includes(name)));
const output = path.resolve(root, process.env.PPG_LONG_CAPTURE_ARTIFACTS || '.dream-loop/long-capture');
mkdirSync(output, { recursive: true });
const files = new Map([
  ['/', ['text/html', '<!doctype html><meta name="viewport" content="width=device-width"><link rel="stylesheet" href="/app/landscape.css"><style>body{margin:0}main{width:100%;height:620px;overflow:hidden}</style><main></main>']],
  ['/app/landscape.js', ['text/javascript', renderer]],
  ['/app/landscape-raster-worker.js', ['text/javascript', readFileSync(path.join(root, 'app/landscape-raster-worker.js'), 'utf8')]],
  ['/app/landscape.css', ['text/css', readFileSync(path.join(root, 'app/landscape.css'), 'utf8')]],
]);
const server = createServer((request, response) => {
  const item = files.get(new URL(request.url, 'http://localhost').pathname);
  response.writeHead(item ? 200 : 404, { 'content-type': item?.[0] || 'text/plain', 'cache-control': 'no-store' });
  response.end(item?.[1] || 'Not found');
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;

try {
  for (const engine of engines) {
    let browser;
    const result = { engine, rendererSha256: createHash('sha256').update(renderer).digest('hex'),
      scope: 'Public accepted source, actual worker transport, stepped long-session lifecycle. Structural correctness only; not physical-phone performance.',
      checkpoints: [], errors: [] };
    try {
      browser = await (engine === 'webkit' ? webkit : chromium).launch(engine === 'chromium' && process.platform === 'darwin' ? { channel: 'chrome' } : {});
      result.browserVersion = browser.version();
      const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, reducedMotion: 'no-preference' });
      page.on('pageerror', error => result.errors.push(String(error)));
      await page.goto(origin);
      await page.evaluate(() => {
        const pending = new Map(); let id = 0, clock = 0;
        window.requestAnimationFrame = callback => { pending.set(++id, callback); return id; };
        window.cancelAnimationFrame = key => pending.delete(key);
        window.advancePaint = (dt = 1000 / 30) => {
          clock += dt;
          const callbacks = [...pending.values()]; pending.clear();
          callbacks.forEach(callback => callback(clock));
        };
        window.pendingPaint = () => pending.size;
      });
      await page.addScriptTag({ url: `${origin}/app/landscape.js` });
      await page.evaluate(segments => {
        const expect = (value, message) => { if (!value) throw Error(message); };
        window.openCapture = () => {
          window.view?.dispose();
          window.scene = PulseLandscape.create({ family: 'quiet-lake', seed: 39293 });
          segments.forEach(segment => PulseLandscape.append(scene, segment));
          window.sourceBefore = JSON.stringify(scene);
          // Independently retain the adapter's original measured values. The
          // renderer may interpolate for display but may not replace these knots.
          const accepted = new Map(segments.flatMap(segment => segment.points.map(point => [point.t, point.v])));
          for (const stroke of scene.strokes) for (const point of stroke.points)
            expect(accepted.get(point.t) === point.v, 'a source knot was invented or changed');
          window.depositedPaths = new Map();
          window.view = PulseLandscape.createView(document.querySelector('main'), scene);
        };
        window.checkCapture = label => {
          const stats = __pulseLandscapeStats;
          expect(JSON.stringify(scene) === sourceBefore, `${label}: presentation altered original source data`);
          const rows = [...document.querySelectorAll('.landscape-line')];
          expect(rows.length <= (stats.lineTurn.active ? 4 : 3), `${label}: live rows accumulated`);
          const uses = [...document.querySelectorAll('.landscape-line-fragment')];
          const referenced = new Set(uses.map(node => node.getAttribute('href').slice(1)));
          const records = [...document.querySelectorAll('.landscape-record')];
          expect(records.length === referenced.size && records.every(node => referenced.has(node.id)), `${label}: historical or future source definitions remain mounted`);
          expect(records.length < scene.strokes.length / 4, `${label}: live resources grew to a session-sized history`);
          for (const id of referenced) expect(document.getElementById(id), `${label}: visible ink has a missing source definition`);
          for (const node of document.querySelectorAll('.landscape-ink [clip-path],.landscape-ink [mask],.landscape-ink [fill],.landscape-ink [stroke]')) {
            for (const attribute of ['clip-path', 'mask', 'fill', 'stroke']) {
              const match = /^url\(#(.+)\)$/.exec(node.getAttribute(attribute) || '');
              if (match) expect(document.getElementById(match[1]), `${label}: visible paint has a missing ${attribute}`);
            }
          }
          for (const record of records) for (const node of record.querySelectorAll('path')) {
            const key = `${record.dataset.recordIndex}:${node.getAttribute('class')}`, geometry = node.getAttribute('d');
            expect(!depositedPaths.has(key) || depositedPaths.get(key) === geometry, `${label}: already deposited ink changed`);
            depositedPaths.set(key, geometry);
          }
          return { label, cursor: stats.streamTime, mountedSources: records.length, sourceStrokes: scene.strokes.length,
            connectedNodes: document.querySelectorAll('.landscape-ink *').length, rows: rows.length, width: document.querySelector('main').getBoundingClientRect().width };
        };
        window.advanceTo = target => {
          for (let frame = 0; frame < 10000 && __pulseLandscapeStats.streamTime < target; frame++) advancePaint();
          expect(__pulseLandscapeStats.streamTime >= target, `source cursor did not reach ${target}`);
          return checkCapture(`at-${target}s`);
        };
        window.compareArtwork = () => {
          expect(JSON.stringify(scene) === sourceBefore, 'Finish changed original measured points or scene metadata');
          expect(__pulseLandscapeStats.finished && __pulseLandscapeStats.mode === 'finished', 'Finish did not produce the final artwork');
          const direct = document.createElement('canvas'), repeat = document.createElement('canvas');
          direct.width = direct.height = repeat.width = repeat.height = view.canvas.width;
          PulseLandscape.render(scene, direct); PulseLandscape.render(scene, repeat);
          const pixels = canvas => canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
          const a = pixels(view.canvas), b = pixels(direct), c = pixels(repeat);
          let max = 0, sum = 0, repeatMax = 0;
          for (let i = 0; i < a.length; i++) { const delta = Math.abs(a[i] - b[i]); max = Math.max(max, delta); sum += delta; repeatMax = Math.max(repeatMax, Math.abs(b[i] - c[i])); }
          direct.width = direct.height = repeat.width = repeat.height = 1;
          return { max, mean: sum / a.length, repeatMax };
        };
        openCapture();
      }, segments);
      // Keep actual worker computation outside the stepped presentation loop.
      await page.waitForFunction(() => __pulseLandscapeStats.rasterBackend === 'worker' && __pulseLandscapeStats.warmStrokes === scene.strokes.length, null, { polling: 20, timeout: 60000 });
      result.checkpoints.push(await page.evaluate(() => advanceTo(20)));
      const pausedAt = await page.evaluate(() => { view.pause(true); return __pulseLandscapeStats.streamTime; });
      await page.setViewportSize({ width: 320, height: 844 });
      await page.waitForFunction(() => document.querySelector('.landscape-ink').getAttribute('viewBox')?.startsWith('0 0 320 '), null, { polling: 20 });
      result.checkpoints.push(await page.evaluate(() => { advancePaint(3000); return checkCapture('paused-and-resized'); }));
      assert.equal(result.checkpoints.at(-1).cursor, pausedAt, 'pause/resize must not consume accepted source');
      await page.evaluate(() => view.pause(false));
      result.checkpoints.push(await page.evaluate(() => advanceTo(90)));
      await page.setViewportSize({ width: 390, height: 844 });
      await page.waitForFunction(() => document.querySelector('.landscape-ink').getAttribute('viewBox')?.startsWith('0 0 390 '), null, { polling: 20 });
      result.checkpoints.push(await page.evaluate(() => advanceTo(140)));
      await page.evaluate(() => {
        for (let i = 0; i < 250 && !__pulseLandscapeStats.lineTurn.active; i++) advancePaint();
        if (!__pulseLandscapeStats.lineTurn.active) throw Error('Finish recovery must start during an actual row return');
        window.finishedScene = null; window.finishPromise = view.finish().then(value => { finishedScene = value; });
        for (let i = 0; i < 12; i++) advancePaint();
      });
      await page.setViewportSize({ width: 320, height: 844 });
      await page.waitForFunction(() => document.querySelector('.landscape-stage').style.width === '320px', null, { polling: 20 });
      // Interruption recovery must be independent of detached historical DOM.
      result.recoveredFinish = await page.evaluate(async () => { view.cancelFinish(); await finishPromise; if (finishedScene !== scene) throw Error('Finish substituted the source scene'); return compareArtwork(); });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      result.reducedMotion = await page.evaluate(async () => { openCapture(); const checkpoint = checkCapture('reduced-motion'); await view.finish(); return { checkpoint, parity: compareArtwork(), frames: __pulseLandscapeStats.frames }; });
      for (const parity of [result.recoveredFinish, result.reducedMotion.parity]) {
        assert.ok(parity.max <= (engine === 'webkit' ? 2 : 1) && parity.mean < .001, 'completed artwork must retain established canonical-render pixel parity');
        assert.equal(parity.repeatMax, 0, 'repeated exports must be identical');
      }
      assert.equal(result.reducedMotion.frames, 0, 'reduced motion does not animate the recording or reveal');
      const disposed = await page.evaluate(() => { view.dispose(); return { pending: pendingPaint(), surfaces: document.querySelectorAll('.landscape-ink,.landscape-stage,.landscape-emergence').length }; });
      assert.deepEqual(disposed, { pending: 0, surfaces: 0 }, 'disposal releases painting surfaces and animation callbacks');
      assert.deepEqual(result.errors, [], 'long-session lifecycle has no browser errors');
      result.passed = true;
    } catch (error) {
      result.failure = String(error.stack || error); process.exitCode = 1;
    } finally {
      await browser?.close();
      writeFileSync(path.join(output, `${engine}.json`), JSON.stringify(result, null, 2));
      console.log(JSON.stringify(result));
    }
  }
} finally { await new Promise(resolve => server.close(resolve)); }
