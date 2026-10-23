# Mobile gallery verification — 2026-10-23

Phones previously offered capture and deep-linked examples, without an entrance
to the gallery. The ready screen now includes **Explore the paintings**, opening
the existing sixteen examples in a mobile collection with a featured landscape,
two-column grid, Water/Land/Sky filters and a swipeable artwork viewer.

The existing floating capture dock provides Back and Start painting. Camera
acquisition still runs from the original button's trusted click. Gallery requests
cannot reopen a dismissed collection or cover camera placement when they finish
late. The default phone page requests no gallery manifest or images; thumbnails
load lazily after an explicit visit. Shared scene links open with the collection
behind the viewer, with browser Back/Forward and focus restoration supported.

## Browser checks

`npm run test:mobile-gallery` passed in Chromium and WebKit at 320, 390 and 430
pixels wide. Assertions cover:

- Discoverable entrance, all sixteen examples, filters and touch-pointer swipes.
- One visible brush heading, readable text, at least 44 px controls, no horizontal
  overflow, a floating dock and accessible content at the bottom of the gallery.
- Viewer close, browser Back/Forward, shared scene links and focus restoration.
- Delayed manifest responses after Back and after the actual Start/cancel flow.
- Manifest failure and retry; no gallery uploads.

The complete `npm test` suite passed, including model, all-scene rendering,
compositor parity, capture/report/export, GPU fallback and both gallery suites.
The separate WebKit capture/report/export/recovery suite also passed.
Evidence and actual screenshots are in ignored `.dream-loop/mobile-gallery/`.
The README's mobile gallery image is a direct WebKit screenshot from this suite.

## Scope

The painting renderer, scientific library, accepted samples, quality gates,
metrics, timing, gallery artwork and export paths are unchanged. The renderer
remains SHA-256
`981c49eccf799a030199c2d694bfb7e8af9bc64a9dca3d6d4dfa331b1ef82637`.
Examples use the already-public recording; they are not visitor submissions.

These are browser-emulation checks with synthetic touch input and mocked camera
acquisition. They do not establish physical iPhone camera, thermal, or native
share performance. No new real-time three-minute or performance claim is made
for this navigation-only change. npm publication remains intentionally pending.

## Public release

PR #3 merged as `a7d6ef0960b0a386f99c9784e45a78225fb29a60`, after CI run
`39937171917` passed on `53c0274ac775501b2181b846055dda3907e06c3b`.
The connected Git integration deployed that merge as
`dpl_4T73TqCwoKtZMFd6vZ95Hg9GAQ3C`, READY on the public domains.

At `2026-10-23T10:14:43.712Z`, anonymous requests matched all 73 served files
to the tested build. The apex returned 308 to `https://www.pulsepainting.com/`.
The complete new mobile gallery suite then passed against that public URL in
both Chromium and WebKit, including delayed loading and Start/cancel recovery.
Evidence is in `.dream-loop/mobile-gallery/hosted/` and
`.dream-loop/mobile-gallery/hosted-assets.json`. Documentation-only main commits
may create a later deployment with the same application bytes.
