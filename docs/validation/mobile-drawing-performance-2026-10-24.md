# Mobile drawing performance

## Status

**In validation; not yet a production release.** The baseline below is measured.
Final candidate measurements, complete regression results, source identities and
deployment verification remain pending. Early diagnostic runs do not establish
the performance or correctness of the final candidate.

## Problem and implementation

The live brush could appear smooth on average while an individual watercolor
deposit blocked the main thread long enough to cause a visible hitch. Previously,
an idle callback baked one complete canonical stroke synchronously. Its nominal
zero-millisecond loop budget still permitted the entire stroke, including texture
creation, clipped washes and reflection work. The callback also prepared softened
ambient snapshots. Ordinary animation-frame submission measurements excluded
this work.

The candidate moves canonical watercolor preparation and ambient snapshot
softening into a dedicated worker when Worker and OffscreenCanvas are available.
The worker loads the same landscape renderer from its sibling URL, preserving
deployment beneath a content-hashed directory or subdirectory. It receives only
accepted stroke descriptors and the existing scene plan. The main thread permits
one request in flight, preserving stroke order without an accumulating message
queue. This is local browser processing; no recording is uploaded by this path.

During capture, the worker returns infrequent 480-square ambient ImageBitmaps.
The main thread copies and closes them, then crossfades the existing two ambient
canvases. It does not blur, generate pigment textures or reconstruct the landscape
on every animation frame. Finish requests the complete 800-square painting and
waits for all accepted strokes before settling the reveal. The worker is
terminated when its work is complete or its view is disposed.

The foreground remains a vector drawing with the existing pointed brush tip,
crisp PPG core, fixed pigment deposits and continuous source-time motion. Two
monotonic cursors restrict SVG updates to the visible six-second window.
Completed clipping bounds and unchanged attributes are retained rather than
rewritten every frame. Source points, interpolation, quality gating and source
timestamps are not reduced to improve the frame rate.

The Three.js entry transition remains separate from the capture renderer.
Capture uses SVG for the foreground and Canvas 2D for cached watercolor; a
reported WebGL2 or WebGPU backend describes the entry compositor, not a claim
that the PPG drawing executes through that backend.

## Artwork consistency and source preservation

The worker and export renderer share the same pigment code, scene mapping,
deterministic material noise and layer-compositing order. Consuming each layer
between writes remains intentional: removing those intermediate reads can change
rasterization cadence and translucent edge rounding.

The candidate uses a common raster-layer factory for worker, preview and export.
It prefers supported OffscreenCanvas 2D layers and retains DOM canvas fallback.
Both execution contexts also request `willReadFrequently` for the grain atlas
and pigment-pattern contexts. Standardizing layer types resolved the initial
Chromium mismatch; matching these two material-context hints resolved the
remaining full Quiet Lake mismatch. These are native raster changes, not changes
to the recorded points or terrain geometry.

The original zero-difference worker-to-export criterion **failed in WebKit**.
The bounded diagnostic used 800 × 800 output, seed 39293, six accepted segments
in 15 families, and the full 59-stroke recording in Quiet Lake. Chromium
155.0.8059.85 matched exactly in all 16 cases. WebKit 26.6 matched exactly in
13 cases, including full Quiet Lake, with the following residuals. Differences
are raw 8-bit channel levels; each comparison contains 2,560,000 RGBA channels.

| WebKit scene, short diagnostic | Maximum channel difference | Mean channel difference | Changed channels |
| --- | ---: | ---: | ---: |
| Coastal Cliffs | 5 / 255 | 0.048455859375 / 255 | 106,143 |
| River Valley | 5 / 255 | 0.013330859375 / 255 | 27,164 |
| Glacial Fjord | 5 / 255 | 0.01910859375 / 255 | 38,902 |

The expanded full-recording matrix uses all 59 strokes in **every** family.
Chromium has passed all 16 with exact pixels, plus lifecycle, fallback and
resource checks. Full-recording Coastal Cliffs in WebKit reached a maximum
difference of 6 / 255 and a mean of approximately 0.0418789 / 255. The final
full-recording WebKit matrix is still pending; the short diagnostic must not be
presented as full-recording coverage.

