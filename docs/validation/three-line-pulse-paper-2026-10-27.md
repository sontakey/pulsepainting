# Three pulse lines and a softer landscape — 2026-10-27

Capture retains the current six-second pulse line and the two preceding lines.
The group is centered in the free paper, with spacing and amplitude bounded by
the actual metrics and floating controls. Those DOM bounds are cached on resize;
the drawing loop performs no layout reads. The oldest row gently leaves during
the existing 560ms return, with at most four mounted rows during the transition.

The continuous background veil retains half its mask opacity at the group
center, with broad translucent shoulders. This is the mask alpha; the overall
background layer remains at 0.58 opacity during capture. It no longer clears a
transparent horizontal band. Scene placement, accepted-beat growth, measured
samples, source gaps, deposited pigment and final landscape geometry are unchanged.

The outer live-paper mask is applied only while a row returns. Settled rows
already fit within its opaque region, so keeping it on during ordinary writing
adds an unnecessary offscreen layer. Finish uses its separate opening mask and
retains all three rows and outgoing-row opacity even during a return. Returns
hold the presentation cursor and draw no connector. Acquisition continues
independently, with no accelerated catch-up through accepted samples.

## Source and artifact scope

The frozen runtime is source `88ae31694d53e9fe72d0546ae1dea44b1e23f016`, with
landscape renderer SHA-256
`af3d157e115f6282f1d7d71cff511eb337151431586294ce889c5bad863603ba`.
Head `7ff4e00eaa1f7b8f994e49fc1a32fb51fe1a43c5` changes only the crisp-brush
test and CI failure-artifact configuration relative to that source; its
application runtime is identical.

The original waveform and final artwork are unchanged. Actual regeneration of
all sixteen gallery scenes at initial candidate `7a514147` (renderer
`d1c6b48f3919a8e5a3c703b50161adac862249fb3421ce0fc6ac54bb1f33edc9`) verified
all 49 gallery image files byte-for-byte against the checked-in assets. The
final optimization changes only live-view masking within `createView()`;
canonical rendering sections before and after it are byte-identical to that
verified candidate. No separate gallery regeneration of the final candidate
is claimed. Evidence: `gallery-byte-parity.json` and `generated-gallery/`.

## Local functional verification

- Chromium/WebKit app suites pass capture, cancellation/restart, stale callback
  isolation, quality attribution, report/export and unavailable-data behavior.
- Both engines pass 320×568, 390×844, 430×932 and 844×390. Checks wait for three
  populated rows, verify actual SVG row transforms, and keep full pulse amplitude
  and pigment tails clear of the overlays. Minimum observed tail clearance was
  30.875px; expanded details preserve the paper geometry.
- Crisp-brush checks pass all sixteen scenes plus 192 provenance cases in each
  engine, with at least 1,268 actual three-settled-row checks per scene. Mid-return
  Finish retains outgoing opacity (0.605306 in the sampled case), with opening
  endpoint displacement below 0.0005px.
- Actual-worker timing checks pass all sixteen scenes in both engines: no source
  advance during returns, no accelerated catch-up, immutable source paths and
  pigment, bounded row DOM, and pause/hidden/reduced-motion recovery.
- Background checks interpolate rendered mask alpha for each projected pigment
  pixel. Every tested twenty-second source interval adds visible pigment in all
  sixteen scenes; minimum changed counts were 13,047 pixels in Chromium and
  5,611 in WebKit. Final canonical artwork parity is exact (maximum delta 0).
- Built-app screenshots were inspected at the first line, a return, three settled
  lines, later source and mid-return Finish. This visual study uses the public
  recording and controlled display metrics; the timed session below uses the
  real signal engine and computed metrics.

The conditional-mask raster comparison now distinguishes compositing
antialiasing from changed ink. It independently checks the complete measured
pigment footprint against the mask's fully opaque region; the two tested
layouts retain at least 4.468px of clearance. Interior pixels allow at most
one channel level of rounding. Larger differences must be within one physical
pixel of local contrast, bounded by one eighth of that channel's contrast plus
one rounding level, with an absolute maximum of 16. Restoring the unmasked
view must reproduce its original screenshot exactly.

