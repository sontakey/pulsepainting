# One live Signal meter — 2026-10-27

Recording now shows **Pulse**, **HRV** (RMSSD), and **Signal**. Signal replaces
the sparsely available breathing tile. It is the pinned engine's existing
0–100 recording-quality score, computed at one-second hops over five-second
windows. Numbers are rounded directly from that score; they are not animated or
artificially varied. The small cobalt-to-teal fill eases for 450ms using CSS
transform only. Reduced motion disables easing.

There is one quality meter in the metrics row. The duplicate bars beneath LIVE
are removed; that area shows brief issue guidance only when needed. About your
readings explains Signal as recording clarity, not health. Supported breathing
estimates remain in the detailed final report. The estimator, camera pipeline,
quality acceptance, original samples, renderer and artwork exports are unchanged.

Finite scores are clamped to 0–100. Rejected quality displays zero and clears the
fill immediately; missing or invalid scores show `--`. Gaps, hidden visibility
and nonprocessing callbacks clear the score. Duplicate or older source timestamps
cannot replace or refresh a reading, including after camera recovery. A newer
source window is needed to restore it. Absent fresh windows expire at a
2.5-second threshold, checked on the existing one-second UI timer. Repeated
clearing callbacks do not repeatedly mutate the DOM.

## Verification

- Build verifies the immutable vendor and registered Sketchbook artifacts.
- Chromium and WebKit app suites pass capture, cancellation/restart, stale
  callback isolation, report/export and artwork recovery/parity checks.
- Focused cases cover score rounding/clamping, missing and invalid inputs,
  rejected quality, source gaps, stale/duplicate/older windows, hidden and
  nonprocessing recovery, reset, single-meter accessibility and reduced motion.
- Both engines pass immersive layout checks at 320×568, 390×844, 430×932 and
  844×390. Readings remain above the fixed buttons; details and charts scroll
  without moving or resizing the painting. Screenshots were inspected.
- Independent source review found no blockers.
- Full WebKit wall-clock replay completed 180.434 active measuring seconds in
  210.144 seconds. A four-second camera-frame pause, 2.5-second main-thread
  stall and four-second simulated hidden period recovered with no missing-time
  credit. Report, reveal, exports and retry recovery passed with exact artwork
  parity. Live painting averaged 59.06fps (23ms p95, 267ms maximum); reveal
  averaged 57.38fps (22ms p95, 29ms maximum). The live figure excludes the
  deliberate stall but retains screenshot overhead and other slow frames.
  Camera I/O was mocked; the public fixture's final 60 seconds were repeated
  with increasing timestamps to cover acquisition and interruption overhead.
- The public fixture audit yields 168 accepted windows among 185 windows, with
  scores ranging from 89 to 100 and 11 distinct rounded values. Fifty-one
  accepted windows score 100. Strong signal can legitimately remain steady.

Evidence lives in ignored `.dream-loop/live-signal-quality/` and
`.dream-loop/immersive-capture/verification/`. No private recordings are used.
Browser replay does not validate physical-phone performance, camera/flash,
physiological accuracy or native sharing. npm publication remains pending.
