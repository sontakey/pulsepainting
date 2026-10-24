// Real public recording, actual acceptance adapter, deterministic presentation
// scheduling. This verifies raster correctness, not frame rate or physiology.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, webkit } from 'playwright';
import { replayPublicFixture } from '../landscape-fixture.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
// Recording keeps source ink above a separate faint ambient surface. The focused
// regression therefore completes reconstruction from early, late and undrained
// recording states, and keeps the established canonical/repeated-export gates.
// The default invocation remains the broader all-family diagnostic, including
// known WebKit residuals; a focused pass must not stand in for that result.
const regression = process.argv.includes('--compositor-regression');
const rendererPath = path.resolve(root, process.env.PPG_LANDSCAPE_RENDERER || 'app/landscape.js');
const source = readFileSync(rendererPath, 'utf8');
const marker = 'sync();return {sync,pause,finish,cancelFinish,dispose,canvas,';
assert.equal(source.split(marker).length, 2, 'observe the real renderer state without replacing its paint loop');
const observedSource = source.replace(marker, 'sync();return {get captureState(){return {painted,progress};},sync,pause,finish,cancelFinish,dispose,canvas,');
const { segments } = replayPublicFixture(1, 0, 180);
assert.ok(segments.length > 20, 'the recording supplies a full accepted session');
const seeds = (process.env.PPG_PARITY_SEEDS || '39293').split(',').map(Number);
assert.ok(seeds.every(Number.isFinite));
const requestedFamilies = (process.env.PPG_PARITY_FAMILIES || (regression ? 'quiet-lake' : '')).split(',').filter(Boolean);
const engines = (process.env.PPG_PARITY_ENGINES || 'chromium,webkit').split(',');
assert.ok(engines.every(name => ['chromium', 'webkit'].includes(name)));
const out = path.resolve(root, process.env.PPG_PARITY_ARTIFACTS || (regression ? '.dream-loop/compositor-regression' : '.dream-loop/real-fixture-parity'));
mkdirSync(out, { recursive: true });
const startedAt = new Date().toISOString();

