// Local debug-log aggregates only. No raw waveform, physiology, identifiers,
// network requests, observers, or animation loop are retained here.
const BIN_MS = 10_000;
const MAX_BINS = 60;
const LIMITS = [8.34, 16.67, 25, 33.34, 50, 66.67, 100, 150, 250, 500, 1000, Infinity];
const finite = Number.isFinite;
const round = value => Math.round(value * 100) / 100;
const label = value => typeof value === 'string' ? value.slice(0, 96) : null;
const aggregate = () => ({ count: 0, sum: 0, max: 0, over50: 0, histogram: new Uint32Array(LIMITS.length) });
function add(aggregate, value) {
  if (!finite(value) || value < 0) return;
  aggregate.count++; aggregate.sum += value; aggregate.max = Math.max(aggregate.max, value);
  if (value > 50) aggregate.over50++;
  let index = 0;
  while (value > LIMITS[index]) index++;
  aggregate.histogram[index]++;
}
function summarize(aggregate, cadence = false) {
  let cumulative = 0, upper = null;
  if (aggregate.count) {
    for (let i = 0; i < LIMITS.length; i++) {
      cumulative += aggregate.histogram[i];
      if (cumulative >= Math.ceil(aggregate.count * .95)) {
        upper = finite(LIMITS[i]) ? LIMITS[i] : null; break;
      }
    }
  }
  return {
    count: aggregate.count,
    meanMs: aggregate.count ? round(aggregate.sum / aggregate.count) : null,
    maxMs: aggregate.count ? round(aggregate.max) : null,
    p95UpperBoundMs: upper,
    above50Ms: aggregate.over50,
    ...(cadence ? { rateHz: aggregate.sum > 0 ? round(aggregate.count * 1000 / aggregate.sum) : null } : {}),
  };
}

