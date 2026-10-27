# Scrolling pulse lines — 2026-10-27

The live brush writes across six-second rows. At a row edge it lifts for 560ms
while the paper scrolls upward, then resumes on the next row. The active line
stays in the center with the previous line above it; the oldest row fades as it
leaves. The atmospheric landscape stays fixed behind the writing corridor.

The return holds the presentation cursor at the exact seam and draws no
connector. It adds a brief display delay but never accelerates the waveform to
catch up. Acquisition and countdown continue independently. Missing samples and
rejected windows retain their existing pen lifts; no source time or accepted
beats are created by a presentation transition.

SVG row fragments reference immutable source paths, gradients and pigment
masks. Only clipping, whole-row placement and the paper transform change during
capture. At most three row groups are mounted during a return, and normal
writing retains two. The foreground fade mask is limited to the writing area.
The existing raster worker and infrequent background snapshots remain intact.

Finish splits live reconstruction paths at row seams and at the current cursor.
Inserted live endpoints use the exact current bounded source interpolation,
while their terrain destinations use the warmed canonical geometry. This keeps
Finish aligned even midway through a return. Original samples, acceptance,
landscape mapping, saved waveform, metrics and exported artwork are unchanged.

## Functional and visual checks

- Chromium and WebKit app suites pass capture, cancellation/restart, stale
  callbacks, quality attribution, reports, export/retry and unavailable data.
- Both engines pass 320×568, 390×844, 430×932 and 844×390 layouts. The active
  writing corridor remains clear of the header, readouts and floating buttons.
- Both engines pass all sixteen scenes in crisp-brush and live-brush-timing:
  source ownership, immutable ink/materials, real worker transport, no false
  row connectors, no source consumption during returns, bounded mounted rows,
  delayed delivery, pause/hidden recovery and reduced motion.
- Arbitrary-cursor and mid-return Finish checks compare actual SVG endpoints;
  measured first-frame displacement stays below 0.001px, within a 0.025px bound.
  The previous row's fading opacity also survives Finish without jumping.
- At a stepped 60Hz presentation clock, maximum upward paper movement was
  3.48px per frame and writing contact movement was 0.79px. These are motion
  bounds, not wall-clock performance measurements.
- Actual WebKit screenshots were inspected at first line, line end, mid-lift,
  subsequent rows, a longer recording, mid-turn Finish and the finished scene.
- Regenerating the gallery leaves all 49 image files byte-identical. Only the
  renderer provenance hash changes. An independent source review found no
  remaining blocker.

## Release refinements

The first wall-clock pass exposed extra WebKit raster work during the masked
pullback. Limiting that mask to the first 180ms preserves the exact opening
frame while avoiding a full offscreen reconstruction layer for all 1.8 seconds.
A subsequent full session improved pullback cadence from 45.30 to 57.72fps and
the complete reveal from 55.41 to 59.31fps. The same final source/opacity seam
checks still pass.

The initial Linux CI then caught a visual regression: extending the clear
background corridor to the previous row could hide all new pigment during some
20-second accepted-source intervals. The original active-line corridor was
restored, without relaxing the visible-growth assertion. Both engines now pass
all sixteen scene discovery cases; snapshots and quality attribution are
unchanged.

## Final full-session replay

The final source `92adb2503fbc53660d3892e4bdf69180ebaec8a6` passed the full
WebKit 26.6 iPhone 13 replay at 1× wall-clock speed. It completed **180.404 active
seconds in 209.864 wall seconds**, including camera-frame loss, a deliberate
2.5-second main-thread stall and a simulated hidden-tab interruption. No stale
interval earned recording credit; expired samples were dropped, and recovery
did not fast-forward the brush.

The measured flow completed 25 line returns, with zero source advance during
651 sampled return frames, no paper regressions, exact brush/source contact and
a maximum of three mounted rows. Acquisition continued independently of the
brief presentation returns. The automatic Finish, source/scene parity, report,
metrics toggle, retry recovery and waveform export all passed. The report kept
193 accepted beats, 71 bpm, 54.6 ms RMSSD and 51.9 ms SDNN; the exported waveform
was 1200×5920 pixels. No page, console or first-party request errors occurred.

