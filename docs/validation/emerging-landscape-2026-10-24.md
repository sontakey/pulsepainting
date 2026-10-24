# Emerging landscape during capture

## Behavior

A pale version of the actual accepted-data landscape gradually develops behind
the continuous pulse brush. The foreground remains crisp with a feathered clear
corridor. Ambient pigment uses a fixed portrait projection: it never tracks the
brush or jumps between scenic destinations. Previously deposited foreground
ink, washes and texture remain immutable.

The first discovery requires at least three usable seconds in the warmed
accepted prefix; subsequent thresholds add twenty usable seconds. Missing,
rejected and empty intervals do not count. Four brief captions accompany actual
snapshot additions. Buffered thresholds coalesce rather than causing a burst of
messages. The canonical full-strength painting remains reserved for Finish.

The ambient view copies the existing canonical caches into two 480-square
canvases, softens their scenic edges, and uses an immutable 256-square pigment
mask before crossfading for 3.2 seconds. It does not render each stroke again.
Canvas backing storage is bounded at 3,086,336 pixels. A browser-owned
256-square pattern may retain another 65,536 pixels, beyond the unchanged
canonical material budget. These bounds do not claim total browser/GPU memory.
Pausing or hiding freezes the presentation; reduced motion uses
immediate snapshots. Finishing fades away the atmosphere during the existing
pullback, then reconstructs the same original measured points into the unchanged
canonical artwork. Cancellation/disposal clears scheduled work and surfaces.

## Verification scope

Development evidence is under ignored `.dream-loop/emerging-landscape/`.
Browser replay uses the already-public fixture, real engine and acceptance
adapter, with mocked camera I/O. Stepped-clock tests prove presentation and
provenance behavior, not timing. CPU throttling and WebKit are browser checks,
not physical-phone, native-share, physiological, battery or thermal validation.

## Tested source

The local runs below used commit
`5b113185e3fafccd4c37e1f44ef2e1ed582cc6f2` and renderer SHA-256
`7d1d2abb53ee40e7d8c9fcab773aefdc7fb749c77cbf10494d93a8e190e8cba1`.
The source and served `dist/landscape.js` hashes matched. Each evidence directory
contains a `run-context.json` recording those identities. The build passed using
Node v24.21.0 and the existing Three.js 0.186.1 dependency.

Only the presentation in `createView` changed. The model, accepted-source
adapter, terrain mapping and canonical renderer remain unchanged from the prior
release. Background progress uses the warmed accepted source prefix; it may be
ahead of the delayed foreground animation, but never ahead of accepted source.
These checks do not establish the diagnostic accuracy of the input recording.

## Full WebKit session: passed

Evidence: `.dream-loop/emerging-landscape/final-safari-session/result.json`.
The run completed on 2026-10-24 at 14:55:53 UTC using Playwright WebKit 26.6 with
an iPhone 13 viewport and mocked camera I/O. Quiet Lake used seed 39293.

- The automatic capture completed **180.342 credited seconds** in **210.081
  wall-clock seconds**. It retained 33 accepted segments, 66 scene strokes and
  157.21666666666647 usable seconds of artwork source.
- A 4,000 ms camera-frame pause, a 2,500 ms main-thread stall and a 4,017 ms
  simulated hidden period all recovered. Every interruption received **0 ms
  first-resume credit**. Camera absence and hidden time added no held-time
  credit; resumed measurement stayed within the fresh-frame timing tolerance.
- The replay dropped 573 expired samples rather than replaying a stale backlog.
  The public recording's final 60 seconds were repeated with shifted monotonic
  timestamps to supply the test's documented extension beyond its original
  200-second length. This is a test stimulus, not a new physiological recording.
- Eight actual background discoveries and 1,492 fade samples were observed.
  There were zero source regressions, invalid positions, future foreground
  samples, future background samples or full-contrast scenic raster compositions
  during capture. Cached canvas storage stayed at 3,086,336 pixels.
- The final reveal took 5,821 ms and preserved both the accepted scene and the
  stopped measurement clock. Canonical portrait pixel difference was zero.
- The report agreed with the replay engine: 71 bpm, RMSSD 55.0 ms, SDNN 51.8 ms
  and 193 beats. The metrics toggle changed only the metrics band; encoder and
  renderer retry recovery passed. The report exported at 1200 × 5920 pixels
  (3,770,837 bytes), and the report/graph checks passed at 320 px width.
- There were zero page errors, console errors or first-party request failures.

| WebKit measurement | FPS | p95 interval | Maximum interval |
| --- | ---: | ---: | ---: |
| Whole session, including deliberate stall | 58.23 | 19 ms | 2513 ms |
| Whole session, excluding deliberate main-thread stall | 58.93 | 19 ms | 264 ms |
| Active painting | 58.71 | 19 ms | 264 ms |
| Final reveal | 59.93 | 18 ms | 31 ms |

FPS is rounded to two decimals here; the evidence retains full precision. The
single mid-session screenshot's readback cost remains included in the cadence.