Both final local crisp-brush runs pass the geometry and raster checks at
390×844 and 320×568. Chromium's maximum channel difference is 1; WebKit is
exact. The same portable gate passes offline against retained Linux CI
40557532448 screenshots: Chromium at 390×844 has a maximum difference of 13
(mean 0.0341), while WebKit at both widths is exact. All have zero out-of-bound
edge differences and exact restoration. These Linux screenshots use separately
validated same-source geometry; this offline result does not replace the full
Linux rerun.

Negative controls reject shifting the ink by one CSS pixel, erasing its oldest
row, and fading it by 5%, on both local engines and the retained Linux images.
The gate therefore does not use a blanket image-difference tolerance. Source,
row coverage, pause/hidden/reduced-motion and first-reveal-frame checks remain
strict. Evidence: `crisp-mask-portable/{chromium,webkit}.json` and
`linux-mask-gate.json`. The full Linux CI status is recorded below.

## Full three-minute WebKit session

The final frozen runtime passed the full WebKit 26.6 replay, completing
**180.404 active measuring seconds in 209.854 wall seconds** at normal replay
speed. Its 25 line returns consumed no accepted-source time. The run sampled
8,748 frames with three settled rows, never mounted more than four rows, and
recorded no source-frontier regressions, future foreground/background samples,
invalid row windows or scenic rasterization during active painting.

A four-second camera-frame pause, a deliberate 2.5-second main-thread stall and
approximately four seconds of simulated hidden-page interruption all recovered.
Each first resumed callback credited **zero stale measuring time**. Acquisition
dropped 560 expired samples instead of replaying a catch-up backlog.

The run completed the pullback/reconstruction, report charts and **1080×1350**
artwork. The Quiet Lake painting retained seed 39293, **65 strokes and 157.2667
usable seconds**. Report values were 71 bpm, 54.6ms RMSSD and 51.9ms SDNN from
193 accepted beats. The original waveform export was **1200×5920**. Encoder
retry reused its successfully rendered art with exact pixel identity; renderer
retry preserved source/seed and successfully rendered on its second attempt.
No runtime, console or first-party request errors occurred.

| Cadence scope | Mean FPS | p95 interval | Maximum interval |
| --- | ---: | ---: | ---: |
| Active painting | 57.46 | 19ms | 217ms |
| Complete reveal | 59.01 | 19ms | 45ms |
| Initial pullback | 56.93 | 21ms | 45ms |
| Terrain reconstruction | 59.94 | 19ms | 20ms |
| All callbacks, including the deliberate stall | 57.27 | 19ms | 2509ms |

The capture maximum remains reported. A screenshot taken at wall second 60.011
required 253ms; its readback overhead remains in the cadence data. Active
painting recorded 204 intervals over 33ms, so this is near-60fps behavior rather
than a claim that every frame meets 16.7ms.

The public `test/fixtures/iphone-200s.json` supplies 199.452 seconds. To allow
acquisition and interruption overhead, the harness repeats its final 60 seconds
with monotonically shifted timestamps when needed. This is a disclosed test
fixture extension, not another real recording. Camera input and native sharing
APIs are mocked. Evidence: `session-final/result.json`, completed at
`2026-10-27T18:07:49.233Z`.

## Mask optimization and performance comparison

An isolated 18-second WebKit profile used the same preloaded public-source
painting, a 390×664 viewport at DPR 3, and normal animation timing after warming.
It compared three settled rows with the parent mask against removing that mask;
the earlier two-row renderer was recorded as a reference.

| Profile | Mean FPS | p95 interval | Maximum interval |
| --- | ---: | ---: | ---: |
| Earlier two-row reference | 57.97 | 23ms | 34ms |
| Three rows with persistent parent mask | 55.37 | 27ms | 46ms |
| Three rows with parent mask removed | 58.22 | 21ms | 40ms |

These diagnostic single runs motivated removing the parent mask only during
settled writing; returns retain their fade. They are not physical-phone results
or repeated-trial estimates. Evidence: `mask-profile/`.

