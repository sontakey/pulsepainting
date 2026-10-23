# Crisp pulse brush

Capture now shows a fine contour of the accepted recording on a steady baseline,
with a pointed brush contact and a delayed, textured pigment bloom. Each completed
trace settles into its landscape placement before the final zoom-out. The change
applies to all sixteen scene families.

## Source and rendering contract

- The foreground maps actual timestamps and values into a 3.2-second window.
  Its amplitude range comes from the accepted source window, not an invented
  beat template. Original samples, accepted gaps, quality and usable-time density
  remain unchanged. No peaks or notches are added to make the trace look medical.
- Bounded monotone interpolation preserves measured knots. The core endpoint
  and brush contact use the same interpolated source-time frontier. The original
  waveform manuscript and computed report remain available unchanged.
- The core is 1.65 CSS pixels wide; the pointed nib is 14 CSS pixels long. Soft
  material follows 250–1600 ms behind the frontier. Its small mask reuses a
  cached 256-square pigment texture. There is no full-frame blur or fluid solver.
- The quieter landscape follows a slowly damped terrain guide rather than each
  pulse peak. Settling fits inside the existing playback budget, so it does not
  accumulate additional delay. Reduced motion, pause, hidden-page recovery,
  finish, cancellation and disposal retain their existing behavior.
- Fine contours also follow the actual landscape strokes in the finished image.
  Reflected decorative derivatives retain their soft treatment. All sixteen
  public-fixture gallery examples were regenerated from this renderer.

Frozen renderer SHA-256:

`a033c4bd89461a08f97af86bc971f738257cab1270c750872ce31c35ea749008`

## Verification

- Independent target comparison passed at 8.0/10. All sixteen capture studies
  were inspected; Quiet Lake, Sea of Clouds and Aurora were checked in WebKit.
  Some pigment edges remain more angular than natural wet paper.
- `test:crisp-brush` passed in Chromium and WebKit. Each engine covers sixteen
  live projections and 192 source-provenance cases across three seeds and full,
  short, irregular and dropped-delivery inputs. Checks include measured-knot
  preservation, actual time/value screen projection, brush/core agreement,
  source gaps, settling duration, lifecycle behavior and empty-data handling.
- The first full-session run exposed a direct camera correction that bypassed
  damping when the next stroke belonged to a distant layer. The correction is
  removed. A new regression rejects the old renderer across all sixteen scene
  traversals. The final build's largest sampled step is 15.38 world units
  across those traversals and 10.06 in the full 59-stroke Quiet Lake traversal,
  against the unchanged 250-unit bound. Both browser engines pass.
- The final `npm test` suite passed as GitHub Actions `40010625096` on
  `41c65a929e20ad309048c5676b33136cd57825cd`, including compositor parity,
  capture/report/export recovery, GPU fallback, galleries, sharing and books.
- Live landscape canvases remain bounded at 2,560,000 pixels. The conservative
  material ceiling is 4,554,752 pixels, including the additional 256-square
  decoded pigment texture. The live mask reports a bounded DPR-adjusted estimate;
  this is not a measurement of all browser/GPU allocations.

## Performance scope

Desktop Chrome 155 on Apple M4, 390 × 844 viewport, DPR 3, actual public recording
through the real engine and app callbacks. Camera I/O is mocked. Each measured
interval lasts twenty seconds after forty seconds of source preload.

| Entry backend | CPU throttle | Active painting | p95 frame interval |
| --- | --- | ---: | ---: |
| WebGPU | 1× | 59.95 fps | 16.7 ms |
| WebGL2 | 1× | 60.00 fps | 16.7 ms |
| WebGPU | 4× | 43.33 fps | 33.4 ms |
| WebGL2 | 4× | 39.47 fps | 50.0 ms |

The ordinary browser run meets the approximate 60 fps target; the early-capture
4× stress run does not. A same-environment ten-second diagnostic of the previous
renderer was similarly limited (36.52 fps), and tracing identified layer updates
as the dominant cost. Separating the pigment into another composited SVG and
reducing the scenic canvas did not demonstrate a sufficient benefit; neither
experimental change is shipped. These diagnostics are not the final benchmark.

