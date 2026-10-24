# Continuous pulse brush

## Behavior

Recording shows one continuous source-time waveform on quiet paper. The brush
stays at a fixed horizontal writing position while the paper moves beneath it.
Every approved stroke has an immutable core, pigment outline, gradient and
texture placement. Previously deposited pigment moves only with its paper.
The brush has a tapered bristle head, metal ferrule and a small wooden handle.
No landscape is visible during recording.

The unchanged selected-channel acceptance adapter supplies approved five-second
windows. Ingestion preserves continuity proof outside the serialized scene.
Only verified adjacent samples from the same channel may get a separate display
connection. Rejected windows, explicit breaks, invalid samples, channel changes
and unknown restored provenance lift the brush. Display connections add no
accepted samples, intervals or usable duration. The original manuscript and
completed landscape renderer remain unchanged.

Finish stops capture before a bounded 5.8-second presentation: pull back to the
source manuscript, interpolate those same measured knots into their landscape
positions, then settle into the canonical completed painting. Rotation reprojects
the ongoing reveal. Reduced motion, hidden pages and Skip reveal reach the same
final scene directly. Cancellation and disposal release scheduled work.

Hidden completed paint layers are prepared one accepted deposit at a time
between frames. They remain invisible during recording. Raster storage retains
the existing 2,560,000-pixel bound; pigment canvases/patterns retain the existing
4,554,752-pixel bound. The small visible SVG paths are reused rather than rebuilt
as the brush advances.

## Verification scope

All browser capture checks use the already-public replay fixture and mocked
camera I/O. They do not certify a physical iPhone, native share delivery,
physiological accuracy, battery use or sustained thermal performance.

Development evidence is under ignored
`.dream-loop/continuous-brush/` and `.dream-loop/continuous-capture/`.

## Rejected performance probes

OffscreenCanvas worker rendering was tested and rejected: all sixteen WebKit
scenes matched canonical pixels, but Chromium differed. The worker was removed
from the runtime. A smaller raster-flush sink was also explored; its limited
speed benefit did not justify changing the canonical rendering path. Neither
probe is part of this release.

## Frozen build

Runtime SHA-256:
`dda5c8ba24dca41761f39cc233ffe27eed7416ea91992edae02af874eaeca85c`.
Tested source: `ea916e2ef85357aa649b35805f2182fb6eee6c4e` (PR #10).
The independently reviewed actual mobile render scored 8.1/10 against the target.
The native README JPEG is an unedited capture of this renderer; its provenance
is recorded in `docs/media/README.md`.

Both Chromium and WebKit passed all 16 recording/reconstruction families and
192 provenance cases per engine locally, then again on the final build in Linux CI.
All 32 short/full canonical parity cases per engine passed. Actual morph paths
retain measured knot timestamps/values; maximum SVG rounding error was under
0.001 CSS pixels. Immutable path checks cover core, wash, joins, blooms and
pigment edges. The final CI also passed immutability checks for the added pigment body.
All 48 serialized scene comparisons match the prior model. All 49 generated
gallery files (full, thumbnail, share JPEG and social image) are byte-identical.

## Frozen-build performance

Chrome 155 with a 390px mobile viewport, DPR 3, normal motion, public fixture
through the real engine/adapter, 160 seconds preloaded then 20 seconds at wall
clock. Preload covers a nearly complete painting; all 59 hidden stroke-warming
callbacks were included. Cases ran sequentially without other local browsers.

| Entry compositor | CPU | Capture fps | Reveal fps | Synchronous finish | First reveal frame |
| --- | ---: | ---: | ---: | ---: | ---: |
| WebGPU | 1× | 59.95 | 60.00 | 9.9 ms | 16.4 ms |
| WebGL2 | 1× | 59.95 | 60.00 | 11.8 ms | 18.3 ms |
| WebGPU | 4× | 59.60 | 52.61 | 62.9 ms | 98.8 ms |
| WebGL2 | 4× | 59.75 | 52.29 | 60.2 ms | 97.4 ms |

At 4×, reveal p95 frame interval was 33.3 ms and maximum was 100 ms.
Hidden warm callbacks reached 89.4 ms. Recording is close to 60 fps in these
checks; the stress reveal does not sustain 60 fps. No physical-phone, thermal
or battery claim follows from CPU emulation. Results are in ignored
`.dream-loop/continuous-capture/final-performance/results.json`.

## Full three-minute WebKit replay

The final runtime passed at 180.554 seconds of credited capture / 210.019
seconds wall clock. A four-second camera pause, a 2.5-second main-thread stall
and a four-second hidden-tab period each resumed with zero clock credit on the
first fresh frame. Expired deliveries were dropped rather than replayed.
The public fixture's final sixty seconds are repeated with monotonically
shifted timestamps only where needed to finish the interrupted three-minute
capture; this is lifecycle evidence, not physiological validation.

Active recording averaged 59.34 fps, p95 18 ms/max 201 ms (including screenshots).
The reveal averaged 59.96 fps, max 22 ms, with no frames over 33 ms. Pullback
averaged 59.89 fps; reconstruction 60 fps. No source-time regressions or future
frontiers occurred; scenery stayed invisible during capture. Portrait-source
pixel difference was zero. Metrics toggling altered only its designated band;
encoder/renderer failure recovery and report export passed. The exported report
was 1200 × 5920 (3,766,257 bytes). Evidence is in ignored
`.dream-loop/continuous-capture/final-safari-session/`.

The final fallback suite also passed blocked GPU-module loading and actual
WebGL2 context loss. Both preserve paused canvas/SVG/source, continue accepted
capture and finish all 27 retained strokes with unchanged measurement credit.

## Hosted verification

Preview `dpl_DEc7LVxgL5P9m8xESDeJmejBhKmo` is READY. At
`2026-10-24T04:06:09.659Z`, all 107 hosted files matched the frozen build.
Protected preview browser checks passed at
`2026-10-24T04:10:32.620Z`: Chromium/WebKit at 390px and 1440px, real gallery
reads, prepared image sharing, lazy illustration loading and no optional book
load. No public writes or runtime/HTTP errors. Full Linux CI `40060891212` passed tested source
`ea916e2ef85357aa649b35805f2182fb6eee6c4e`; PR #10 merged as
`5cba901ef7c40404ee684ec54f5a9f2199534710`. Production `dpl_6izm7gaLKRf7gd54bdpr7Di46v6A` is READY at
https://www.pulsepainting.com/. At `2026-10-24T04:17:46.955Z`, all 107 public
files matched the tested build; apex returned 308 to www. Anonymous production
Chromium/WebKit checks at 390px and 1440px passed at `2026-10-24T04:17:59.391Z`
with no public writes or runtime/HTTP errors. Later documentation commits may
advance deployment IDs without changing runtime bytes. npm remains unpublished.