## Chrome performance: four cases passed

Evidence: `.dream-loop/emerging-landscape/final-performance/results.json`.
The cases ran sequentially in Chrome 155.0.8059.85 on an Apple M4 Mac, using a
390 × 844 viewport at device scale factor 3. Each preloaded 160 seconds of the
public recording, measured another 20 seconds of real-time delivery, and then
measured the full reveal. This deliberately exercises a large accepted-source
backlog; it does not reproduce a physical phone's camera, GPU or thermal load.

| Requested and observed entry backend | CPU slowdown | Active capture FPS | Capture p95 | Reveal FPS | Reveal p95 |
| --- | ---: | ---: | ---: | ---: | ---: |
| WebGPU | 1× | 60.00 | 16.7 ms | 60.00 | 16.8 ms |
| WebGL2 | 1× | 59.95 | 16.7 ms | 60.00 | 16.8 ms |
| WebGPU | 4× | 59.75 | 16.7 ms | 54.12 | 33.3 ms |
| WebGL2 | 4× | 59.70 | 16.8 ms | 52.57 | 33.4 ms |

All four cases exercised actual background discoveries and crossfades while
retaining the warmed accepted-source boundary and the 3,086,336-pixel cache
bound. Each warmed 59 canonical strokes. Capture submission CPU p95 was
0.4/0.5/0.8/0.8 ms respectively. At 4× slowdown, the longest capture intervals
were 83.3 ms (WebGPU) and 99.9 ms (WebGL2); warming callbacks reached 89.8 ms and
94.4 ms. The sustained capture stayed near 60 fps, while the final reconstruction
fell to approximately 53–54 fps under CPU throttling. These are measured results,
not a universal 60 fps guarantee or a measurement of GPU execution time.

## Visual and release status

The current visual review is **7.4/10**. Treat this as a released phone preview;
the visual target has not been declared reached, and visual polish remains open.
No physical-phone acceptance is claimed by the local browser results above.

- Local full-session and four-case performance verification: passed.
- Remote CI on the final release candidate: passed.
- Hosted preview verification: passed.
- Production deployment and production verification: passed.
- Physical-phone capture, native sharing and user acceptance: pending.

## Release evidence

[PR #11](https://github.com/sontakey/pulsepainting/pull/11) merged as
`7d6fb388971d3371b5422bdfbc3e0d448690ef01`; its tree is identical to tested head
`5b113185e3fafccd4c37e1f44ef2e1ed582cc6f2`.
[CI 40104454982](https://github.com/sontakey/pulsepainting/actions/runs/40104454982)
passed the full `npm test` suite using the PR merge tree
`dda63ffc12e9c684841ca07c9d27d2b5aa896386`, Node 24 and Playwright 1.63.0 on Linux.
This includes all sixteen scenes in Chromium/WebKit, accepted-source provenance,
fixed pigment and geometry, cancellation, hidden/reduced-motion behavior,
canonical pixel parity, application/report, gallery, sharing and existing book
compatibility. The new emergence suite observed eight actual discoveries in
each engine and zero canonical pixel difference. The unmodified original
ThreeUI arrow-pointer limitation remains documented by its existing suite;
the adapted/public book controls passed.

The source model/mapping and canonical renderer are unchanged. Regeneration
confirmed all 49 checked-in gallery images are byte-identical. The gallery
manifest's source-renderer hash was updated for the new capture presentation.

Preview `dpl_7qF7wiNqpaPADzXvKYYHMidX4utD` was READY at
`https://pulsepainting-huyv484ia-sontakeys-projects.vercel.app/`.
All 107 files matched the frozen build at `2026-10-24T14:55:08.752Z`.
Protected-preview Chromium/WebKit checks at 390px and 1440px passed at
`2026-10-24T14:59:24.860Z`. They exercised real read-only gallery/community data,
prepared sharing, lazy images and responsive layouts with no page/HTTP errors.
Closing image views/contexts cancelled outstanding preview requests; these
were separate from successful image decoding and sharing hash checks.

Production `dpl_Ep6WeXRWFz6jMhjWAfKvbbZZafJL` is READY for the merged source at
`https://www.pulsepainting.com/`. All 107 public files matched the tested build
at `2026-10-24T15:06:27.083Z`; the apex returned 308 to www. Anonymous Chromium
and WebKit checks at 390px and 1440px passed at `2026-10-24T15:06:38.735Z`, with
no page/HTTP errors or public writes. Image requests cancelled when their views
closed were recorded separately. No production QA paintings were created.

Evidence is in `preview-deployment.json`, `preview-assets.json`,
`preview-browser/results.json`, `production-deployment.json`,
`production-assets.json` and `production-browser/results.json` under the ignored
development evidence directory. The refreshed README capture is an actual-app
accelerated composition screenshot; its exact scope and hashes are in
`docs/media/README.md`. Later documentation-only deployments may have different
IDs while serving the same verified runtime. npm 0.3.1 remains unpublished.
