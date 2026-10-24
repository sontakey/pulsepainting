// Optional visual enhancement failures must leave capture and its measured
// source-time brush and finished Canvas2D landscape usable. This uses real
// engine replay, not a mock renderer.
// npm run build && node test/e2e/paint-fallback-checks.mjs
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
const hash=value=>createHash('sha256').update(value).digest('hex');
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, devices } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

async function installReplay(page, log) {
  await page.evaluate(log => {
    window.PPGMonitor = class extends PPG.PPGMonitor {
      constructor(host, options) {
        super(host, options);
        this.engine = new PPG.PpgEngine({ ...log.meta?.engineConfig?.engine, ...options.signal });
        this.video = document.createElement('video');
        this.torchSupported = true; this.torchState = 'on';
        this.currentMetrics = { fingerState: 'NO_FINGER' }; this.i = 0;
      }
      async start() { this.options.onReady({ torchSupported: true }); }
      stop() {} destroy() {}
      getMetrics() { return this.currentMetrics; }
      getSessionSummary() { return this.engine.getSessionSummary(); }
      getTachogram(options = {}) { return this.engine.getTachogram(options); }
      getDebugLog() { return log; }
      feedUntil(seconds) {
        const t0 = log.samples[0].t;
        for (; this.i < log.samples.length; this.i++) {
          const sample = log.samples[this.i], t = (sample.t - t0) / 1000;
          if (t > seconds) break;
          const result = this.engine.push({ ...sample, t });
          if (result.stateChanged) {
            this.currentMetrics.fingerState = result.state;
            this.options.onState?.({ state: result.state, reason: result.stateReason, time: t });
          }
          if (result.window) this._onWindow(result.window, sample.t, sample.rMean, sample.gMean, sample.bMean, sample.clippedFraction);
          this.options.onSignalUpdate({ time: t, value: result.waveform, isProcessing: result.state === 'MEASURING' });
        }
      }
    };
  }, log);
}

async function inspectFallback(page) {
  return page.evaluate(() => {
    const canvas = document.querySelector('.landscape-canvas');
    const ink=document.querySelector('.landscape-ink'),core=document.querySelector('.landscape-live-core');
    const coreLength=core?.getAttribute('d')?core.getTotalLength():0;
    const inkVisible=!!ink&&!ink.hasAttribute('hidden')&&getComputedStyle(ink).display!=='none'&&getComputedStyle(ink).visibility==='visible'&&Number(getComputedStyle(ink).opacity)>0;
    const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    // Families can use foliage greens or a dark aurora paper.
    // Compare with this exact scene's unpainted material instead of requiring
    // one palette color; a missing/empty transparent canvas cannot satisfy it.
    const paper = document.createElement('canvas');paper.width=canvas.width;paper.height=canvas.height;
    PulseLandscape.render(landscape,paper,{through:0});
    const background = paper.getContext('2d').getImageData(0,0,paper.width,paper.height).data;
    let paintedPixels = 0, changedPixels = 0, maxDifference = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      const difference=Math.abs(pixels[i]-background[i])+Math.abs(pixels[i+1]-background[i+1])+Math.abs(pixels[i+2]-background[i+2]);
      maxDifference=Math.max(maxDifference,difference);
      if(pixels[i+3]>32&&difference>8)changedPixels++;
      if (pixels[i + 3] > 32 && difference > 30) paintedPixels++;
    }
    return { paintedPixels, changedPixels, maxDifference, inkVisible,coreLength, family:landscape.family, seed:landscape.seed, sceneStrokes:landscape.strokes.length, view:{...__pulseLandscapeStats}, sourceVisible: getComputedStyle(canvas).visibility === 'visible' && !canvas.hidden,
      measuring: !document.getElementById('screen-measuring').hidden, segments: manuscript.segments.length,
      samples: monitor.i, gpuReady: window.__paintGpuStats?.ready || false };
  });
}

async function startReplay(page, log) {
  await installReplay(page, log);
  await page.getByRole('button', { name: 'Begin pulse capture', exact: true }).click();
  await page.waitForFunction(() => entryTransition === null);
  await page.evaluate(() => monitor.feedUntil(70));
  assert.ok(await page.evaluate(() => manuscript.segments.length > 0), 'real replay supplies accepted waveform');
  await page.waitForFunction(() => __pulseLandscapeStats.mode==='recording'&&__pulseLandscapeStats.nib&&document.querySelector('.landscape-live-core')?.getAttribute('d'));
}

