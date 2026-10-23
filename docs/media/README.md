# Pulse Painting screenshots

These are direct browser captures of the actual static app. Capture, report and
desktop images were refreshed on October 22, 2026 (America/Chicago) for the finer
Quiet Lake foreground. Ready and QR retain their unchanged first-release images.
See [HANDOFF.md](../../HANDOFF.md) for deployment status.

## Current artwork images

- Chrome 155.0.8059.85 through Playwright 1.63.0 on macOS. Phone viewport:
  390 × 844 CSS pixels; desktop: 1440 × 1000; device scale factor 1. Fonts loaded,
  normal motion enabled. Direct browser JPEGs; no screenshot pixels, interface
  text, countdown, metric values or QR elements were edited after capture.
- The original public `test/fixtures/iphone-200s.json` was preloaded through
  170 recorded seconds using the real signal engine, accepted-window adapter
  and application callbacks. Camera I/O was mocked, so the live thumbnail is
  empty. No samples were duplicated and no metrics were substituted.
- Quiet Lake seed 39293 contains 28 accepted segments / 138.967 usable seconds.
  Capture shows the real app countdown **0:29** and computed live values
  **71 bpm, 62 ms RMSSD, 51 ms SDNN** while the normal close-up painting runs.
  The first pass's mid-water camera position is used for the README.
- The actual **Finish painting** button starts the animated zoom-out. The report
  screenshot waits for the same-scene export to become ready. Report values are
  **71 bpm, 52.8 ms RMSSD and 46.8 ms SDNN**. A separate PNG export was also checked.
- The desktop background is the current public-fixture gallery example: the
  same seed, replay through 180 seconds, 148.9 usable seconds. The desktop and
  report images came from the final screenshot pass at
  `2026-10-23T04:21:11.940Z` and `2026-10-23T04:21:30.194Z`.
- Both screenshot passes completed without runtime errors. Helper and raw
  evidence are in ignored `.dream-loop/foreground-pulse/screens/`.

Renderer and served `dist/landscape.js` SHA-256:

`981c49eccf799a030199c2d694bfb7e8af9bc64a9dca3d6d4dfa331b1ef82637`

Public fixture SHA-256:

`5f09524bc151460d1a1a1fa58c30681dd84eaf30d989f4637edf6183e4a03b66`

Current gallery manifest SHA-256:

`a653ec9f6b48628616ab5b3dcf3e6f6bc07dafc3b0c290636cf484772054da1d`

These accelerated replay images are not real-time-session measurements,
physical-phone validation, physiological-accuracy evidence, native-share tests
or performance benchmarks.

## Retained ready and QR images

Ready (390 × 844) and narrow desktop QR (634 × 1014) were captured directly from
the prior build on `2026-10-23T03:45:22.967Z` and
`2026-10-23T03:45:21.784Z`, respectively. Both use Chrome 155.0.8059.85, device
scale factor 1 and reduced motion. These screens are unchanged by the foreground
correction. Their source renderer was
`a84ebe6772a518e2e9d44e6db5d2f30392a75e488884bbfa4e606765a78384d8`.
Original capture evidence is in ignored `.dream-loop/release-readme/`.

## Image integrity

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `pulse-painting-desktop-candidate.jpg` | 188941 | `71f997d63b0146af03e7cebbaea9b092c927ffd8c044959c591d36365a01fd4f` |
| `pulse-painting-qr.jpg` | 81054 | `56374f21d8c42f2edc94165adb7b06a762b95fae80e95c147e157f7038c52898` |
| `pulse-painting-ready.jpg` | 51933 | `1da91b18ec49b70eebb09af1fcea4dff9f87078637b8ffcc70adf00e375a1ddf` |
| `pulse-painting-capture.jpg` | 54988 | `39ffe97770307230c8a67fd97009d1fcf9be886e31c51da27a36f8a86b912cf9` |
| `pulse-painting-report.jpg` | 65173 | `c2f8559f395c9d6ed8d36738f68a0df638aab51f30377e413e8966e1ce234f4c` |
