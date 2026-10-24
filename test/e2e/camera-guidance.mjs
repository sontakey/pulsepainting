// Browser-level permission recovery. Only camera acquisition and frame delivery
// are mocked; the monitor lifecycle, signal engine, app callbacks and guide are real.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, webkit, devices } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const output = path.resolve(root, process.env.PPG_CAMERA_ARTIFACTS || '.dream-loop/camera-guidance/checks');
const fixture = JSON.parse(readFileSync(path.join(root, 'test/fixtures/iphone-200s.json'), 'utf8'));
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png', '.woff2': 'font/woff2', '.json': 'application/json' };
mkdirSync(output, { recursive: true });
const server = createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  const file = path.resolve(root, '.' + pathname);
  if (!file.startsWith(root + path.sep) || !existsSync(file) || !statSync(file).isFile()) {
    response.writeHead(404); response.end(); return;
  }
  response.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  response.end(readFileSync(file));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const url = `http://127.0.0.1:${server.address().port}/dist/index.html`;
const report = { scope: 'Chromium/WebKit browser emulation; mocked camera boundary and already-public fixture; not physical-device or operating-system-settings validation', startedAt: new Date().toISOString(), browsers: [] };
let browser;

async function instrument(page) {
  await page.goto(url);
  await page.waitForFunction(() => window.PulseCameraHelp && window.PPG?.PPGMonitor);
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(fixture => {
    const state = window.__cameraChecks = { requests: 0, starts: 0, mode: 'ready', errorName: 'NotAllowedError', preflightCode: null, pending: [], tracks: [], instances: [], gestures: [], alerts: [], helpCalls: [] };
    window.alert = value => state.alerts.push(String(value));
    const open = PulseCameraHelp.open;
    PulseCameraHelp.open = options => { state.helpCalls.push({ reason: options.reason, hasRecording: !!options.hasRecording }); return open(options); };
    window.PPGMonitor = class extends PPG.PPGMonitor {
      constructor(host, options) {
        super(host, { ...options, signal: { ...fixture.meta?.engineConfig?.engine, ...options.signal }, wakeLock: false, motion: false, debug: { persistLastSession: false } });
        this.testIndex = state.instances.length;
        this.testSample = 0;
        this.testStops = 0;
        this.testDestroys = 0;
        state.instances.push(this);
      }
      start() { state.starts++; state.gestures.push(navigator.userActivation.isActive); return super.start(); }
      _preflight() { if (state.preflightCode) throw new PPG.PPGError(state.preflightCode); return super._preflight(); }
      async _openCamera() {
        state.requests++;
        const mode = state.mode;
        if (mode === 'pending') await new Promise((resolve, reject) => state.pending.push({ resolve, reject }));
        if (mode === 'reject') throw new DOMException('Controlled camera acquisition failure', state.errorName);
        const track = { stopped: false, readyState: 'live', stop() { this.stopped = true; this.readyState = 'ended'; }, getSettings: () => ({}) };
        state.tracks.push(track);
        if (!this.video) throw new Error('A pending camera request lost its video before stream adoption');
        return { track, stream: { getTracks: () => [track], getVideoTracks: () => [track] }, capabilities: {}, applied: {}, constraintErrors: {}, torchSupported: true, torchState: 'on' };
      }
      _installWatchers() {}
      _scheduleNextFrame() {}
      stop() { this.testStops++; super.stop(); }
      destroy() { this.testDestroys++; super.destroy(); }
      feedUntil(seconds) {
        const t0 = fixture.samples[0].t;
        for (; this.testSample < fixture.samples.length; this.testSample++) {
          const sample = fixture.samples[this.testSample], t = (sample.t - t0) / 1000;
          if (t > seconds) break;
          const result = this.engine.push({ ...sample, t });
          if (result.window) this._onWindow(result.window, sample.t, sample.rMean, sample.gMean, sample.bMean, sample.clippedFraction);
          this.options.onSignalUpdate({ time: t, value: result.waveform, isProcessing: result.state === 'MEASURING' });
        }
      }
    };
  }, fixture);
}

async function setup(browser, options = {}) {
  const context = await browser.newContext({ ...devices['iPhone 13'], viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, reducedMotion: 'reduce', ...options });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('dialog', async dialog => { errors.push(`Unexpected native dialog: ${dialog.message()}`); await dialog.dismiss(); });
  await instrument(page);
  return { page, context, errors };
}

