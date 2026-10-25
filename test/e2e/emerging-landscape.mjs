// Deterministic presentation checks with real public PPG samples. This stepped
// clock is not a phone performance, camera, or physiological validation.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, webkit } from 'playwright';
import { replayPublicFixture } from '../landscape-fixture.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const source = readFileSync(path.join(root, 'app/landscape.js'), 'utf8');
const recording = replayPublicFixture(1, 0, 180);
const fragmented = replayPublicFixture(.5, .18);
const acceptedPeakTimes = new Set(recording.acceptedBeats.map(beat => beat.t));
assert.ok(recording.segments.some(segment => segment.beatTimes.length), 'the public replay retains real accepted beat timestamps');
assert.ok(recording.segments.every(segment => segment.beatTimes.every(t => acceptedPeakTimes.has(t))), 'art metadata cannot synthesize timestamps from heart rate');
assert.ok(recording.scene.strokes.every(stroke => stroke.beatTimes.every(t => acceptedPeakTimes.has(t) && t >= stroke.sourceStart && t <= stroke.sourceEnd)), 'beat metadata belongs to the retained source fragment');
const retainedPeakTimes = recording.scene.strokes.flatMap(stroke => stroke.beatTimes);
assert.equal(new Set(retainedPeakTimes).size, retainedPeakTimes.length, 'shared fragment boundaries cannot count one beat twice');
const output = path.resolve(root, process.env.PPG_EMERGENCE_ARTIFACTS || '.dream-loop/emerging-landscape/verification');
const engines = (process.env.PPG_EMERGENCE_ENGINES || 'chromium,webkit').split(',');
assert.ok(engines.every(engine => ['chromium', 'webkit'].includes(engine)));
mkdirSync(output, { recursive: true });