The earlier full three-row run with a persistent parent mask measured 53.37fps
active painting (p95 31ms, maximum 206ms) and 46.85fps reveal (p95 27ms, maximum
41ms). The final full run measured 57.46fps and 59.01fps respectively, while its
capture maximum rose to 217ms. These are separate end-to-end runs, not a
controlled claim that the mask change alone caused every timing difference.
The diagnostic live-mask surface estimate at the captured end state fell from
4,656,600 to 2,527,200 pixels; this estimate is not measured GPU allocation or
execution time. The fixed live raster/material budgets were not expanded.
Evidence: `session/result.json` and `session-final/result.json`.

Separate isolated desktop Chrome 156.0.8078.48 checks ran on Apple M4 with a
390×844 viewport at DPR 3, 40 seconds of source preload and 20 seconds of
streaming replay. The painted entry used WebGL2; active landscape capture used
the normal worker and SVG path, not a WebGL-rendered pulse.

| CPU slowdown | Active FPS | Active p95 / maximum | Main-thread submission p95 | Reveal FPS |
| --- | ---: | ---: | ---: | ---: |
| 4× | 60.00 | 16.8 / 16.8ms | 0.8ms | 60.00 |
| 6× | 60.00 | 16.7 / 16.8ms | 1.2ms | 59.66 |

The 6× overall rAF stream included one 33.4ms interval (59.95fps), outside the
active-paint cadence subset. Both runs preserved source/measurement state,
completed three line returns without advancing source during returns, mounted
at most four rows and produced no active scenic raster frames or runtime errors.
Evidence: `perf-4x/results.json` and `perf-6x/results.json`.

Desktop CPU throttling does not emulate phone camera work, mobile GPU behavior,
thermal throttling or sustained physical-device performance. These tests do not
establish physiological accuracy or native-share delivery.

## Hosted preview and release gate

The protected preview at
https://pulsepainting-4rvzvs3lc-sontakeys-projects.vercel.app/ passed a hash
comparison of **all 110 served files** against the frozen tested runtime at
`2026-10-27T18:11:24.187Z`. Its renderer matches `af3d157e` and source `88ae316`.
A separate read-only Chromium/WebKit hosted check passed at
`2026-10-27T18:11:50.171Z`; it covered the actual app, camera help and an existing
public Quiet Lake example without requesting a camera or publishing anything.
Preview verification is not production deployment. Evidence: `preview-assets.json`
and `preview-browser/results.json`.

The final feature-head preview is READY as deployment
`dpl_DQ6ZurwPnPHDq8SsShbHksUKtRMW`, at
https://pulsepainting-r6sgpki4q-sontakeys-projects.vercel.app/. Its source is
`7ff4e00eaa1f7b8f994e49fc1a32fb51fe1a43c5`. All 110 served files match the
frozen tested build at `2026-10-27T18:22:14.507Z`, including the same renderer
`af3d157e`. Its runtime bytes match the earlier hosted browser check; no separate
browser smoke of this final preview URL is claimed. Evidence:
`preview-final-assets.json` and `preview-final-deployment.json`.

The portable geometry-plus-edge checks and the complete Linux suite passed
on final feature head `7ff4e00eaa1f7b8f994e49fc1a32fb51fe1a43c5` in run **40558977752**.
The merge tree exactly matches that tested feature tree. Production verification
below used anonymous browser sessions and performed no public writes.

- Final CI run and result: 40558977752 — success
- Final feature head: 7ff4e00eaa1f7b8f994e49fc1a32fb51fe1a43c5
- PR #19 merge commit: eba3d7973e2fcea597364a557b3880f7a3f3153d
- READY production deployment: dpl_3NZzYmK97F5smUZpamfQkDKW8bUL
- Production asset verification: 110 files matched at 2026-10-27T18:37:42.114Z
- Production browser checks: Anonymous Chromium/WebKit mobile and desktop smoke, plus four capture viewports in both engines, passed.

Evidence stays in ignored `.dream-loop/three-line-pulse-paper/`. The README's
capture image comes from `session-final/capture-390.png`; the October 25 keepsake
image and its separate-session provenance are retained. The simple PPG-JS demo
is unchanged; npm publication remains pending.
