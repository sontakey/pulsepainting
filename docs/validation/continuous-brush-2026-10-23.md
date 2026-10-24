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

Detailed frozen-build results and production verification are recorded below
once the release gates finish. Development evidence is under ignored
`.dream-loop/continuous-brush/` and `.dream-loop/continuous-capture/`.

## Rejected performance probes

OffscreenCanvas worker rendering was tested and rejected: all sixteen WebKit
scenes matched canonical pixels, but Chromium differed. The worker was removed
from the runtime. A smaller raster-flush sink was also explored; its limited
speed benefit did not justify changing the canonical rendering path. Neither
probe is part of this release.
