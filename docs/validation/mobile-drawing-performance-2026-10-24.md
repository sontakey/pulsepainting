# Mobile drawing performance

## Status

**Released to production at https://www.pulsepainting.com/.** Validated runtime
`5c2419ba667e954f0645106b5ff72573a1e7bea3` has passed the full sixteen-scene
worker, lifecycle, fallback and resource matrix in Chromium and WebKit, including
the new worker-supplied reveal geometry checks. WebKit has three explicitly
bounded artwork residuals; those cases are not pixel-exact. Its matched 45-second
run, additional timing cases and current preview asset verification are complete.
Live capture averaged 60fps in those Chrome cases; dense reconstruction at 4×
CPU slowdown remained 49.83fps. The current full timed WebKit session passed
functional checks, with active painting at 59.179fps and a retained 367 ms
maximum interval. Application regressions, hosted preview checks and CI passed;
PR #14 is merged and its production deployment is ready. Anonymous production
browser checks, all 110 asset hashes and a short hosted worker replay passed.

Timing, full-session and preview results for first candidate `81bd81a` are
retained below as **intermediate evidence**, not current-release acceptance.
Those runs improved live drawing but exposed a finish-call regression, which
prompted the current geometry-reuse change. No global 60fps pass is claimed.

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

Each worker paint response now also returns the canonical reveal knots from
the stroke's already-warmed `pulseCore`. The selection is exactly the existing
every-third interpolated node plus the endpoint, which retains every original
measured knot. Only `{x, y, t, v}` is copied. The main thread validates its length
and exact source timestamps/values, then uses it when preparing reconstruction.
Pending strokes, missing payloads and the main-thread fallback use the original
calculation. Reveal colors, widths, interpolation and source geometry are
unchanged; no extra DOM preparation is moved into capture callbacks.

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

The full-recording matrix uses all 30 accepted segments and 59 strokes in
**every** family. Both first candidate `81bd81a` and current candidate `5c2419b`
produced the results below. Chromium passed all sixteen with exact pixels. WebKit
passed thirteen with exact pixels and the following three under the bounded
criterion below. These final results supersede the shorter diagnostic as the
full-recording acceptance evidence; the earlier failed strict gate remains
documented above.

| WebKit scene, full recording on both revisions | Maximum channel difference | Mean channel difference | Changed channels |
| --- | ---: | ---: | ---: |
| Coastal Cliffs | 6 / 255 | 0.04187890625 / 255 | 91,744 |
| River Valley | 6 / 255 | 0.011741015625 / 255 | 24,359 |
| Glacial Fjord | 5 / 255 | 0.01697734375 / 255 | 35,142 |

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

The current `final-worker-knots` matrix additionally checked **145,684 transferred
reveal nodes per engine**. Every payload contained one node per original source
point with exactly matching `t` and `v`; `x` and `y` were compared with the
canonical `strokeFrontier` mapping. Maximum measured geometry error was zero
in both engines (the test threshold is `1e-7`). Accepted scene descriptors stayed
exact in every comparison. This geometry evidence is independent of the three
bounded WebKit raster residuals.

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

The current frozen worker matrix verified pause and hidden recovery, cancelled and
hidden reveal completion, reduced motion and disposal in both engines. It also
passed all four worker failure modes: unavailable API, constructor failure,
reported error and a silent worker whose controlled watchdog expires. These
lifecycle and fallback artwork comparisons were pixel-exact. They do not
constitute the separate full three-minute real-time interruption replay or
physical-phone testing.

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
worker's atlas. Termination releases the worker atlas. The final matrix covered
this second-recording case in both engines: the main and worker atlases each
held 4,554,752 reported material pixels, reaching the combined 9,109,504 bound
without exceeding it. First-session measurements alone would have missed this.

Each engine created and terminated 23 workers, with at most one request pending.
All 854 received ImageBitmaps were closed. After disposal there were no live
workers, pending requests, scheduled animation frames, watchdogs or presentation
elements. Reported worker material allocation was zero; retained main material
returned to its pre-scene value. The inspected detached final and ambient
canvases each had actual dimensions of 1 × 1.