| Phase | Average FPS | p95 interval | Maximum interval |
| --- | ---: | ---: | ---: |
| Active painting | 58.19 | 23ms | 197ms |
| Complete reveal | 59.09 | 19ms | 44ms |
| Pullback | 56.87 | 22ms | 44ms |
| Reconstruction | 60.06 | 18ms | 21ms |

The maximum during capture is retained, including the screenshot readback at
60 seconds. The deliberate 2.5-second stall is excluded only from the labeled
active cadence; all-frame cadence is 57.84fps with a 2504ms maximum. These numbers
are browser measurements on this Mac, not physical-phone guarantees.

The public fixture's original 199.452 seconds was extended by repeating its
last 60 seconds once with monotonically shifted timestamps to cover acquisition
and interruption overhead. That explicit test-input extension was used; it is
not additional real recorded data. Evidence is in
`.dream-loop/scrolling-pulse-lines/session-release/result.json`.

## Slower-CPU browser checks

Isolated Chromium WebGL2-entry runs used 4× and 6× CPU throttling, 40 seconds of
preloaded public source followed by 20 seconds of timed capture, then the
complete reveal. No competing browser tests or gallery generation ran locally.
The live waveform remains SVG; these cases exercise the WebGL2 entry fallback,
not a claim that live ink uses a WebGL renderer.

| CPU slowdown | Active painting | Complete reveal | Live submission p95 | First reveal delay |
| --- | ---: | ---: | ---: | ---: |
| 4× | 60.00fps | 60.00fps | 0.8ms | 27.0ms |
| 6× | 60.00fps | 59.83fps | 1.2ms | 48.7ms |

The 6× whole-replay sample retained one 33.4ms interval; its pullback retained
one 33.3ms interval. These short desktop CPU stress checks do not reproduce
mobile GPU, thermal, camera or background-process conditions. Results live in
`perf-4x/results.json` and `perf-6x/results.json` under the release evidence folder.

## Release evidence

The protected preview `dpl_MQEtqvYUqtoSCtWiKpiwK6yass6G` is READY at exact
feature head `92adb2503fbc53660d3892e4bdf69180ebaec8a6`. All 110 runtime files
matched the frozen build at `2026-10-27T17:11:56.723Z`. Hosted Chromium/WebKit
checks at 390px and 1440px passed camera help, example gallery, sharing dialog
and read-only community, without requesting a camera or writing public data.

Full Linux CI run `40547258159` passed final feature head `92adb250`. PR #18
merged as `979f37507706796485f7bfdbced9d20edb32f2be`; the merge tree is exactly
equal to the tested feature tree. Production `dpl_BfBHFCXFzen45YhXWJDF5QLu2h4U` is READY on that exact merge
commit, with www and apex aliases on the verified standalone project
`prj_14qDiHVKhjNCMJEKvAz4Hg04H6Yo`. All 110 public files matched the frozen
build at `2026-10-27T17:23:43.097Z`; the apex returns 308 to www.

Anonymous hosted Chromium/WebKit at mobile and desktop sizes passed camera
help, examples, sharing and read-only community with no public writes. All four
phone viewports passed the production capture-layout suite in both engines.
These layout checks inject the public accepted-source fixture; they do not
request a real phone camera. GitHub main and the production runtime match.
The README capture was refreshed from the final full session, with its exact
provenance in `docs/media/README.md`. Later documentation-only deployments may
have different IDs while retaining the verified runtime bytes. Evidence lives in ignored `.dream-loop/scrolling-pulse-lines/` and
`.dream-loop/scrolling-ppg/`. Only the checked-in public recording was used.
Browser replay does not validate physical-phone performance, real camera/flash,
physiological accuracy or native sharing. npm publication remains pending.
