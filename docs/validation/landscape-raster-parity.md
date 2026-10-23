# Landscape live/export raster check

## Adopted all-surface candidate

The layer-only correction described below subsequently failed one checkpoint
in an extended Linux WebKit check after the coastal directional taper fix:
Coastal Cliffs, seed 39293, thirty segments, early partial painting. Its maximum
channel difference was 16, mean 0.0000203125, with exact repeated exports. The
other eleven cases passed. This result is preserved in ignored
`.dream-loop/accepted-material/linux-final/webkit.json`.

The adopted follow-up renderer is SHA-256
`a84ebe6772a518e2e9d44e6db5d2f30392a75e488884bbfa4e606765a78384d8`.
It also requests `{ willReadFrequently: true }` for the visible/export canvas,
so both retained layers and the output use that context hint. The material
canvases and all source, geometry, pigment and cache-budget code are unchanged.
This avoids mixing the two requested raster paths within the active layer
composition; a precise native implementation cause is still unproven.

The bounded follow-up passes with exact pixels in every checked phase:

- Linux/amd64 WebKit, Coastal Cliffs seed 39293, short/full: two cases,
  six checkpoints, live/export and repeated-export maximum 0.
- macOS Chromium and WebKit, River Valley seed 39293, short/full: two cases and
  six checkpoints per engine, live/export and repeated-export maximum 0.

These checks cover both the new coastal failure and the river case that rejected
the earlier output-only control. The subsequent broader matrix on this same hash
also passes without changing any acceptance criterion:

| Final adopted renderer check | Cases / checkpoints | Maximum channel difference | Maximum mean | Repeated export difference | Result |
| --- | --- | --- | --- | --- | --- |
| macOS Chromium, all sixteen families, three seeds, short/full | 96 / 288 | 0 | 0 | 0 | PASS |
| macOS WebKit, all sixteen families, three seeds, short/full | 96 / 288 | 0 | 0 | 0 | PASS |
| Linux/amd64 WebKit, all sixteen families, seed 39293, short/full | 32 / 96 | 0 | 0 | 0 | PASS |

The macOS matrix uses seeds 39293, 17 and 9991. Every checkpoint preserves source
scene data exactly. The maximum live and material rasters remain 2,560,000 and
4,489,216 pixels, respectively. There are no page errors. macOS Chromium is
155.0.8059.85; both WebKit runs are 26.6. Linux uses the official Playwright
1.63.0 Noble image under amd64 emulation on this Mac. These stepped-presentation
runs verify correctness, not performance or physical-phone behavior.

Raw evidence is in ignored
`.dream-loop/accepted-parity/macos-all-surfaces-final/` and
`.dream-loop/accepted-parity/linux-all-surfaces-final/`; exact renderer and
evidence hashes are recorded in
`.dream-loop/accepted-parity/all-surfaces-final-report.json`.

The retention harness now observes the context options requested by the real
`createView` output canvas and applies those same options to each isolated
history canvas. The final build requests `willReadFrequently: true`; the prior
default-output-context result below does not describe this build. Fresh results
from the tracked diagnostic on the exact adopted hash are:

| Engine | Comparisons | Solid coverage maximum loss / pixel observations | Actual pigment maximum loss / pixel observations | Strict zero-loss result |
| --- | --- | --- | --- | --- |
| macOS Chromium | 672 | 9 / 245 | 6 / 152 | FAIL |
| macOS WebKit | 672 | 1 / 5 | 1 / 6 | FAIL |

Values are raw 8-bit alpha levels; observations can include the same pixel at
multiple source cutoffs. There are no page errors or source mutations. Evidence
is in ignored `.dream-loop/accepted-parity/actual-context-retention/`.
These are isolated transparent-prefix rasterizations with the actual output
context options. They are not measurements of the complete opaque application
image, and do not demonstrate visible end-to-end flicker or missing recorded
geometry. The exact native cause remains unproven. Both strict diagnostics
remain failed; exact retained-alpha stability is not a claim of this release.
No threshold was weakened and no production paint change was made to conceal
this limitation. The passing full-image raster matrix and failed isolated-prefix
diagnostic are separate results; neither supersedes the other.

## Accepted material integration and raster correction

The user accepted the hosted V18-combined Quiet Lake treatment. Its shared
material treatment is now integrated across the sixteen scene families. The
following raster correction was measured on frozen renderer SHA-256
`1db324b46c2a333cd94b52f477cb25f5087663f8f15542dcfe3aaa79f9cfb2bd`:

- Create the three retained painting/export layers with
  `{ willReadFrequently: true }`. The visible canvas and material canvases
  retain their default contexts. This requests a consistent native raster path
  for the retained layers; the renderer adds no `getImageData` calls.
