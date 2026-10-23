# Slower-phone rendering and gallery refinements

## Rendering contract

The scenery uses a separate 30 Hz raster budget and reduces that budget to
20 Hz after sustained frame pressure, with hysteresis before returning to 30 Hz.
The measured pulse contour, pointed brush, wet pigment blooms and damped camera
still update on every animation frame. Stroke boundaries can force an additional
raster update; these are cadence targets, not strict global draw-rate caps.

Pause, visibility interruption, stroke completion, reduced motion and finishing
flush the current scenic progress explicitly. The scientific signal engine,
accepted source samples, timestamps, quality attribution, terrain mapping and
canonical export drawing are unchanged. The live canvas remains 800 square;
the four-canvas allocation remains 2,560,000 pixels. Regenerating all sixteen
gallery examples changed only the renderer hash in their manifest: every image
file is byte-identical to the previous release.

Renderer SHA-256:
`2e7e417aeffe1cfef835bfbf49d80e49029de02314a00591a3366aa18d0df794`.

## Matched performance comparison

Desktop Chrome, Apple M4, 390 × 844 viewport, DPR 3, public recording through
the actual signal engine and application callbacks. Camera I/O is simulated.
Each measurement runs twenty seconds after forty seconds of recorded preload;
browser timing runs are serial. This is not physical-phone or thermal evidence.

| Case | CPU throttle | Active painting | p95 interval |
| --- | --- | ---: | ---: |
| Released renderer, first baseline | 1× | 59.65 fps | 16.8 ms |
| Released renderer, matched control | 4× | 43.22 fps | 33.4 ms |
| New renderer, same frozen layout | 4× | 52.39 fps | 33.4 ms |
| New renderer and compact header | 4× | 54.73 fps | 33.3 ms |

The unchanged-layout comparison isolates a 21.2% increase in active frame rate.
The final row includes the header change and is not a renderer-only attribution.
All cases stayed within the existing memory bounds without runtime or console
errors. The unchanged-layout candidate still had an 83.3 ms maximum interval;
these averages do not imply uninterrupted 60 fps.

The final twenty-second matrix on the finished capture UI measured:

| Backend | CPU throttle | Active painting | p95 interval |
| --- | --- | ---: | ---: |
| WebGPU | 1× | 60.00 fps | 16.7 ms |
| WebGL2 | 1× | 59.95 fps | 16.7 ms |
| WebGPU | 4× | 52.57 fps | 33.4 ms |
| WebGL2 | 4× | 51.62 fps | 33.4 ms |

Both backends retained the exact 2,560,000-pixel scene allocation and a
4,122,752-pixel material allocation below the existing 4,554,752 ceiling.
No runtime or console errors occurred. Final evidence is retained locally in
`.dream-loop/slow-phone/final-performance/results.json`.

Diagnostic tracing found layer updates dominated the main-thread work. Short
camera-freeze and paper-background-removal probes did not demonstrate a benefit,
so neither visual change ships. Trace durations are nested and are not GPU
execution timings. Raw evidence remains ignored in `.dream-loop/slow-phone/`.

## Correctness and interface

- Chromium and WebKit each passed all sixteen live scenes and 192 provenance
  cases. The new deterministic cadence checks verify foreground advancement
  between raster updates, bounded presentation lag, 30→20→30 Hz hysteresis,
  exact pause/hidden flush and no hidden-time catch-up. They observed 92 foreground
  advances during skipped rasters and a maximum 33.37 ms scenic lag. These are
  stepped correctness checks, not frame-rate measurements.
- The capture title is smaller. The LIVE camera sits in the upper-right with
  signal quality below it; state and countdown sit with the title. IDs and camera
  behavior are retained, with separate polite status announcements.
- The desktop QR no longer repeats the URL. The footer spans the viewport,
  the menu has a visible More label and a generous touch target, and the example
  viewer has a painted invitation button. The introductory copy is updated.
- Community shows real publications first, with up to eight clearly labeled
  public-recording examples filling unused spaces. Examples disappear as real
  paintings arrive. They use the existing example viewer and keep Community
  history/focus behavior. Publication consent and the backend are unchanged.
- Both browser engines passed empty, mixed, pagination, replacement, retry,
  history/focus and existing publication/privacy/removal cases. Default phone
  capture still makes no gallery-image requests until the gallery is opened.
- The final full WebKit replay completed 180.392 active seconds in 209.851 wall
  seconds, averaging 59.82 active fps with an 18 ms p95 interval. Camera-frame
  interruption, an intentional main-thread stall and visibility interruption
  recovered without counting stale frames. Report metrics, exact source-art
  pixel parity (maximum channel delta zero), encoder/renderer retry and the
  1200 × 5920 manuscript export passed. Evidence is stored locally in
  `.dream-loop/slow-phone/final-session/result.json`.
- Independent read-only review found no actionable renderer or cadence-test
  defects. It confirmed that only scenic raster work is gated and that forced
  painting covers lifecycle transitions and stroke boundaries.

## Walkthrough illustrations

Three coordinated watercolor illustrations show rear-camera fingertip placement,
the pulse becoming a painting, and the saved artwork/sketchbook. Sunburst could
not start because the workspace had no credits; the user explicitly approved
the built-in image generator. These editorial illustrations are separate from
the actual pulse-derived gallery. Prompts, source hashes and optimized asset
provenance are in `docs/design/how-it-works-illustrations.md`.

Six responsive WebPs total 226,498 bytes. Their URLs are attached only in the
desktop branch, when the walkthrough approaches the viewport. The phone's
capture and gallery do not request these assets. Their reserved 4:3 space avoids
layout shifts; reduced motion disables the brief opacity reveal. Illustration
integration followed the timed replay, without changes to capture or renderer
code; final gallery checks cover this separate addition.

Chromium and WebKit passed the gallery and mobile-gallery suites after this
addition. All three images decoded; default phone capture and the phone gallery
requested zero walkthrough images. Actual walkthrough screenshots at 1440,
887 and 320 CSS pixels were inspected with no horizontal overflow or clipped
copy. The native README capture was refreshed from the actual app with the
public replay fixture, without pixel or metric editing.

## Release checks

CI, hosted preview and production checks are pending.
This record does not yet assert that the new changes are publicly deployed.