The release criterion is now explicitly **maximum channel difference ≤ 8 / 255
and mean channel difference ≤ 0.1 / 255**, only for worker-to-export comparisons
of these three WebKit families. All other scene comparisons and same-thread
fallback/lifecycle comparisons retain exact pixel equality. This is a bounded
artwork-equivalence acceptance decision after a failed exact-pixel test, not a
claim that byte equality was fixed. Source samples and scene descriptors remain
subject to exact identity checks independently of this visual criterion.

ImageBitmap transport itself matched exactly. All emitted RGBA color strings
also matched across contexts in all 16 diagnostic cases, including 620 color
commands for Coastal Cliffs and 623 each for River Valley and Glacial Fjord.
This is not a complete trace of every path, transform and drawing-state command.
The residuals are consistent with native raster behavior, but the precise cause
is **unproven**; prior-family render history affected whether they appeared.

Isolated probes did not eliminate the residuals: worker full versus incremental
rendering; no, ambient or final snapshots between strokes; event-loop yields;
forced material/layer readbacks; fresh renderer/scene copies; clearing prior
material inks; removing redundant canvas resizes; broader CPU context hints;
color-rounding tie handling; and OffscreenCanvas pigment tiles or separate
offscreen grain atlases. Transferring DOM layers also did not fix the initial
Chromium layer mismatch, and worker-only material hints worsened that mismatch.
These were diagnostic variants, not additional production changes. No claim is
made that every probe covered every family or the full recording.

Ignored diagnostic evidence is under `.dream-loop/raster-worker/`: the
`probe-materials-only-all` Chromium result, `matrix-two-line` WebKit result,
`matrix-color-trace`, and the unsuccessful `matrix-all-cpu`, `matrix-fresh-inks`,
`matrix-no-reset`, `matrix-tie-round`, `matrix-offscreen-patterns` and
`matrix-offscreen-grain` variants. Some diagnostic scripts continued after
recording `pixelFailures`; their completion does not mean the strict pixel gate
passed. These stepped correctness runs do not measure capture FPS or validate
physical-phone behavior.

This document does not claim that previous-release images remain byte-identical.
Any gallery regeneration must be tied to the final renderer hash and inspected
separately.

Original measured waveform samples remain available independently of the
artistic terrain projection. Neither the worker nor the SVG update optimization
manufactures accepted beats, joins rejected intervals or changes the stopped
measurement clock during the reveal.

## Fallback and lifecycle behavior

- Unsupported workers, unsupported offscreen rendering, worker startup errors,
  runtime errors and a nonresponding worker use the main-thread raster fallback.
  This retains the artwork, but does not promise the same performance benefit on
  older browsers.
- The worker response watchdog runs only while active and visible. Pause and
  hidden states hold it so a suspended tab is not mistaken for a failed worker.
  No new raster request is queued while paused or hidden.
- Worker identity checks reject stale responses after termination or fallback.
  Discarded, replaced and consumed ImageBitmaps are explicitly closed.
- Finish drops unused ambient snapshots and ignores late ambient transfers.
  Immediate hidden, reduced-motion or cancelled-reveal completion can rebuild
  synchronously from the accepted scene rather than leave completion pending.
- Disposal terminates worker work, clears timers and animation/idle callbacks,
  removes observers/listeners and releases presentation canvases. Source data
  remains owned by the existing recording/report flow.

These are implementation contracts awaiting final regression verification, not
claims of completed physical-phone testing.

## Storage bounds

The current worker path conservatively budgets **4,662,275 presentation pixels**:
the worker's three canonical layers and output, the main final canvas, one
full-size transfer, three ambient canvases, two grain canvases and three
one-pixel fallback placeholders. Pending ambient transfers are closed before a
final full-size transfer is retained. The presentation allocation does not grow
with recording duration. Normal worker completion retains 1,166,339 presentation
pixels until the view is disposed; disposal reduces its seven main canvases to
one pixel each.

Main-thread fallback retains the earlier 3,086,336-pixel presentation bound.
Each execution context's pigment atlas has an independent bounded LRU. The
combined material budget is **9,109,504 pixels** while a worker exists, accounting
for a main-document atlas that may remain after an earlier report/export and the
worker's atlas. Termination releases the worker atlas. This second-recording
case must be covered; first-session measurements alone miss it.