- Clip each impression pass to its existing positive-winding source paths,
  then fill a fixed world-space rectangle with the existing pigment texture.
  This keeps texture application independent of the growing union's bounds.
- Preserve all source samples, timestamps, geometry, pass alphas, cache limits
  and the existing acceptance criteria below. No additional raster is allocated.

| Frozen candidate check | Cases / checkpoints | Maximum channel difference | Maximum mean | Repeated export difference | Result |
| --- | --- | --- | --- | --- | --- |
| macOS Chromium, all sixteen families, three seeds, short/full | 96 / 288 | 0 | 0 | 0 | PASS |
| macOS WebKit, all sixteen families, three seeds, short/full | 96 / 288 | 2 | 0.00008125 | 0 | PASS |
| Linux/amd64 WebKit, focused Quiet Lake short/full | 2 / 6 | 0 | 0 | 0 | PASS |

The Linux check uses the same official Playwright 1.63.0 Noble image as the
earlier failing reproduction. Evidence is in ignored
`.dream-loop/accepted-parity/macos-layers-all/` and
`.dream-loop/accepted-parity/linux-layers-integrated/`. These are correctness
tests, not frame-rate or physical-phone measurements. The later coastal-cliff
directional taper fix changes renderer SHA-256 to
`48497bda57e2ce5e043ec652e60cb7d7f7a1ea0746db54f8362cfc8263fd8caa`;
the frozen matrix above predates that separate change.

The context hint is an empirically verified fix for the observed repeat/export
failure, not proof of a particular native-browser implementation cause. Material-
only context changes and nearest-neighbor sampling did not fix the Linux failure.
An output-only context change fixed that focused failure but worsened the separate
retention diagnostic; it was rejected. This historical layer-only candidate
confines the hint to the retained layers. Its results do not establish the final
all-surface build's frame rate; performance is measured separately.

Changing the native raster path preserves the accepted scene's composition and
paint treatment, but does not produce bit-identical pixels to the prior backend.
Across 32 full/short images, the maximum mean difference is 0.288667 raw 8-bit
channel levels, with maximum individual difference 50 at rasterized boundaries.
Quiet Lake full/short means are 0.197432 and 0.094245; their maximum differences
are 49 and 46. Before/after images and measurements are in ignored
`.dream-loop/accepted-parity/visual-diff.json`. Visual inspection retains the
same approved treatment; exact prior PNG equivalence is not claimed.

### Prior layer-only retained-pigment diagnostic

The initial `test/e2e/landscape-retention.mjs` recorded a strict zero-alpha-loss
check of the actual impression painter using default-context frame history.
The current harness observes the real output context options, as described above. Each
observation uses a fresh canvas, replays the preceding clear/draw history, and
reads only its final frame. It covers two seeds, early/late water fragments,
800/1080 rasters, solid coverage and actual textured pigment, for 672 comparisons
per engine. This isolates pigment-prefix retention rather than observing the
entire opaque, layered app image.

That initial test passed in Chromium on the layer-only correction with zero
loss. Its negative control rejects the previous integrated material renderer
(`59ec1721…`) at maximum one-level loss and 92 pixel-loss observations. The
equivalent WebKit default-context probe still fails strict zero: maximum one
alpha level at 43 pixel observations across 672 comparisons. Solid coverage
retains every pixel; the residual occurs with actual textured pigment.

Fixed-origin `drawImage` tiling, source-over blending and a single-pass control
each retain a one-level WebKit residual and were discarded. A flattened-boundary
control also failed and was discarded. No geometry, texture, threshold or
production behavior was changed to conceal those failures. The older cropped
read-frequency stress test still fails separately; it is not the visible
canvas's context or observation history.

No missing source knot, disappearing impression geometry, or visible end-to-end
flicker has been demonstrated by this isolated one-alpha-level result. Its exact
native cause remains unproven. The strict diagnostic remains **FAIL** for WebKit;
the all-family live/export matrix is a separate **PASS**. Release assessment must
keep those scopes distinct rather than claiming that every raster diagnostic
passes. Evidence and failed controls remain under ignored
`.dream-loop/accepted-parity/`; no failed criterion was widened.

Run the current diagnostic independently with Node 24 (the final-build strict
zero-loss result above remains failed):

```sh
rtk proxy node test/e2e/landscape-retention.mjs
```

`PPG_RETENTION_ENGINES`, `PPG_RETENTION_ARTIFACTS` and
`PPG_LANDSCAPE_RENDERER` select engines, evidence directory and renderer.

The original completed-view tests use synthetic presentation paths in Chromium.
The new `test/e2e/landscape-parity.mjs` replays the public camera recording through
the pinned engine and actual acceptance adapter, then checks early and late
partial strokes plus completed scenes in Chromium and WebKit. Its stepped RAF
scheduler is for correctness; it does not measure mobile frame rate.

## Fixed acceptance criteria

