import assert from 'node:assert/strict';
import { createCapturePerformance, attachCapturePerformanceLog } from '../app/capture-performance.js';

const frame = (interval, work = 1) => ({ frameIntervalMs: interval, frameMs: work, rendererVersion: 'test-renderer', liveRecords: 12, queuedSeconds: 5.25, rasterBackend: 'worker' });
const capture = createCapturePerformance({ startedAt: 100, modelVersion: 'landscape-test' });
for (let i = 0; i < 600; i++) {
  const now = 100 + i * 1000 / 60;
  capture.recordCamera(now + .1, i / 60);
  // Browser rAF timestamps can precede camera deliveries in the same frame.
  capture.recordFrame(now, frame(i ? 1000 / 60 : null));
}
for (let i = 0; i < 100; i++) {
  const now = 10_100 + i * 100;
  capture.recordCamera(now + .1, 10 + i / 10);
  capture.recordFrame(now, frame(100, 8));
}
capture.stop(20_100);
const result = capture.snapshot();
assert.equal(result.bins.length, 2);
assert.equal(result.bins[0].cameraCallbacks, 600);
assert.equal(result.bins[0].renderFrames, 600);
assert.equal(result.bins[0].processedCameraSource.rateHz, 60);
assert.equal(result.bins[0].cameraDelivery.rateHz, 60);
assert.equal(result.bins[0].rendererCadence.rateHz, 60);
assert.equal(result.bins[0].rendererCadence.p95UpperBoundMs, 16.67);
assert.equal(result.bins[1].rendererCadence.rateHz, 10);
assert.equal(result.bins[1].rendererCadence.above50Ms, 100);
assert.equal(result.bins[1].rendererWork.meanMs, 8);
assert.equal(result.rendererVersion, 'test-renderer');
assert.equal(result.modelVersion, 'landscape-test');
assert.equal(result.appBuild, null);
assert.equal(result.elapsedMs, 20_000);
assert.equal(result.stopped, true);
assert.equal(result.bins[0].maxLiveRecords, 12);
assert.equal(result.bins[0].maxQueuedSeconds, 5.25);
capture.recordFrame(22_000, frame(1000));
capture.recordCamera(22_000, 30);
assert.deepEqual(capture.snapshot(), result, 'stopped capture cannot absorb reveal or late callbacks');

const recovery = createCapturePerformance({ startedAt: 0 });
recovery.recordCamera(0, 0);
recovery.recordFrame(0, frame(null));
recovery.recordCamera(20, .02);
recovery.recordFrame(20, frame(20));
recovery.setVisible(false, 25);
recovery.recordCamera(1000, 1);
recovery.recordFrame(1000, frame(980));
recovery.setVisible(true, 10_000);
recovery.recordCamera(10_010, 10.01);
recovery.recordFrame(10_010, frame(9990));
recovery.recordCamera(10_030, 10.03);
recovery.recordFrame(10_030, frame(20));
// An intentional source wait resets the renderer's anchor without visibility.
recovery.recordFrame(15_000, frame(null));
recovery.recordFrame(15_020, frame(20));
const recovered = recovery.snapshot();
assert.equal(recovered.visibilityResets, 2);
assert.equal(recovered.bins[0].cameraCallbacks, 2);
assert.equal(recovered.bins[1].processedCameraSource.count, 1);
assert.equal(recovered.bins[1].processedCameraSource.meanMs, 20);
assert.equal(recovered.bins[1].rendererCadence.count, 2);
assert.equal(recovered.bins[1].rendererCadence.maxMs, 20, 'hidden time and intentional source waits are not frame stalls');
assert.equal(recovered.bins[1].renderIntervalResets, 2);

const bounded = createCapturePerformance({ startedAt: 0, collectionStartedAt: 500 });
for (let i = 0; i < 1000; i++) bounded.recordCamera(i * 10_000 + 500, i * 10);
const capped = bounded.snapshot();
assert.equal(capped.bins.length, 60);
assert.equal(capped.droppedBins, 940);
assert.equal(capped.bins[0].startMs, 9_400_000);
assert.equal(capped.observedFromMs, 500);
bounded.recordFrame(NaN, frame(10));
bounded.recordCamera(Infinity, 0);
bounded.recordCamera(-1, 0);
bounded.recordFrame(0, frame(10));
assert.deepEqual(bounded.snapshot(), capped, 'malformed or evicted times cannot grow or revive old bins');
capped.bins[0].processedCameraSource.count = -5;
assert.notEqual(bounded.snapshot().bins[0].processedCameraSource.count, -5, 'snapshots cannot mutate aggregates');

const invalid = createCapturePerformance({ startedAt: 0 });
invalid.recordCamera(0, 1);
invalid.recordCamera(10, 1);
invalid.recordCamera(20, .9);
invalid.recordCamera(30, 1.03);
invalid.recordCamera(40, NaN);
invalid.recordCamera(50, 1.05);
assert.equal(invalid.snapshot().bins[0].invalidSourceIntervals, 3);
assert.equal(invalid.snapshot().bins[0].processedCameraSource.count, 1);
assert.equal(invalid.snapshot().bins[0].processedCameraSource.maxMs, 30);

// Preserve vendor fields, method binding and both persistence/download callers.
const vendorLog = { meta: { appVersion: '0.3.1' }, samples: [{ t: 0 }], windows: [], events: [], droppedFrames: 17 };
const monitor = {
  marker: 'correct instance',
  getDebugLog() { assert.equal(this.marker, 'correct instance'); return vendorLog; },
  downloadDebugLog() { return JSON.stringify(this.getDebugLog()); },
  persistLastLog() { return JSON.stringify(this.getDebugLog()); },
};
assert.equal(attachCapturePerformanceLog(monitor, capture), true);
const enriched = monitor.getDebugLog();
for (const key of Object.keys(vendorLog)) assert.strictEqual(enriched[key], vendorLog[key]);
assert.deepEqual(enriched.pulsePaintingPerformance, result);
assert.equal(Object.hasOwn(vendorLog, 'pulsePaintingPerformance'), false);
assert.deepEqual(JSON.parse(monitor.downloadDebugLog()), JSON.parse(monitor.persistLastLog()));
assert.equal(attachCapturePerformanceLog(monitor, null), false, 'missing optional helper/collector is a no-op');
assert.equal(attachCapturePerformanceLog({}, capture), false, 'monitor doubles without debug export still capture');
const failingDiagnostics = { getDebugLog: () => vendorLog };
attachCapturePerformanceLog(failingDiagnostics, { snapshot() { throw new Error('optional diagnostics failed'); } });
assert.strictEqual(failingDiagnostics.getDebugLog(), vendorLog, 'diagnostic failure must preserve original export');

console.log('Capture performance aggregates: cadence, bounded memory, lifecycle resets and existing debug exports passed.');
