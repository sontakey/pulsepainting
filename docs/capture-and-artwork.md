# Capture and artwork contract

Pulse Painting is a local, camera-based art experience by ChatPPG. ppg-js owns
camera acquisition, signal processing, acceptance and computed metrics. This app
owns composition, material, presentation and export; it does not infer stress,
emotion, personality or health from the resulting scene.

## Real traces, persistent scenes

A session chooses one of sixteen landscape families and saves a random seed before
capture. The family and layout are independent of recording duration and metric
values. All geometry stays in memory. Restart creates a new scene; resize, recovery,
reveal and export retain the existing one.

Artwork uses the selected analysis channel's filtered waveform from the matching
`monitor.engine.lastWindow`. The red-channel display callback supplies frame
presence, not the artwork's shape. Approximately five-second, nonoverlapping
artwork windows pass the existing engine quality gate before contributing marks;
metric readouts retain their independent one-second cadence. This is a delayed
rendering of accepted measurements, not a prediction of future pulse beats.

Accepted windows are amplitude-normalized for display, then split into continuous
source runs. Timestamp gaps and invalid samples stay disconnected. The user
approved mapping real traces along curved terrain and organically interpolating
between recorded points in the artwork. This is an artistic transformation, not
an analysis plot. Original samples remain unchanged, with their timing, channel,
quality, intervals and deterministic artistic mapping in the private descriptor.
The original waveform manuscript and scientific report remain separate and
unchanged. Curvature, pigment wash, grain and within-stroke gradients must not
manufacture accepted beats or fill missing intervals with purported recordings.

Every family has its own composition rules. Progressively interleaved slots let a
longer usable recording become denser without moving earlier strokes. Each slot
has a five-second usable-time budget; fragmented runs occupy partial slots rather
than each consuming a full placement. Usable time is the sum of accepted drawable
intervals, excluding gaps and duplicates. Raw frame count, fragment count, wall
time, rejected noise and repeated callbacks cannot increase density.
Short recordings remain intentionally sparse within the same selected family.

Families: Meadow, Open ocean, Alpine peaks, Quiet lake, Coastal cliffs, River valley,
Rolling hills, Sand dunes, Desert mesas, Island archipelago, Waterfall gorge,
Glacial fjord, Reed wetland, Forest canopy, Sea of clouds and Aurora night.

## Capture and reveal

The flow is ready → placement → capture → landscape reveal → report. The camera
preview, current pulse/RMSSD/SDNN and safe-area-aware floating controls stay anchored
while the artwork camera follows the active accepted stroke. Pause artwork freezes
visual progress while recording continues to retain accepted data. Resume reveals
the saved work rather than fabricating a replacement interval.

Finishing stops acquisition through the existing lifecycle, finishes the accepted
paint frontier, and pulls back from the same scene over roughly 3–4 seconds. The
report uses the same scene descriptor and rendering code. No end-of-session image
generation, reseeding, layout replacement or data selection occurs.

Reduced motion uses a stationary full composition and immediate completion.
Hidden pages stop decorative frames. Cancel, restart and page lifecycle changes
settle or dispose pending animation without resurrecting an old session. Accepted
data and measurement timing never depend on rendering success or animation cadence.

The protocol clock counts adjacent fresh processing-frame timestamps only while
the page is visible. A source or delivery gap over 250 ms earns no time credit;
recovery starts with the next fresh frame without catching up the missing interval.
The scientific vendor bundle is immutable and verified by the build.

## Rendering budget

The landscape uses cached paint layers, bounded raster sizes, an active paint
frontier, and composited camera transforms. Completed pigment is not regenerated
on every animation frame. Full-resolution export runs after the moving reveal.
The existing optional Three.js 0.186.1 WebGPU/WebGL2 compositor remains responsible
for painted entry transitions, with a Canvas2D fallback. Its absence or context
loss cannot erase the landscape or change accepted data.

Approximately 60 fps is a target, not a universal device guarantee. Evidence must
identify renderer, viewport and hardware; desktop mobile emulation cannot establish
physical iPhone camera, flash, thermal or native share-sheet behavior.

## Eligibility and exports

Artwork eligibility is independent of HRV eligibility. A few accepted traces can
produce a sparse scene while metrics remain unavailable under their existing
rules. No accepted traces means no personal artwork or enabled artwork share;
show placement/retry guidance. Rejected windows never add paint or density.

The report retains its readable scientific charts and expandable analysis. The
primary floating actions are Share artwork and Measure again. Save artwork,
Save manuscript, Save report and debug-log actions remain in the menu.

The portrait PNG is 1080 × 1350. Its square painting comes from the same scene as
capture, with typography outside the scene. Summary metrics are opt-in and change
only the footer; they never crop or move the painting. Prepared files allow native
sharing directly within the tap; unsupported sharing falls back to downloading.
Cancellation returns quietly, and errors retain the scene/report.

The image contains the rendered pixels and standard image-format information
(such as dimensions and color space). No raw samples, private source map, seed or
session identifier is embedded in metadata. Explicit debug-log saving is a separate action.
The existing local session log behavior remains unchanged. The original full
manuscript is still available as a separately named export.

## Local development and verification

Use Node 24 and `npm ci`, then `npm run build`. The self-contained `dist/` is
served by `npm run serve` at http://127.0.0.1:5173. Actual phone capture requires
compatible hardware and a secure context. The desktop QR opens
https://www.pulsepainting.com/. The apex domain redirects to www.

Core files:

- `app/app.js`: acquisition integration, lifecycle, metrics and report.
- `app/landscape.js`, `app/landscape.css`: persistent composition and live camera.
- `app/portrait.js`: same-scene raster export, optional metrics and sharing.
- `src/paint-gpu.js`: optional Three.js entry compositor.
- `test/e2e/`: accepted-data, layout, export, interruption and rendering checks.

Run the app, landscape, full WebKit session, performance, fallback and QR scripts
listed in package.json. Browser tests use the public replay fixture and mock camera
I/O. Test-only edge-case traces are not product fallback data. Keep test artifacts
in ignored `.dream-loop/`, and record actual results in `docs/validation/`.

The primary Vercel project builds `dist/` from this repository and serves it at
https://www.pulsepainting.com/. ChatPPG also retains its separately pinned app
integration. Local build, source merge, deployment readiness and public verification
are separate gates; a working older deployment does not establish the new release.
