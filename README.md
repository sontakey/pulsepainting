# Pulse Painting

Your pulse, made into a place.

> Landscape release candidate: the Quiet Lake paint treatment is approved and integrated across all sixteen scenes.
> Final release checks are in progress; physical-device validation remains separate.
> The public site and phone screenshots below currently show the earlier manuscript app.
> The landscape gallery images are actual renders from the current candidate, not a deployed release.
> See [HANDOFF.md](HANDOFF.md) for the visual review and deployment status.

Pulse Painting is a three-minute phone-camera capture experience by [ChatPPG](https://chatppg.com), powered by [ppg-js](https://github.com/sontakey/ppg-js). Accepted pulse waveforms paint one of sixteen landscapes, with organic cobalt, iris, and teal gradients. A close-up follows the brush during capture, then pulls back to reveal the same painting, ready to share alongside an expandable HRV report.

<p align="center">
  <img src="docs/media/pulse-painting-ready.jpg" width="230" alt="Pulse Painting phone capture instructions">
  <img src="docs/media/pulse-painting-capture.jpg" width="230" alt="Painted pulse strokes, live metrics, and floating capture controls">
  <img src="docs/media/pulse-painting-report.jpg" width="230" alt="Shareable Pulse Painting artwork and report">
</p>

The screenshots use browser replay with mocked camera input; see [capture provenance](docs/media/README.md). They are not new physical-phone measurements.

The primary destination is [pulsepainting.com](https://www.pulsepainting.com/), a separate Vercel project connected to this repository. The apex domain redirects to www. The simple library demo remains at [ChatPPG](https://chatppg.com/ppg-js-demo). Release and public verification status are tracked in [HANDOFF.md](HANDOFF.md).

## Desktop gallery · release candidate

The desktop experience opens with a full-screen landscape, a painted invitation
to begin on your phone, and a gallery of all sixteen scene families. Browse
water, land and sky, open an artwork at full size, then share its labeled example
image or copy a link. Keyboard navigation, reduced motion and a stationary QR
keep the gallery and phone handoff accessible.

![Current desktop candidate with the Quiet lake background and phone QR invitation](docs/media/pulse-painting-desktop-candidate.jpg)

**Current candidate desktop.** Direct browser capture of the local build, not
the deployed site. See [image provenance](docs/media/README.md).

<p align="center">
  <img src="app/assets/gallery/alpine-peaks-640.webp" width="230" alt="Alpine peaks landscape generated from the public pulse fixture by the current candidate renderer">
  <img src="app/assets/gallery/quiet-lake-640.webp" width="230" alt="Quiet lake landscape generated from the public pulse fixture by the current candidate renderer">
  <img src="app/assets/gallery/rolling-hills-640.webp" width="230" alt="Rolling hills landscape generated from the public pulse fixture by the current candidate renderer">
</p>

**Alpine peaks · Quiet lake · Rolling hills.** These examples are made by the
actual app renderer from one already-public pulse recording. They show the
current candidate, combining the accepted natural pigment texture with distinct
landscape shapes. They are not visitor submissions. Your recording stays in your
browser, and sharing happens only when you choose it.

The [desktop design note](docs/design/desktop-gallery.md) records the inspected
Mobbin references, gallery behavior and validation scope. The
[gallery manifest](app/assets/gallery/manifest.json) records renderer, fixture,
signal-engine, accepted-window adapter and image hashes. All sixteen examples
are regenerated from the current renderer. Default mobile capture
does not download gallery imagery.

## Run locally

Use Node.js 24 or later:

```sh
npm ci
npm run dev
```

Open `http://127.0.0.1:5173`. `npm run build` creates a complete static site in `dist/`. Actual capture needs a compatible phone, camera and flash permissions, and HTTPS or another secure context. Desktop visitors can browse the example gallery and use the painted QR invitation to open the hosted app on their phone.

## What is implemented

- Sixteen seeded landscape families made from accepted waveform paths, with curved terrain, flowing brush strokes and within-stroke gradients. Artistic mapping preserves the original samples; the original manuscript and computed report remain unchanged.
- Density based on usable recorded time: sparse sessions keep open paper; longer sessions fill interleaved slots without moving earlier strokes.
- A close-up artwork camera and a continuous zoom-out reveal of the same accumulated painting. Cached layers keep the main thread available for capture.
- Optional WebGPU/WebGL2 painted entry transitions and an independent Canvas2D landscape compositor.
- Placement coaching, a small live finger preview, real-time pulse/RMSSD/SDNN, and floating mobile controls.
- Report charts, a 1080 × 1350 shareable artwork, native file sharing with download fallback, and optional metrics on the artwork.
- A full-screen desktop introduction and sixteen public-fixture examples, with filters, a keyboard-accessible viewer, user-initiated image sharing and phone deep links.
- Accessible supporting typography, one brush heading per screen, reduced motion, interruption recovery, and no recording credit for stale frames.

The [landscape design contract](docs/design/pulse-painting-design.md) covers the sixteen families, data fidelity, density and recovery. Scene choice is random within an art-directed plan, not a health classification. The [mapping brief](docs/design/biometric-scene-mapping.md) distinguishes implemented source/quality/density mappings from future optional self-report ideas. The original manuscript remains available in the report menu.

No accepted pulse means retry guidance, not fabricated art. A short valid recording can produce a sparse painting even when HRV metrics are unavailable. Shared PNGs exclude raw data and session identifiers, with summary metrics included only when requested.

## Library boundary

This repository owns the art experience. [ppg-js](https://github.com/sontakey/ppg-js) owns camera acquisition, signal processing, quality gates, and computed measurements. Scientific source code is not copied here.

The temporary pinned browser artifact in [`vendor/ppg-js/0.3.1`](vendor/ppg-js/0.3.1) comes from ppg-js commit `732e1ef51f76bce9145bb7f666f92a30be5e0181`. Its [provenance manifest](vendor/ppg-js/0.3.1/PROVENANCE.json) records its SHA-256 and origin; every build verifies that checksum. The artifact includes the tested camera lifecycle fixes that npm `0.3.0` lacks. Version `0.3.1` has **not been published to npm**; publication was intentionally left pending. Replace this temporary artifact with a tested npm dependency once that release is actually available, then rerun capture, interruption, and export checks. Do not silently downgrade it.

## Verification

```sh
npm test
npm run test:safari-session
npm run test:paint-performance
npm run test:qr
npm run test:gallery
```

`npm test` covers actual app callbacks, accepted-data attribution, metrics, report glyph bounds, mobile layouts, export/share behavior, compositor fallback, and the desktop gallery. Gallery checks require current renderer/image provenance and exercise all sixteen scenes, keyboard focus, sharing fallbacks, mobile deep links and failure recovery in Chromium and WebKit. The full session test runs real-time public-recording replay in WebKit with three interruptions and automatic completion. These checks mock camera input and sharing APIs; they do not establish physical iPhone camera, thermal, or native-share performance.

The QR suite uses Python OpenCV, Pillow, and NumPy for bounded image perturbations; the static QR itself ships no encoder dependency. Optional `PPG_PYTHON` selects a prepared Python environment. Test artifacts stay in ignored `.dream-loop/`.

## Source map

- `app/`: ready, placement, capture, report, export, local fonts, and static QR assets.
- `app/landscape.js`: scene planning, accepted-source coverage, pigment rendering and the live artwork camera.
- `app/portrait.js`: same-scene export and native sharing with download fallback.
- `app/gallery.js` and `app/gallery.css`: desktop introduction, public-example browsing and sharing; separate from phone capture.
- `app/assets/gallery/`: generated example thumbnails, full artworks, labeled share images and their provenance manifest.
- `src/paint-gpu.js`: optional Three.js entry compositor source.
- `tools/prepare-dist.mjs`: verify the pinned library and assemble the static app.
- `tools/generate-gallery.mjs`: regenerate the sixteen examples from the actual renderer and public fixture after a renderer change.
- `tools/serve.mjs`: local static preview.
- `test/e2e/`: browser replay, graph, accessibility, export, interruption, and QR checks.
- `docs/capture-and-artwork.md`: capture, rendering, and report behavior.
- `vendor/`: an immutable library artifact with its original MIT license and provenance.

Pulse Painting retains the MIT license of the original ppg-js application. Bundled fonts retain their SIL OFL licenses, and Three.js retains its MIT license. Signal quality controls pigment definition; the artwork does not interpret health or personality.