for (const name of engines) {
  let browser;
  // See docs/validation/landscape-raster-parity.md. This new WebKit criterion
  // is distinct from the existing Chromium one-level gate, which is unchanged.
  const maxChannel = name === 'webkit' ? 2 : 1;
  const result = { engine: name, mode: regression ? 'focused-compositor-regression' : 'all-family-diagnostic', startedAt, nodeVersion: process.version, platform: process.platform, architecture: process.arch, rendererPath, rendererSha256: createHash('sha256').update(source).digest('hex'),
    scope: 'Public camera replay; stepped presentation correctness only, not mobile performance or physical-device validation.',
    thresholds: { maxChannel, meanExclusive: .001, repeatMax: 0 }, cases: [], errors: [], failures: [] };
  try {
    browser = await (name === 'webkit' ? webkit : chromium).launch(name === 'chromium' && process.platform === 'darwin' ? { channel: 'chrome' } : {});
    result.browserVersion = browser.version();
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'no-preference' });
    page.on('pageerror', error => result.errors.push(String(error)));
    await page.setContent('<style>body{margin:0}main{width:390px;height:700px;overflow:hidden}</style><main></main>');
    await page.addStyleTag({ path: path.join(root, 'app/landscape.css') });
    await page.evaluate(() => {
      const pending = new Map(); let id = 0, time = 0;
      window.requestAnimationFrame = callback => { pending.set(++id, callback); return id; };
      window.cancelAnimationFrame = key => pending.delete(key);
      window.advancePaint = () => {
        time += 64;
        const callbacks = [...pending.values()]; pending.clear();
        callbacks.forEach(callback => callback(time));
        return callbacks.length;
      };
    });
    await page.addScriptTag({ content: observedSource });
    const available = await page.evaluate(() => PulseLandscape.FAMILIES.map(family => family.id));
    assert.ok(requestedFamilies.every(family => available.includes(family)));
    for (const family of available.filter(family => !requestedFamilies.length || requestedFamilies.includes(family))) {
      for (const seed of seeds) for (const count of [6, segments.length]) {
        const item = await page.evaluate(async ({ family, seed, segments }) => {
          const scene = PulseLandscape.create({ seed, family });
          segments.forEach(segment => PulseLandscape.append(scene, segment));
          const original = JSON.stringify(scene);
          let view;
          const eligible = scene.strokes.map((stroke, index) => ({ stroke, index }))
            .filter(({ stroke }) => stroke.sourceEnd - stroke.sourceStart > .12);
          const targets = [.12, .85].map(fraction => eligible[Math.floor(eligible.length * fraction)].index);
          const phases = [];
          const compare = label => {
            const state = view.captureState;
            const direct = document.createElement('canvas'), repeat = document.createElement('canvas');
            direct.width = direct.height = repeat.width = repeat.height = view.canvas.width;
            PulseLandscape.render(scene, direct); PulseLandscape.render(scene, repeat);
            const pixels = canvas => canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
            const a = pixels(view.canvas), b = pixels(direct), c = pixels(repeat);
            let max = 0, sum = 0, repeatMax = 0, changedChannels = 0, channelsAboveOne = 0;
            for (let i = 0; i < a.length; i++) {
              const difference = Math.abs(a[i] - b[i]);
              max = Math.max(max, difference); sum += difference;
              changedChannels += difference > 0 ? 1 : 0;
              channelsAboveOne += difference > 1 ? 1 : 0;
              repeatMax = Math.max(repeatMax, Math.abs(b[i] - c[i]));
            }
            const stats = { ...__pulseLandscapeStats };
            direct.width = direct.height = repeat.width = repeat.height = 1;
            return { label, ...state, max, mean: sum / a.length, sum, changedChannels, channelsAboveOne, repeatMax,
              sourceStable: JSON.stringify(scene) === original, stats };
          };
          try {
            for (let phase = 0; phase < targets.length; phase++) {
              view = PulseLandscape.createView(document.querySelector('main'), scene);
              const target = targets[phase]; let reached = false;
              for (let frame = 0; frame < 20000; frame++) {
                const state = view.captureState;
                if (state.painted === target && state.progress > .38 && state.progress < .86) {
                  view.pause(true); reached = true; break;
                }
                if (state.painted > target || !advancePaint()) throw Error('Missed actual partial paint checkpoint');
              }
              if (!reached) throw Error('Partial paint checkpoint exceeded its frame bound');
              const recording = { ...view.captureState, mode: __pulseLandscapeStats.mode, streamTime: __pulseLandscapeStats.streamTime };
              if(recording.mode !== 'recording')throw Error('Landscape reconstructed before finish was requested');
              const finishing = view.finish(); view.cancelFinish();
              if(await finishing !== scene)throw Error('Finish substituted another scene');
              phases.push({ ...compare(phase ? 'finish-from-late-recording' : 'finish-from-early-recording'), recording });
              view.dispose();view=null;
            }
            view = PulseLandscape.createView(document.querySelector('main'), scene);
            const finishing = view.finish(); view.cancelFinish();
            if (await finishing !== scene) throw Error('Finish substituted another scene');
            phases.push(compare('finish-with-undrained-recording'));
            return { family, seed, segments: segments.length, usableSeconds: scene.usableSeconds, phases };
          } finally { view?.dispose(); }
        }, { family, seed, segments: segments.slice(0, count) });
        result.cases.push(item);
        for (const phase of item.phases) {
          const checkpoint = { family, seed, count, phase: phase.label };
          assert.ok(phase.sourceStable, 'painting and exporting retain every original source field');
          assert.equal(phase.stats.mode,'finished','canonical scenery is checked only after reconstruction completes');
          assert.equal(phase.stats.finished,true,'every completion checkpoint reaches a final artwork');
          if (phase.repeatMax !== 0) result.failures.push({ ...checkpoint, check: 'repeated-export', max: phase.repeatMax });
          assert.ok(phase.stats.cachedPixels <= phase.stats.pixelBudget && phase.stats.pixelBudget <= 3086336, 'canonical caches, ambient snapshots and their fixed mask remain bounded');
          // Existing pigment cache plus one 256² decoded live-wash mask.
          assert.ok(phase.stats.materialPixels <= 4489216 + 256 ** 2, 'material raster memory remains bounded');
          if (phase.max > maxChannel || phase.mean >= .001) result.failures.push({ ...checkpoint, check: 'live-export', max: phase.max, mean: phase.mean });
        }
      }
    }
    assert.deepEqual(result.errors, []);
    assert.deepEqual(result.failures, [], 'reconstruction from early, late and undrained recordings matches canonical exports, and repeated exports are exact');
    result.passed = true;
  } catch (error) {
    // Preserve a failing exit status while still recording the other engine.
    result.failure = String(error.stack || error);
    process.exitCode = 1;
  }
  finally {
    writeFileSync(path.join(out, `${name}.json`), JSON.stringify(result, null, 2));
    await browser?.close();
    console.log(JSON.stringify({ engine: name, passed: !!result.passed, cases: result.cases.length, failures: result.failures, errors: result.errors, failure: result.failure, out }));
  }
}
