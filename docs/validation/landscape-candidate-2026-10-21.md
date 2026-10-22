# Landscape candidate validation

This is a draft implementation, not a production release or visual acceptance.
The runtime under review is on `codex/landscape-reveal`. The existing public
site still serves the earlier manuscript application.

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

The full WebKit session and longer performance measurements are being run on an
immutable build snapshot. Results will be added when those processes finish.
Local detailed evidence, including failures and SHA-256 manifests, stays in the
ignored `.dream-loop/landscape-round5-functional/` directory.

Physical iPhone camera/flash behavior, sustained thermal performance and native
share-sheet acceptance are not established by these browser checks. npm 0.3.1
publication remains intentionally pending; the vendor artifact is unchanged.
