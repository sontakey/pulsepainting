// Browser integration of optional local diagnostics. Camera I/O and frame
// scheduling are mocked; monitor lifecycle, engine, log export, persistence and
// painting renderer are real. Only the already-public replay fixture is used.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { cp, mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, devices, webkit } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const runtime = await mkdtemp(path.join(tmpdir(), 'pulse-performance-smoke-'));
// Isolate this source smoke from other tests rebuilding dist. Existing compiled
// optional sketchbook assets are copied first; current static app files win.
await cp(path.join(root, 'dist'), runtime, { recursive: true });
await cp(path.join(root, 'app'), runtime, { recursive: true });
await cp(path.join(root, 'vendor/ppg-js/0.3.1'), path.join(runtime, 'vendor'), { recursive: true });
const fixture = JSON.parse(await readFile(path.join(root, 'test/fixtures/iphone-200s.json'), 'utf8'));
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png', '.woff2': 'font/woff2', '.json': 'application/json' };
const server = createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const file = path.resolve(runtime, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!file.startsWith(runtime + path.sep) || !(await stat(file)).isFile()) throw new Error('Not found');
    res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(await readFile(file));
  } catch { res.writeHead(404); res.end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const url = `http://127.0.0.1:${server.address().port}/`;
const results = [];
let browser;

async function setup(engine, missingHelper) {
  const context = await engine.newContext({ ...devices['iPhone 13'], deviceScaleFactor: 1, reducedMotion: 'no-preference' });
  const page = await context.newPage();
  const errors = [];
  let blockedHelpers = 0;
  page.on('pageerror', error => errors.push(error.message));
  if (missingHelper) await page.route('**/capture-performance.js', route => { blockedHelpers++; return route.abort('failed'); });
  await page.goto(url);
  await page.evaluate(() => document.fonts.ready);
  if (!missingHelper) await page.waitForFunction(() => capturePerformanceModule !== null);
  await page.evaluate(fixture => {
    window.__performanceCheck = { exportCalls: 0, stopCalls: 0, stoppedTracks: 0 };
    window.PPGMonitor = class extends PPG.PPGMonitor {
      constructor(host, options) {
        super(host, { ...options, signal: { ...fixture.meta?.engineConfig?.engine, ...options.signal }, wakeLock: false, motion: false });
        this.replayIndex = 0;
      }
      async _openCamera() {
        const track = {
          readyState: 'live', getSettings: () => ({}),
          stop() { this.readyState = 'ended'; window.__performanceCheck.stoppedTracks++; },
        };
        return { track, stream: { getTracks: () => [track], getVideoTracks: () => [track] }, capabilities: {}, applied: {}, constraintErrors: {}, torchSupported: true, torchState: 'on' };
      }
      _scheduleNextFrame() {}
      stop() { window.__performanceCheck.stopCalls++; return super.stop(); }
      feedOne() {
        if (!this.running || this.replayIndex >= fixture.samples.length) return;
        const sample = fixture.samples[this.replayIndex++];
        const time = (sample.t - fixture.samples[0].t) / 1000;
        const result = this.engine.push({ ...sample, t: time });
        this.recorder.pushSample(sample);
        if (result.window) this._onWindow(result.window, sample.t, sample.rMean, sample.gMean, sample.bMean, sample.clippedFraction);
        this.options.onSignalUpdate({ time, value: result.waveform, isProcessing: result.state === 'MEASURING' });
      }
      feedUntil(seconds) {
        while (this.replayIndex < fixture.samples.length && (fixture.samples[this.replayIndex].t - fixture.samples[0].t) / 1000 <= seconds) this.feedOne();
      }
    };
    localStorage.removeItem('ppg_last_session_log');
  }, fixture);
  await page.locator('#btn-start').click();
  await page.waitForFunction(() => monitor?.running && pendingMonitorStarts.size === 0);
  await page.evaluate(() => monitor.feedUntil(40));
  await page.waitForFunction(() => !document.getElementById('screen-measuring').hidden && manuscript.segments.length > 0 && __pulseLandscapeStats.frames > 2);
  return { context, page, errors, blockedHelpers: () => blockedHelpers };
}

function count(snapshot, field) { return snapshot.bins.reduce((sum, bin) => sum + (field.includes('.') ? bin[field.split('.')[0]][field.split('.')[1]] : bin[field]), 0); }

try {
  for (const [name, engine] of [['chromium', chromium], ['webkit', webkit]]) {
    if (process.env.PPG_DIAGNOSTICS_BROWSER && process.env.PPG_DIAGNOSTICS_BROWSER !== name) continue;
    browser = await engine.launch(name === 'chromium' && process.platform === 'darwin' ? { channel: 'chrome' } : {});
    {
      const { context, page, errors } = await setup(browser, false);
      const original = await page.evaluate(() => {
        const vendor = PPG.PPGMonitor.prototype.getDebugLog.call(monitor);
        const enriched = monitor.getDebugLog();
        const { pulsePaintingPerformance, ...preserved } = enriched;
        return { preserved: JSON.stringify(preserved) === JSON.stringify(vendor), vendorHasPerformance: 'pulsePaintingPerformance' in vendor, summary: pulsePaintingPerformance, vendorSamples: vendor.samples.length, rendererVersion: __pulseLandscapeStats.rendererVersion, modelVersion: PulseLandscape.VERSION };
      });
      assert.equal(original.preserved, true, `${name}: all actual vendor log fields are preserved`);
      assert.equal(original.vendorHasPerformance, false, `${name}: vendor recorder remains unmodified`);
      assert.ok(original.vendorSamples > 100, `${name}: real recorder has public replay samples`);
      assert.ok(count(original.summary, 'cameraCallbacks') > 100 && count(original.summary, 'renderFrames') > 0, `${name}: actual app callbacks populate both cadence streams`);
      assert.match(original.summary.rendererVersion, /^live-paper-/);
      assert.equal(original.summary.rendererVersion, original.rendererVersion);
      assert.equal(original.summary.modelVersion, original.modelVersion);
      assert.equal(original.summary.stopped, false);

      const hidden = await page.evaluate(() => {
        window.__restorePerformanceVisibility = ['hidden', 'visibilityState'].map(key => [key, Object.getOwnPropertyDescriptor(document, key)]);
        Object.defineProperty(document, 'hidden', { configurable: true, value: true });
        Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
        document.dispatchEvent(new Event('visibilitychange'));
        const before = monitor.getDebugLog().pulsePaintingPerformance;
        monitor.feedUntil(41);
        return { before, after: monitor.getDebugLog().pulsePaintingPerformance };
      });
      assert.equal(count(hidden.before, 'cameraCallbacks'), count(hidden.after, 'cameraCallbacks'), `${name}: hidden callbacks are excluded`);
      assert.equal(hidden.after.visibilityResets, 1);
      await page.waitForTimeout(150);
      const restored = await page.evaluate(() => {
        const before = monitor.getDebugLog().pulsePaintingPerformance;
        for (const [key, descriptor] of __restorePerformanceVisibility) {
          if (descriptor) Object.defineProperty(document, key, descriptor); else delete document[key];
        }
        document.dispatchEvent(new Event('visibilitychange'));
        monitor.feedOne();
        const first = monitor.getDebugLog().pulsePaintingPerformance;
        monitor.feedOne();
        return { before, first, second: monitor.getDebugLog().pulsePaintingPerformance };
      });
      assert.equal(count(restored.before, 'renderFrames'), count(hidden.before, 'renderFrames'), `${name}: hidden renderer does not collect frames`);
      assert.equal(restored.first.visibilityResets, 2);
      assert.equal(count(restored.first, 'cameraCallbacks'), count(restored.before, 'cameraCallbacks') + 1);
      assert.equal(count(restored.first, 'processedCameraSource.count'), count(restored.before, 'processedCameraSource.count'), `${name}: first resumed camera frame resets its source interval`);
      assert.equal(count(restored.first, 'cameraDelivery.count'), count(restored.before, 'cameraDelivery.count'), `${name}: first resumed camera frame resets its delivery interval`);
      assert.equal(count(restored.second, 'processedCameraSource.count'), count(restored.first, 'processedCameraSource.count') + 1);
      await page.waitForFunction(() => __pulseLandscapeStats.active && !document.hidden);
      await page.evaluate(() => {
        const originalExport = monitor.getDebugLog;
        monitor.getDebugLog = function (...args) { __performanceCheck.exportCalls++; return originalExport.apply(this, args); };
        __performanceCheck.preFinishFrames = __pulseLandscapeStats.frames;
      });
      await page.locator('#btn-stop').click();
      const stopped = await page.evaluate(() => {
        const exportCalls = __performanceCheck.exportCalls;
        const summary = monitor.getDebugLog().pulsePaintingPerformance;
        return { exportCalls, summary, persisted: getLastSessionLog(), active: capturePerformanceSession !== null, running: monitor.running, stoppedTracks: __performanceCheck.stoppedTracks };
      });
      assert.ok(stopped.exportCalls > 0, `${name}: actual vendor stop persistence called the app's getDebugLog wrapper`);
      assert.equal(stopped.summary.stopped, true);
      assert.equal(stopped.active, false);
      assert.equal(stopped.running, false);
      assert.ok(stopped.stoppedTracks > 0);
      assert.deepEqual(stopped.persisted.pulsePaintingPerformance, stopped.summary, `${name}: existing last-session storage contains finalized aggregates`);
      assert.ok(stopped.persisted.samples.length > 100 && stopped.persisted.events.length > 0 && stopped.persisted.windows.length > 0, `${name}: existing private-debug shape remains complete`);
      await page.waitForFunction(() => !document.getElementById('screen-summary').hidden, null, { timeout: 30_000 });
      const finished = await page.evaluate(() => ({ summary: monitor.getDebugLog().pulsePaintingPerformance, revealFrames: __pulseLandscapeStats.frames - __performanceCheck.preFinishFrames }));
      assert.deepEqual(finished.summary, stopped.summary, `${name}: reveal and report do not add capture diagnostics`);
      assert.ok(finished.revealFrames > 0, `${name}: real reveal frames ran after collection stopped`);
      assert.deepEqual(errors, [], `${name}: no page errors`);
      results.push({ browser: name, case: 'actual monitor, hidden recovery, stop persistence and reveal boundary', passed: true });
      await context.close();
    }
    {
      const { context, page, errors, blockedHelpers } = await setup(browser, true);
      const running = await page.evaluate(() => ({ running: monitor.running, helper: capturePerformanceModule, accepted: manuscript.segments.length, hasDiagnostics: 'pulsePaintingPerformance' in monitor.getDebugLog() }));
      assert.equal(blockedHelpers(), 1, `${name}: actual optional module request was blocked`);
      assert.equal(running.helper, null);
      assert.equal(running.running, true);
      assert.ok(running.accepted > 0);
      assert.equal(running.hasDiagnostics, false);
      await page.locator('#btn-cancel-reading').click();
      const canceled = await page.evaluate(() => ({ ready: !document.getElementById('screen-ready').hidden, monitor: monitor === null, log: getLastSessionLog(), stoppedTracks: __performanceCheck.stoppedTracks }));
      assert.ok(canceled.ready && canceled.monitor && canceled.stoppedTracks > 0, `${name}: unavailable helper leaves normal camera cancellation intact`);
      assert.ok(canceled.log.samples.length > 100 && !('pulsePaintingPerformance' in canceled.log), `${name}: unchanged vendor log persists when optional import fails`);
      assert.deepEqual(errors, [], `${name}: missing optional module causes no unhandled page error`);
      results.push({ browser: name, case: 'missing diagnostics module does not affect capture or cancellation', passed: true });
      await context.close();
    }
    await browser.close(); browser = null;
  }
  console.log(JSON.stringify({ scope: 'Browser integration with current app source and pinned vendor; public fixture; no physical-camera or FPS claim', results }, null, 2));
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
  await rm(runtime, { recursive: true, force: true });
}
