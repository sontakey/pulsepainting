# Simpler live readings — 2026-10-24

## Behavior

Recording shows **Pulse**, **HRV** (RMSSD), and **Breathing** in the main strip.
The expandable **About your readings** guide contains one short definition per
metric. Raw pulse and beat-timing charts appear only after **View signal** is
selected, and stop redrawing while hidden. SDNN and full measurements remain in
the final report; artwork metrics, accepted samples and renderer are unchanged.

Breathing uses the existing pinned ppg-js estimator, without a new physiological
algorithm. It examines up to 60 seconds of accepted beats and needs at least 30
valid peaks spanning 40 seconds. A fresh window can update every second; this is
a rolling pulse-derived estimate, not a directly measured breath-by-breath rate.

The main tile requires good current quality, no gap, a finite positive rate,
agreement between modulation sources, and confidence between 0.5 and 1.
Single-source, held and unsupported estimates remain unavailable. The status is
**Estimating**, **Finding signal**, or **Estimated**. Repeated or older window
timestamps cannot refresh a value. Nonprocessing signal callbacks and hidden
visibility clear it immediately; absent fresh windows expire after a 2.5-second threshold,
checked on the existing one-second UI timer. A newer supported window restores it.

## Verification

- Self-contained build and vendor hash verification pass.
- Complete Chromium and WebKit app suites pass, including report/export,
  cancellation/restart and stale callback isolation.
- Focused cases cover new estimates, invalid rates/confidence/timestamps,
  rejected quality, held/single-source estimates, duplicates, expiry, signal
  interruption and visibility recovery, optional charts, and unchanged reports.
- WebKit layout checks pass at 320, 390 and 430px in ready, estimating and
  finding-signal states. Main readings and the disclosure fit above the floating
  controls; expanded explanations and charts remain scrollable without horizontal
  overflow. Screenshots were inspected.
- Independent read-only code review found no blockers.
- A separate availability audit replayed the checked-in public 200-second fixture
  through the exact pinned vendor engine at one-second hops: 57 of 185 windows
  supported the main breathing tile, first at 62.337 seconds. Unsupported,
  single-source and held results stayed unavailable. This fixture has no
  respiratory reference measurement; availability does not validate accuracy.
- Full wall-clock WebKit replay completed 180.387 seconds of active measurement
  in 209.904 seconds. Camera-frame pause, a deliberate 2.5-second main-thread
  stall and simulated hidden visibility recovered without crediting interrupted
  time. Final report, PNG export and artwork recovery/parity checks passed.
  Active painting averaged 59.20fps (19ms p95, 222ms maximum); reveal averaged
  59.98fps (18ms p95, 33ms maximum). The deliberate stall is excluded from those
  active figures. The retained 222ms capture maximum means this is not a claim
  that every frame is smooth. The checked-in public recording was replayed at
  wall-clock speed, with its final 60 seconds repeated at increasing timestamps
  when needed. Camera I/O was mocked.

Feature source: `7dba31d8ddf567ea99816cd5b212f751a6dbec95`, PR #15.
All 110 protected-preview files matched the frozen local build at
`2026-10-24T17:50:01.035Z`.
Hosted preview Chromium/WebKit checks passed at 390 and 1440px, covering entry,
camera guidance, gallery, example sharing and read-only community access.

Local evidence lives in ignored `.dream-loop/live-readings/`: app-checks.log,
layout-results.json, mobile screenshots, release-manifest.json and preview-assets.json.
The renderer SHA-256 remains
`9d650cdd03f89093b5a4e0a3642b35042dedbc1d9beca3faf748fde4bd68d636`.

Complete Linux `npm test` passed feature SHA `7dba31d8` in
[Actions run 40117831657](https://github.com/sontakey/pulsepainting/actions/runs/40117831657),
finishing at `2026-10-24T18:02:18Z`. PR #15 merged as
`314c284e35e04c7aa209fa824a647a2c2f38b737`.

Production deployment `dpl_781otiHENFGNBEUs8cABicf5DaUF` is READY, built by the
Git integration from the exact merge commit. All 110 files served from
https://www.pulsepainting.com/ matched the frozen tested build at
`2026-10-24T18:05:16.030Z`. The apex returns 308 to the primary www domain.
Anonymous Chromium/WebKit mobile and desktop smoke checks passed at
`2026-10-24T18:05:29.888Z` with no public writes or camera requests. Additional
public WebKit checks pass all three reading states and optional-chart toggles
at 320, 390 and 430px; these deliberately injected display states do not acquire
the camera. Evidence: production-inspect.json, production-assets.json,
production-browser/ and production-ui/ under the ignored evidence directory.

No physical iPhone camera, respiratory accuracy or native share validation is
claimed. No private recording is checked in or published; npm publication remains
pending.
