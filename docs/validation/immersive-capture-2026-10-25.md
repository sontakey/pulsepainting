# Immersive capture and balanced keepsakes — 2026-10-25

## Behavior

Recording fills the viewport with paper and watercolor. Pulse, HRV and gated
estimated Breathing overlay the top; the continuous measured pulse is centered.
The LIVE preview, signal bars and floating Cancel reading / Finish painting
controls remain reachable. About your readings opens above the dock without
resizing or moving the painting.

The live nib now reads cached source time/value interpolation directly. It no
longer prepares the terrain's pigment geometry on the main thread when entering
each new stroke; the raster worker already prepares that geometry. Playback
never accelerates to empty a backlog. A delayed animation frame advances at most
33.333 milliseconds of source; missing or rejected source remains a real pen
lift rather than invented pulse data. The final reconstruction retains all
accepted samples, including any not yet drawn when the recording ends.

The atmospheric landscape forms through quiet, monotonic pigment additions
triggered by actual accepted peak timestamps. Each change settles over roughly
1.2 seconds. Fixed, low-resolution background snapshots are prepared at most
once per five-second usable-data milestone, not on every beat. Overall opacity
is limited to 0.58 and the central writing corridor stays clear. Empty beat
metadata cannot invent progress; older saved scenes retain calm time fades.
No health interpretation or new physiological algorithm is added.

The 1080×1350 keepsake makes the landscape larger by trimming only untouched
source paper, with conservative bounds and uniform scaling. Every painted pixel
is retained. The scene name has its own padded cursive band; metrics sit higher
with more space above the date and website footer. The full gold frame and
optional metrics remain. Night scenes retain their complete square composition.

## Verification

- Chromium and WebKit source-timing checks pass across all 16 scene families:
  zero live main-thread terrain preparation with raster workers, exact measured
  frontier parity, unchanged deposited pigment, bounded stalls, rejected-window
  pen lifts and stable late-data recovery.
- Both engines pass immersive layout checks at 320×568, 390×844, 430×932 and
  844×390. Art fills the viewport, readouts clear the pulse, controls are at least
  44px, and expanded details/graphs do not resize the canvas or overflow.
- Both engines pass print checks across all 16 scenes: zero cropped pigment,
  exact cached-source pixel parity and a metrics toggle confined to its band.
  River Valley, long titles, metrics-off and Aurora were visually inspected.
- Sharing regression checks pass in both engines. These use mocked native-share
  support; they do not establish actual native share behavior on a phone.
- Independent runtime review found no blocking issues.

Ignored local evidence is in `.dream-loop/immersive-capture/`,
`.dream-loop/live-brush-timing/verification/` and `.dream-loop/balanced-print/`.
Timed session, performance, Linux CI and hosted deployment results follow. Browser replay is not physical-phone, camera, thermal or
physiological-accuracy validation. npm publication remains pending.

## Timed replay and release

Capture source: `4f88137b2e1e28809c4fc9cadf8dd456a2f91ecf`. Final PR #16
head: `098a752a422d5a56917f6b312a6ef355b7a2158a`; the follow-up regenerates
gallery keepsakes and refreshes provenance, with unchanged capture code.
The unchanged pinned vendor hash and self-contained build pass. Complete local
Chromium/WebKit app suites pass, including cancellation, stale callbacks,
unavailable data, report calculations and artwork recovery. Both engines pass
all sixteen background scenes, actual peak attribution, empty and legacy beat
metadata, pause/hidden recovery, cleanup and reduced motion. Each prepared
snapshot contains new actual pigment; visible growth outside the protected
foreground corridor is checked across accumulated twenty-second periods.

The full WebKit replay completed 180.404 seconds of active measurement in
209.860 seconds of wall time, including a four-second camera-frame pause,
a deliberate 2.5-second main-thread stall and four seconds of simulated hidden
visibility. All three resumed without counting interrupted time. It retained
31 background discoveries, no backward source movement or future-source drawing,
and exact exported landscape pixels. Final report values agree with the pinned
engine; report PNG export passes.

Active painting averaged 59.91fps (18ms p95, 181ms maximum). Final reconstruction
averaged 60.02fps (18ms p95, 25ms maximum). These active figures exclude the
deliberate 2.5-second stall. The retained 181ms maximum prevents a claim of
perfectly smooth performance. The figures retain a 198ms screenshot readback
at the sixty-second checkpoint, so that maximum is not a pure renderer cost.
Camera delivery was mocked, and the public
fixture's final minute was extended at increasing timestamps when needed.

A matched 35-second Chrome replay under 4× CPU throttling measured 60fps live
drawing both before and after this change. The new run's live callback p95 was
0.6ms, with a 16.8ms longest live interval; reveal averaged 59.83fps with one
33.4ms interval. A separate 6× run measured 60fps live drawing, a 1.0ms callback
p95, and 59.48fps reveal (50ms maximum). These short desktop stress runs support
the bounded rendering design, not a guarantee for every phone or thermal state.

All 110 protected-preview assets matched the frozen local build at
`2026-10-25T21:30:20.942Z`. Hosted preview Chromium/WebKit checks passed at
390 and 1440px, covering entry, camera guidance, gallery, example sharing and
read-only community access without camera acquisition or public writes.
Runtime code changes are confined to `app.css`, `app.js`, `index.html`,
`landscape.js` and `portrait.js`. All sixteen gallery share JPEGs and their
manifest were regenerated through the same new keepsake layout; the landscape
WEBPs, thumbnails and social image remain byte-identical.

Renderer SHA-256:
`277a3163b8d797944e264e2775f9232645f3f1c9cbcaead4865ce72d78802849`.


## Public release

Complete Linux `npm test` passed final head `098a752` in Actions run
[40235656573](https://github.com/sontakey/pulsepainting/actions/runs/40235656573).
The first run caught stale gallery renderer provenance; regenerating all gallery
share cards and the manifest resolved it without relaxing the check.

[PR #16](https://github.com/sontakey/pulsepainting/pull/16) merged as
`42a0fc0a83569d2617d7747cc2363bfd7a4fc47a`. Its tree matches the tested head.
The Git integration deployed that exact merge automatically to production:
`dpl_Fpj8xpvDo7n8xHWW3LfKNtwUaNXB`, READY at https://www.pulsepainting.com/.
At `2026-10-25T21:47:11.131Z`, all 110 public assets matched the frozen build;
the apex returned 308 to the primary www destination.

Anonymous Chromium/WebKit checks at 390 and 1440px passed at
`2026-10-25T21:47:21.472Z`, covering entry, camera guidance, gallery and sharing.
There were no page or HTTP errors, camera requests or public writes; cancelled
image requests during dialog/navigation transitions were retained in the log.
A separate WebKit production layout check passed all four mobile viewports,
including expanded details, unavailable readings and the centered waveform.

Later documentation-only deployments can have a different ID while serving the
same verified runtime. Existing open Safari tabs should be refreshed before a
new reading. These are browser replay and deployment results, not physical-phone,
thermal, camera, native-share or physiological-accuracy validation. npm 0.3.1
publication remains pending.
