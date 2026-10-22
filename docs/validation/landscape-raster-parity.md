# Landscape live/export raster check

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

## Current result: diagnostic still fails

The compositor-only scratch candidate has SHA-256
`a7807450f85972d3677e6bdc7830594525663c425a94bb7418cf441a4cfee25a`.
It does not contain the Quiet Lake visual study and has not replaced the tracked
renderer. The all-family matrix uses sixteen families, seeds 39293, 17 and 9991,
and six or thirty accepted segments: 96 cases and 288 checkpoints per engine.

| Engine | Maximum channel difference | Maximum mean | Repeated exports | Result |
| --- | --- | --- | --- | --- |
| Chromium | 0 | 0 | Exact | PASS |
| WebKit | 3 | 0.000025 | Exact | FAIL |

WebKit exceeds the frozen two-level limit at eleven checkpoints across Alpine
Peaks, Coastal Cliffs, Sand Dunes, Desert Mesas and Forest Canopy. Source data
remains exact and raster budgets remain bounded. The criterion has not been
widened again. No compositor correction is integrated on the basis of this run.

Raw results remain in ignored
`.dream-loop/compositor-runtime/all-family-strict/{chromium,webkit}.json`.
That process used the earlier one-level limit; the adjacent
`*-criterion-review.json` files assess the same recorded metrics against the
criteria frozen above. The run predates the diagnostic's added summed-error and
changed-channel fields. Those fields are available on future runs; they are not
retroactively claimed for this matrix.

The new diagnostic is intentionally separate from `npm test` while the known
defect is open. A passing existing CI run does not mean this stronger check
passes. A final diagnostic smoke check against the unchanged tracked renderer
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
