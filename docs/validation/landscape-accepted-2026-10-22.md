# Accepted Pulse Painting landscape candidate

The user accepted the publicly hosted Quiet Lake V18-combined study with **Keep**.
Its pigment treatment is integrated across all sixteen scene families. The
original measured samples, timestamps, quality attribution and usable-time
density remain unchanged. Independent visual review passed at 8/10; subsequent
raster consistency changes retain that visible treatment. A mirrored Coastal
Cliffs taper bug is corrected and covered by a negative-control regression.

The final renderer under verification has SHA-256
`a84ebe6772a518e2e9d44e6db5d2f30392a75e488884bbfa4e606765a78384d8`.
The source and generated gallery provenance must match this hash before release.

## Rendering consistency

Stable Canvas2D contexts and fixed-rectangle texture clipping preserve the
existing four-raster live budget and pigment budget. The preceding layer-only
candidate passed all 96 macOS cases in both engines. Extending its Linux check
exposed one Coastal Cliffs early-frame edge mismatch; the final all-surface
candidate fixes the targeted case exactly and also passes the previously
sensitive River Valley case. The final broad matrix remains pending.

The strict isolated-painter zero-alpha-loss diagnostic remains **failed** with
its unchanged zero threshold. It observes the actual output context
(`willReadFrequently: true`) and reuses that choice for transparent prefix-history
canvases. Across 672 comparisons per engine, Chromium's solid control had maximum
9 alpha levels lost across 245 pixel observations, and textured pigment maximum
6 across 152; WebKit's maxima were 1 across 5 and 6 observations respectively.
The earlier default-context result is not substituted for these measurements.

This is isolated transparent painter rasterization, not a source-sample loss or
a demonstrated visible defect in the full opaque app. Source geometry remains
unchanged. No exact-alpha-retention claim is made, and no threshold was widened.
The unchanged diagnostic criterion, scope and failures are preserved in
[the detailed raster record](landscape-raster-parity.md).

## Release verification

GitHub CI run `39895956213` passed the complete default suite on source commit
`b9c1b294a0fbd8204febc81ab8e0fb2358437e87` in the official Playwright Linux image.
It covers model/source fidelity, all-family lifecycle, the focused real-recording
compositor regression, app/report/export behavior, fallback rendering and gallery.

### Real-time WebKit session

Completed at `2026-10-23T03:41:14.371Z`, using WebKit 26.6 and iPhone 13 browser
emulation with the public `iphone-200s.json` recording. Quiet Lake seed 39293
was fixed in the test harness; production scene choice remains random.

- Automatic completion after **180.434 seconds of fresh measurement** over
  209.871 seconds wall time. The fixture's last 60 seconds were repeated with
  monotonic timestamps to supply the extra recorded input needed after pauses.
- Camera-frame pause (4 seconds), deliberate main-thread stall (2.5 seconds)
  and simulated visibility interruption (4 seconds) each credited **zero stale
  time** on recovery. Expired input was dropped rather than replayed in a burst.
- Active painting: **59.85 fps**, p95 19 ms, maximum 98 ms, 11 intervals over
  33 ms. The deliberately imposed stall is reported separately.
- 33 accepted windows produced 65 strokes from 157.28 usable seconds. The
  completed landscape exactly matched the square scene in the shared portrait.
- Report: 71 bpm, RMSSD 54.0 ms, SDNN 51.5 ms, 193 accepted beats; graph labels
  remained inside their canvases at 320 CSS pixels.
- 1080 × 1350 artwork and 1200 × 5920 original manuscript exported. Encoder and
  renderer failure/retry paths recovered with the same source and scene seed;
  the encoder retry retained identical artwork pixels.
- No app/console errors or first-party request failures.

Raw session evidence: `.dream-loop/accepted-material/safari/result.json`.

### Dense capture performance

A separate Chromium mobile-viewport run preloaded 150 seconds of recording and
streamed 20 seconds at normal cadence. Four cases used WebGPU/WebGL2 entry
compositors and 1×/4× CPU throttling. Active painting measured 60.00/59.85 fps at
1× and 57.39/57.44 fps at 4×. All p95 intervals were 16.7–16.8 ms; the longest
was 50 ms. Entry transitions were approximately 60 fps. Live raster allocation
remained 2,560,000 pixels and material allocation 4,489,216 pixels.
Raw evidence: `.dream-loop/accepted-material/performance-late/results.json`.

These are desktop browser replay results with mocked camera/share APIs. They do
not establish physical-phone camera, thermal, physiological or native-share
acceptance. Hosted asset verification remains pending; the main product remains
unchanged until the production deployment and public checks succeed.