for (const engine of engines) {
  let browser;
  const result = { engine, rendererSha256: createHash('sha256').update(source).digest('hex'), scope: 'Real public samples, stepped animation and idle callbacks. Not physical mobile or physiological validation.', errors: [] };
  try {
    browser = await (engine === 'webkit' ? webkit : chromium).launch(engine === 'chromium' && process.platform === 'darwin' ? { channel: 'chrome' } : {});
    result.browserVersion = browser.version();
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, reducedMotion: 'no-preference' });
    page.on('pageerror', error => result.errors.push(String(error)));
    await page.setContent('<style>*{box-sizing:border-box}body{margin:0;background:#fbf8f0}main{margin:0 14px;width:362px;height:520px}</style><main></main>');
    await page.addStyleTag({ path: path.join(root, 'app/landscape.css') });
    await page.evaluate(() => {
      const frames = new Map(), idle = new Map(); let id = 0, time = 0;
      window.requestAnimationFrame = callback => { frames.set(++id, callback); return id; };
      window.cancelAnimationFrame = key => frames.delete(key);
      window.requestIdleCallback = callback => { idle.set(++id, callback); return id; };
      window.cancelIdleCallback = key => idle.delete(key);
      window.advancePaint = (count = 1) => {
        for (let i = 0; i < count; i++) {
          time += 1000 / 60;
          const current = [...frames.values()]; frames.clear(); current.forEach(callback => callback(time));
          const warming = [...idle.values()]; idle.clear(); warming.forEach(callback => callback({ didTimeout: false, timeRemaining: () => 16 }));
        }
      };
      window.pendingPaint = () => frames.size + idle.size;
      window.canvasFingerprint = canvas => {
        const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
        let hash = 2166136261, pigment = 0, occupied = 0, opaque = 0;
        for (let i = 0; i < pixels.length; i++) hash = Math.imul(hash ^ pixels[i], 16777619);
        for (let i = 0; i < pixels.length; i += 4) {
          if (pixels[i + 3] > 8) occupied++;
          if (pixels[i + 3] === 255) opaque++;
          if (pixels[i + 3] > 8 && Math.abs(pixels[i] - pixels[i + 1]) + Math.abs(pixels[i + 1] - pixels[i + 2]) > 24) pigment++;
        }
        return { hash: hash >>> 0, pigment, occupied, opaque, width: canvas.width, height: canvas.height };
      };
      window.inspectEmergence = () => {
        const surface = document.querySelector('.landscape-emergence'), style = surface && getComputedStyle(surface), box = surface?.getBoundingClientRect();
        const caption = document.querySelector('.landscape-discovery'), paper = document.querySelector('.landscape-emergence-paper'), paperStyle = paper && getComputedStyle(paper);
        return {
          stats: structuredClone(__pulseLandscapeStats.emergence), warmed: __pulseLandscapeStats.warmStrokes || 0,
          pixels: [...document.querySelectorAll('.landscape-emergence canvas')].map(canvasFingerprint),
          placement: surface && { transform: style.transform, left: box.left, top: box.top, width: box.width, height: box.height, paperTransform: paperStyle?.transform, paperWidth: paperStyle?.width, paperHeight: paperStyle?.height },
          opacity: style && Number(style.opacity), mask: style && (style.maskImage || style.webkitMaskImage),
          caption: caption?.textContent.trim() || '', finalOpacity: Number(getComputedStyle(document.querySelector('.landscape-stage')).opacity),
          cachedPixels: __pulseLandscapeStats.cachedPixels, pixelBudget: __pulseLandscapeStats.pixelBudget,
        };
      };
      window.visibleDiscoveryDelta = () => {
        const wrapper = document.querySelector('.landscape-emergence').getBoundingClientRect(), paper = document.querySelector('.landscape-emergence-paper').getBoundingClientRect();
        const canvas = [...document.querySelectorAll('.landscape-emergence canvas')].find(item => item.style.zIndex === '1');
        const pixels = canvas.getContext('2d').getImageData(0, 0, 480, 480).data;
        // Compare visible color, not transparent mask holes. Empty pigment
        // masks must composite back to paper and cannot count as a discovery.
        const composite = new Float32Array(pixels.length);
        for (let i = 0; i < pixels.length; i += 4) {
          const alpha = pixels[i + 3] / 255 * __pulseLandscapeStats.emergence.opacity;
          for (let channel = 0; channel < 3; channel++) composite[i + channel] = pixels[i + channel] * alpha + emptyAmbientPixels[i + channel] * (1 - alpha);
          composite[i + 3] = 255;
        }
        const { clearTop, clearBottom } = __pulseLandscapeStats.emergence;
        let changed = 0, changedAnywhere = 0;
        for (let i = 0; i < composite.length; i += 4) if (Math.abs(composite[i] - previousAmbientPixels[i]) + Math.abs(composite[i + 1] - previousAmbientPixels[i + 1]) + Math.abs(composite[i + 2] - previousAmbientPixels[i + 2]) > 2) changedAnywhere++;
        for (let y = 0; y < 480; y++) {
          const screenY = paper.top - wrapper.top + (y + .5) / 480 * paper.height;
          if (screenY < wrapper.height * .1 || screenY > wrapper.height * .92 || (screenY >= wrapper.height * clearTop && screenY <= wrapper.height * clearBottom)) continue;
          for (let x = 58; x < 422; x++) {
            const screenX = paper.left - wrapper.left + (x + .5) / 480 * paper.width;
            if (screenX < 0 || screenX > wrapper.width) continue;
            const i = (y * 480 + x) * 4;
            if (Math.abs(composite[i] - previousAmbientPixels[i]) + Math.abs(composite[i + 1] - previousAmbientPixels[i + 1]) + Math.abs(composite[i + 2] - previousAmbientPixels[i + 2]) > 2) changed++;
          }
        }
        window.lastAmbientDifference = { changed, changedAnywhere };
        window.previousAmbientPixels = composite;
        return changed;
      };
    });
    await page.addScriptTag({ content: source });
    await page.evaluate(() => {
      window.resetScene = (family = 'quiet-lake', reducedMotion = false) => {
        window.view?.dispose();
        window.scene = PulseLandscape.create({ seed: 39293, family });
        const paper = document.createElement('canvas'), snapshot = document.createElement('canvas');
        paper.width = paper.height = 800; snapshot.width = snapshot.height = 480;
        PulseLandscape.render(scene, paper, { through: 0 }); snapshot.getContext('2d').drawImage(paper, 0, 0, 480, 480);
        window.emptyAmbientHash = canvasFingerprint(snapshot).hash;
        window.emptyAmbientPixels = snapshot.getContext('2d').getImageData(0, 0, 480, 480).data;
        window.previousAmbientPixels = emptyAmbientPixels;
        paper.width = paper.height = snapshot.width = snapshot.height = 1;
        window.view = PulseLandscape.createView(document.querySelector('main'), scene, { reducedMotion });
      };
      resetScene();
    });
    result.empty = await page.evaluate(() => { advancePaint(12000); return inspectEmergence(); });
    assert.equal(result.empty.stats.updates, 0, 'three minutes of clock time cannot invent a discovery without accepted source');
    assert.equal(result.empty.stats.captionVisible, false, 'empty input produces no invented progress caption');
    assert.equal(result.empty.pixels.length, 2, 'ambient drawing uses exactly two bounded snapshot canvases');
    assert.ok(result.empty.pixels.every(canvas => canvas.width === 480 && canvas.height === 480));

    const short = structuredClone(recording.segments[0]);
    short.points = short.points.filter(point => point.t - short.points[0].t < 2);
    result.short = await page.evaluate(segment => {
      PulseLandscape.append(scene, segment); view.sync(); advancePaint(12000);
      return { ...inspectEmergence(), usableSeconds: scene.usableSeconds };
    }, short);
    assert.ok(result.short.usableSeconds < 3 && result.short.usableSeconds > 0);
    assert.equal(result.short.stats.updates, 0, 'a very short accepted recording stays an honest airy study');

    result.beats = await page.evaluate(segment => {
      resetScene(); PulseLandscape.append(scene, segment); view.sync();
      const source = JSON.stringify(scene), firstBeatAt = segment.beatTimes[0] - segment.points[0].t;
      advancePaint(Math.max(1, Math.floor((firstBeatAt - .12) * 60)));
      const beforeFirstBeat = inspectEmergence(), changes = []; let previousTarget = 0, previousFade = 0;
      for (let i = 0; i < 600; i++) {
        advancePaint(); const state = __pulseLandscapeStats.emergence;
        if (!state.updates) continue;
        const sourceTime = segment.points[0].t + __pulseLandscapeStats.streamTime;
        if (state.lastBeatTime != null && (!segment.beatTimes.includes(state.lastBeatTime) || state.lastBeatTime > sourceTime + 1e-6)) throw Error('Background progress invented or anticipated a beat');
        if (state.target < previousTarget || state.fade < previousFade) throw Error('Deposited background pigment faded backward');
        if (state.target !== previousTarget) changes.push({ target: state.target, beat: state.lastBeatTime });
        previousTarget = state.target; previousFade = state.fade;
      }
      const finished = inspectEmergence(), pending = pendingPaint();
      return { beforeFirstBeat, changes, finished, pending, sourceUnchanged: JSON.stringify(scene) === source };
    }, recording.segments[0]);
    assert.equal(result.beats.beforeFirstBeat.stats.updates, 0, 'accepted terrain waits for its first actual played beat');
    assert.equal(result.beats.changes.length, recording.segments[0].beatTimes.length, 'each real beat advances the pigment target once');
    assert.deepEqual(result.beats.changes.map(change => change.beat), Array.from(recording.segments[0].beatTimes));
    assert.equal(result.beats.finished.stats.target, 1);
    assert.equal(result.beats.finished.stats.fade, 1);
    assert.equal(result.beats.finished.stats.snapshotRequests, 1, 'per-beat progress does not rasterize per beat');
    assert.equal(result.beats.pending, 0, 'settled pigment stops requesting frames');
    assert.ok(result.beats.sourceUnchanged, 'background progress does not modify accepted data');

    result.noBeats = await page.evaluate(segment => {
      resetScene(); PulseLandscape.append(scene, { ...segment, beatTimes: [] }); view.sync(); advancePaint(1200);
      return { ...inspectEmergence(), pending: pendingPaint() };
    }, recording.segments[0]);
    assert.equal(result.noBeats.stats.updates, 0, 'an explicit empty accepted-beat list creates no invented beat progress');
    assert.equal(result.noBeats.stats.snapshotRequests, 0, 'empty beat metadata performs no unnecessary fallback snapshot');
    assert.equal(result.noBeats.pending, 0, 'an empty beat list cannot keep the animation clock running');

    result.legacy = await page.evaluate(segment => {
      resetScene(); const legacy = { ...segment }; delete legacy.beatTimes;
      PulseLandscape.append(scene, legacy); view.sync(); advancePaint(1200);
      return inspectEmergence();
    }, recording.segments[0]);
    assert.equal(result.legacy.stats.updates, 1, 'legacy waveform-only paintings retain a calm time fade');
    assert.equal(result.legacy.stats.beatDriven, false);
    assert.equal(result.legacy.stats.lastBeatTime, null, 'legacy fades do not fabricate beat timestamps');
    assert.equal(result.legacy.stats.fade, 1);

    result.families = await page.evaluate(({ segments, fragmented }) => {
      const results = [];
      const check = (condition, message) => { if (!condition) throw Error(message); };
      for (const family of PulseLandscape.FAMILIES) {
        resetScene(family.id);
        const updates = [], captions = new Set(), visibleGroups = []; let previousUpdate = 0, placement = null, groupStartSeconds = 0, groupVisiblePixels = 0;
        const input = family.id === 'quiet-lake' ? segments : segments.slice(0, 5);
        for (const segment of input) {
          PulseLandscape.append(scene, segment); view.sync();
          const source = JSON.stringify(scene);
          for (let frame = 0; frame < 420; frame++) {
            advancePaint();
            const stats = __pulseLandscapeStats, ambient = stats.emergence;
            check(ambient.strokeCount <= (stats.warmStrokes || 0), `${family.id}: snapshot is ahead of its warmed source`);
            check(ambient.strokeCount <= scene.strokes.length, `${family.id}: snapshot invents accepted source`);
            if (ambient.strokeCount) {
              const prefix = scene.strokes.slice(0, ambient.strokeCount);
              const duration = prefix.reduce((sum, stroke) => sum + stroke.sourceEnd - stroke.sourceStart, 0);
              check(Math.abs(duration - ambient.sourceSeconds) < 1e-6, `${family.id}: background progress includes gaps or clock time`);
              check(Math.abs(prefix.at(-1).sourceEnd - ambient.sourceEnd) < 1e-6, `${family.id}: source endpoint is not the recorded prefix endpoint`);
            }
            if (ambient.captionVisible) {
              check(ambient.updates > 0, `${family.id}: caption precedes any painting addition`);
              check(ambient.caption && document.querySelector('.landscape-discovery')?.textContent.trim() === ambient.caption, `${family.id}: caption does not match actual rendered text`);
              captions.add(ambient.caption);
            }
            if (ambient.updates !== previousUpdate) {
              const snapshot = inspectEmergence();
              snapshot.visibleNewPixels = visibleDiscoveryDelta();
              check(ambient.updates === previousUpdate + 1, `${family.id}: update counters skipped a visible discovery`);
              check(ambient.sourceSeconds >= 3, `${family.id}: discovery appears before usable source threshold`);
              if (updates.length) check(ambient.stage > updates.at(-1).stats.stage && ambient.sourceSeconds >= 3 + 5 * (ambient.stage - 1), `${family.id}: snapshots repeat before the next five-second source milestone`);
              check(snapshot.pixels.some(canvas => canvas.occupied > 0 && canvas.hash !== emptyAmbientHash), `${family.id}: discovery adds no actual painted pixels to empty paper`);
              check(snapshot.pixels.some(canvas => canvas.opaque === 480 * 480 && canvas.hash !== emptyAmbientHash), `${family.id}: snapshot is not backed with opaque paper for a stable crossfade`);
              snapshot.changedPixels = lastAmbientDifference.changedAnywhere;
              check(snapshot.changedPixels > 0, `${family.id}: snapshot ${ambient.stage} has a stale pigment buffer`);
              groupVisiblePixels += snapshot.visibleNewPixels;
              // Five-second additions may land wholly in the intentionally
              // clear foreground corridor. The prior twenty-second discovery
              // contract still requires actual visible background growth.
              if (ambient.sourceSeconds - groupStartSeconds >= 20) {
                check(groupVisiblePixels > 0, `${family.id}: twenty seconds of accepted source adds no pigment outside the foreground quiet mask`);
                visibleGroups.push({ fromSeconds: groupStartSeconds, toSeconds: ambient.sourceSeconds, changedPixels: groupVisiblePixels });
                groupStartSeconds = ambient.sourceSeconds; groupVisiblePixels = 0;
              }
              check(snapshot.opacity <= .6, `${family.id}: background competes with foreground contrast`);
              check(snapshot.finalOpacity === 0, `${family.id}: full-strength final landscape appeared during capture`);
              check(snapshot.mask && snapshot.mask !== 'none', `${family.id}: the live waveform has no quiet masked corridor`);
              check(ambient.clearTop < .45 && ambient.clearBottom > .60, `${family.id}: the clear corridor does not contain the live waveform amplitude and brush margin`);
              if (placement) check(JSON.stringify(snapshot.placement) === JSON.stringify(placement), `${family.id}: the background translated or changed its fixed framing`);
              placement ||= snapshot.placement;
              updates.push(snapshot); previousUpdate = ambient.updates;
            }
          }
          check(JSON.stringify(scene) === source, `${family.id}: animation rewrites accepted source or canonical scene`);
        }
        advancePaint(600);
        const settled = inspectEmergence(); advancePaint(3600);
        const held = inspectEmergence();
        check(JSON.stringify(held.pixels) === JSON.stringify(settled.pixels), `${family.id}: already deposited ambient pigment shifts without new source`);
        check(held.stats.updates === settled.stats.updates, `${family.id}: idle time creates another discovery`);
        check(held.stats.snapshotRequests <= Math.max(0, Math.floor((scene.usableSeconds - 3) / 5) + 1), `${family.id}: per-beat progress exceeds the five-second snapshot budget`);
        check(held.stats.captionVisible === false, `${family.id}: discovery text persists after its quiet interval`);
        check(captions.size <= 4, `${family.id}: too many repeated progress captions`);
        check(held.cachedPixels <= held.pixelBudget && held.pixelBudget <= 3086336, `${family.id}: ambient canvases exceed their fixed budget`);
        results.push({ family: family.id, updates, visibleGroups, captions: [...captions], final: held.stats, usableSeconds: scene.usableSeconds });
      }
      // Delivery gaps contribute no usable duration, even when the recording
      // has hundreds of separate fragments.
      resetScene('quiet-lake');
      for (const segment of fragmented) PulseLandscape.append(scene, segment);
      view.sync(); advancePaint(12000);
      const snapshot = inspectEmergence();
      check(snapshot.stats.sourceSeconds <= scene.usableSeconds + 1e-6, 'fragmented input counts gaps as useful painting time');
      return { scenes: results, fragmented: { ...snapshot, usableSeconds: scene.usableSeconds, strokes: scene.strokes.length } };
    }, { segments: recording.segments, fragmented: fragmented.segments });
    assert.equal(result.families.scenes.length, 16);
    assert.ok(result.families.scenes.every(scene => scene.updates.length > 0), 'all sixteen scenes develop real ambient pigment');
    assert.ok(result.families.scenes[0].updates.length > 0);
    const lake = result.families.scenes.find(scene => scene.family === 'quiet-lake');
    assert.ok(lake.updates.length >= 5, 'a long usable session yields several distinct discoveries');

    result.lifecycle = await page.evaluate(segments => {
      resetScene(); PulseLandscape.append(scene, segments[0]); view.sync();
      for (let i = 0; i < 1200 && !__pulseLandscapeStats.emergence.animating; i++) advancePaint();
      if (!__pulseLandscapeStats.emergence.animating) throw Error('Lifecycle test did not reach an actual ambient crossfade');
      const fadeStart = inspectEmergence(); advancePaint(60); const fadeLater = inspectEmergence();
      view.pause(true); const paused = inspectEmergence();
      PulseLandscape.append(scene, segments[1]); view.sync(); advancePaint(1200);
      const afterPause = inspectEmergence();
      view.pause(false); advancePaint(8);
      Object.defineProperty(document, 'hidden', { value: true, configurable: true }); document.dispatchEvent(new Event('visibilitychange'));
      const hidden = inspectEmergence(); advancePaint(1200); const afterHidden = inspectEmergence();
      delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); advancePaint(600);
      const resumed = inspectEmergence(), sourceBefore = JSON.stringify(scene), finish = view.finish();
      view.cancelFinish();
      const direct = document.createElement('canvas'); direct.width = direct.height = view.canvas.width; PulseLandscape.render(scene, direct);
      const a = view.canvas.getContext('2d').getImageData(0, 0, direct.width, direct.height).data, b = direct.getContext('2d').getImageData(0, 0, direct.width, direct.height).data;
      let max = 0, sum = 0; for (let i = 0; i < a.length; i++) { const delta = Math.abs(a[i] - b[i]); max = Math.max(max, delta); sum += delta; }
      const canonical = { max, mean: sum / a.length, sourceUnchanged: sourceBefore === JSON.stringify(scene), finished: __pulseLandscapeStats.finished };
      view.dispose(); const frames = __pulseLandscapeStats.frames; advancePaint(1200);
      return { fadeStart, fadeLater, paused, afterPause, hidden, afterHidden, resumed, canonical, cleanup: { elements: document.querySelectorAll('.landscape-emergence,.landscape-discovery,.landscape-ink,.landscape-stage').length, pending: pendingPaint(), framesUnchanged: __pulseLandscapeStats.frames === frames, cachedPixels: __pulseLandscapeStats.cachedPixels } };
    }, recording.segments);
    assert.deepEqual(result.lifecycle.fadeLater.pixels, result.lifecycle.fadeStart.pixels, 'the fixed pigment mask and already deposited pixels do not shift during a crossfade');
    assert.deepEqual(result.lifecycle.fadeLater.placement, result.lifecycle.fadeStart.placement);
    assert.ok(result.lifecycle.fadeLater.stats.fade > result.lifecycle.fadeStart.stats.fade, 'the crossfade actually advances while its pixel geometry stays fixed');
    assert.deepEqual(result.lifecycle.afterPause.stats, result.lifecycle.paused.stats, 'pause freezes discovery progress and captions');
    assert.deepEqual(result.lifecycle.afterPause.pixels, result.lifecycle.paused.pixels, 'pause leaves actual deposited pigment unchanged');
    assert.deepEqual(result.lifecycle.afterHidden.stats, result.lifecycle.hidden.stats, 'hidden tabs freeze the background and caption clock');
    assert.deepEqual(result.lifecycle.afterHidden.pixels, result.lifecycle.hidden.pixels, 'hidden tabs spend no ambient raster work');
    assert.ok(result.lifecycle.canonical.sourceUnchanged && result.lifecycle.canonical.finished);
    assert.ok(result.lifecycle.canonical.max <= 1 && result.lifecycle.canonical.mean < .001, 'ambient work does not change canonical finished artwork');
    assert.equal(result.lifecycle.cleanup.elements, 0);
    assert.equal(result.lifecycle.cleanup.pending, 0);
    assert.equal(result.lifecycle.cleanup.framesUnchanged, true);
    assert.ok(result.lifecycle.cleanup.cachedPixels <= 7);

    result.cancel = await page.evaluate(segments => {
      resetScene(); for (const segment of segments.slice(0, 5)) PulseLandscape.append(scene, segment);
      view.sync();
      for (let i = 0; i < 1200 && !__pulseLandscapeStats.emergence.animating; i++) advancePaint();
      const active = __pulseLandscapeStats.emergence.animating && pendingPaint() > 0;
      view.dispose(); const frames = __pulseLandscapeStats.frames; advancePaint(1200);
      return { active, pending: pendingPaint(), framesUnchanged: __pulseLandscapeStats.frames === frames, elements: document.querySelectorAll('.landscape-emergence,.landscape-discovery,.landscape-ink,.landscape-stage').length };
    }, recording.segments);
    assert.deepEqual(result.cancel, { active: true, pending: 0, framesUnchanged: true, elements: 0 }, 'cancelling during a discovery removes its canvases and stops queued warming, fades and captions');

    result.reduced = await page.evaluate(async segments => {
      resetScene('coastal-cliffs', true);
      for (const segment of segments.slice(0, 5)) PulseLandscape.append(scene, segment);
      view.sync(); let animated = false;
      for (let i = 0; i < 1200 && !__pulseLandscapeStats.emergence.captionVisible; i++) { advancePaint(); animated ||= __pulseLandscapeStats.emergence.animating; }
      const snapshot = inspectEmergence(), captionPending = pendingPaint() > 0 && snapshot.stats.captionVisible;
      await view.finish(); advancePaint(1200);
      const final = { mode: __pulseLandscapeStats.mode, opacity: Number(getComputedStyle(document.querySelector('.landscape-stage')).opacity), pending: pendingPaint() };
      view.dispose();
      return { ...snapshot, animated, captionPending, final, pending: pendingPaint() };
    }, recording.segments);
    assert.ok(result.reduced.stats.updates > 0, 'reduced motion still receives real discoveries');
    assert.equal(result.reduced.animated, false, 'reduced motion uses discrete pigment additions');
    assert.equal(result.reduced.captionPending, true, 'reduced-motion finish is exercised while a discovery caption has a pending frame');
    assert.deepEqual(result.reduced.final, { mode: 'finished', opacity: 1, pending: 0 }, 'a pending discovery frame cannot hide the finished painting after reduced-motion completion');
    assert.equal(result.reduced.pending, 0);
    assert.deepEqual(result.errors, []);
    console.log('EMERGING_LANDSCAPE_PASS', JSON.stringify({ engine, scenes: result.families.scenes.length, discoveries: lake.updates.length, canonicalMax: result.lifecycle.canonical.max }));
  } catch (error) {
    result.failure = error.stack || String(error); throw error;
  } finally {
    writeFileSync(path.join(output, `${engine}.json`), `${JSON.stringify(result, null, 2)}\n`);
    await browser?.close();
  }
}