Reveal payloads have separate JavaScript accounting: `revealKnotCount` cannot
exceed `revealKnotLimit`, the sum of original accepted source-point counts. Each
stored knot carries four numeric values; `revealKnotDataBytes` reports
`count × 4 × 8`. This is numeric data size only, excluding array/object headers,
structured-clone overhead and transient worker copies; it is not a heap limit
or part of the canvas pixel budget. Payload references and the retained count
are cleared on disposal. The one-request-in-flight rule also bounds simultaneous
transport to one stroke's payload.

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
| Active painting intervals over 25 ms / over 33.34 ms | 7 / 3 |
| Main-thread watercolor callback median | 27.7 ms |
| Main-thread watercolor callback p95 | 66.4 ms |
| Main-thread watercolor callback maximum | 112.2 ms |
| Animation submission p95 / maximum | 0.8 / 4.5 ms |
| Final reveal FPS / maximum interval | 59.83 / 33.4 ms |

The near-60 average did not rule out visible pauses. Watercolor callbacks
occasionally consumed several 16.7 ms frame budgets even though the foreground
submission itself was inexpensive. The replay observed zero source regressions,
future foreground samples or future background samples, and zero page/console
errors. These findings motivated moving the expensive work. The matched
candidate measurement below tests the resulting capture behavior.

## Current frozen candidate identity

Current runtime/test revision: `5c2419ba667e954f0645106b5ff72573a1e7bea3`.

- Renderer SHA-256:
  `9d650cdd03f89093b5a4e0a3642b35042dedbc1d9beca3faf748fde4bd68d636`.
- Worker SHA-256:
  `082fb427d18fc7048a51b3246820a3f749fdbde903d545b2c60c2a2d811df29b`.
- Current correctness evidence:
  `.dream-loop/mobile-drawing-performance/final-worker-knots/chromium.json`
  and `final-worker-knots/webkit.json` in the same directory.
- Rebuilt local artifact manifest:
  `.dream-loop/mobile-drawing-performance/release-manifest.json`, frozen at
  `2026-10-24T17:23:28.971Z`, contains 110 assets tied to this revision and
  renderer. This is a local freeze, not a deployed asset-hash result.

The current matrix used Chrome 155.0.8059.85 and WebKit 26.6. Animation time was
stepped while worker transport and rendering remained real; these correctness
runs are not FPS measurements. Both engines reported zero page errors. The
current timed-session evidence is separately recorded under `release-safari`.

## Current matched performance and preview

The current 45-second / 4× run is recorded in
`.dream-loop/mobile-drawing-performance/release-paired/results.json`, generated
at `2026-10-24T17:23:29.316Z`, with the same 40-second preload, Quiet Lake seed,
Chrome version and mobile viewport as the baseline. Capture used the worker;
the entry compositor used WebGL2.

| Measurement | Frozen baseline | Current `5c2419b` |
| --- | ---: | ---: |
| Active painting FPS | 59.73 | 60.00 |
| Active painting p95 / maximum interval | 16.8 / 100.0 ms | 16.7 / 16.8 ms |
| Active intervals over 25 ms / over 33.34 ms | 7 / 3 | 0 / 0 |
| Sampled main-thread warming p95 / maximum | 66.4 / 112.2 ms | 0.6 / 0.6 ms |
| Animation submission p95 / maximum | 0.8 / 4.5 ms | 0.8 / 9.6 ms |
| Final reveal FPS / maximum interval | 59.83 / 33.4 ms | 59.48 / 50.0 ms |
| Finish call / first reveal frame delay | 31.4 / 47.3 ms | 34.3 / 54.9 ms |

