# Bounded live capture resources — 2026-10-27

The live SVG now contains only sources referenced by the visible paper window.
Historical and queued measured nodes stay in the recording model, but their
paths, seven-stop gradients, clips and pigment masks are created on first use
and released after the final visible fragment leaves. A record crossing a row
boundary still shares the same immutable ink. Finish uses retained measured
nodes and worker-prepared terrain knots, independently of the live SVG.

Active source synchronization no longer runs twice for each accepted window.
No acquisition rate, quality decision, source timestamp, playback speed,
landscape mapping, foreground pigment or final artwork design changes.

## Local diagnostics

Existing downloaded and persisted debug logs gain `pulsePaintingPerformance`.
It distinguishes processed camera source cadence, callback delivery cadence,
renderer cadence and JavaScript submission work. Ten-second bins record counts,
means, maximums and bounded histograms, plus queue depth, mounted source count,
renderer identity and worker/fallback backend. At most 60 bins are retained.

There is no extra animation loop, observer, network telemetry, raw waveform
copy or separate persistence path. Visibility and intentional renderer restarts
reset interval anchors. Collection stops before the completion reveal. A missing
optional module or diagnostic callback cannot block recording or log export.
`appBuild` remains null; the explicit renderer identity is
`live-paper-2026-10-27-bounded`, separately from the PPG library version.
JavaScript submission time is not GPU completion time, and processed camera
callbacks are not sensor frame-rate measurements.

## Verification

Runtime source: `1ce5d45286489d8391282e28f50ab20f1351fc16`.
Renderer SHA-256:
`21ce298502b92d78f9368cb27c00aff1cf57285bd877283b73474339c9f82ebd`.

- Chromium and WebKit long-capture checks replay the public recording with
  actual workers and a stepped presentation clock. At 20/90/140 source seconds,
  mounted source counts are 6/8/6 from 59 retained strokes. Connected SVG nodes
  are 167/210/167; the middle checkpoint includes a four-row return.
- Original measured values remain exact. Pause, resize, interrupted Finish
  during a late return, reduced-motion completion and disposal pass. Finished
  artwork and repeated exports match canonical rendering exactly in both engines.
- The same regression fails the old renderer because historical/future
  definitions remain mounted. This is structural coverage, not an FPS test.
- Crisp-brush and live-brush timing checks pass all sixteen scenes in both
  engines. Provenance coverage remains 192 cases per engine. The crisp test now
  visits every source as it mounts: all 13 normal source records per scene and
  all 62 fragmented records. All seven continuity fixtures are exercised through
  completion, including the clean bridge and six ingestion barriers.
- Actual vendor monitor lifecycle tests verify enriched exports and existing
  stop persistence preserve every original log field. Hidden intervals reset
  correctly, real reveal frames add no capture data, and blocking the helper
  import leaves capture, cancellation and the original vendor log working.
- Matched late-position WebKit profiling at 440×956 / DPR 3 used actual workers
  for both versions. Live definitions fell from 1,189 to 135. Isolating the
  foreground for comparison produced exactly identical screenshot pixels.
  Twelve-second cadence was 56.17fps before and 56.15fps after: this probe does
  **not** demonstrate an FPS improvement. It verifies a smaller, bounded live
  document without a visual change. It does not reproduce phone screen-recording
  or thermal pressure.
- Canonical renderer sections outside `createView()` are byte-identical to the
  preceding production source. All 49 example images were actually regenerated
  with the current renderer and match their checked-in bytes exactly. The
  generated gallery manifest changes only its renderer provenance hash. Existing
  published paintings are untouched.

## Complete recording with browser video

The frozen runtime passed a normal-speed WebKit replay with Playwright video
recording enabled: **180.390 active measuring seconds in 210.125 wall seconds**.
It recovered from a four-second camera-frame pause, a deliberate 2.5-second
main-thread stall and a four-second simulated hidden-page interruption. First
resumed callbacks credited zero stale time. There were 25 line returns, 8,717
three-row observations, no future samples, no source regressions and zero brush
contact error. The original waveform, final report, print and artwork exports
completed. The keepsake metric toggle changed only its reserved metric band;
canonical scene and encoder-retry artwork pixels remained exact.

| Cadence scope | Mean FPS | p95 interval | Maximum interval |
| --- | ---: | ---: | ---: |
| Active painting | 57.13 | 25ms | 264ms |
| Complete reveal | 59.15 | 20ms | 47ms |
| Terrain reconstruction | 60.00 | 19ms | 22ms |
| All callbacks, including deliberate stall | 56.99 | 23ms | 2509ms |

The maximum capture interval is retained, including the screenshot taken at
60 seconds; there is no claim of uninterrupted 60fps. These desktop browser
results do not reproduce the phone's severe late slowdown or establish its
cause. The resource cleanup prevents historical SVG accumulation; additional
phone logs now distinguish camera-delivery and renderer-cadence degradation.

A desktop Chrome WebGL2 replay with 6× CPU slowdown and 160 seconds of source
preloaded measured 60fps during its 20-second live capture sample (JavaScript
submission p95 1.3ms). Its full-history reveal measured 28.98fps, with a 94.5ms
Finish call and 143.9ms first reveal-frame delay. Preloading source does not move
the live presentation cursor to the end; this test measures cumulative source
load and must not be called a late-position or physical-phone FPS result.

A separate Chrome 6× CPU probe starts at the actual 140-second presentation
position, after all worker terrain preparation. During twelve seconds of
playback it measured 60.00fps, p95 interval 16.8ms and maximum 16.8ms; JavaScript
submission p95 was 0.9ms and maximum 8.1ms. It retained six source definitions.
This isolates late live drawing; it is not a physical-phone thermal test.

The first Linux run, `40567655414`, passed the new diagnostics, all renderer,
worker/lifecycle and app checks, then correctly stopped on stale gallery
provenance. Actual regeneration verified all 49 image files unchanged and the
new generated manifest records the current renderer hash. Unchanged gallery
checks subsequently passed Chromium and WebKit locally. The complete Linux
rerun `40570144526` passed on final feature head
`ba3dcaaac481da0c82dfe6cee7854e834cb5d03b`.

Final preview `dpl_3xqbHnbFcdjjHTv6xtdRNu9v2tMF` was READY on that exact head.
Its 110 non-document assets matched the frozen build exactly; the original HTML
was byte-identical with only Vercel's 163-byte preview feedback script appended.

PR #20 merged as `60194f67fd24fd5ce70a81fa90210c2a204261af`. Its source tree
matches the tested feature head exactly. The Git integration deployed production
`dpl_EDBuVxRxXWUXQ4QA4W9UHGK2kJz7`, READY on that merge commit, to
https://www.pulsepainting.com/. All 111 public runtime files, including HTML,
matched the frozen build at `2026-10-27T19:48:05.029Z`. The apex returns a 308
redirect to www. Anonymous hosted Chromium/WebKit mobile and desktop checks
passed: camera guidance, examples, artwork sharing UI and the read-only community
gallery. All 40 immersive layout cases passed across 320×568, 390×844,
430×932 and 844×390 in Chromium and WebKit: edge-to-edge paper, three rows,
overlay clearance, expanded details and floating controls. No real camera or
public publication API was used in these checks.
Later documentation-only deployments may have different IDs with identical
runtime bytes.

Ignored local evidence lives under `.dream-loop/steady-long-capture/`,
`.dream-loop/long-capture/` and `.dream-loop/capture-performance/`.
Private recordings are not checked in. Browser video recording is not the iOS
screen recorder; physical-phone camera, thermal behavior, sustained phone FPS,
physiological accuracy and native sharing remain separate validation scopes.
