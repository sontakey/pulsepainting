// This worker owns the canonical raster canvases. The main thread keeps at
// most one request in flight, so accepted strokes stay ordered without an
// unbounded queue competing with the live brush animation.
let raster = null;
let count = 0;
let failed = false;

function reportError() {
  failed = true;
  // Do not send recording data or internal error details across this boundary.
  try { self.postMessage({ type: 'error' }); } catch { /* The owner may have disposed the worker. */ }
}

function send(message, bitmap) {
  try {
    self.postMessage(message, bitmap ? [bitmap] : []);
  } catch {
    // A failed transfer still leaves ownership here; release its pixel storage.
    bitmap?.close();
    reportError();
  }
}

try {
  importScripts('./landscape.js');
} catch {
  reportError();
}

self.onmessage = ({ data }) => {
  if (failed) return;
  try {
    if (data?.type === 'paint') {
      const started = performance.now();
      if (!raster) {
        if (!data.scene) throw new Error('Missing scene');
        raster = self.PulseLandscape.createRaster({ ...data.scene, strokes: [] }, 800);
      }
      // Append only the accepted descriptor supplied by the main thread.
      raster.append(data.stroke);
      count += 1;
      const bitmap = data.snapshot ? raster.snapshot(data.snapshot) : undefined;
      send({
        type: 'painted',
        snapshot: data.snapshot,
        ...(bitmap ? { bitmap } : {}),
        count,
        durationMs: performance.now() - started,
        materialPixels: raster.materialPixels,
        cachedPixels: raster.cachedPixels,
      }, bitmap);
    } else if (data?.type === 'snapshot') {
      if (!raster) throw new Error('Missing raster');
      const bitmap = raster.snapshot();
      send({ type: 'snapshot', bitmap, count }, bitmap);
    }
  } catch {
    reportError();
  }
};
