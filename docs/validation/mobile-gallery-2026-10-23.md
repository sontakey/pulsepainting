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

Production deployment and anonymous asset/hosted-browser verification are
recorded in `HANDOFF.md` after release.