Overall replay cadence was 59.98fps with a 33.4 ms maximum interval. The warming
probe sampled 19 callbacks while 21 strokes warmed; its 0.6 ms maximum describes
observed main-thread response work, not total worker CPU or a complete long-task
census. The reveal completed in 5,923 ms with source and measurement time stable.
There were no capture regressions, invalid positions, future foreground or
background samples, page errors or console errors. The table retains the higher
reveal maximum and foreground submission maximum; these results do not establish
that all rendering phases improve or every frame meets the display budget.

Additional current runs used the same host, browser, viewport and seed, with
20 seconds of measured replay each. Active capture values below come from
`replay.activePaintCadence`; they exclude the initial pre-active replay interval.
The corresponding overall replay FPS values were 60.00, 59.90 and 59.95.

| Current condition | Preload / final strokes | Active FPS / p95 / max | Reveal FPS / p95 / max | Finish call / first reveal frame |
| --- | --- | --- | --- | --- |
| 1× CPU, WebGPU entry | 40 s / 11 | 60.00 / 16.7 / 16.8 ms | 60.00 / 16.8 / 16.8 ms | 3.9 / 14.2 ms |
| 6× CPU, WebGL2 entry | 40 s / 11 | 60.00 / 16.7 / 16.8 ms | 59.83 / 16.8 / 33.3 ms | 28.0 / 42.3 ms |
| 4× CPU, WebGL2 entry, full-density scene | 160 s / 59 | 60.00 / 16.7 / 16.8 ms | 49.83 / 33.4 / 83.4 ms | 44.6 / 80.8 ms |

Evidence is `release-normal/results.json` (`2026-10-24T17:24:56.756Z`),
`release-heavy/results.json` (`2026-10-24T17:25:29.125Z`) and
`release-late/results.json` (`2026-10-24T17:26:01.987Z`) in the same performance
evidence directory. Each active interval had zero frames over 25 ms, and each
run reported no page/console errors, source regressions, invalid coordinates or
future foreground/background samples. Every reveal preserved source and stopped
measurement time. Sampled warming callback maxima were 0.2, 1.0 and 1.2 ms;
these remain partial main-thread observations, not total worker CPU.

The following comparison is specifically the 160-second preload / 59-stroke,
20-second replay at 4× CPU slowdown. It does not compare different density cases
or establish phone performance.

| Full-density measurement | Frozen baseline | First candidate `81bd81a` | Current `5c2419b` |
| --- | ---: | ---: | ---: |
| Active capture FPS / maximum interval | 59.45 / 116.6 ms | 59.85 / 49.9 ms | 60.00 / 16.8 ms |
| Finish call | 78.3 ms | 227.4 ms | 44.6 ms |
| First reveal frame delay | 120.7 ms | 259.9 ms | 80.8 ms |
| Reveal FPS / maximum interval | 46.80 / 116.7 ms | 46.93 / 250.0 ms | 49.83 / 83.4 ms |

Geometry reuse removed the observed cold-preparation regression in this run,
with finish latency below baseline. **Dense reconstruction still falls short of
60fps under 4× CPU slowdown:** its reconstruction phase averaged 48.00fps,
and the overall reveal retained an 83.4 ms maximum interval. The foreground
capture improvement does not imply that all-stroke SVG animation meets the
display budget on slower phones. This preload case starts foreground traversal
from the beginning; it tests retained scene density, not a real-time late source
frontier. The timed WebKit session supplies separate continuous-session coverage.

Current preview `dpl_52FSsPhLnuYfZe7gN6hFNYBwqYgK` is `READY` at
`https://pulsepainting-j9ymuotfr-sontakeys-projects.vercel.app`.
`release-preview-assets.json` verified all 110 assets with HTTP 200 and matching
local hashes at `2026-10-24T17:24:40.166Z`; metadata is in
`release-preview-inspect.json` in the same evidence directory. Production
deployment is verified separately below.

## Current full timed WebKit session