These figures describe renderer-managed backing surfaces and the conservative
material-pattern accounting in its statistics. They are not measurements or
upper bounds for total browser, compositor, driver or device memory.

## Baseline: measured before the change

Evidence: ignored
`.dream-loop/mobile-drawing-performance/baseline-paired/results.json`, generated
at `2026-10-24T16:38:48.204Z`. The frozen baseline renderer SHA-256 is
`7d1d2abb53ee40e7d8c9fcab773aefdc7fb749c77cbf10494d93a8e190e8cba1`.

The run used Node v24.21.0, Chrome 155.0.8059.85 on an Apple M4 Mac, a
390 × 844 viewport at device scale factor 3, and a requested and observed WebGL2
entry backend. CPU slowdown was 4×. Quiet Lake used seed 39293. The replay
preloaded 40 seconds of the already-public fixture and measured another 45
seconds of real-time delivery with mocked camera I/O. It fed 2,561 samples and
ended with 21 accepted scene strokes. Cases are measured sequentially to avoid
competing browser workloads.

| Baseline measurement | Result |
| --- | ---: |
| Active painting FPS | 59.73 |
| Active painting p95 frame interval | 16.8 ms |
| Active painting maximum frame interval | 100.0 ms |
| Active painting intervals over 25 ms / over 33 ms | 7 / 3 |
| Main-thread watercolor callback median | 27.7 ms |
| Main-thread watercolor callback p95 | 66.4 ms |
| Main-thread watercolor callback maximum | 112.2 ms |
| Animation submission p95 / maximum | 0.8 / 4.5 ms |
| Final reveal FPS / maximum interval | 59.83 / 33.4 ms |

The near-60 average did not rule out visible pauses. Watercolor callbacks
occasionally consumed several 16.7 ms frame budgets even though the foreground
submission itself was inexpensive. The replay observed zero source regressions,
future foreground samples or future background samples, and zero page/console
errors. These findings motivate moving the expensive work; they do not prove
the final candidate's improvement.

## Final candidate verification: pending

Record the final source commit, renderer and worker SHA-256 values, build
identity and exact evidence directories here before release.

| Release check | Status |
| --- | --- |
| Matched 45-second 4× baseline/candidate comparison | Pending final candidate |
| Normal-speed and additional slower-device browser cases | Pending |
| Late-session/full-density drawing and reveal measurements | Pending |
| Chromium and WebKit worker/export pixel parity across all 16 scenes | Pending |
| Worker unsupported, construction failure, error and timeout fallbacks | Pending |
| Pause, hidden recovery, reduced motion, cancellation and disposal | Pending |
| Second recording after report/export and resource bounds | Pending |
| Full three-minute WebKit session with interruption/recovery | Pending |
| App, source-provenance, gallery and sharing regressions | Pending |
| Final gallery assets and manifest tied to the frozen renderer | Pending |
| GitHub CI, merge and production deployment | Pending |
| Anonymous hosted mobile checks and deployed asset hashes | Pending |

## Limits

Browser replay exercises the real engine and acceptance adapter against an
already-public fixture, with mocked camera I/O. A mobile viewport, CPU slowdown
and desktop WebKit do not reproduce a phone's camera, CPU/GPU contention,
battery, thermal throttling or browser scheduling. A 60fps target is not a
guarantee for every phone. Physical-phone acceptance, physiological accuracy and
native sharing remain separate validation scopes. npm 0.3.1 publication remains
pending and is unrelated to this application change.

## Frozen worker correctness matrix

The 2026-10-24 final worker matrix passed all sixteen families using all 30
accepted segments (59 rendered strokes) in each engine, then pause/hidden
recovery, cancel/reduced-motion/hidden completion, disposal and four worker
failure modes. Chromium is pixel-exact. WebKit is exact in thirteen families;
Coastal Cliffs, River Valley and Glacial Fjord pass the explicitly bounded
cross-thread artwork criterion described above. Accepted source is exact in
every case. Repeat-reading material and presentation limits and bitmap closure
checks pass. Evidence: `.dream-loop/mobile-drawing-performance/final-worker/`.
