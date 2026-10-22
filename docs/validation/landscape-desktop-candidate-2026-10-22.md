# Landscape and desktop candidate validation · 2026-10-22

The retained landscape candidate passes the browser checks recorded here. Its
visual review remains below the requested target. The user chose to perfect
Quiet Lake before extending its paint treatment to the other scenes; that study
is separate from this frozen runtime. Production still serves the earlier manuscript app. This record
does not approve or claim a production deployment.

## Candidate identity

- Renderer SHA-256:
  `878928ede818f9866dca9994506df2802570f2c6673c961310d9988a10866b1a`.
- All 69 files in `source-manifest.json` match current `app/`; all 73 files in
  `build-manifest.json` match current `dist/` at this documentation checkpoint.
- The gallery manifest matches this renderer, the pinned signal engine, the
  actual accepted-window adapter, public fixture and generated images. All
  sixteen examples were regenerated from the public recording and contain
  148.9 seconds of usable waveform. They are not private visitor submissions.
- Source/build manifests, immutable build and results are preserved locally in
  ignored `.dream-loop/landscape-round11-functional/`.

## Full interrupted WebKit session

`safari/result.json` reports PASS, completed at 2026-10-22T17:18:07.570Z.
Playwright WebKit 26.6 used iPhone 13 emulation and mocked camera I/O. The public
fixture ran at wall-clock speed; its recorded final 60 seconds were repeated
with shifted timestamps to supply enough samples after interruptions. Expired
samples were dropped instead of replayed as a catch-up backlog.

- Automatic completion: **180.387 active seconds / 209.833 wall seconds**.
- A 4-second camera-frame pause, 2.5-second deliberate main-thread stall and
  4-second simulated hidden-page interval recovered. Each recorded zero stale
  or held-time credit and zero credit on the first resumed frame.
- Active painting: **59.756 fps, p95 18 ms, maximum 201 ms**, with 11 intervals
  above 33 ms. Long active intervals remain in this metric. It is not a claim
  that every frame met a 16.7 ms budget.
- All-frame cadence including the deliberate stall was 59.063 fps, maximum
  2506 ms. Excluding only that deliberate stall gives 59.772 fps, maximum
  201 ms. One 164 ms screenshot readback at the 60-second checkpoint remains
  included; no claim is made that it explains every long interval.
- Capture, report, graph bounds, same-scene artwork, print restoration and
  export checks passed, with no page errors, console errors or failed
  first-party requests. The final view settled from scale 2.8 to scale 1;
  all 65 retained strokes were painted.
- The 1080 × 1350 artwork exported successfully. Encoder and renderer failure
  retries preserved source and seed and recovered in 197 ms and 140 ms.
  Original-manuscript export was 1200 × 5920 pixels. Native sharing was mocked.

## Chrome performance cases

`performance/results.json` records Chrome 155.0.8059.85 on Apple M4, a
390 × 844 viewport at DPR 3, 40 seconds of preloaded fixture and 20 seconds of
live replay per case. The backend column describes the optional entry
compositor; live landscape painting uses the cached Canvas2D renderer.

| Entry backend | CPU throttle | Active painting fps | p95 interval | Maximum interval |
| --- | ---: | ---: | ---: | ---: |
| WebGPU | 1× | 60.00 | 16.8 ms | 16.8 ms |
| WebGL2 | 1× | 60.00 | 16.7 ms | 16.8 ms |
| WebGPU | 4× | 60.00 | 16.7 ms | 16.8 ms |
| WebGL2 | 4× | 60.00 | 16.8 ms | 16.8 ms |

All cases had zero active-paint intervals above 33 ms and no page/console
errors. Entry transitions ranged from 59.21–60 fps, with maximum intervals of
16.8–33.4 ms. Raster-layer accounting stayed within 2,560,000 pixels and material
accounting within 4,489,216 pixels. These are bounded browser cache counters,
not a measurement of total process memory or GPU execution time.

## QR, gallery and desktop capture