export async function checkPaintFallbacks(browser, baseURL, log, output = process.env.PPG_FALLBACK_ARTIFACTS) {
  if (output) mkdirSync(output, { recursive: true });
  const results = [];
  for (const name of ['module-blocked', 'webgl2-context-lost']) {
    const context = await browser.newContext({ ...devices['iPhone 13'], reducedMotion: 'no-preference' });
    try {
      const page = await context.newPage(), errors = [];
      page.on('pageerror', error => errors.push(String(error)));
      let blockedModule;
      if (name === 'module-blocked') {
        await page.route('**/paint-gpu.js*', route => route.abort('failed'));
        blockedModule = page.waitForEvent('requestfailed', {
          predicate: request => new URL(request.url()).pathname.endsWith('/paint-gpu.js'), timeout: 15000,
        });
      }
      const url = new URL(baseURL);
      if (name === 'webgl2-context-lost') url.searchParams.set('paintBackend', 'webgl2');
      await Promise.all([page.goto(url.href), blockedModule]);
      if (!blockedModule) {
        await page.waitForFunction(() => window.__paintGpuStats?.ready && paintGPU, null, { timeout: 60000 });
        assert.equal(await page.evaluate(() => window.__paintGpuStats.backend), 'webgl2', 'test uses the actual WebGL2 renderer');
      }
      await startReplay(page, log);
      if (name === 'webgl2-context-lost') {
        const beforeLoss = await page.evaluate(() => {landscapeView.pause(true);return{source:JSON.stringify(landscape),pixels:landscapeView.canvas.toDataURL(),ink:document.querySelector('.landscape-ink').outerHTML};});
        const hasLossExtension = await page.evaluate(() => {
          // The optional entry compositor is genuine WebGL2; the scene cache
          // intentionally remains Canvas2D and must survive compositor failure.
          const canvas = [...document.querySelectorAll('canvas')].find(candidate => candidate.style.position === 'fixed' && candidate.style.zIndex === '1000');
          const gl = canvas?.getContext('webgl2');
          const extension = gl?.getExtension('WEBGL_lose_context');
          if (!extension) return false;
          window.__lostPaintCanvas = canvas;
          extension.loseContext();
          return true;
        });
        assert.equal(hasLossExtension, true, 'live GPU canvas exposes real context-loss extension');
        await page.waitForFunction(() => window.__paintGpuStats.backend === 'unavailable' && !window.__paintGpuStats.ready);
        assert.equal(await page.evaluate(() => window.__lostPaintCanvas.getContext('webgl2').isContextLost()), true, 'real GPU context was lost');
        assert.equal(await page.evaluate(() => window.__lostPaintCanvas.hidden), true, 'lost GPU surface is hidden');
        assert.equal(hash(await page.evaluate(() => JSON.stringify(landscape))),hash(beforeLoss.source),'context loss preserves measured waveform and quality');
        assert.equal(hash(await page.evaluate(() => landscapeView.canvas.toDataURL())),hash(beforeLoss.pixels),'context loss preserves the exact visible painting while presentation is paused');
        assert.equal(hash(await page.evaluate(() => document.querySelector('.landscape-ink').outerHTML)),hash(beforeLoss.ink),'context loss preserves the exact retained source ink while paused');
        await page.evaluate(()=>landscapeView.pause(false));
        await page.waitForFunction(()=>__pulseLandscapeStats.nib&&!document.querySelector('.landscape-ink').hasAttribute('hidden'));
      }
      const fallback = await inspectFallback(page);
      console.log('FALLBACK_VISIBLE_STATE',JSON.stringify({name,...fallback}));
      if(output)await page.screenshot({path:path.join(output,`${name}-before-assert.png`)});
      assert.equal(fallback.view.mode,'recording');
      assert.ok(fallback.inkVisible&&fallback.coreLength>10&&fallback.view.nib,`${name}: real source ink and brush remain visible without the optional GPU`);
      assert.equal(fallback.measuring, true, `${name}: capture stays active`);
      assert.equal(fallback.gpuReady, false, `${name}: fallback actually runs without GPU`);
      assert.equal(fallback.view.rasterFrames,0,`${name}: capture does not substitute scenic raster painting for source ink`);
      await page.evaluate(() => {landscapeView.pause(false);monitor.feedUntil(100);});
      await page.waitForFunction(before=>__pulseLandscapeStats.frontier?.t>before&&__pulseLandscapeStats.nib,fallback.view.frontier.t);
      const continued = await inspectFallback(page);
      assert.ok(continued.samples > fallback.samples && continued.segments > fallback.segments, `${name}: engine and accepted artwork continue after failure`);
      assert.ok(continued.inkVisible&&continued.coreLength>10&&continued.view.nib, `${name}: continuing capture keeps the measured ink visible`);
      assert.ok(continued.view.frames>fallback.view.frames&&continued.view.frontier.t>fallback.view.frontier.t,`${name}: resumed renderer advances measured source after failure`);
      const finish=await page.evaluate(async()=>{const source=JSON.stringify(landscape),clock=elapsedMeasuringMs;await stopSession();return{sourceStable:source===JSON.stringify(landscape),clockStable:clock===elapsedMeasuringMs,summary:!document.getElementById('screen-summary').hidden};});
      const finished=await inspectFallback(page);
      assert.ok(finish.sourceStable&&finish.clockStable&&finish.summary,`${name}: finish preserves capture data and reaches the report`);
      assert.equal(finished.view.mode,'finished');assert.equal(finished.view.painted,finished.sceneStrokes);
      assert.ok(finished.changedPixels>100,`${name}: reconstruction retains the finished measured landscape without the optional GPU`);
      assert.deepEqual(errors, [], `${name}: no uncaught application errors`);
      if (output) await page.screenshot({ path: path.join(output, `${name}.png`) });
      results.push({ name, fallback, continued,finish,finished });
    } finally { await context.close(); }
  }
  if (output) writeFileSync(path.join(output, 'fallback-checks.json'), JSON.stringify(results, null, 2) + '\n');
  return results;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const log = JSON.parse(readFileSync(process.env.PPG_SESSION_LOG || path.join(root, 'test/fixtures/iphone-200s.json'), 'utf8'));
  const mime = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.woff2': 'font/woff2' };
  const server = createServer((req, res) => {
    const file = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
    if (!file.startsWith(root + '/') || !existsSync(file) || !statSync(file).isFile()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' }); res.end(readFileSync(file));
  });
  let browser;
  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    browser = await chromium.launch(process.env.PPG_CHROMIUM ? { executablePath: process.env.PPG_CHROMIUM } : process.platform === 'darwin' ? { channel: 'chrome' } : {});
    const results = await checkPaintFallbacks(browser, `http://127.0.0.1:${server.address().port}/dist/index.html`, log);
    console.log(JSON.stringify(results));
    console.log('PASS: blocked GPU module and real WebGL2 context loss preserve visible measured painting and continued capture');
  } finally {
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
  }
}