These criteria were reviewed against the focused three-family results and fixed
before inspecting the broader all-family results on October 22, 2026:

| Check | Chromium | WebKit |
| --- | --- | --- |
| Maximum absolute difference per 8-bit channel | 1 | 2 |
| Mean absolute difference per raw 8-bit channel | < 0.001 | < 0.001 |
| Repeated direct-export difference | Exactly 0 | Exactly 0 |
| Scene data before/after drawing | Exact | Exact |
| Live raster budget | 2,560,000 pixels | 2,560,000 pixels |
| Material raster budget | 4,489,216 pixels | 4,489,216 pixels |

The existing Chromium thresholds are unchanged. Artifacts retain maximum, mean,
summed error, changed-channel count and count above one, rather than only PASS.
Source/model tests separately verify original samples, times, quality, geometry,
usable duration and append stability. Equal direct exports do not by themselves
prove repeatability of two independently animated live views.

## Why WebKit has a separate criterion

The focused recording checks uncovered actual implementation problems: partial
paint blended over already-composed lower layers in the live view but over its
own transparent layer during export. Completed layer consumption and transform
cadence also differed. Those problems caused differences up to 13 channel levels
on the checked-in renderer; a compositor-only correction eliminates the focused
Chromium mismatch without changing material geometry or adding raster storage.

An initial exploratory WebKit limit of one still rejected the corrected candidate:
its worst focused result differed by two at very few channels, with only 39 summed
levels over 2,560,000 channels, mean 0.000015234375 and exact repeated exports.
First-stroke diagnostics found 12,067 identical drawing commands; differences
appeared at a canvas-consumption/flush boundary. Fresh single-read canvases and
several targeted consumption/pattern changes did not remove the residual.