async function settled(page) {
  await page.waitForFunction(() => pendingMonitorStarts.size === 0);
}

async function assertFits(page, label) {
  const box = await page.locator('.pulse-camera-help').evaluate(dialog => {
    const rect = dialog.getBoundingClientRect();
    return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: innerWidth, height: innerHeight, scrollWidth: document.documentElement.scrollWidth, dialogScrollWidth: dialog.scrollWidth, clientWidth: dialog.clientWidth };
  });
  assert.ok(box.left >= -1 && box.right <= box.width + 1 && box.top >= -1 && box.bottom <= box.height + 1, `${label}: help fits the visual viewport`);
  assert.ok(box.scrollWidth <= box.width && box.dialogScrollWidth <= box.clientWidth + 1, `${label}: no horizontal overflow`);
}

async function finishCase(context, errors) {
  assert.deepEqual(errors, [], 'no uncaught page errors or native alert dialogs');
  await context.close();
}

try {
  for (const [name, engine] of [['chromium', chromium], ['webkit', webkit]]) {
    if (process.env.PPG_CAMERA_BROWSER && process.env.PPG_CAMERA_BROWSER !== name) continue;
    browser = await engine.launch(name === 'chromium' && process.platform === 'darwin' ? { channel: 'chrome' } : {});
    const result = { browser: name, checks: [] };

    // Guidance is a deliberate, camera-free action. Its browser picker remains
    // usable when browser identification is ambiguous or the visitor switched apps.
    {
      const { page, context, errors } = await setup(browser);
      await page.locator('#btn-camera-help').click();
      await page.waitForFunction(() => PulseCameraHelp.isOpen());
      const guide = page.locator('.pulse-camera-help');
      assert.equal(await page.evaluate(() => __cameraChecks.requests), 0, 'manual help never requests camera');
      assert.equal(await page.locator('#camera-help-title').evaluate(el => el === document.activeElement), true, 'help title receives initial focus');
      const profiles = await page.locator('#camera-help-browser option').evaluateAll(options => options.map(option => ({ value: option.value, label: option.textContent })));
      assert.ok(profiles.length >= 5, 'browser guidance offers an explicit fallback and phone browser choices');
      for (const profile of profiles) {
        await page.locator('#camera-help-browser').selectOption(profile.value);
        assert.ok((await page.locator('.ch-browser-steps').innerText()).trim().length > 40, `${profile.label} has actionable steps`);
      }
      await page.locator('#camera-help-browser').selectOption('safari');
      await page.locator('.ch-phone summary').click();
      await page.locator('.ch-open-browser summary').click();
      await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: () => Promise.reject(new DOMException('Clipboard unavailable in this browser', 'NotAllowedError')) } }));
      await page.locator('.ch-copy').click();
      await page.waitForFunction(() => document.querySelector('.ch-copy-status')?.textContent.includes('selected link'));
      assert.equal(await page.locator('.ch-link').inputValue(), 'https://www.pulsepainting.com/');
      assert.equal(await page.locator('.ch-link').evaluate(input => input.selectionStart === 0 && input.selectionEnd === input.value.length), true, 'denied clipboard leaves the complete canonical link selected');
      for (const width of [320, 390]) {
        await page.setViewportSize({ width, height: 700 });
        await assertFits(page, `${name} ${width}px`);
        const browserControl = await page.locator('#camera-help-browser').boundingBox();
        assert.ok(browserControl && browserControl.height >= 44, `${name} ${width}px: browser picker has a rendered touch target at least 44px tall`);
      }
      await page.addStyleTag({ content: '.pulse-camera-help { font-size: 20px !important; } .pulse-camera-help p, .pulse-camera-help li, .pulse-camera-help button, .pulse-camera-help select { font-size: 1em !important; }' });
      await page.setViewportSize({ width: 320, height: 700 });
      await assertFits(page, `${name} enlarged help text`);
      await page.locator('.ch-close').focus();
      await page.keyboard.press('Shift+Tab');
      // Native modal dialogs may let a keyboard user reach browser chrome, in
      // which case activeElement is body. The underlying app must stay inert.
      assert.equal(await guide.evaluate(el => el.contains(document.activeElement) || document.activeElement === document.body), true, 'backward tab cannot reach the underlying app');
      await page.keyboard.press('Tab');
      assert.equal(await guide.evaluate(el => el.contains(document.activeElement) || document.activeElement === document.body), true, 'forward tab cannot reach the underlying app');
      await page.screenshot({ path: path.join(output, `${name}-manual-320.png`) });
      await page.keyboard.press('Escape');
      assert.equal(await page.evaluate(() => PulseCameraHelp.isOpen()), false, 'Escape dismisses optional guidance');
      assert.equal(await page.locator('#btn-camera-help').evaluate(el => el === document.activeElement), true, 'dismissal restores the initiating control');
      assert.equal(await page.evaluate(() => __cameraChecks.requests), 0);
      await finishCase(context, errors);
      result.checks.push('manual help, browser picker, focus, Escape, small screens and enlarged text');
    }

    // Exercise the real start() callback + rejection pair, and ensure it is one
    // recoverable UI event rather than two dialogs or an orphaned live monitor.
    for (const [errorName, reason] of [['NotAllowedError', 'permission_denied'], ['NotReadableError', 'camera_busy'], ['NotFoundError', 'no_camera'], ['OverconstrainedError', 'overconstrained'], ['AbortError', 'aborted'], ['Error', 'unknown']]) {
      const { page, context, errors } = await setup(browser);
      await page.evaluate(errorName => { __cameraChecks.mode = 'reject'; __cameraChecks.errorName = errorName; }, errorName);
      await page.getByRole('button', { name: 'Begin pulse capture', exact: true }).click();
      await page.waitForFunction(() => PulseCameraHelp.isOpen());
      await settled(page);
      const failure = await page.evaluate(() => ({ calls: __cameraChecks.helpCalls, alerts: __cameraChecks.alerts, timer: sessionTimerId, frame: lastMeasuringFrame, starts: __cameraChecks.starts, running: __cameraChecks.instances[0].running, stopped: __cameraChecks.instances[0].testStops > 0, screen: document.getElementById('app').dataset.activeScreen }));
      assert.deepEqual(failure.calls, [{ reason, hasRecording: false }], `${reason}: callback/rejection pair opens help once`);
      assert.deepEqual(failure.alerts, []);
      assert.equal(failure.timer, null); assert.equal(failure.frame, null);
      assert.equal(failure.running, false); assert.equal(failure.stopped, true); assert.equal(failure.screen, 'ready');
      assert.equal(await page.locator('.pulse-camera-help').getAttribute('data-reason'), reason);
      if (reason === 'permission_denied') {
        await page.screenshot({ path: path.join(output, `${name}-permission-denied.png`) });
        await page.evaluate(() => { __cameraChecks.mode = 'ready'; });
        await page.locator('.ch-retry').click();
        await page.waitForFunction(() => monitor?.running && !cameraPending);
        assert.equal(await page.evaluate(() => PulseCameraHelp.isOpen()), false, 'successful retry clears old instructions');
        assert.deepEqual(await page.evaluate(() => __cameraChecks.gestures), [true, true], 'both camera attempts start inside the click gesture');
        await page.evaluate(() => {
          const old = __cameraChecks.instances[0];
          old.options.onReady({ torchSupported: false });
          old.options.onError(new PPG.PPGError('camera_busy'));
          old.options.onQualityUpdate({ fingerState: 'MEASURING', quality: { good: false } });
          old.options.onSignalUpdate({ time: 500, value: 1, isProcessing: true });
        });
        assert.equal(await page.evaluate(() => PulseCameraHelp.isOpen()), false, 'old error cannot replace the successful retry');
        assert.equal(await page.evaluate(() => elapsedMeasuringMs), 0, 'stale callbacks cannot advance a new reading');
        await page.locator('#btn-cancel-placement').click();
        assert.equal(await page.evaluate(() => __cameraChecks.tracks.every(track => track.stopped)), true);
      }
      await finishCase(context, errors);
      result.checks.push(`${reason} startup recovery`);
    }

    // The real environment preflight can fail before any acquisition. The app
    // must still explain the failure without opening a camera or offering a loop.
    for (const reason of ['unsupported', 'insecure_context']) {
      const { page, context, errors } = await setup(browser);
      await page.evaluate(reason => { __cameraChecks.preflightCode = reason; }, reason);
      await page.getByRole('button', { name: 'Begin pulse capture', exact: true }).click();
      await page.waitForFunction(() => PulseCameraHelp.isOpen());
      await settled(page);
      assert.equal(await page.locator('.pulse-camera-help').getAttribute('data-reason'), reason);
      assert.equal(await page.evaluate(() => __cameraChecks.requests), 0, `${reason} never reaches acquisition`);
      assert.deepEqual(await page.evaluate(() => __cameraChecks.alerts), []);
      await finishCase(context, errors);
      result.checks.push(`${reason} preflight`);
    }

    // A quiet/ignored browser prompt is not a denial. Cancel must retain the
    // unresolved operation so that its eventual stream can be released safely.
    for (const lateResult of ['grant', 'reject']) {
      const { page, context, errors } = await setup(browser, { reducedMotion: 'no-preference' });
      await page.evaluate(() => { __cameraChecks.mode = 'pending'; });
      await page.getByRole('button', { name: 'Begin pulse capture', exact: true }).click();
      await page.waitForFunction(() => __cameraChecks.pending.length === 1);
      assert.equal(await page.locator('#camera-connection').isVisible(), true, 'pending state is visible before a grant');
      assert.equal(await page.evaluate(() => cameraPending), true);
      if (lateResult === 'grant') {
        const firstHint = await page.locator('#camera-pending-status').textContent();
        await page.waitForFunction(firstHint => document.getElementById('camera-pending-status').textContent !== firstHint, firstHint, { timeout: 13000 });
        assert.equal(await page.evaluate(() => __cameraChecks.requests), 1, 'a slow permission prompt is not automatically retried');
        assert.equal(await page.evaluate(() => elapsedMeasuringMs), 0, 'a slow permission prompt earns no recording time');
      }
      await page.locator('#btn-camera-pending-help').click();
      await page.waitForFunction(() => PulseCameraHelp.isOpen());
      assert.equal(await page.locator('.pulse-camera-help').getAttribute('data-reason'), 'waiting');
      assert.equal(await page.locator('.ch-retry').isVisible(), false, 'waiting help cannot issue another request');
      assert.equal(await page.evaluate(() => __cameraChecks.requests), 1);
      await page.locator('.ch-close').click();
      await page.locator('#btn-cancel-placement').click();
      // A browser can still deliver the old permission result after this click.
      await page.getByRole('button', { name: 'Begin pulse capture', exact: true }).click();
      await page.waitForFunction(() => PulseCameraHelp.isOpen());
      assert.equal(await page.evaluate(() => __cameraChecks.requests), 1, 'cancelled pending request blocks duplicate acquisition');
      await page.evaluate(lateResult => {
        const pending = __cameraChecks.pending.shift();
        if (lateResult === 'grant') pending.resolve();
        else pending.reject(new DOMException('Late camera refusal', 'NotAllowedError'));
      }, lateResult);
      await settled(page);
      assert.equal(await page.locator('#screen-ready').isVisible(), true, 'late outcome remains cancelled');
      assert.equal(await page.evaluate(() => PulseCameraHelp.isOpen()), false, 'settled cancelled request removes obsolete waiting help without starting capture');
      assert.equal(await page.evaluate(() => __cameraChecks.tracks.every(track => track.stopped)), true, 'late-granted tracks are stopped');
      assert.equal(await page.evaluate(() => sessionTimerId), null);
      await page.evaluate(() => { __cameraChecks.mode = 'ready'; });
      await page.getByRole('button', { name: 'Begin pulse capture', exact: true }).click();
      await page.waitForFunction(() => monitor?.running && !cameraPending);
      assert.equal(await page.evaluate(() => __cameraChecks.requests), 2, 'fresh acquisition works after prior prompt settles');
      await page.locator('#btn-cancel-placement').click();
      await finishCase(context, errors);
      result.checks.push(`pending prompt, cancel, duplicate guard, late ${lateResult}, fresh start`);
    }

    // A successful native response while the waiting guide is open should move
    // naturally into placement; settings/page visibility changes never retry it.
    {
      const { page, context, errors } = await setup(browser);
      await page.evaluate(() => { __cameraChecks.mode = 'pending'; });
      await page.getByRole('button', { name: 'Begin pulse capture', exact: true }).click();
      await page.locator('#btn-camera-pending-help').click();
      await page.evaluate(() => {
        Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
        document.dispatchEvent(new Event('visibilitychange'));
        delete document.hidden;
        document.dispatchEvent(new Event('visibilitychange'));
      });
      assert.equal(await page.evaluate(() => __cameraChecks.requests), 1, 'settings round trip does not request camera again');
      await page.evaluate(() => __cameraChecks.pending.shift().resolve());
      await page.waitForFunction(() => monitor?.running && !cameraPending && !PulseCameraHelp.isOpen());
      assert.equal(await page.locator('#screen-placement').isVisible(), true);
      assert.equal(await page.locator('#camera-connection').isVisible(), false);
      assert.equal(await page.evaluate(() => elapsedMeasuringMs), 0, 'permission waiting earns no recording time');
      await page.locator('#btn-cancel-placement').click();
      await finishCase(context, errors);
      result.checks.push('grant dismisses waiting help; visibility round trip creates no camera request');
    }

    // Retain a partial real engine session when automatic camera recovery fails.
    // Late callbacks are hostile input after the app invalidates this capture.
    {
      const { page, context, errors } = await setup(browser);
      await page.getByRole('button', { name: 'Begin pulse capture', exact: true }).click();
      await page.waitForFunction(() => monitor?.running);
      const before = await page.evaluate(() => {
        monitor.feedUntil(90);
        window.__failedCapture = monitor;
        const beats = monitor.getTachogram({ goodOnly: true, hrvOnly: true }).filter(beat => beat.valid);
        const analysis = PPG.hrv.analyzeHRV(beats);
        window.__acceptedSnapshot = () => JSON.stringify({ segments: manuscript.segments.map(({ reveal, ...source }) => source), strokes: landscape.strokes, seed: landscape.seed, family: landscape.family, elapsed: elapsedMeasuringMs });
        return { accepted: __acceptedSnapshot(), segments: manuscript.segments.length, beats: beats.length, hr: analysis.timeDomain.meanHR.toFixed(0), rmssd: analysis.timeDomain.rmssd.toFixed(1), sdnn: analysis.timeDomain.sdnn.toFixed(1) };
      });
      assert.ok(before.segments > 0 && before.beats > 0, 'partial session includes accepted real samples and measured beats');
      await page.evaluate(async () => { __cameraChecks.mode = 'reject'; __cameraChecks.errorName = 'NotAllowedError'; await monitor._resumeCamera('permission_test'); });
      await page.waitForFunction(() => PulseCameraHelp.isOpen() && !document.getElementById('screen-summary').hidden);
      assert.equal(await page.evaluate(() => __acceptedSnapshot()), before.accepted, 'failed recovery preserves all accepted waveform data and elapsed time');
      assert.equal(await page.evaluate(() => __failedCapture.running), false, 'failed recovery cannot keep rescheduling capture');
      assert.equal(await page.evaluate(() => sessionTimerId), null);
      assert.equal(await page.evaluate(() => lastMeasuringFrame), null);
      assert.equal(await page.locator('.ch-keep').isVisible(), true, 'partial recording has a clear keep action');
      const heroes = await page.locator('.report-heroes strong').allTextContents();
      assert.ok(heroes[0].includes(before.hr) && heroes[1].includes(before.rmssd) && heroes[2].includes(before.sdnn), 'report contains the pre-error measured metrics');
      await page.screenshot({ path: path.join(output, `${name}-keep-partial.png`) });
      await page.locator('.ch-keep').click();
      assert.equal(await page.evaluate(() => PulseCameraHelp.isOpen()), false);
      assert.equal(await page.locator('#screen-summary').isVisible(), true);
      await page.evaluate(() => {
        __failedCapture.options.onReady({ torchSupported: false });
        __failedCapture.options.onError(new PPG.PPGError('camera_busy'));
        __failedCapture.feedUntil(110);
      });
      assert.equal(await page.evaluate(() => __acceptedSnapshot()), before.accepted, 'late failed-camera data cannot alter the retained painting');
      assert.equal(await page.evaluate(() => PulseCameraHelp.isOpen()), false, 'late error cannot cover the kept painting');
      assert.equal(await page.evaluate(() => __cameraChecks.tracks.every(track => track.stopped)), true);
      await finishCase(context, errors);
      result.checks.push('failed automatic recovery preserves real accepted data/report; Keep and stale callback isolation');
    }

    report.browsers.push(result);
    await browser.close(); browser = null;
    console.log(`PASS camera guidance ${name}: ${result.checks.length} recovery and accessibility groups`);
  }
  report.passed = true;
} catch (error) {
  report.passed = false; report.failure = error.stack || String(error);
  throw error;
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
  report.completedAt = new Date().toISOString();
  writeFileSync(path.join(output, 'results.json'), JSON.stringify(report, null, 2) + '\n');
}
