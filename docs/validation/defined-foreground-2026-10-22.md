# Defined Quiet Lake foreground

The phone capture made the lake's foreground pulses look oversized and blurred.
This correction shortens the nearer water passages, reduces their wet brush-tip
footprint, and adds a fine pigment contour following the existing measured path.
The distant underwash, shore, mountains and other fifteen scene families retain
their released treatment.

## Data and visual scope

- Original waveform samples, sample times, quality attribution, five-second
  source slots and usable-time density are unchanged. No synthetic beats or
  dicrotic notches are introduced. The original waveform manuscript is unchanged.
- The organic interpolation still passes through every measured knot and keeps
  its existing bounds. The change is artistic projection and pigment placement.
- Foreground passage width decreases by up to 42%. Lake-water brush-tip width
  and height use 46% and 38% of the previous dimensions, with a smaller halo.
- Independent visual review passed the compact candidate at **8/10**, inspecting
  three seeds at 390 pixels and a short recording. The remaining minor issue is
  a small overlap of foreground rows; it does not obscure the overall pulse
  character. Independent code review found no actionable correctness issue.
- All sixteen public gallery examples were regenerated. Only Quiet Lake's
  image, thumbnail and labeled share image changed, plus the Quiet Lake social
  card. The other fifteen families' image hashes are unchanged.

Frozen renderer SHA-256:

`981c49eccf799a030199c2d694bfb7e8af9bc64a9dca3d6d4dfa331b1ef82637`

## Verification

- `npm test` passed: source/provenance model checks; all sixteen family
  compositor, reveal and disposal checks; focused Chromium/WebKit compositor
  regression; actual application callbacks, reports, exports and recovery;
  GPU failure fallback; and the complete desktop gallery checks.
- Additional Quiet Lake parity passed in Chromium and WebKit: seeds 39293, 17
  and 9991, short and dense records, three render checkpoints per case. All
  36 checkpoints were pixel-exact between the live compositor and export, and
  repeated export was pixel-exact. Source objects remained unchanged.
- The application suite also passed separately in WebKit, including export
  encoder/renderer recovery and source-artwork parity.
- Live raster and material budgets remain 2,560,000 and 4,489,216 pixels.
- Dense Chrome replay performance (390 × 844, DPR 3, 150-second preload plus
  20 seconds of streaming data) measured **59.95 fps** active painting with
  both WebGPU and WebGL2 entry backends. At 4× CPU throttling, active painting
  measured **57.40 / 57.05 fps**, respectively. Entry animation measured 60 fps
  in all four cases. The slowest active interval was 50 ms at 4× CPU; these are
  desktop-browser measurements, not physical-phone frame-rate guarantees.
  No runtime or console errors occurred; no raster budget increased.
- This is a renderer-only change. Camera, timing and lifecycle logic did not
  change; the previous release's full interrupted three-minute test is recorded
  separately in [the landscape release evidence](landscape-accepted-2026-10-22.md).
  It was not rerun for this visual correction.

Evidence and review images are in ignored `.dream-loop/foreground-pulse/`.
The public gallery's checked-in manifest records reproducible source and image
hashes. Browser replay does not establish physical iPhone camera, thermal,
physiological-accuracy or native-share validation.

The older isolated transparent-prefix zero-alpha diagnostic remains a separate
known native-raster precision limitation; this change does not claim to resolve
it or relax its threshold.
