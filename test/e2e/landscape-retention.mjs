// Isolate the actual impression painter with the visible canvas' default 2D
// context and drawing history. Each observation reads its canvas only once.
// Repeated readbacks or willReadFrequently:true select a different native path
// on some engines and are retained separately as diagnostic stress controls.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, webkit } from 'playwright';
import { replayPublicFixture } from '../landscape-fixture.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const rendererPath = path.resolve(root, process.env.PPG_LANDSCAPE_RENDERER || 'app/landscape.js');
const renderer = readFileSync(rendererPath, 'utf8');
const marker = '  global.PulseLandscape=Object.freeze(';
assert.equal(renderer.split(marker).length, 2);
const observed = renderer.replace(marker, `
  const retentionPool = poolPattern;
  poolPattern = (ctx, scene, stroke) => global.__retentionSolid ? '#000' : retentionPool(ctx, scene, stroke);
  global.__retention = { strokePaint, pulseImpressions, drawPulseImpressions };
${marker}`);
const { segments } = replayPublicFixture(1, 0, 180);
const engines = (process.env.PPG_RETENTION_ENGINES || 'chromium,webkit').split(',');
assert.ok(engines.every(name => ['chromium', 'webkit'].includes(name)));
const out = path.resolve(root, process.env.PPG_RETENTION_ARTIFACTS || '.dream-loop/landscape-retention');
mkdirSync(out, { recursive: true });

for (const name of engines) {
  let browser;
  const result = {
    engine: name, platform: process.platform, architecture: process.arch,
    rendererSha256: createHash('sha256').update(renderer).digest('hex'),
    scope: 'Public-fixture pigment-prefix retention with default-context drawing history; isolated painter correctness, not performance or physical-device evidence.',
    thresholds: { maximumAlphaLoss: 0 }, errors: [], cases: [], failures: [],
  };
  try {
    browser = await (name === 'webkit' ? webkit : chromium).launch(name === 'chromium' && process.platform === 'darwin' ? { channel: 'chrome' } : {});
    result.browserVersion = browser.version();
    const page = await browser.newPage();
    page.on('pageerror', error => result.errors.push(String(error)));
    await page.setContent('<body></body>');
    await page.addScriptTag({ content: observed });
    Object.assign(result, await page.evaluate(segments => {
      const result = { cases: [], comparisons: 0, maxAlphaLoss: 0, alphaLossPixels: 0, failures: [] };
      for (const seed of [39293, 17]) for (const side of [800, 1080]) for (const solid of [true, false]) {
        const scene = PulseLandscape.create({ seed, family: 'quiet-lake' });
        segments.forEach(segment => PulseLandscape.append(scene, segment));
        const serialized = JSON.stringify(scene);
        const water = scene.strokes.map((stroke, index) => ({ stroke, index }))
          .filter(({ stroke }) => stroke.role === 'water' && !stroke.material.underpaint);
        const selected = [water[0], water[2], water.at(-1)];
        if (selected.some(item => !item)) throw Error('Public recording no longer covers early and late water impressions');
        const report = { seed, side, solid, strokes: [], comparisons: 0, maxAlphaLoss: 0, alphaLossPixels: 0 };
        for (const { stroke, index } of selected) {
          const paint = __retention.strokePaint(stroke);
          const chunks = __retention.pulseImpressions(stroke, paint);
          const stops = [stroke.sourceStart, stroke.sourceStart + 1e-8,
            ...chunks.flatMap(chunk => [chunk.start, chunk.items[Math.floor(chunk.items.length / 2)].t,
              chunk.items[Math.max(0, chunk.items.length - 2)].t, chunk.end - 1e-8, chunk.end, chunk.end + 1e-8]),
            stroke.sourceEnd]
            .filter(t => t >= stroke.sourceStart && t <= stroke.sourceEnd + 1e-8).sort((a, b) => a - b);
          const unique = [...new Set(stops)];
          let previous;
          for (let target = 0; target < unique.length; target++) {
            globalThis.__retentionSolid = solid;
            const canvas = document.createElement('canvas');
            canvas.width = canvas.height = side;
            const ctx = canvas.getContext('2d');
            // Replay persistent frame history, but defer observation until its
            // final frame. This avoids changing the tested context by reading it.
            for (let frame = 0; frame <= target; frame++) {
              ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, side, side);
              ctx.setTransform(side / 1080, 0, 0, side / 1080, 0, 0);
              ctx.globalCompositeOperation = 'multiply';
              __retention.drawPulseImpressions(ctx, scene, stroke, paint, .6, unique[frame]);
            }
            const pixels = ctx.getImageData(0, 0, side, side).data;
            canvas.width = canvas.height = 1;
            if (previous) {
              let loss = 0, count = 0;
              for (let offset = 3; offset < pixels.length; offset += 4) {
                const delta = previous[offset] - pixels[offset];
                if (delta > 0) { loss = Math.max(loss, delta); count++; }
              }
              result.comparisons++; report.comparisons++;
              result.maxAlphaLoss = Math.max(result.maxAlphaLoss, loss);
              report.maxAlphaLoss = Math.max(report.maxAlphaLoss, loss);
              result.alphaLossPixels += count; report.alphaLossPixels += count;
              if (loss && result.failures.length < 30) result.failures.push({ seed, side, solid, stroke: index, stop: unique[target], loss, count });
            }
            previous = pixels;
          }
          report.strokes.push(index);
        }
        if (JSON.stringify(scene) !== serialized) throw Error('Painting changed accepted source data');
        result.cases.push(report);
      }
      return result;
    }, segments));
    assert.deepEqual(result.errors, []);
    assert.equal(result.maxAlphaLoss, 0, 'advancing the measured source prefix retains all previously painted alpha');
    result.passed = true;
  } catch (error) {
    result.failure = String(error.stack || error);
    process.exitCode = 1;
  } finally {
    await browser?.close();
    writeFileSync(path.join(out, `${name}.json`), JSON.stringify(result, null, 2));
    console.log(JSON.stringify({ engine: name, passed: !!result.passed, comparisons: result.comparisons,
      maxAlphaLoss: result.maxAlphaLoss, alphaLossPixels: result.alphaLossPixels, failure: result.failure, out }));
  }
}