`release-safari/result.json` completed with `SESSION_PASS` at
`2026-10-24T17:30:34.625Z`. This used the current built app in Playwright WebKit
26.6, iPhone 13 emulation and mocked camera I/O, not physical Safari. Quiet Lake
seed 39293 replayed at 1× wall-clock speed. As in the intermediate run, the
recorded final 60 seconds were repeated with shifted timestamps to cover
startup and interruptions beyond the original fixture duration; no new
physiological recording was made.

The countdown completed 180.054 seconds of active measurement in 209.903 seconds
wall time. It accepted 33 segments / 66 strokes and 156.883 seconds of usable
waveform. It dropped 581 expired samples, then resumed with the newest current
sample after each interruption rather than replaying a stale backlog.

| Current timed WebKit cadence | FPS | p95 interval | Maximum interval | Intervals over 33.34 ms |
| --- | ---: | ---: | ---: | ---: |
| Active painting | 59.179 | 19 ms | 367 ms | 54 |
| Overall, excluding deliberate main-thread stall | 59.234 | 19 ms | 367 ms | 65 |
| Overall, including deliberate main-thread stall | 58.530 | 19 ms | 2,511 ms | 66 |
| Final reveal | 59.148 | 19 ms | 62 ms | 2 |

The 60-second screenshot took 174 ms, and its overhead remains included in the
timing. **The cause of the 367 ms maximum interval is unproven; it is not
attributed to that screenshot.** This functional pass and near-60 average do
not establish hitch-free rendering. The current full-session active maximum
was higher than the intermediate session's 162 ms, so the full-session results
cannot be presented as a uniform performance improvement. The reveal completed
in 5,856 ms with accepted source and stopped measurement time unchanged.

The four-second camera-frame pause, deliberate 2.5-second main-thread stall
and approximately four-second simulated hidden state each recovered with zero
stale elapsed-time credit on the first resumed sample. Camera pause and hidden
state also added zero elapsed time while held. No source regressions, invalid
coordinates or future foreground/background samples occurred; eight progressive
background discoveries used accepted data. Presentation storage stayed within
4,662,275 pixels.

Report values matched the actual engine: 71 bpm, RMSSD 57.1 ms, SDNN 52.8 ms and
193 beats. Quiet Lake capture-to-portrait geometry/pixel comparison passed,
the downloaded image matched its preview, and toggling metrics left the
landscape unchanged. Encoder recovery reused the same source-art pixels with
zero difference; renderer recovery succeeded with the same source and seed.
Both restored sharing/export actions. The 1080 × 1350 artwork and
1200 × 5920 manuscript exported successfully, graph labels fit at 320 pixels,
and print disclosure state was restored. Sharing APIs were mocked. No page
errors, console errors or first-party request failures occurred.

## Current application regression and visual checks

`.dream-loop/mobile-drawing-performance/release-app-checks.log` records
sequential Chromium and WebKit passes for capture, cancellation/restart, stale
callback isolation, quality attribution, report generation, exports, responsive
layouts and unavailable-data handling. Both also passed artwork preparation and
encoding recovery. The observed portrait scene comparisons had zero pixel
difference, and the metrics toggle changed only its numeric summary band.

Visual review of `release-safari/capture-390.png` confirmed the crisp PPG core,
pointed brush head, fixed pigment, faint background scenery, signal bars, live
metrics and floating mobile controls remain present. This is a rendered browser
capture review, not a physical-phone capture or a continuous-motion assessment.
Current hosted browser evidence is
`.dream-loop/mobile-drawing-performance/release-preview-browser/results.json`,
completed at `2026-10-24T17:32:56.806Z`. All four cases passed: Chromium and
WebKit at 390 × 844 and 1440 × 1100. Checks covered manual camera guidance,
existing public Quiet Lake artwork, share-sheet layout, example/community
gallery behavior and desktop walkthrough illustrations. The community endpoint
returned HTTP 200 with zero public paintings and eight example cards. These
were read-only checks against a protected preview: no public write or camera
request was made, and camera permission/native sharing were not validated.

