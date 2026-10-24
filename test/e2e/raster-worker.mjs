// Real public samples and real worker transport, with only animation time
// stepped. This is correctness/lifecycle coverage, not a phone FPS benchmark.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, webkit } from 'playwright';
import { replayPublicFixture } from '../landscape-fixture.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const source = readFileSync(path.join(root, 'app/landscape.js'), 'utf8');
const workerSource = readFileSync(path.join(root, 'app/landscape-raster-worker.js'), 'utf8');
const { segments } = replayPublicFixture(1, 0, 180);
assert.ok(segments.length > 20, 'the public recording supplies a full accepted session');
const engines = (process.env.PPG_RASTER_WORKER_ENGINES || 'chromium,webkit').split(',');
assert.ok(engines.every(engine => ['chromium', 'webkit'].includes(engine)));
const output = path.resolve(root, process.env.PPG_RASTER_WORKER_ARTIFACTS || '.dream-loop/raster-worker/verification');
mkdirSync(output, { recursive: true });
const files = new Map([
  ['/app/landscape.js', ['text/javascript', source]],
  ['/app/landscape-raster-worker.js', ['text/javascript', workerSource]],
  ['/app/landscape.css', ['text/css', readFileSync(path.join(root, 'app/landscape.css'), 'utf8')]],
  ['/', ['text/html', '<!doctype html><meta name="viewport" content="width=device-width"><link rel="stylesheet" href="/app/landscape.css"><style>body{margin:0}main{width:390px;height:620px;overflow:hidden}</style><main></main>']],
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
    const result = {
      engine,
      rendererSha256: createHash('sha256').update(source).digest('hex'),
      workerSha256: createHash('sha256').update(workerSource).digest('hex'),
      scope: 'Public recording replay, real worker messages and stepped animation. Not physical mobile, camera or physiological validation.',
      families: [], fallbacks: [], errors: [],
    };
    try {
      browser = await (engine === 'webkit' ? webkit : chromium).launch(engine === 'chromium' && process.platform === 'darwin' ? { channel: 'chrome' } : {});
      result.browserVersion = browser.version();
      const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, reducedMotion: 'no-preference' });
      page.on('pageerror', error => result.errors.push(String(error)));
      await page.goto(origin);
      await page.evaluate(() => {
        const nativeWorker = window.Worker, nativeSetTimeout = window.setTimeout.bind(window), nativeClearTimeout = window.clearTimeout.bind(window);
        const frames = new Map(), watchdogs = new Map(); let frameId = 0, clock = 0, timerId = -1;
        window.workerTest = { mode: 'real', created: 0, terminated: 0, alive: 0, pending: 0, maxPending: 0, requests: 0, received: 0, bitmaps: 0, closed: 0, revealNodesChecked: 0, revealGeometryError: 0, urls: [] };
        const bitmapClose = ImageBitmap.prototype.close;
        ImageBitmap.prototype.close = function () { workerTest.closed++; return bitmapClose.call(this); };
        window.requestAnimationFrame = callback => { frames.set(++frameId, callback); return frameId; };
        window.cancelAnimationFrame = id => frames.delete(id);
        window.advancePaint = (count = 1) => {
          for (let i = 0; i < count; i++) {
            clock += 64; const current = [...frames.values()]; frames.clear();
            for (const callback of current) callback(clock);
          }
        };
        // Only a deliberately silent worker's watchdog is controlled. Normal
        // worker delivery, timers and main-thread fallbacks remain real.
        window.setTimeout = (callback, delay, ...args) => {
          if (workerTest.mode === 'silent' && delay === 10000) { const id = timerId--; watchdogs.set(id, () => callback(...args)); return id; }
          return nativeSetTimeout(callback, delay, ...args);
        };
        window.clearTimeout = id => { watchdogs.delete(id); nativeClearTimeout(id); };
        window.fireWorkerWatchdog = () => { const callbacks = [...watchdogs.values()]; watchdogs.clear(); callbacks.forEach(callback => callback()); return callbacks.length; };
        window.pendingPaint = () => ({ frames: frames.size, watchdogs: watchdogs.size });
        class ObservedWorker {
          constructor(url) {
            if (workerTest.mode === 'constructor-error') throw new Error('Worker unavailable');
            this.mode = workerTest.mode; this.busy = false; this.dead = false;
            workerTest.created++; workerTest.alive++; workerTest.urls.push(String(url));
            if (this.mode === 'real') {
              this.inner = new nativeWorker(url);
              this.inner.onmessage = event => this.deliver(event);
              this.inner.onerror = event => { this.clearBusy(); this.onerror?.(event); };
            }
          }
          clearBusy() { if (this.busy) { this.busy = false; workerTest.pending--; } }
          deliver(event) {
            this.clearBusy(); workerTest.received++;
            if (event.data.bitmap) workerTest.bitmaps++;
            if (event.data.type === 'painted') {
              const stroke = scene.strokes[event.data.count - 1], nodes = event.data.revealNodes;
              if (!Array.isArray(nodes) || nodes.length !== stroke.points.length) throw Error('Worker omitted measured reveal knots');
              nodes.forEach((node, i) => {
                const source = stroke.points[i];
                if (node.t !== source.t || node.v !== source.v) throw Error('Worker changed a measured reveal knot');
                const expected = PulseLandscape.strokeFrontier(stroke, (node.t - stroke.sourceStart) / (stroke.sourceEnd - stroke.sourceStart));
                const error = Math.hypot(node.x - expected.x, node.y - expected.y);
                if (!Number.isFinite(error) || error > 1e-7) throw Error('Worker changed canonical reveal geometry');
                workerTest.revealNodesChecked++; workerTest.revealGeometryError = Math.max(workerTest.revealGeometryError, error);
              });
            }
            this.onmessage?.(event);
          }
          postMessage(message, transfer) {
            if (this.dead) throw new Error('Post after termination');
            if (this.busy) throw new Error('More than one request in flight');
            this.busy = true; workerTest.pending++; workerTest.requests++;
            workerTest.maxPending = Math.max(workerTest.maxPending, workerTest.pending);
            if (this.mode === 'real') this.inner.postMessage(message, transfer || []);
            else if (this.mode === 'error') queueMicrotask(() => { if (!this.dead) this.deliver({ data: { type: 'error' } }); });
            // The silent mode deliberately never replies.
          }
          terminate() {
            if (this.dead) return;
            this.dead = true; this.inner?.terminate(); this.clearBusy();
            workerTest.terminated++; workerTest.alive--;
          }
        }
        window.setWorkerMode = mode => { workerTest.mode = mode; window.Worker = mode === 'unavailable' ? undefined : ObservedWorker; };
        setWorkerMode('real');
        window.inspectWorker = () => ({ ...workerTest, ...pendingPaint(), stats: { ...window.__pulseLandscapeStats } });
      });
      // A real external script URL is essential: content injection bypasses
      // currentScript.src and would silently exercise the main-thread path.
      await page.addScriptTag({ url: `${origin}/app/landscape.js` });
      await page.evaluate(() => {
        window.openScene = ({ family = 'quiet-lake', segments = [], mode = 'real', reducedMotion = false } = {}) => {
          window.view?.dispose(); delete document.hidden; setWorkerMode(mode);
          window.materialBeforeScene = window.__pulseLandscapeStats?.materialPixels || 0;
          window.scene = PulseLandscape.create({ seed: 39293, family });
          segments.forEach(segment => PulseLandscape.append(scene, segment));
          window.view = PulseLandscape.createView(document.querySelector('main'), scene, { reducedMotion });
          window.sourceBefore = JSON.stringify(scene); window.finishDone = false;
        };
        window.compareRaster = () => {
          const direct = document.createElement('canvas'); direct.width = direct.height = 800;
          PulseLandscape.render(scene, direct);
          const a = view.canvas.getContext('2d').getImageData(0, 0, 800, 800).data;
          const b = direct.getContext('2d').getImageData(0, 0, 800, 800).data;
          let max = 0, changed = 0, sum = 0;
          for (let i = 0; i < a.length; i++) { const difference = Math.abs(a[i] - b[i]); max = Math.max(max, difference); sum += difference; changed += difference > 0 ? 1 : 0; }
          direct.width = direct.height = 1;
          return { max, changed, mean: sum / a.length, sourceStable: JSON.stringify(scene) === sourceBefore, finished: __pulseLandscapeStats.finished, backend: __pulseLandscapeStats.rasterBackend, strokes: scene.strokes.length };
        };
        window.beginFinish = () => { window.finishPromise = view.finish().then(finishedScene => { if (finishedScene !== scene) throw Error('Finish substituted source'); window.finishDone = true; }); };
      });
      const waitWarm = () => page.waitForFunction(() => (__pulseLandscapeStats.warmStrokes || 0) === scene.strokes.length && workerTest.pending === 0, null, { timeout: 60000, polling: 50 });
      const finish = async () => {
        await page.evaluate(() => beginFinish());
        await page.waitForFunction(() => { advancePaint(12); return finishDone; }, null, { polling: 50, timeout: 60000 });
        return page.evaluate(() => compareRaster());
      };
      const assertExact = (comparison, label) => {
        assert.equal(comparison.finished, true, `${label}: finish resolves to final artwork`);
        assert.equal(comparison.sourceStable, true, `${label}: accepted samples/descriptors are unchanged`);
        assert.equal(comparison.max, 0, `${label}: final canvas matches canonical export exactly`);
        assert.equal(comparison.changed, 0, `${label}: no channel differs from canonical export`);
      };
      const resources = stats => ({
        cachedPixels: stats.cachedPixels, pixelBudget: stats.pixelBudget,
        materialPixels: stats.materialPixels, materialPixelBudget: stats.materialPixelBudget,
        workerMaterialPixels: stats.workerMaterialPixels || 0, liveTexturePixels: stats.liveTexturePixels,
      });
      const assertResourceBounds = (stats, label, workerAlive) => {
        for (const name of ['cachedPixels', 'pixelBudget', 'materialPixels', 'materialPixelBudget']) {
          assert.ok(Number.isFinite(stats[name]) && stats[name] >= 0, `${label}: ${name} is a finite allocation count`);
        }
        assert.ok(stats.cachedPixels <= stats.pixelBudget, `${label}: presentation stays inside its declared bound`);
        assert.ok(stats.pixelBudget <= 4662275, `${label}: presentation allocation cannot grow with scene duration`);
        assert.ok(stats.materialPixels <= stats.materialPixelBudget, `${label}: both pigment caches fit the declared material bound`);
        assert.ok(stats.materialPixelBudget <= (workerAlive ? 9109504 : 4554752), `${label}: material bound accounts for only live execution contexts`);
        if (!workerAlive) assert.equal(stats.workerMaterialPixels || 0, 0, `${label}: terminated worker retains no reported pigment allocation`);
      };
      // Cross-thread native rasterization is not byte-stable in these WebKit
      // underpaint scenes. Keep source identity exact and a tight, explicit
      // visual bound; all other scenes and same-thread recovery remain exact.
      // See docs/validation/mobile-drawing-performance-2026-10-24.md.
      const webkitUnderpaint = new Set(['coastal-cliffs', 'river-valley', 'glacial-fjord']);
      const assertWorkerArtwork = (comparison, family) => {
        if (engine !== 'webkit' || !webkitUnderpaint.has(family)) return assertExact(comparison, family);
        assert.equal(comparison.finished, true);
        assert.equal(comparison.sourceStable, true, `${family}: accepted source stays exact`);
        assert.ok(comparison.max <= 8, `${family}: cross-thread channel difference stays within 8/255`);
        assert.ok(comparison.mean <= .1, `${family}: cross-thread mean difference stays within .1/255`);
      };
      const families = await page.evaluate(() => PulseLandscape.FAMILIES.map(family => family.id));
      for (const [familyIndex, family] of families.entries()) {
        const input = segments;
        await page.evaluate(args => openScene(args), { family, segments: input });
        await waitWarm();
        const warm = await page.evaluate(() => inspectWorker());
        assert.equal(warm.stats.rasterBackend, 'worker', `${family}: exercise actual worker path`);
        assert.ok(warm.stats.workerRequests > 0);
        assert.equal(warm.maxPending, 1, 'one raster request may be in flight');
        assertResourceBounds(warm.stats, `${family} capture`, true);
        if (familyIndex === 1) {
          // compareRaster exported the first scene into the main-document
          // atlas. A second recording must budget it alongside worker pigment.
          const mainMaterialPixels = warm.stats.materialPixels - warm.stats.workerMaterialPixels;
          assert.ok(mainMaterialPixels > 131072, 'second recording retains actual main-thread pigment tiles from the previous export');
          assert.ok(warm.stats.workerMaterialPixels > 131072, 'second recording also contains actual worker pigment tiles');
          result.secondRecordingResources = { family, mainMaterialPixels, ...resources(warm.stats) };
        }
        const comparison = await finish();
        const settled = await page.evaluate(() => inspectWorker());
        assertResourceBounds(settled.stats, `${family} final artwork`, false);
        assert.ok(settled.stats.cachedPixels <= 1166339, `${family}: completed worker presentation releases canonical worker canvases`);
        result.families.push({ family, segments: input.length, warmStrokes: warm.stats.warmStrokes, captureResources: resources(warm.stats), settledResources: resources(settled.stats), comparison });
        assertWorkerArtwork(comparison, family);
        assert.equal(await page.evaluate(() => workerTest.alive), 0, 'finishing releases the worker');
      }
      assert.equal(result.families.length, 16);

      // Pause and visibility permit an already sent stroke to return, but must
      // not start another request or move the foreground until resumed.
      await page.evaluate(input => { openScene({ segments: input.slice(0, 2) }); view.pause(true); window.holdFrames = __pulseLandscapeStats.frames; }, segments);
      await page.waitForFunction(() => workerTest.pending === 0, null, { timeout: 30000, polling: 50 });
      const paused = await page.evaluate(() => { const requests = workerTest.requests; advancePaint(200); return { requests, after: workerTest.requests, frames: __pulseLandscapeStats.frames, held: holdFrames }; });
      assert.equal(paused.requests, paused.after); assert.equal(paused.frames, paused.held);
      await page.evaluate(input => { input.slice(2, 4).forEach(segment => PulseLandscape.append(scene, segment)); view.sync(); view.pause(false); }, segments);
      await waitWarm();
      await page.evaluate(input => {
        Object.defineProperty(document, 'hidden', { value: true, configurable: true }); document.dispatchEvent(new Event('visibilitychange'));
        input.slice(4, 6).forEach(segment => PulseLandscape.append(scene, segment)); view.sync();
        window.holdFrames = __pulseLandscapeStats.frames;
      }, segments);
      const hidden = await page.evaluate(() => { const requests = workerTest.requests; advancePaint(200); return { requests, after: workerTest.requests, frames: __pulseLandscapeStats.frames, held: holdFrames }; });
      assert.equal(hidden.requests, hidden.after); assert.equal(hidden.frames, hidden.held);
      await page.evaluate(() => { delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); window.sourceBefore = JSON.stringify(scene); });
      await waitWarm();
      const resumed = await finish(); assertExact(resumed, 'pause/hidden recovery');

      await page.evaluate(input => { openScene({ segments: input }); beginFinish(); view.cancelFinish(); }, segments.slice(0, 6));
      await page.waitForFunction(() => finishDone, null, { polling: 50 });
      const canceled = await page.evaluate(() => compareRaster()); assertExact(canceled, 'cancel reveal with worker pending');
      assert.equal(await page.evaluate(() => workerTest.alive), 0);
      await page.evaluate(input => {
        openScene({ segments: input }); beginFinish();
        Object.defineProperty(document, 'hidden', { value: true, configurable: true }); document.dispatchEvent(new Event('visibilitychange'));
      }, segments.slice(0, 6));
      await page.waitForFunction(() => finishDone, null, { polling: 50 });
      const hiddenReveal = await page.evaluate(() => compareRaster()); assertExact(hiddenReveal, 'hidden reveal with worker pending');
      assert.equal(await page.evaluate(() => workerTest.alive), 0);
      await page.evaluate(input => { openScene({ segments: input, reducedMotion: true }); beginFinish(); }, segments.slice(0, 6));
      await page.waitForFunction(() => finishDone, null, { polling: 50 });
      const reduced = await page.evaluate(() => compareRaster()); assertExact(reduced, 'reduced-motion finish');
      assert.equal(await page.evaluate(() => workerTest.alive), 0);
      await page.evaluate(input => {
        openScene({ segments: input });
        window.disposedCanvases = [view.canvas, ...document.querySelectorAll('.landscape-emergence canvas')];
        beginFinish(); view.dispose(); window.disposedFrames = __pulseLandscapeStats.frames;
      }, segments.slice(0, 6));
      await page.waitForFunction(() => finishDone, null, { polling: 50 });
      const disposed = await page.evaluate(() => {
        advancePaint(200);
        return { ...inspectWorker(), elements: document.querySelectorAll('.landscape-emergence,.landscape-discovery,.landscape-stage,.landscape-ink').length, stableFrames: __pulseLandscapeStats.frames === disposedFrames,
          materialBeforeScene, canvasSizes: disposedCanvases.map(canvas => ({ width: canvas.width, height: canvas.height })) };
      });
      assert.equal(disposed.alive, 0); assert.equal(disposed.pending, 0); assert.equal(disposed.frames, 0); assert.equal(disposed.watchdogs, 0); assert.equal(disposed.elements, 0); assert.equal(disposed.stableFrames, true);
      assertResourceBounds(disposed.stats, 'disposed worker view', false);
      assert.equal(disposed.stats.cachedPixels, 7, 'dispose leaves only seven one-pixel canvas placeholders');
      assert.equal(disposed.stats.liveTexturePixels, 0, 'dispose releases the live SVG texture reference');
      assert.equal(disposed.stats.materialPixels, disposed.materialBeforeScene, 'disposing an unfinished second recording releases its worker atlas without growing the retained document atlas');
      assert.ok(disposed.canvasSizes.every(size => size.width === 1 && size.height === 1), 'detached presentation canvases release their actual backing dimensions');
      result.lifecycle = { paused, hidden, resumed, canceled, hiddenReveal, reduced, disposed: { alive: disposed.alive, pending: disposed.pending, frames: disposed.frames, watchdogs: disposed.watchdogs, elements: disposed.elements, stableFrames: disposed.stableFrames, resources: resources(disposed.stats), materialBeforeScene: disposed.materialBeforeScene, canvasSizes: disposed.canvasSizes } };

      for (const mode of ['unavailable', 'constructor-error', 'error', 'silent']) {
        await page.evaluate(args => openScene(args), { mode, segments: segments.slice(0, 6) });
        if (mode === 'silent') {
          const watchdog = await page.evaluate(() => ({ pending: workerTest.pending, fired: fireWorkerWatchdog() }));
          assert.equal(watchdog.pending, 1); assert.equal(watchdog.fired, 1, 'a silent worker has a bounded watchdog');
        }
        await waitWarm();
        assertResourceBounds((await page.evaluate(() => inspectWorker())).stats, `${mode} fallback capture`, false);
        const comparison = await finish(); assertExact(comparison, mode);
        assert.equal(comparison.backend, mode === 'unavailable' ? 'main-thread' : 'main-thread-fallback');
        result.fallbacks.push({ mode, comparison });
        await page.evaluate(() => view.dispose());
        assert.equal(await page.evaluate(() => workerTest.alive), 0);
        assertResourceBounds((await page.evaluate(() => inspectWorker())).stats, `${mode} fallback disposal`, false);
      }
      result.transport = await page.evaluate(() => inspectWorker());
      assert.equal(result.transport.maxPending, 1);
      assert.ok(result.transport.revealNodesChecked > 10000, 'full recordings reuse verified worker reveal geometry');
      assert.ok(result.transport.revealGeometryError < 1e-7);
      assert.equal(result.transport.alive, 0); assert.equal(result.transport.pending, 0);
      assert.equal(result.transport.bitmaps, result.transport.closed, 'each received bitmap is closed after use');
      assert.ok(result.transport.urls.every(url => url === `${origin}/app/landscape-raster-worker.js`));
      assert.deepEqual(result.errors, []);
      result.passed = true;
    } catch (error) {
      result.failure = String(error.stack || error); process.exitCode = 1;
    } finally {
      await browser?.close();
      writeFileSync(path.join(output, `${engine}.json`), JSON.stringify(result, null, 2));
      console.log(JSON.stringify({ engine, passed: !!result.passed, families: result.families.length, fallbacks: result.fallbacks.length, failure: result.failure, output }));
    }
  }
} finally {
  await new Promise(resolve => server.close(resolve));
}
