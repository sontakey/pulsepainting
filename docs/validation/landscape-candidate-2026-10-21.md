# Landscape candidate validation

This is a draft implementation, not a production release or visual acceptance.
The runtime under review is commit `7d4b42bffff29cdb11de76e27c1699b156d645ed`,
on `codex/landscape-reveal`, in [draft PR 1](https://github.com/sontakey/pulsepainting/pull/1).
The existing public site still serves the earlier manuscript application.

## Candidate scope

Sixteen seeded landscape families use accepted selected-channel waveform paths.
The user approved artistic terrain curves and bounded interpolation between
recorded points. Source points, gaps and quality attribution remain available
separately from the artwork. The live close-up and final zoom-out use one scene;
the exported PNG renders that same scene at higher resolution.

Density is allocated in five-second usable-time slots. Fragmenting a recording
cannot create extra scene placements. The public fixture regression yields:

| Delivery | Usable seconds | Source fragments | Scene slots |
| --- | ---: | ---: | ---: |
| Original | 69.467 | 27 | 14 |
| 180 ms omitted each second | 54.967 | 90 | 11 |
| 180 ms omitted each half-second | 40.800 | 155 | 9 |

These are browser/test delivery scenarios using the already-public fixture,
not new phone recordings or clinical validation.

## Visual decision remains open

Independent visual reviews of the curved renderer scored 5.5 and 5.3 out of 10.
The second pass improved connected terrain and channels but introduced smooth,
stacked fills. Several scene families remain insufficiently distinct, and sparse
and dense compositions need stronger art direction. The user has been shown the
actual atlas and asked to choose between natural watercolor refinement and
retaining the abstract contour style. No visual acceptance is claimed.

## Current verified behavior

- Model checks cover all sixteen families, finite bounded interpolation,
  preservation of source knots and amplitude bounds, gap barriers, duplicates,
  usable-time density, deterministic reconstruction and immutable history.
- View checks cover pause/resume, responsive framing, a continuous same-scene
  reveal, reduced motion, the 155-fragment fixture, and disposal. Live/direct
  rendering had zero differing pixel channels. The live raster cache remains
  bounded to 2.56 million pixels.
- Chromium app checks passed capture callbacks, reports, export/share payloads,
  renderer/encoder retry, opt-in metrics and source preservation.
- Both optional GPU failure cases passed: blocked module and actual WebGL2
  context loss. The paused Canvas2D raster was identical before and after loss;
  accepted source and painting progressed after resume.
- A separate read-only code review found no substantive reproducible issue in
  source attribution, lifecycle, reconstruction, sharing or export privacy.

## Intermediate failures retained

An earlier fallback assertion required blue pixels. It was replaced with a
comparison against the same scene's unpainted paper, because foliage can be
green and aurora paper is dark. A second overly strong pigment threshold also
misidentified faint distant paint as absent: one cloud scene had 16,682 changed
pixels above a summed RGB difference of 8, but none above 30. The revised check
requires actual changed pixels, exact raster preservation across context loss,
and resumed painting progress. Faint first-layer contrast remains a visual
issue rather than being erased from the evidence.

One Chromium run exceeded the five-second artwork encoder retry test deadline.
The subsequent diagnostic run passed with the same deadline, including both
encoder and renderer recovery. The original timeout is retained and its cause
has not been established. It must not be silently reclassified as a confirmed
application fix.

## Full-session and performance evidence

The full WebKit replay completed **180.407 seconds of active measurement in
209.809 seconds wall time**, then automatically stopped once and revealed the
same scene. It recovered from a four-second camera-frame pause, a 2.5-second
main-thread stall, and a four-second simulated hidden-page interval. All three
resumed without stale-frame or catch-up recording credit. Hidden and paused
periods added no recording time.

Active painting averaged **59.68 fps**, with an 18 ms p95 frame interval. The
overall cadence excluding deliberate test interruptions was 59.97 fps. The
cache remained at 2.56 million pixels; no invalid camera transforms, uncaught
errors, console errors or first-party request failures were recorded. Report
parity, graph bounds, PNG privacy, original manuscript export, print and share
payload checks passed. Injected encoder/renderer retries took 83/80 ms. The
replay used the public recording and, when needed, repeated its recorded tail
with shifted timestamps to provide enough input for the interrupted session.

Four separate 20-second desktop Chrome streaming checks used a 390 × 844
viewport at DPR 3. Both the actual entry backend and independent Canvas2D
landscape were active; the results do not measure physical mobile hardware or
GPU execution time.

| Entry backend | CPU throttling | Painting fps | Frame p95 | Submission CPU p95 |
| --- | ---: | ---: | ---: | ---: |
| WebGPU | 1× | 60.0 | 16.7 ms | 0.7 ms |
| WebGL2 | 1× | 60.0 | 16.7 ms | 0.7 ms |
| WebGPU | 4× | 60.0 | 16.7 ms | 1.6 ms |
| WebGL2 | 4× | 60.0 | 16.8 ms | 1.7 ms |

The timed runs used an immutable build snapshot. Runtime, harness and built-file
SHA-256 checks found no changes during those runs; the renderer SHA-256 is
`f1f331e614425b966b9dd7f5053d08dfdb757acd68147607fe22f82e40194e95`.
Detailed evidence, including failures and integrity manifests, stays in ignored
`.dream-loop/landscape-round5-functional/`.

## Hosted checkpoint

Vercel preview `dpl_ChGLMjcdfhecNVooYbatvteiyEDt` is READY for source commit
`7d4b42bffff29cdb11de76e27c1699b156d645ed`:
https://pulsepainting-eo0kdeo0a-sontakeys-projects.vercel.app.
Provider readiness is not a production release or a hosted capture acceptance.

The first Linux CI run passed the model and view checks, then detected a maximum
two-level channel difference (mean 0.00057525) in the portrait parity test. That
test compared two different canvas copy/resampling paths. A test-only correction
now compares identical destination coordinates without loosening its original
tolerance. Chromium and WebKit app/export suites both pass with zero channel
difference, including the sand-dunes scene on WebKit. The five-second retry
deadline is unchanged, with retries taking 51–89 ms. These checks ran after the
timed suite; runtime files are unchanged. A fresh Linux CI result remains pending.

Physical iPhone camera/flash behavior, sustained thermal performance and native
share-sheet acceptance are not established by these browser checks. npm 0.3.1
publication remains intentionally pending; the vendor artifact is unchanged.