Fresh QR checks passed **66/66**: six rendered captures across Chromium and
WebKit at 320/634/1440 px, their bounded image perturbations and painted-card
surrounds. OpenCV 4.13.0 decoded every case to
`https://www.pulsepainting.com/`. The scope is rendered pixels, not a physical
camera scan. Byte-identical results/captures from `.dream-loop/painted-qr/` are
preserved under `.dream-loop/landscape-round11-functional/qr/`, with snapshot
provenance hashes.

The current `npm test` pass includes model/source invariants, all-family
rendering parity, capture/report/export, fallback and Chromium/WebKit gallery
checks. The delayed mobile deep-link regression fails before its fix and passes
afterward: finishing a manifest request cannot open an example over active
placement. Engine and accepted-window adapter hash guards supplement renderer,
fixture and image checks. Focus, share/copy fallbacks, default mobile asset
avoidance and manifest-failure recovery are covered.

Fresh actual desktop hero, gallery and lightbox captures at 1440/634 px were
inspected without clipping, overflow, runtime errors or failed asset requests.
Their served renderer and gallery manifest matched this candidate. Evidence is
in `.dream-loop/desktop-gallery-round11/`; the README's direct quality-85 JPEG
and its provenance are documented in [the media record](../media/README.md).
Capture browsers were closed; the existing local preview server was untouched.

## GitHub checkpoint and protected preview

Runtime checkpoint `35b6195` was pushed to draft PR1. Preview
[https://pulsepainting-muws2mix2-sontakeys-projects.vercel.app](https://pulsepainting-muws2mix2-sontakeys-projects.vercel.app) is READY as deployment
`dpl_Ej9RxFtVzDFMhcuyWdNPPQCSTrVd`; production was not changed.

All 73 served files exactly match the frozen build manifest and local dist.
Hosted Chromium/WebKit gallery checks passed, followed by accelerated WebKit
capture, animated reveal, report, sharing/export and retry checks. The chosen
hosted scene was Forest canopy. Scene export parity was pixel-identical, encoder
and renderer retries recovered in 168/183 ms, and there were zero page errors
or failed first-party requests. This hosted smoke run supplements the full
three-minute local replay above; it does not replace it or simulate a real phone.

Evidence is preserved in the ignored `hosted-preview/` subdirectory, including
asset integrity, harness hashes, gallery results and capture screenshots/results.
Preview authentication was injected in memory and restricted to its exact origin.
GitHub Linux CI run 39822883752 timed out while installing system dependencies
from the Ubuntu apt mirror; it never reached the app tests. The workflow now
uses the official `mcr.microsoft.com/playwright:v1.63.0-noble` image with matching
browsers and dependencies, preserving the same `npm test` checks.

Run 39830531276 reached the tests and passed model and all-family raster checks,
then stopped at the artwork-retry harness's five-second deadline while PNG
encoding was still pending. The original source and scene seed were unchanged.
The harness now observes terminal UI changes with a 30-second correctness limit,
retains actual elapsed timing, and verifies the recovered sharing/saving controls.
Both local Chromium and WebKit app suites passed. Fault injection confirms a
valid 5.5-second encoder callback succeeds, a null callback fails immediately,
and a missing callback times out with sharing disabled. No runtime or animation
performance assertion changed. Evidence: ignored `.dream-loop/ci-recovery/`.
Linux run [39832035805](https://github.com/sontakey/pulsepainting/actions/runs/39832035805)
passed the complete `npm test` suite on `cad0f47` at 18:33 UTC. This validates
the unchanged tracked runtime and corrected test harness, not the separate
Quiet Lake design study.

## Remaining scope

The focused Quiet Lake refinement remains underway; passing functional checks
does not meet the unresolved visual target. Physical iPhone camera/flash behavior, sustained
mobile thermal performance, physiological accuracy, physical QR scanning and
native share-sheet acceptance remain unverified by these browser runs. Source
checkpoint, preview publication and production deployment are separate states;
see [HANDOFF.md](../../HANDOFF.md) for their current status.