The preview cases recorded no page or HTTP errors. Their raw request-failure
arrays do contain aborted/cancelled image requests and some protected-origin
image/favicon request failures; they are not zero-network-failure runs. All
assertions passed and the separate 110-asset HTTP/hash check matched exactly.
Anonymous production behavior is verified separately below.

## CI and merge

[GitHub Actions run 40115878128](https://github.com/sontakey/pulsepainting/actions/runs/40115878128)
passed the complete `npm test` gate on source
`5c2419ba667e954f0645106b5ff72573a1e7bea3`, including source-provenance,
gallery and sharing checks. [PR #14](https://github.com/sontakey/pulsepainting/pull/14)
was squash-merged as `e85a0dd48cb251749eb0b59feab1b154f7ced923`.
The commit merge and protected preview are distinct from the production
deployment and public checks recorded below.

## Production deployment and public verification

Production deployment `dpl_7RM8UQbz1CAvVmyWkdBw386m45PT` is `READY` at
`pulsepainting-nikm7vsub-sontakeys-projects.vercel.app`, built by the automatic
Git integration from merge commit `e85a0dd48cb251749eb0b59feab1b154f7ced923`.
It serves [www.pulsepainting.com](https://www.pulsepainting.com/). The apex
responds with HTTP 308 to the www address. `production-inspect.json` records
deployment identity and aliases.

`production-assets.json`, verified at `2026-10-24T17:35:40.942Z`, fetched all
110 frozen assets from the public site with HTTP 200 and exact matching hashes.
The deployed renderer and worker match validated source `5c2419b`; that source
was squash-merged into the production commit above.

`production-browser/results.json` completed at `2026-10-24T17:35:54.310Z`.
All four anonymous, read-only cases passed: Chromium and WebKit at 390 × 844
and 1440 × 1100, with zero authenticated preview requests and no public writes.
Camera guidance, artwork/share layouts, walkthroughs and gallery browsing
worked. The community API returned HTTP 200 with two existing paintings and
six example cards. No page or HTTP errors occurred. The retained request-failure
entries are cancelled/aborted Quiet Lake image requests; unlike the protected
preview, no protected-origin request failures were recorded. These are not
zero-network-failure runs and do not validate actual camera permission or native
sharing.

A short hosted replay also completed at `2026-10-24T17:36:26.014Z`, recorded in
`production-replay/results.json`. Desktop Chrome used the 390 × 844 / DPR 3
viewport, mocked camera I/O, 40-second fixture preload and five seconds of
streaming at requested 4× CPU slowdown. The actual capture raster backend was
`worker`, with five worker requests. Active drawing and reveal each averaged
60fps with a 16.8 ms maximum interval; source and stopped measurement time
survived the reveal, with no page or console errors. This confirms the deployed
worker path can paint and finish; it is a five-second smoke check, not a full
production-session benchmark, physical-phone test or proof of smoothness on all
phones. All production evidence files are beneath
`.dream-loop/mobile-drawing-performance/`.

## First candidate identity: intermediate evidence

The earlier worker and matched performance runs used source commit
`81bd81a741926452d4a2b6a29dd55e2c8c340744`:

- Renderer SHA-256:
  `e8a5a2f8edb1ec27aed200f83fd31e5770a117bc0b59a29a4a4685104e0b1680`.
- Worker SHA-256:
  `0176884ed814690d0a2c653a12d622a0ba493dcfbfe9f4caaca5a169e9671122`.
- Worker correctness evidence:
  `.dream-loop/mobile-drawing-performance/final-worker/chromium.json` and
  `.dream-loop/mobile-drawing-performance/final-worker/webkit.json`.
- Matched performance evidence:
  `.dream-loop/mobile-drawing-performance/final-paired/results.json`, generated
  at `2026-10-24T17:06:56.140Z`.

The worker matrix used Chrome 155.0.8059.85 and WebKit 26.6. Animation time was
stepped while worker transport and rendering remained real; these correctness
runs are not FPS measurements. Both engines reported zero page errors and
preserved source descriptors exactly in every comparison.

## First candidate matched performance: intermediate result

First candidate `81bd81a` used the same Quiet Lake seed, 40-second preload, 45-second
measurement, viewport, Chrome version, Apple M4 host and requested 4× CPU
slowdown as the baseline above. The observed capture raster backend was
`worker`; the entry compositor was WebGL2. These are sequential browser runs,
not physical-phone measurements or a guarantee of equivalent throttling across
every browser process/thread.

| Measurement | Frozen baseline | First candidate `81bd81a` |
| --- | ---: | ---: |
| Active painting FPS | 59.73 | 59.98 |
| Active painting p95 interval | 16.8 ms | 16.8 ms |
| Active painting maximum interval | 100.0 ms | 33.3 ms |
| Active intervals over 25 ms / over 33.34 ms | 7 / 3 | 1 / 0 |
| Sampled main-thread warming callback median | 27.7 ms | 0.0 ms |
| Sampled main-thread warming callback p95 | 66.4 ms | 0.6 ms |
| Sampled main-thread warming callback maximum | 112.2 ms | 0.6 ms |
| Animation submission p95 / maximum | 0.8 / 4.5 ms | 0.8 / 23.7 ms |
| Final reveal FPS | 59.83 | 59.66 |
| Final reveal maximum interval | 33.4 ms | 50.1 ms |
| Finish call / first reveal frame delay | 31.4 / 47.3 ms | 38.4 / 54.9 ms |

The candidate's main-thread warming samples measure response handling and small
bitmap copies, not total worker rendering time. The work moved to another
thread; it did not disappear. The probe observed 20 warming callbacks for the
candidate's 21 warmed strokes, versus 21 callbacks in the baseline, so these
sampled maxima are not a complete long-task census. A rounded 0.0 ms sample is
below the reported timing precision, not a claim of zero CPU cost.

This run reduced the visible capture hitch and main-thread watercolor cost.
It did not improve every metric: the maximum foreground submission and reveal
interval were higher in this single paired run, as shown above. The final
reveal completed in 5,917 ms and preserved both source data and the stopped
measurement clock. Capture had zero regressions, invalid coordinates, future
foreground samples or future background samples; three genuine ambient
discoveries were observed. There were no page or console errors. Additional
performance conditions are recorded separately below.

## First candidate timing conditions and revealed regression

Three further sequential first-candidate Chrome 155.0.8059.85 runs used the same Apple M4,
390 × 844 / DPR 3 mobile viewport and Quiet Lake seed 39293, with mocked camera
I/O and the worker capture raster backend. Each measured 20 seconds of streamed
replay. The preload cases build the retained scene before that interval; they
are not substitutes for a continuous three-minute session. WebGPU and WebGL2
in this table identify the entry compositor, not the PPG drawing backend.

| Condition | Scene preload | Final strokes | Active FPS / p95 / max | Reveal FPS / p95 / max | Finish call / first reveal frame |
| --- | ---: | ---: | --- | --- | --- |
| 1× CPU, WebGPU entry | 40 s | 11 | 60.00 / 16.7 / 16.8 ms | 60.00 / 16.7 / 16.8 ms | 13.5 / 17.7 ms |
| 6× CPU, WebGL2 entry | 40 s | 11 | 59.90 / 16.7 / 33.4 ms | 59.66 / 16.8 / 50.0 ms | 44.6 / 62.5 ms |
| 4× CPU, WebGL2 entry, full-density scene | 160 s | 59 | 59.85 / 16.8 / 49.9 ms | 46.93 / 33.4 / 250.0 ms | 227.4 / 259.9 ms |

Evidence is respectively `final-normal/results.json` (generated
`2026-10-24T17:12:20.538Z`), `final-heavy/results.json`
(`2026-10-24T17:12:54.300Z`) and `final-late/results.json`
(`2026-10-24T17:13:27.219Z`), all beneath
`.dream-loop/mobile-drawing-performance/`. No page or console errors occurred.
Each run preserved accepted source and the stopped measurement clock through
the reveal, with no capture regressions, invalid positions or future foreground
or background samples. Sampled main-thread warming callback maxima were
0.2 ms, 1.9 ms and 0.8 ms respectively; these exclude worker rendering CPU.

The full-density case validates bounded capture work with 59 retained strokes,
but its foreground still advances from the beginning after the preload. It does
not prove the live brush was at a late source-time frontier. The uninterrupted
portions of the full timed WebKit session below provide continuous progression
coverage.

**Dense final reconstruction was below the 60fps target under severe CPU
stress.** The final reveal must prepare and animate all recorded SVG strokes,
unlike the six-second live foreground window. In the 59-stroke / 4× case,
reconstruction itself averaged 46.75fps and required up to 25.8 ms of animation
submission; the initial finish call cost 227.4 ms. The 6,168 ms reveal completed
correctly, but its 250 ms maximum interval and 259.9 ms first-frame delay remain
visible performance limitations of the first candidate. A matched `baseline-late`
run subsequently measured a 78.3 ms finish call and 120.7 ms first-frame delay,
versus this candidate's 227.4 / 259.9 ms. Its reveal also averaged 46.8fps.
The added finish latency was therefore a regression, not simply an unchanged
pre-existing limit. Moving paint preparation to the worker left the main
thread's reconstruction geometry cold. Current candidate `5c2419b` reuses the
worker's warmed knots to address that duplicated preparation. The current
scoped timing comparison above measures its improvement while retaining the
remaining all-stroke animation limitation.

## First candidate full timed WebKit session: intermediate pass

The `81bd81a` session completed with `SESSION_PASS`; evidence is
`.dream-loop/mobile-drawing-performance/final-safari/result.json`, completed at
`2026-10-24T17:12:03.132Z`. This was Playwright WebKit 26.6 with iPhone 13
emulation and mocked camera I/O against the local built app, **not physical
iPhone Safari**. It replayed the recorded fixture at 1× wall-clock speed using
Quiet Lake seed 39293. The fixture's final 60 seconds were repeated with shifted
timestamps to cover startup and interruption time beyond its original
199.452-second duration; this is test-fixture extension, not newly measured data.

The automatic countdown reached 180.474 seconds of active measurement after
209.918 seconds of wall time. It accepted 33 segments / 65 painting strokes and
157.35 seconds of usable waveform. Expired samples were dropped after
interruptions instead of feeding a catch-up backlog.

| Timed WebKit cadence | FPS | p95 interval | Maximum interval | Intervals over 33.34 ms |
| --- | ---: | ---: | ---: | ---: |
| Active painting | 59.689 | 19 ms | 162 ms | 33 |
| Overall, excluding the deliberate main-thread stall | 59.600 | 19 ms | 162 ms | 45 |
| Overall, including the deliberate main-thread stall | 58.891 | 19 ms | 2,515 ms | 46 |
| Final reveal | 57.350 | 20 ms | 68 ms | 4 |

One screenshot at the 60-second checkpoint took 230 ms to capture. Its readback
overhead remains included in the reported active and stall-excluded cadence;
the 162 ms maximum has not been removed. The near-60 average does not establish
that every frame met the display budget. The 5,830 ms reveal completed with
the accepted source and stopped measurement clock unchanged.

All three interruption cases recovered: a four-second camera-frame pause, a
deliberate 2.5-second main-thread stall and a four-second simulated hidden state.
Each gave zero stale elapsed-time credit on the first resumed sample. The
camera-pause and hidden cases also credited zero time while held. The replay
dropped 558 expired samples, then resumed with current samples. Capture had no
source regressions, invalid positions, future foreground samples or future
ambient samples. All eight progressive background discoveries used accepted
data, and the presentation allocation remained within 4,662,275 pixels.

The displayed report agreed with the engine: pulse 71 bpm, RMSSD 55.0 ms, SDNN
51.4 ms and 192 beats. Quiet Lake artwork retained the capture scene, and the
download matched the preview exactly. Toggling metrics left the landscape
pixels unchanged. Both injected artwork recovery cases passed: the encoder
retry retained the completed artwork with zero pixel change; the renderer
retry regenerated once successfully with the same source and seed. Sharing
was exercised through mocked browser APIs only. The 320-pixel report and graph
label bounds, manuscript download and print disclosure restoration also passed.
There were no page errors, console errors or failed first-party requests.

## First candidate hosted preview asset verification: intermediate pass

Preview deployment `dpl_HfMRhP4YJSnJYMpsTqQmmLCLFeaM` was `READY` at
`https://pulsepainting-f7gc0in0v-sontakeys-projects.vercel.app`. The checks in
`.dream-loop/mobile-drawing-performance/preview-assets.json`, recorded at
`2026-10-24T17:08:24.763Z`, received HTTP 200 for all 110 checked assets and
matched every local asset hash, including the frozen renderer and worker.
Deployment metadata is in `preview-inspect.json` in the same evidence directory.
This proves the first candidate's preview identity only. The current
geometry-reuse revision has its own preview and production verification above.

## Remaining release verification

| Release check | Status |
| --- | --- |
| Matched 45-second 4× baseline/current candidate comparison | Measured on current revision; live capture 60fps / 16.8 ms max, reveal limitations retained above |
| Normal-speed and additional slower-device browser cases | Measured on current revision at 1× and 6×; active capture 60fps, not phone certification |
| Full-density drawing and reveal measurements | Current capture 60fps; finish latency below baseline; 49.83fps dense reveal remains below target at 4× |
| Chromium and WebKit worker/export artwork comparison across all 16 full scenes | Passed on current revision; Chromium exact, WebKit three bounded residuals documented above |
| Worker reveal geometry and source preservation | Passed; 145,684 knots checked per engine, zero observed geometry error |
| Worker unsupported, construction failure, error and timeout fallbacks | Passed on current revision in Chromium and WebKit |
| Pause, hidden recovery, reduced motion, cancellation and disposal | Passed in current stepped worker matrix and current timed interruption session |
| Second recording after report/export and resource bounds | Passed in both engines |
| Full three-minute WebKit session with interruption/recovery | Current functional pass with mocked camera; 367 ms active maximum retained and unexplained |
| App capture, cancellation/restart, report, exports, responsive and unavailable-data regressions | Passed sequentially in Chromium and WebKit; current capture screenshot also visually reviewed |
| Additional source-provenance, gallery and sharing release gates | Passed in complete npm test CI run 40115878128 |
| Final gallery assets and manifest tied to the frozen renderer | Current local 110-asset manifest and hosted preview hashes match |
| Hosted preview artifact and static asset hashes | Passed on current revision; all 110 assets match |
| Hosted preview browser interactions | Passed Chromium/WebKit at mobile and desktop sizes; observed aborted/protected requests retained above |
| GitHub CI and merge | Passed on 5c2419b; PR #14 merged as e85a0dd |
| Production deployment | READY dpl_7RM8UQbz1CAvVmyWkdBw386m45PT from merged e85a0dd |
| Anonymous hosted mobile/desktop checks and deployed asset hashes | All four browser cases and 110 exact asset hashes passed; request aborts retained above |
| Hosted worker capture/reveal smoke test | Five-second mocked-camera replay passed; not full-session or physical-phone certification |

## Limits

Browser replay exercises the real engine and acceptance adapter against an
already-public fixture, with mocked camera I/O. A mobile viewport, CPU slowdown
and desktop WebKit do not reproduce a phone's camera, CPU/GPU contention,
battery, thermal throttling or browser scheduling. A 60fps target is not a
guarantee for every phone. Physical-phone acceptance, physiological accuracy and
native sharing remain separate validation scopes. npm 0.3.1 publication remains
pending and is unrelated to this application change.
