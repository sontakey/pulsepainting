# Landscape and desktop candidate validation · 2026-10-22

The retained landscape candidate passes the browser checks recorded here. Its
visual review remains below the requested target, and the user's style decision
is pending. Production still serves the earlier manuscript app. This record
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

## Remaining scope

The style decision remains pending; passing functional checks does not meet the
unresolved visual target. Physical iPhone camera/flash behavior, sustained
mobile thermal performance, physiological accuracy, physical QR scanning and
native share-sheet acceptance remain unverified by these browser runs. Source
checkpoint, preview publication and production deployment are separate states;
see [HANDOFF.md](../../HANDOFF.md) for their current status.