Before the final camera-damping fix, diagnostic runs at the denser 150-second
preload measured
53.53 fps for Quiet Lake, 56.69 fps for Alpine Peaks and 55.38 fps for Aurora.
All stayed within the raster budgets with no runtime or console errors. Scene
stage affects cadence; these earlier-candidate results are retained as diagnostic
evidence, not final-build timing.
The dense Quiet Lake stress run included one 516.6 ms interval, so its average
must not be interpreted as uninterrupted smoothness.

Evidence is in ignored `.dream-loop/crisp-brush/`, including the target, actual
renders, per-engine verification, performance results and frozen asset manifest.
Browser replay does not establish physical-phone camera, thermal performance,
physiological accuracy or native-share delivery.

## Full session and release

The Git preview deployment `dpl_E61MCrNguSKHPX39mUiRwmeeqfoM` is READY at
`https://pulsepainting-git-codex-crisp-pulse-brush-sontakeys-projects.vercel.app`.
At `2026-10-23T19:22:47.922Z`, all 101 served files matched the frozen tested
build byte-for-byte. Protected-origin verification sent credentials only to
that exact origin and made no public-gallery writes.
The actual hosted app also passed in Chromium and WebKit at 390px and 1440px:
sixteen lazy examples, exact public-art bytes, centered sharing, three decoded
personal sketchbook pages, flip/zoom/close controls and read-only community
responses. No runtime errors, HTTP errors or write attempts occurred. Evidence
is in `.dream-loop/crisp-brush/preview-browser-fixed/`.

The final full WebKit session passed at `2026-10-23T19:26:34.073Z`:

- 180.404 seconds of active measurement in 209.836 wall seconds. The automatic
  stop ran once. Camera-frame pause, a deliberate 2.5-second main-thread stall
  and simulated backgrounding each recovered with zero stale-time credit.
- Active painting averaged 59.93 fps, p95 18 ms, maximum 103 ms. Overall cadence
  including the deliberate stall was 59.23 fps; excluding only that deliberate
  stall, overall cadence was 59.94 fps. Long normal intervals remain counted.
- Maximum healthy camera step was 15.36 world units, within the unchanged
  250-unit guard. The final reveal returned to the complete saved composition.
- Report values agreed with the real engine, graph text fit, and same-scene
  artwork parity was pixel-exact. Encoder and renderer retry paths recovered;
  encoder retry retained the original artwork without rerendering it.
- Report export was 1200 × 5920 pixels. No runtime, console or first-party
  request errors occurred.

This is a wall-clock public-recording replay in desktop WebKit with iPhone 13
emulation, not a physical iPhone test. Missing frames are dropped during the
interruptions. To finish 180 active seconds, the fixture's final recorded sixty
seconds are repeated with monotonically shifted timestamps, as documented by
the existing harness. The replay does not supply new physiological evidence.
Evidence is in `.dream-loop/crisp-brush/safari-session-fixed/`.

[PR #6](https://github.com/sontakey/pulsepainting/pull/6) merged as
`1ce10c81ebacef9dbafcc633205f17ef612c08c9` after CI and preview checks passed.
Production deployment `dpl_Bi448yYAVrrMNN1a5iVPrsgrpefs` is READY at
https://www.pulsepainting.com/. At `2026-10-23T19:31:49.685Z`, all 101 public
files matched the frozen build byte-for-byte; the apex domain returns 308 to
www. Anonymous production Chromium/WebKit checks at 390px and 1440px passed
at `2026-10-23T19:32:32.406Z`: gallery, sharing, three decoded personal book
pages and flip/zoom/close controls, plus real community reads. There were no
runtime errors, HTTP errors, authentication headers or write attempts. No
production QA paintings were created. Evidence is in
`.dream-loop/crisp-brush/production-assets.json` and `production-browser/`.
Later documentation-only commits can change the deployment ID without changing
the verified runtime.