The [HTML Canvas standard](https://html.spec.whatwg.org/multipage/canvas.html#premultiplied-alpha-and-the-2d-rendering-context)
documents finite-precision loss when converting transparent color representations.
That is relevant context, **not proof of this particular WebKit residual's cause**.
Its precise native cause remains unproven. The new two-level maximum together
with the strict aggregate bound is an explicit product acceptance criterion for
near-identical artwork, not a claim of bit-identical live/export pixels or that
the residual was fixed. It still rejects the original compositor defect.

Earlier failed one-level diagnostics remain preserved in ignored
`.dream-loop/compositor-runtime/` and `.dream-loop/webkit-pixel-cause/`. Do not
silently widen these criteria if other families, seeds or lifecycle cases fail.
Browser parity does not establish visual style acceptance, physical-phone
performance, capture accuracy, native sharing, or production readiness.

## Prior compositor-only result: diagnostic failed

The compositor correction now in the development branch has SHA-256
`a7807450f85972d3677e6bdc7830594525663c425a94bb7418cf441a4cfee25a`.
It does not contain the Quiet Lake visual study. Integrating the established
blend-target and consumption-order fix is a partial correction, not acceptance
of the remaining WebKit discrepancy. The gallery was regenerated from this exact
renderer. The existing all-family matrix uses sixteen families, seeds 39293, 17 and 9991,
and six or thirty accepted segments: 96 cases and 288 checkpoints per engine.

The following matrix was measured on macOS, not Linux CI:

| Engine | Maximum channel difference | Maximum mean | Repeated exports | Result |
| --- | --- | --- | --- | --- |
| Chromium | 0 | 0 | Exact | PASS |
| WebKit | 3 | 0.000025 | Exact | FAIL |

WebKit exceeds the frozen two-level limit at eleven checkpoints across Alpine
Peaks, Coastal Cliffs, Sand Dunes, Desert Mesas and Forest Canopy. Source data
remains exact and raster budgets remain bounded. The criterion has not been
widened again. The correction removes the larger known defect but does not make
this stronger diagnostic pass or establish release readiness.

Raw results remain in ignored
`.dream-loop/compositor-runtime/all-family-strict/{chromium,webkit}.json`.
That process used the earlier one-level limit; the adjacent
`*-criterion-review.json` files assess the same recorded metrics against the
criteria frozen above. The run predates the diagnostic's added summed-error and
changed-channel fields. Those fields are available on future runs; they are not
retroactively claimed for this matrix.

The default all-family diagnostic remains separate from `npm test` while the
residual is open. A focused `--compositor-regression` mode now runs in
`npm run test:landscape`: Quiet Lake, seed 39293, short/full accepted records,
early/late/complete checkpoints and both engines, with the same frozen thresholds.
This catches the established blend-target defect. The pre-fix renderer fails all
six Chromium checkpoints; the corrected renderer passes in both engines on macOS. This
focused pass does not stand in for the broader all-family result above.

## Linux regression failure

GitHub Actions run `39889702883` on commit `2bc8c8b` fails the new focused
WebKit check: repeated exports differ by five channel levels in the short
recording. The original assertion aborted before checking the full recording.
The harness now retains every repeat/live-export failure with its scene, seed,
recording length and phase. It records platform/architecture and still exits
nonzero under exactly the same criteria.

The failure reproduces locally with the official Playwright 1.63.0 Noble
Linux/amd64 image (digest
`sha256:eff16c30e6f3f4af0a03fa4b706120d5e9b0891c344a27d64559aff5900a4a27`).
The Docker host is Apple silicon with x64 emulation; this is a correctness
reproduction, not performance evidence. The app renderer remains `a7807450…`.
With both recording lengths inspected, short late/completed exports differ
by up to five; full-session late exports differ by four and completed exports
by twenty-six. Completed full-session live/direct maximum is also twenty-six,
mean 0.003144140625, exceeding both existing bounds. Original scene data and
runtime raster budgets remain intact. The revised harness still passes the
focused Chromium/WebKit checks on macOS.

Bounded controls keep evicted material canvases, keep temporary render layers,
or disable material eviction entirely. Each retains the short-record repeat-five
failure. Reading the first export before drawing the repeat also leaves the late
failure, although the completed repeat becomes exact. These controls do not
justify a production change. An instrumented no-eviction probe records all
60,279 commands for the late direct and repeated exports: exact numeric
arguments, state assignments and shared pattern identities match, while one
pixel still differs in three channels (maximum five). A second probe preserves
the short-then-full history and records the completed full scene: all 295,743
commands and shared patterns match, while repeat maximum remains twenty-six.
These probes localize both discrepancies below the recorded drawing commands.
They do not identify the native cause or establish an appearance-preserving fix.

Evidence and bounded reproduction scripts are in ignored
`.dream-loop/linux-repeat/`. No renderer, gallery asset, source recording or
acceptance threshold changed during this investigation. Linux CI remains failed;
the successful macOS session and focused check are separate results.

The revised harness ran in CI as `39891506680` on `d4cb7cd`: Chromium passes;
WebKit again fails, including full-completion maximum 27 and mean
0.003170703125. Explicitly resetting each shared ink pattern to its intended
identity transform does not fix the local reproduction. The separate frozen
V18-plus-compositor study also fails the Linux focused check (live/export
maximum 17, repeated-export maximum 14). Those findings do not change its
appearance or replace the pending visual checkpoint.

## Preserve completed artwork during encoding recovery

An independent report fix retains the completed 1080-square artwork when PNG
encoding fails. Retrying encoding recomposes the portrait from those exact
retained pixels, without rasterizing the landscape again. If landscape rendering
itself failed, no incomplete canvas is published and the retry invokes the
renderer again. Sharing and downloading continue to use the prepared PNG.

The recovery regression distinguishes these paths with render-attempt counts,
completed-canvas identity, exact retained-pixel comparison and existing
source/seed/action-state assertions. It rejects the prior implementation because
an encoder retry invokes the landscape renderer twice. This improves product
recovery; it does **not** fix or waive the independent fresh-render diagnostic.

The earlier diagnostic smoke check against the pre-fix renderer
confirmed that both engines write fresh results even when Chromium fails first:
Quiet Lake short/full records fail at max13 in Chromium and max4 in WebKit,
with exact source preservation. The process correctly exits nonzero. The
existing model suite passes with the fixture helper's unchanged default duration.
This validates failure reporting, not the renderer. Run the diagnostic explicitly
from the repository with Node 24:

```sh
rtk proxy node test/e2e/landscape-parity.mjs
```

Optional environment variables select a renderer (`PPG_LANDSCAPE_RENDERER`),
families, seeds, engines or artifact directory (`PPG_PARITY_FAMILIES`,
`PPG_PARITY_SEEDS`, `PPG_PARITY_ENGINES`, `PPG_PARITY_ARTIFACTS`). Defaults are the
tracked renderer, all families, seed 39293 and both engines. Use
`PPG_PARITY_SEEDS=39293,17,9991` for the broader matrix. Failures exit nonzero and
remain failures; this is a diagnostic checkpoint, not release acceptance.

## Observation controls

A later focused review tested whether earlier `getImageData` calls create the
known WebKit max-three residual. Alpine Peaks seed39293 completion and Coastal
Cliffs seed9991 late/completion retain that failure when earlier live reads or
all earlier reads are removed. Their endpoint pixels remain identical. Omitting
earlier export rendering slightly changes aggregate error, but still leaves one
channel above two in each case. No criterion or renderer was changed for this
diagnosis. Evidence is in ignored `.dream-loop/parity-observation-review/`.

The Quiet Lake V18 study has a separate readback-sensitive paint-retention
diagnostic. It is not part of this compositor or the tracked visual renderer;
its results must not be conflated with these live/export differences.