export function createCapturePerformance({ startedAt, collectionStartedAt = startedAt, visible = true, modelVersion = null, appBuild = null } = {}) {
  if (!finite(startedAt) || !finite(collectionStartedAt)) throw new TypeError('A monotonic capture start is required');
  const bins = new Map();
  let lastNow = Math.max(startedAt, collectionStartedAt), stoppedAt = null;
  let previousCameraTime = null, previousCameraDelivery = null, resetRenderInterval = true;
  let visibilityResets = 0, droppedBins = 0, rendererVersion = null;
  function bucket(now) {
    if (stoppedAt !== null || !visible || !finite(now) || now < startedAt) return null;
    // rAF timestamps describe the frame start and can precede a camera delivery
    // already received during that same frame. Do not discard either stream.
    lastNow = Math.max(lastNow, now);
    const index = Math.floor((now - startedAt) / BIN_MS);
    let bin = bins.get(index);
    if (!bin) {
      if (bins.size === MAX_BINS) {
        const oldest = Math.min(...bins.keys());
        if (index < oldest) return null;
        bins.delete(oldest); droppedBins++;
      }
      bin = {
        index, firstMs: now - startedAt, lastMs: now - startedAt,
        cameraCallbacks: 0, invalidSourceIntervals: 0, renderFrames: 0, renderIntervalResets: 0,
        source: aggregate(), delivery: aggregate(), raf: aggregate(), work: aggregate(),
        maxLiveRecords: null, maxQueuedSeconds: null, rasterBackend: null,
      };
      bins.set(index, bin);
    }
    bin.firstMs = Math.min(bin.firstMs, now - startedAt);
    bin.lastMs = Math.max(bin.lastMs, now - startedAt);
    return bin;
  }
  function resetAnchors() {
    previousCameraTime = null; previousCameraDelivery = null; resetRenderInterval = true;
  }
  return {
    recordCamera(now, sourceTimeSeconds) {
      const bin = bucket(now);
      if (!bin) return;
      bin.cameraCallbacks++;
      if (previousCameraDelivery !== null) add(bin.delivery, now - previousCameraDelivery);
      previousCameraDelivery = now;
      if (!finite(sourceTimeSeconds)) { bin.invalidSourceIntervals++; previousCameraTime = null; return; }
      if (previousCameraTime !== null) {
        const interval = (sourceTimeSeconds - previousCameraTime) * 1000;
        if (interval > 0) add(bin.source, interval);
        else { bin.invalidSourceIntervals++; return; }
      }
      previousCameraTime = sourceTimeSeconds;
    },
    recordFrame(now, stats) {
      const bin = bucket(now);
      if (!bin || !stats) return;
      bin.renderFrames++;
      // The renderer supplies null when restarting after pause or waiting for
      // source data. A gap between callbacks is not itself a dropped frame.
      if (!resetRenderInterval && finite(stats.frameIntervalMs) && stats.frameIntervalMs > 0) add(bin.raf, stats.frameIntervalMs);
      else bin.renderIntervalResets++;
      resetRenderInterval = false;
      add(bin.work, stats.frameMs);
      if (finite(stats.liveRecords) && stats.liveRecords >= 0) bin.maxLiveRecords = Math.max(bin.maxLiveRecords ?? 0, stats.liveRecords);
      if (finite(stats.queuedSeconds) && stats.queuedSeconds >= 0) bin.maxQueuedSeconds = Math.max(bin.maxQueuedSeconds ?? 0, stats.queuedSeconds);
      if (typeof stats.rasterBackend === 'string') bin.rasterBackend = label(stats.rasterBackend);
      if (typeof stats.rendererVersion === 'string') rendererVersion = label(stats.rendererVersion);
    },
    setVisible(nextVisible, now) {
      if (stoppedAt !== null || !finite(now) || now < lastNow) return;
      lastNow = now;
      if (visible !== !!nextVisible) { visibilityResets++; resetAnchors(); }
      visible = !!nextVisible;
    },
    stop(now) {
      if (stoppedAt !== null) return;
      stoppedAt = finite(now) ? Math.max(lastNow, now) : lastNow;
      resetAnchors();
    },
    snapshot() {
      return {
        schemaVersion: 1,
        appBuild: label(appBuild), modelVersion: label(modelVersion), rendererVersion,
        scope: 'Capture only; camera cadence is processed callbacks, not sensor FPS. Renderer cadence excludes intentional restarts. Work is JS submission time, not GPU completion.',
        intervalMs: BIN_MS, maxBins: MAX_BINS, droppedBins,
        observedFromMs: round(Math.max(0, collectionStartedAt - startedAt)),
        elapsedMs: round((stoppedAt ?? lastNow) - startedAt),
        stopped: stoppedAt !== null, visibilityResets,
        bins: [...bins.values()].sort((a, b) => a.index - b.index).map(bin => ({
          startMs: bin.index * BIN_MS, endMs: (bin.index + 1) * BIN_MS,
          firstObservedMs: round(bin.firstMs), lastObservedMs: round(bin.lastMs),
          cameraCallbacks: bin.cameraCallbacks, invalidSourceIntervals: bin.invalidSourceIntervals,
          processedCameraSource: summarize(bin.source, true), cameraDelivery: summarize(bin.delivery, true),
          renderFrames: bin.renderFrames, renderIntervalResets: bin.renderIntervalResets,
          rendererCadence: summarize(bin.raf, true), rendererWork: summarize(bin.work),
          maxLiveRecords: bin.maxLiveRecords,
          maxQueuedSeconds: bin.maxQueuedSeconds === null ? null : round(bin.maxQueuedSeconds),
          rasterBackend: bin.rasterBackend,
        })),
      };
    },
  };
}

// Both vendor downloadDebugLog() and its existing local last-session persistence
// call this public method. Append here without touching the immutable vendor,
// adding a second persistence path, or walking its private log on every frame.
export function attachCapturePerformanceLog(monitor, collector) {
  if (typeof monitor?.getDebugLog !== 'function' || typeof collector?.snapshot !== 'function') return false;
  const original = monitor.getDebugLog;
  monitor.getDebugLog = function (...args) {
    const log = original.apply(this, args);
    try {
      if (log && typeof log === 'object') return { ...log, pulsePaintingPerformance: collector.snapshot() };
    } catch { /* Optional diagnostics must never prevent saving the original log. */ }
    return log;
  };
  return true;
}
