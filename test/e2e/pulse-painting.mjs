// App-level regression checks: camera I/O is mocked, the streaming engine and
// application callbacks are real. No physiological-accuracy claim is implied.
// npm run build && npm run test:app
// Optional local recording: PPG_SESSION_LOG=/absolute/path.json npm run test:app
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
const fingerprint = value => createHash('sha256').update(value).digest('hex');
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, webkit, devices } from 'playwright';
import { instrumentReportGraphText, checkReportGraphs } from './report-graph-checks.mjs';
import { checkCaptureEntry } from './capture-entry-checks.mjs';
import { checkArtwork, openReportMenu, checkEmptyArtworkActions } from './artwork-checks.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const log = JSON.parse(readFileSync(process.env.PPG_SESSION_LOG || path.join(root, 'test/fixtures/iphone-200s.json'), 'utf8'));
const mime = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.woff2': 'font/woff2' };
const server = createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const file = path.resolve(root, '.' + pathname);
  if (!file.startsWith(root + '/') || !existsSync(file) || !statSync(file).isFile()) {
    res.writeHead(404); res.end(); return;
  }
  res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' });
  res.end(readFileSync(file));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const url = process.env.PPG_APP_URL || `http://127.0.0.1:${server.address().port}/dist/index.html`;
async function assertViewportFits(page, label) {
  const requestedWidth = page.viewportSize().width;
  const actual = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth }));
  assert.equal(actual.width, requestedWidth, `${label}: mobile viewport has not auto-zoomed to hide overflow`);
  assert.ok(actual.scrollWidth <= requestedWidth, `${label}: content fits the requested width`);
}
let browser;
try {
  browser = process.env.PPG_BROWSER === 'webkit' ? await webkit.launch() : await chromium.launch(process.env.PPG_CHROMIUM ? { executablePath: process.env.PPG_CHROMIUM } : process.platform === 'darwin' ? { channel: 'chrome' } : {});
  const context = await browser.newContext({ ...devices['iPhone 13'], reducedMotion: 'reduce' });
  const page = await context.newPage();
  await instrumentReportGraphText(page);
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  await page.goto(url);
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(log => {
    window.PPGMonitor = class extends PPG.PPGMonitor {
      constructor(_host, options) {
        super(_host, options);
        this.engine = new PPG.PpgEngine({ ...log.meta?.engineConfig?.engine, ...options.signal });
        this.video = document.createElement('video');
        this.torchSupported = true;
        this.torchState = 'on';
        this.currentMetrics = { fingerState: 'NO_FINGER' };
        this.i = 0;
        this.metricUpdates = [];
        this.stopCalls = 0;
        this.destroyCalls = 0;
        const update = this.options.onQualityUpdate;
        this.options.onQualityUpdate = metrics => {
          update(metrics);
          if (metrics.fingerState === 'MEASURING') this.metricUpdates.push({
            t: metrics.t, good: metrics.quality.good, segments: manuscript.segments.length,
            score: metrics.qualityScore, meter: Number(document.getElementById('signal-meter').getAttribute('aria-valuenow')),
            signalText: document.getElementById('quality-text').textContent,
            values: ['hr-value', 'rmssd-value', 'sdnn-value'].map(id => document.getElementById(id).textContent),
            expected: [metrics.heartRate, metrics.rmssd, metrics.sdnn].map(value => metrics.quality.good && Number.isFinite(value) ? String(Math.round(value)) : '--'),
          });
        };
      }
      async start() { this.options.onReady({ torchSupported: true }); }
      stop() { this.stopCalls++; }
      destroy() { this.destroyCalls++; }
      getMetrics() { return this.currentMetrics; }
      getSessionSummary() { return this.engine.getSessionSummary(); }
      getTachogram(options = {}) { return this.engine.getTachogram(options); }
      getDebugLog() { return log; }
      downloadDebugLog() {}
      feedUntil(seconds) {
        const t0 = log.samples[0].t;
        for (; this.i < log.samples.length; this.i++) {
          const sample = log.samples[this.i];
          const t = (sample.t - t0) / 1000;
          if (t > seconds) break;
          const result = this.engine.push({ ...sample, t });
          if (result.stateChanged) {
            this.currentMetrics.fingerState = result.state;
            this.options.onState?.({ state: result.state, reason: result.stateReason, time: t });
          }
          if (result.window) {
            // Use the real monitor callback adapter: public metrics deliberately
            // omit internal windowStartSec/filtered fields that paint reads
            // from the matching engine window.
            this._onWindow(result.window, sample.t, sample.rMean, sample.gMean, sample.bMean, sample.clippedFraction);
          }
          this.options.onSignalUpdate({ time: t, value: result.waveform, isProcessing: result.state === 'MEASURING' });
        }
      }
    };
  }, log);
  assert.doesNotMatch(await page.locator('body').innerText(), /experiment|watercolor/i, 'capture copy leaves the visual treatment unstated');
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await assertViewportFits(page, `ready ${width}px`);
  }
  await page.getByRole('button', { name: 'Begin pulse capture', exact: true }).click();
  await page.evaluate(() => monitor.feedUntil(70));
  assert.equal(await page.evaluate(() => 'windowStartSec' in monitor.getMetrics()), false, 'replay uses the real public callback payload');
  assert.ok(await page.evaluate(() => manuscript.segments.length > 0), 'accepted real signal paints');
  const cadence = await page.evaluate(() => ({ updates: monitor.metricUpdates, hop: monitor.engine.opts.hopSec, window: monitor.engine.opts.windowSec }));
  assert.ok(cadence.updates.every(update => update.meter === (update.good ? Math.round(Math.max(0, Math.min(100, update.score))) : 0)), 'signal meter follows the real gate-aware quality score');
  assert.ok(cadence.updates.filter(update => update.good).every(update => update.signalText === ''), 'healthy capture shows bars without signal copy');
  assert.equal(cadence.hop, 1, 'capture requests genuine computed updates once a second');
  assert.equal(cadence.window, 5, 'signal analysis retains five-second windows');
  assert.ok(cadence.updates.every(update => update.values.join() === update.expected.join()), 'readouts display the actual quality-gated metrics, without interpolation');
  const byPaint = new Map();
  for (const update of cadence.updates.filter(update => update.good)) {
    const group = byPaint.get(update.segments) || []; group.push(update); byPaint.set(update.segments, group);
  }
  assert.ok([...byPaint.values()].some(group => group.length >= 4 && new Set(group.map(update => update.values.join())).size > 1), 'computed metrics visibly update several times within one painted segment');
  for (const viewport of [{ width: 320, height: 568 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await assertViewportFits(page, `capture ${viewport.width}px`);
    const captureLayout = await page.evaluate(() => {
      const rect = selector => {
        const { top, bottom } = document.querySelector(selector).getBoundingClientRect();
        return { top, bottom };
      };
      return {
        metrics: rect('.live-metrics'),
        status: rect('.painting-status'),
        signal: rect('#signal-meter'),
        title: rect('.capture-title'),
        camera: rect('.capture-camera'),
        details: rect('.live-details > summary'),
        dock: rect('.painting-actions'),
      };
    });
    assert.ok(Math.abs(captureLayout.status.top - captureLayout.signal.top) <= 1, 'timer and signal bars share a row');
    assert.ok(Math.abs((captureLayout.title.top + captureLayout.title.bottom) / 2 - (captureLayout.camera.top + captureLayout.camera.bottom) / 2) <= 1, 'title and camera are vertically balanced');
    assert.ok(captureLayout.metrics.top >= 0 && captureLayout.metrics.bottom <= captureLayout.dock.top - 4,
      `capture ${viewport.width}x${viewport.height}: live metrics stay above floating controls without scrolling`);
    assert.ok(captureLayout.details.bottom <= captureLayout.dock.top - 4,
      `capture ${viewport.width}x${viewport.height}: details remain reachable above floating controls`);
  }
  const signalCases = await page.evaluate(() => {
    const read = metrics => {
      updateCaptureSignal(metrics);
      return { value: document.getElementById('signal-meter').getAttribute('aria-valuenow'),
        description: document.getElementById('signal-meter').getAttribute('aria-valuetext'),
        bars: document.querySelectorAll('#signal-meter .filled').length,
        text: document.getElementById('quality-text').textContent };
    };
    const cases = [
      read({ quality: {good:true}, qualityScore:41 }),
      read({ quality: {good:false, code:'motion'}, qualityScore:99 }),
      read({ quality: {good:false, code:'irregular', reason:'Long internal quality explanation'} }),
      read({ quality: {good:true}, qualityScore:NaN }),
    ];
    updateMeasuringScreen(monitor.getMetrics());
    return cases;
  });
  assert.deepEqual(signalCases, [
    {value:'41',description:'41 out of 100',bars:3,text:''},
    {value:'0',description:'0 out of 100',bars:0,text:'Hold still'},
    {value:'0',description:'Signal quality unavailable',bars:0,text:'Finding signal'},
    {value:'0',description:'Signal quality unavailable',bars:0,text:''},
  ], 'signal display gates rejected data, keeps issue prompts brief, and never invents a missing score');
  // Accepted source advances on moving paper under a fixed brush. Presentation
  // must preserve earlier source strokes and save the final landscape for finish.
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const beforeFlow = await page.evaluate(() => {
    const paper = document.querySelector('.landscape-paper-trace');
    return { frames: __pulseLandscapeStats.frames, streamTime: __pulseLandscapeStats.streamTime,
      paperTransform: paper.getAttribute('transform') || paper.style.transform,
      strokes: JSON.stringify(landscape.strokes) };
  });
  await page.evaluate(() => monitor.feedUntil(75));
  await page.waitForFunction(previous => {
    const state = __pulseLandscapeStats, paper = document.querySelector('.landscape-paper-trace');
    return state.frames > previous.frames && state.streamTime > previous.streamTime && state.nib
      && (paper.getAttribute('transform') || paper.style.transform) !== previous.paperTransform;
  }, beforeFlow);
  const flow = await page.evaluate(previous => ({
    stats: __pulseLandscapeStats,
    width: document.getElementById('landscape-view').getBoundingClientRect().width,
    acceptedEnd: landscape.strokes.at(-1).sourceEnd,
    finalScenicHidden: getComputedStyle(document.querySelector('.landscape-stage')).opacity === '0',
    stable: JSON.stringify(landscape.strokes.slice(0, JSON.parse(previous).length)) === previous,
  }), beforeFlow.strokes);
  assert.equal(flow.stable, true, 'new accepted strokes preserve all earlier placements and materials');
  assert.equal(flow.stats.mode, 'recording');
  assert.equal(flow.stats.projection.kind, 'continuous-source-time-value');
  assert.ok(Math.abs(flow.stats.nib.x - flow.width * .78) < 1, 'the brush keeps its horizontal anchor as real source paper advances');
  assert.ok(flow.stats.frontier.t <= flow.acceptedEnd + 1e-9, 'the brush cannot paint beyond accepted source');
  assert.equal(flow.finalScenicHidden, true, 'recording keeps the full-contrast final painting for the finish reveal');
  assert.ok(flow.stats.cachedPixels <= flow.stats.pixelBudget, 'live landscape cache stays within its pixel budget');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.evaluate(() => {
    window.__cancelledMonitor = monitor;
    window.__cancelledLandscapeStats = __pulseLandscapeStats;
    window.__cancelledCanvas = landscapeView.canvas;
  });
  await page.getByRole('button', { name: 'Cancel reading', exact: true }).click();
  const cancelled = await page.evaluate(() => ({
    screen: document.getElementById('app').dataset.activeScreen,
    stopCalls: __cancelledMonitor.stopCalls, destroyCalls: __cancelledMonitor.destroyCalls,
    detached: monitor === null && landscape === null && landscapeView === null,
    timerStopped: sessionTimerId === null && measuringStartedAt === null && lastMeasuringFrame === null,
    elapsed: elapsedMeasuringMs, segments: manuscript.segments.length, pending: manuscript.pending.length,
    lastWindow: manuscript.lastWindow, metricsCleared: lastMetrics === null && portraitStartedAt === null,
    waveCleared: [...waveBuf, ...placementWaveBuf].every(value => value === 0),
    rasterReleased: __cancelledCanvas.width === 1 && __cancelledCanvas.height === 1 && __cancelledLandscapeStats.cachedPixels === 7 && !document.querySelector('.landscape-emergence,.landscape-discovery'),
    active: __cancelledLandscapeStats.active,
    overlayHidden: document.getElementById('entry-pigment').hidden,
  }));
  assert.deepEqual(cancelled, { screen: 'ready', stopCalls: 1, destroyCalls: 1, detached: true, timerStopped: true,
    elapsed: 0, segments: 0, pending: 0, lastWindow: -1, metricsCleared: true, waveCleared: true,
    rasterReleased: true, active: false, overlayHidden: true }, 'cancel releases capture and artwork resources, clears retained reading data, and returns to ready');
  await page.evaluate(() => {
    // Exercise callbacks retained by a stopped camera, including its real
    // engine adapter. Neither Ready nor a later reading may adopt that data.
    window.__checkCancelledDelivery = seconds => {
      const snapshot = () => JSON.stringify({
        screen: document.getElementById('app').dataset.activeScreen,
        cancelledMonitorActive: monitor === __cancelledMonitor,
        manuscript, landscape, lastMetrics, elapsedMeasuringMs, lastMeasuringFrame,
        measuringStartedAt, portraitStartedAt, sessionTimerId, waveBuf, placementWaveBuf,
        readings: ['hr-value', 'rmssd-value', 'sdnn-value', 'quality-text', 'painting-state', 'session-countdown'].map(id => document.getElementById(id).textContent),
        torchHidden: document.getElementById('torch-note').hidden,
      });
      const before = snapshot(), oldAlert = window.alert, alerts = [];
      window.alert = message => alerts.push(String(message));
      try {
        __cancelledMonitor.options.onReady({ torchSupported: false });
        __cancelledMonitor.options.onQualityUpdate({ ...__cancelledMonitor.getMetrics(), t: seconds + 1, fingerState: 'MEASURING' });
        __cancelledMonitor.options.onSignalUpdate({ time: seconds + 1, value: .123, isProcessing: true });
        __cancelledMonitor.options.onError({ guidance: 'Cancelled camera callback' });
        __cancelledMonitor.feedUntil(seconds);
      } finally { window.alert = oldAlert; }
      return { unchanged: snapshot() === before, alerts };
    };
  });
  assert.deepEqual(await page.evaluate(() => __checkCancelledDelivery(80)), { unchanged: true, alerts: [] }, 'late cancelled callbacks cannot restart capture, retain data, or display an error on Ready');
  await page.getByRole('button', { name: 'Begin pulse capture', exact: true }).click();
  const fresh = await page.evaluate(() => ({
    newMonitor: monitor !== __cancelledMonitor, sampleIndex: monitor.i,
    segments: manuscript.segments.length, pending: manuscript.pending.length, strokes: landscape.strokes.length,
    elapsed: elapsedMeasuringMs, lastWindow: manuscript.lastWindow, lastMetrics,
    beats: monitor.getTachogram().length,
  }));
  assert.deepEqual(fresh, { newMonitor: true, sampleIndex: 0, segments: 0, pending: 0, strokes: 0, elapsed: 0, lastWindow: -1, lastMetrics: null, beats: 0 }, 'restart begins with a new engine and no cancelled samples, strokes, metrics, or elapsed time');
  await page.evaluate(() => monitor.feedUntil(80));
  assert.equal(await page.locator('#screen-measuring').isVisible(), true, 'a fresh reading can enter capture');
  assert.ok(await page.evaluate(() => manuscript.segments.length > 0 && landscape.strokes.length > 0), 'fresh accepted signal paints after cancellation');
  assert.deepEqual(await page.evaluate(() => __checkCancelledDelivery(90)), { unchanged: true, alerts: [] }, 'late callbacks and replay from the cancelled monitor cannot mutate the new reading');
  assert.equal(await page.getByRole('button', { name: 'Cancel reading', exact: true }).isVisible(), true);
  // Keep this export/manual-finish check below automatic completion; the
  // dedicated WebKit session test exercises the full 180 active seconds.
  await page.evaluate(() => monitor.feedUntil(180));
  const expected = await page.evaluate(() => {
    const beats = monitor.getTachogram({ goodOnly: true, hrvOnly: true }).filter(p => p.valid);
    const report = PPG.hrv.analyzeHRV(beats);
    return { hr: report.timeDomain.meanHR.toFixed(0), rmssd: report.timeDomain.rmssd.toFixed(1), sdnn: report.timeDomain.sdnn.toFixed(1), beats: report.meta.nBeats };
  });
  await page.getByRole('button', { name: 'Finish painting', exact: true }).click();
  await page.waitForFunction(() => !document.getElementById('screen-summary').hidden);
  const heroValues = await page.locator('.report-heroes strong').allTextContents();
  assert.doesNotMatch(await page.locator('#report-content').innerText(), /experiment/i, 'report uses research-estimate wording');
  assert.ok(heroValues[0].includes(expected.hr));
  assert.ok(heroValues[1].includes(expected.rmssd));
  assert.ok(heroValues[2].includes(expected.sdnn));
  assert.match(await page.locator('.quality-facts').innerText(), new RegExp(String(expected.beats)));
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await assertViewportFits(page, `report ${width}px`);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await checkArtwork(page);
  for (const label of ['Frequency analysis', 'Nonlinear analysis', 'Beat timing & methods']) {
    await page.getByText(label, { exact: true }).click();
  }
  const charts = await page.locator('.report-canvas-wrap canvas').evaluateAll(nodes => nodes.map(c => ({ width: c.width, height: c.height, visible: c.getBoundingClientRect().width > 0 })));
  assert.ok(charts.every(c => c.width > 0 && c.height > 0 && c.visible), 'expanded charts have actual dimensions');
  await checkReportGraphs(page);
  await openReportMenu(page);
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Save manuscript', exact: true }).click(),
  ]);
  assert.equal(await download.failure(), null, 'manuscript exports');
  const png = readFileSync(await download.path());
  assert.equal(png.subarray(1, 4).toString(), 'PNG');
  assert.ok(png.readUInt32BE(16) <= 1200 && png.readUInt32BE(20) <= 8192, 'bounded PNG dimensions');
  await page.evaluate(() => { window.print = () => { window.__printedOpen = [...document.querySelectorAll('.report-disclosure,.time-details,.ans-methods')].every(d => d.open); window.dispatchEvent(new Event('afterprint')); }; });
  await openReportMenu(page);
  await page.getByRole('button', { name: 'Save report', exact: true }).click();
  await page.waitForFunction(() => window.__printedOpen !== undefined);
  assert.equal(await page.evaluate(() => window.__printedOpen), true, 'print opens all report detail');

  const completeScene = await page.evaluate(() => JSON.stringify(landscape));
  await page.evaluate(() => renderReport([], undefined, null));
  await page.waitForFunction(() => !document.getElementById('btn-share-artwork').disabled);
  assert.match(await page.locator('#report-content').innerText(), /not include enough accepted beat intervals/, 'art eligibility is independent of HRV eligibility');
  assert.equal(await page.locator('.hrv-table').count(), 0, 'unavailable HRV is never fabricated');
  assert.equal(fingerprint(await page.evaluate(() => JSON.stringify(landscape))), fingerprint(completeScene), 'missing HRV does not change or discard the painting');
  await page.evaluate(() => useManuscriptFallback());
  assert.equal(fingerprint(await page.evaluate(() => JSON.stringify(landscape))), fingerprint(completeScene), 'visual fallback preserves the scene identity and every accepted source stroke');

  // Navigate away while the final landscape reconstruction is active. Capture
  // has already stopped; page lifecycle must settle, never strand the report.
  await page.locator('#btn-again').click();
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.getByRole('button', { name: 'Begin pulse capture', exact: true }).click();
  await page.evaluate(() => monitor.feedUntil(45));
  const finishingScene = await page.evaluate(() => { window.__testFinish=stopSession(); return JSON.stringify(landscape); });
  assert.equal(await page.evaluate(() => sessionFinishing), true, 'normal-motion completion starts the scene reveal');
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true })));
  await page.waitForFunction(() => !document.getElementById('screen-summary').hidden);
  await page.evaluate(() => window.__testFinish);
  assert.equal(await page.evaluate(() => sessionFinishing), false, 'pagehide settles the pending reveal');
  assert.equal(fingerprint(await page.evaluate(() => JSON.stringify(landscape))), fingerprint(finishingScene), 'lifecycle recovery preserves the same completed scene');
  assert.equal(await page.locator('#entry-pigment').isHidden(), true, 'pagehide leaves no stale overlay above the report');
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })));

  const attribution = await page.evaluate(() => {
    resetManuscript();
    const w = { t: 2, windowStartSec: 0, gridHz: 10, selectedChannel: 'green', filtered: Float64Array.from({ length: 21 }, (_, i) => i), quality: { good: true }, sqi: { score: .9 } };
    monitor = { engine: { lastWindow: w } };
    // Red callback values are intentionally descending. Selected green is rising.
    manuscript.pending = Array.from({ length: 20 }, (_, i) => ({ t: (i + 1) / 10, v: -i }));
    acceptPaintWindow(w);
    const first = manuscript.segments[0];
    const match = first.channel === 'green' && first.points[0].v === 0 && first.points.at(-1).v === 1 && first.score === .9;
    const unchanged = JSON.stringify(first);
    w.t = 4; w.windowStartSec = 2; w.quality.good = false;
    manuscript.pending = Array.from({ length: 20 }, (_, i) => ({ t: 2 + (i + 1) / 10, v: i }));
    acceptPaintWindow(w);
    const rejected = manuscript.segments.length === 1 && JSON.stringify(first) === unchanged;
    // A malformed filtered sample is a source barrier, even when valid
    // neighboring samples are less than the normal dropout threshold apart.
    resetManuscript();
    w.t = 2; w.windowStartSec = 0; w.quality.good = true;
    w.filtered = Float64Array.from({ length:21 }, (_,i) => i === 10 ? NaN : i);
    manuscript.pending = Array.from({ length:20 }, (_,i) => ({t:(i+1)/10,v:i}));
    acceptPaintWindow(w);
    const malformed = { usableSeconds:landscape.usableSeconds, strokes:landscape.strokes.length,
      bridgesHole:landscape.strokes.some(stroke=>stroke.points.some((point,i)=>i>0&&stroke.points[i-1].t<1&&point.t>1)),
      finite:landscape.strokes.every(stroke=>stroke.points.every(point=>Number.isFinite(point.t)&&Number.isFinite(point.v))) };
    document.getElementById('pause-note').textContent = 'Old recording notice';
    resetManuscript();
    const liveRegions=['painting-state','quality-text'].map(id=>{
      const region=document.getElementById(id).closest('[role="status"]');
      return {role:region?.getAttribute('role'),live:region?.getAttribute('aria-live'),atomic:region?.getAttribute('aria-atomic')};
    });
    return { match, rejected, malformed, resetNote: document.getElementById('pause-note').textContent, resetNoteHidden: document.getElementById('pause-note').hidden, liveRegions,
      countdownAnnounced:!!document.getElementById('session-countdown').closest('[role="status"],[aria-live="polite"],[aria-live="assertive"]') };
  });
  assert.equal(attribution.match, true, 'geometry and pigment quality use the selected analysis channel');
  assert.equal(attribution.rejected, true, 'bad windows add no paint and never recolor captured segments');
  assert.ok(attribution.malformed.strokes>=2&&attribution.malformed.finite,'valid portions survive a malformed sample as separate finite source runs');
  assert.equal(attribution.malformed.bridgesHole,false,'app adapter never connects across a nonfinite filtered sample');
  assert.ok(Math.abs(attribution.malformed.usableSeconds-1.7)<1e-7,'nonfinite sample hole contributes no accepted source duration');
  assert.equal(attribution.resetNote, '', 'a fresh manuscript clears stale recording notices');
  assert.equal(attribution.resetNoteHidden, true, 'normal capture reserves no space for a footer notice');
  assert.deepEqual(attribution.liveRegions,Array(2).fill({role:'status',live:'polite',atomic:'true'}),'painting state and camera signal remain accessible live statuses');
  assert.equal(attribution.countdownAnnounced,false,'timer updates do not repeatedly announce the capture header');

  const timing = await page.evaluate(() => {
    measuringStartedAt = 1; elapsedMeasuringMs = 0; lastMeasuringFrame = null;
    for (let i = 0; i <= 50; i++) advanceSessionClock(i / 50, true);
    tickSessionCountdown();
    advanceSessionClock(1.02, false);
    for (let i = 0; i < 40; i++) tickSessionCountdown();
    const held = elapsedMeasuringMs;
    for (let i = 0; i <= 50; i++) advanceSessionClock(41 + i / 50, true);
    tickSessionCountdown();
    const resumed = elapsedMeasuringMs;
    return { held: Math.round(held), resumed: Math.round(resumed) };
  });
  assert.deepEqual(timing, { held: 1000, resumed: 2000 }, 'finger-loss time is excluded from countdown');
  await page.evaluate(() => { monitor = { getSessionSummary: () => ({ goodFraction: 0 }) }; renderReport([], undefined, null); showScreen('summary'); });
  assert.match(await page.locator('#report-content').innerText(), /No good-quality windows/);
  await checkEmptyArtworkActions(page);
  assert.deepEqual(errors, [], 'no runtime errors');
  await checkCaptureEntry(browser, url);
  console.log('PASS: Pulse Painting capture, cancellation/restart, stale callback isolation, quality attribution, report, exports, responsive layouts and unavailable-data handling');
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
