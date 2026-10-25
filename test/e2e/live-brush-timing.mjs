// Real accepted public samples and real worker transport, with only animation
// delivery stepped. This checks source fidelity and work placement, not phone FPS.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, webkit } from 'playwright';
import { replayPublicFixture } from '../landscape-fixture.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const source = readFileSync(path.resolve(root, process.env.PPG_LIVE_BRUSH_SOURCE || 'app/landscape.js'), 'utf8');
const workerSource = readFileSync(path.join(root, 'app/landscape-raster-worker.js'), 'utf8');
const marker = 'function strokePaint(stroke){';
assert.equal(source.split(marker).length, 2, 'observe the terrain preparation entry without replacing the paint loop');
const observed = source.replace(marker, `${marker}\nif(typeof document!=='undefined')global.__liveTerrainPreparations=(global.__liveTerrainPreparations||0)+1;`);
const { segments } = replayPublicFixture(1, 0, 180);
assert.ok(segments.length > 20, 'the actual engine and acceptance adapter supply a full public session');
const engines = (process.env.PPG_LIVE_BRUSH_ENGINES || 'chromium,webkit').split(',');
assert.ok(engines.every(engine => ['chromium', 'webkit'].includes(engine)));
const output = path.resolve(root, process.env.PPG_LIVE_BRUSH_ARTIFACTS || '.dream-loop/live-brush-timing/verification');
mkdirSync(output, { recursive: true });
const files = new Map([
  ['/app/landscape.js', ['text/javascript', observed]],
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
      scope: 'Public recorded samples through the real acceptance adapter, actual raster workers and deterministic presentation delays. Not a physical-camera, phone-FPS or physiological-accuracy result.',
      families: [], errors: [],
    };
    try {
      browser = await (engine === 'webkit' ? webkit : chromium).launch(engine === 'chromium' && process.platform === 'darwin' ? { channel: 'chrome' } : {});
      result.browserVersion = browser.version();
      const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, reducedMotion: 'no-preference' });
      page.on('pageerror', error => result.errors.push(String(error)));
      await page.goto(origin);
      await page.evaluate(() => {
        const frames = new Map(); let nextId = 0, clock = 0;
        window.requestAnimationFrame = callback => { frames.set(++nextId, callback); return nextId; };
        window.cancelAnimationFrame = id => frames.delete(id);
        window.advancePaint = dt => {
          clock += dt;
          const current = [...frames.values()]; frames.clear();
          current.forEach(callback => callback(clock));
          return current.length;
        };
        window.pendingPaint = () => frames.size;
      });
      // An external source URL keeps currentScript.src and actual workers active.
      await page.addScriptTag({ url: `${origin}/app/landscape.js` });
      await page.evaluate(() => {
        const expect = (condition, message) => { if (!condition) throw Error(`${scene.family}: ${message}`); };
        window.openTimingScene = ({ family, segments }) => {
          window.view?.dispose();
          window.__liveTerrainPreparations = 0;
          window.scene = PulseLandscape.create({ family, seed: 39293 });
          segments.forEach(segment => PulseLandscape.append(scene, segment));
          window.acceptedBefore = JSON.stringify(scene);
          window.pathCache = new Map(); window.materialCache = new Map();
          window.observedChecks = { frontiers: 0, knots: 0, paths: 0, materials: 0, transitions: 0, previousStroke: null };
          window.view = PulseLandscape.createView(document.querySelector('main'), scene);
        };
        window.streamDuration = () => scene.strokes.reduce((sum, stroke, index) => sum + stroke.sourceEnd - stroke.sourceStart + (index ? Math.min(.45, Math.max(0, stroke.sourceStart - scene.strokes[index - 1].sourceEnd)) : 0), 0);
        window.inspectTiming = () => {
          const stats = __pulseLandscapeStats;
          expect(stats.rasterBackend === 'worker', 'live verification must keep the actual worker backend');
          expect(!__liveTerrainPreparations, 'live frontier prepared terrain/pigment on the main thread');
          expect(Number.isFinite(stats.streamTime) && stats.streamTime >= 0 && stats.streamTime <= streamDuration() + 1e-8, 'cursor left the accepted source extent');
          expect(Number.isFinite(stats.queuedSeconds) && Math.abs(stats.queuedSeconds - (streamDuration() - stats.streamTime)) < 1e-7, 'queued time disagrees with accepted source coverage');
          expect(Number.isFinite(stats.playbackRate) && stats.playbackRate >= 0 && stats.playbackRate <= 1, 'recording accelerates to catch up');
          expect(typeof stats.awaitingSource === 'boolean', 'source waiting state is inspectable');
          for (const node of document.querySelectorAll('.landscape-live-core,.landscape-source-wash,.landscape-source-join,.landscape-source-blooms,.landscape-source-body,.landscape-source-edge')) {
            const geometry = node.getAttribute('d');
            expect(!pathCache.has(node) || pathCache.get(node) === geometry, 'deposited pulse ink changed when delivery stalled');
            pathCache.set(node, geometry); observedChecks.paths++;
          }
          for (const node of document.querySelectorAll('.landscape-ink pattern,.landscape-ink mask')) {
            const geometry = ['x', 'y', 'width', 'height', 'patternTransform', 'patternUnits', 'maskUnits', 'maskContentUnits'].map(name => node.getAttribute(name)).join('|');
            expect(!materialCache.has(node) || materialCache.get(node) === geometry, 'deposited pigment texture shifted');
            materialCache.set(node, geometry); observedChecks.materials++;
          }
          if (stats.nib && stats.activeStroke !== null && !stats.bridging) {
            const stroke = scene.strokes[stats.activeStroke];
            // sampleStroke has no terrain/material preparation. Its prefix is
            // independently timestamp-clipped to the original bounded path.
            const expected = PulseLandscape.sampleStroke(stroke, stats.progress).at(-1);
            expect(expected && Math.abs(expected.t - stats.frontier.t) < 1e-8 && Math.abs(expected.v - stats.frontier.v) < 1e-8, 'brush does not follow the measured time/value frontier');
            expect(Number.isFinite(stats.nib.x) && Number.isFinite(stats.nib.y), 'source frontier produced an invalid brush position');
            if (observedChecks.previousStroke !== null && observedChecks.previousStroke !== stats.activeStroke) observedChecks.transitions++;
            observedChecks.previousStroke = stats.activeStroke; observedChecks.frontiers++;
          }
          return { cursor: stats.streamTime, queuedSeconds: stats.queuedSeconds, playbackRate: stats.playbackRate, awaitingSource: stats.awaitingSource, frontier: stats.frontier && { t: stats.frontier.t, v: stats.frontier.v } };
        };
        window.stepTiming = (dt, maxAdvance = dt / 1000) => {
          const before = inspectTiming(); advancePaint(dt); const after = inspectTiming();
          const advance = after.cursor - before.cursor;
          expect(advance >= -1e-9 && advance <= maxAdvance + 1e-7, `a ${dt} ms frame advanced source by ${advance.toFixed(6)} seconds`);
          return { dt, advance, ...after };
        };
        window.sequence16 = () => Array.from({ length: 3 }, () => stepTiming(16));
        window.verifyAcceptedKnots = segments => {
          const accepted = new Map(segments.flatMap(segment => segment.points.map(point => [point.t, point.v])));
          for (const stroke of scene.strokes) {
            const nodes = PulseLandscape.sampleStroke(stroke);
            for (const point of stroke.points) {
              expect(accepted.has(point.t) && accepted.get(point.t) === point.v, 'source point was invented or altered');
              const match = nodes.find(node => Math.abs(node.t - point.t) < 1e-9);
              expect(match && Math.abs(match.v - point.v) < 1e-9, 'source knot was smoothed away');
              observedChecks.knots++;
            }
          }
        };
      });
      const families = await page.evaluate(() => PulseLandscape.FAMILIES.map(family => family.id));
      for (const family of families) {
        await page.evaluate(data => openTimingScene(data), { family, segments: segments.slice(0, 3) });
        await page.waitForFunction(() => __pulseLandscapeStats.rasterBackend === 'worker' && __pulseLandscapeStats.warmStrokes === scene.strokes.length, null, { polling: 20, timeout: 30000 });
        const item = await page.evaluate(segments => {
          verifyAcceptedKnots(segments.slice(0, 3));
          if (streamDuration() <= 10) throw Error('Initial backlog must exercise the former catch-up threshold');
          stepTiming(1000 / 60); // Start the presentation clock before exact 16 ms checks.
          const steady = sequence16();
          const stall = stepTiming(2000, 1 / 30);
          const afterStall = sequence16();
          for (let i = 0; i < 3000 && __pulseLandscapeStats.streamTime < streamDuration() - 1e-8; i++) stepTiming(64, .064);
          const exhausted = inspectTiming();
          if (exhausted.queuedSeconds > 1e-8 || !exhausted.awaitingSource) throw Error('Exhausted source did not enter its waiting state');
          for (let i = 0; i < 120; i++) stepTiming(64, .064); // Settle any ambient/caption animation.
          const idle = inspectTiming();
          const deliveryDelay = stepTiming(15000, 0);
          if (JSON.stringify(idle.frontier) !== JSON.stringify(deliveryDelay.frontier)) throw Error('No-data time changed the last measured endpoint');
          if (JSON.stringify(scene) !== acceptedBefore) throw Error('Presentation modified accepted session data');
          const rejected = { ...structuredClone(segments[3]), quality: { good: false } };
          const count = scene.strokes.length;
          PulseLandscape.append(scene, rejected); view.sync();
          if (scene.strokes.length !== count) throw Error('A rejected window created live painting source');
          stepTiming(5000, 0);
          PulseLandscape.append(scene, segments[4]); view.sync();
          const appended = inspectTiming();
          if (appended.cursor !== idle.cursor || appended.queuedSeconds <= 0) throw Error('Late source moved the cursor before an animation frame');
          const restart = stepTiming(1000 / 60, 1000 / 60);
          // A deliberately rejected window remains a pen lift. Advance over
          // that bounded presentation gap before testing the new actual ink.
          for (let i = 0; i < 60 && __pulseLandscapeStats.activeStroke === null; i++) stepTiming(16);
          if (__pulseLandscapeStats.activeStroke === null) throw Error('Late accepted source never resumed measured ink');
          const afterLateDelivery = sequence16();
          verifyAcceptedKnots([...segments.slice(0, 3), segments[4]]);
          return { family: scene.family, steady, stall, afterStall, exhausted, deliveryDelay, restart, afterLateDelivery, checks: { ...observedChecks }, strokes: scene.strokes.length, terrainPreparations: __liveTerrainPreparations || 0 };
        }, segments);
        // Finish warming the newly accepted record before disposal, so a worker
        // error cannot be hidden by immediately terminating its last request.
        await page.waitForFunction(() => __pulseLandscapeStats.rasterBackend === 'worker' && __pulseLandscapeStats.warmStrokes === scene.strokes.length, null, { polling: 20, timeout: 30000 });
        const final = await page.evaluate(() => { const state = inspectTiming(); view.dispose(); return { state, pending: pendingPaint(), elements: document.querySelectorAll('.landscape-ink,.landscape-stage,.landscape-emergence').length }; });
        assert.equal(final.pending, 0, `${family}: disposal cancels animation`);
        assert.equal(final.elements, 0, `${family}: disposal removes painting surfaces`);
        assert.ok(item.checks.frontiers > 100 && item.checks.transitions >= 2 && item.checks.knots > 100, `${family}: checks cross real source windows and preserve measured knots`);
        result.families.push(item);
      }
      assert.equal(result.families.length, 16, 'all landscape families share the source-only live path');
      assert.deepEqual(result.errors, [], 'no browser errors during delayed source delivery');
      result.passed = true;
      console.log(`${engine}: all 16 scenes preserve source and fixed pigment, prepare no live terrain on the main thread, and resume without catch-up`);
    } catch (error) {
      result.failure = String(error?.stack || error);
      throw error;
    } finally {
      writeFileSync(path.join(output, `${engine}.json`), JSON.stringify(result, null, 2));
      await browser?.close();
    }
  }
} finally {
  await new Promise(resolve => server.close(resolve));
}
