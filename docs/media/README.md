# Pulse Painting screenshots

These are direct browser captures of the actual static app. The capture image
was refreshed on October 23, 2026 for continuous source-time ink on quiet paper. The report and sharing
images show the October 23 framed keepsake card. The desktop image retains the
October 22 foreground release. Ready and QR retain their
unchanged first-release images.
The mobile gallery PNG documents the separately tested October 23 build
described below. Its release was subsequently verified on the public site;
the screenshot itself was captured locally.
See [HANDOFF.md](../../HANDOFF.md) for deployment status.

## Continuous brush capture

`pulse-painting-capture.jpg` is the direct native-browser JPEG (quality 92) from
`2026-10-24T04:01:53.583Z` (October 23 locally). Chrome 155.0.8059.85 through
Playwright captured the actual app at 390 × 844 CSS pixels, DPR 1, with normal
motion and loaded fonts. No image pixels or UI values were edited.

The public recording was preloaded through forty seconds using the real signal
engine, acceptance adapter and app callbacks, followed by six seconds of
wall-clock replay. The screenshot shows a continuous measured PPG line on paper,
a pointed brush and permanent pigment; landscape geometry remains hidden.
The countdown is 2:34; computed values are 70 bpm, 43 ms RMSSD and 33 ms SDNN.
Camera I/O is mocked, so the thumbnail is empty. No samples were duplicated and
no metrics were substituted. There were no runtime errors.

Source and distribution renderer SHA-256:
`dda5c8ba24dca41761f39cc233ffe27eed7416ea91992edae02af874eaeca85c`.
The native JPEG, full motion recording and metadata are in ignored
`.dream-loop/continuous-brush/pass4/`. This is presentation evidence, separate
from [full-session and performance checks](../validation/continuous-brush-2026-10-23.md).

## Earlier artwork images

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
  The earlier capture used the first pass's mid-water camera position; the crisp
  brush image above has now replaced that capture.
- The actual **Finish painting** button starts the animated zoom-out. The earlier
  report screenshot waited for the same-scene export to become ready. Its values were
  **71 bpm, 52.8 ms RMSSD and 46.8 ms SDNN**. A separate PNG export was also checked.
- The desktop background is the earlier public-fixture gallery example: the
  same seed, replay through 180 seconds, 148.9 usable seconds. The desktop and
  earlier report images came from the final screenshot pass at
  `2026-10-23T04:21:11.940Z` and `2026-10-23T04:21:30.194Z`.
- Both screenshot passes completed without runtime errors. Helper and raw
  evidence are in ignored `.dream-loop/foreground-pulse/screens/`.
  The framed keepsake capture below has replaced that report image.

Renderer and served `dist/landscape.js` SHA-256:

`981c49eccf799a030199c2d694bfb7e8af9bc64a9dca3d6d4dfa331b1ef82637`

Public fixture SHA-256:

`5f09524bc151460d1a1a1fa58c30681dd84eaf30d989f4637edf6183e4a03b66`

Gallery manifest SHA-256 at that earlier capture:

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

## Mobile gallery

`pulse-painting-mobile-gallery.png` is the native WebKit screenshot from
`test/e2e/mobile-gallery-checks.mjs`, copied byte-for-byte from ignored
`.dream-loop/mobile-gallery/webkit-gallery-viewport.png`. It shows the actual
local gallery after **Explore the paintings** is selected, with the first
thumbnail decoded. No image pixels or interface text were edited.

- Playwright's iPhone 13 emulation, 390 × 844 CSS pixels, device scale factor 1,
  reduced motion, and loaded local fonts. The output is a 390 × 844 PNG.
- The artwork is the existing Quiet lake public-fixture example. Neither the
  landscape renderer nor the generated gallery artwork changed for the mobile
  navigation work; the renderer remains
  `981c49eccf799a030199c2d694bfb7e8af9bc64a9dca3d6d4dfa331b1ef82637`.
- The screenshot requires no new capture or visitor recording. The default
  phone page requests no gallery manifest or images before the explicit visit.
- [The mobile verification record](../validation/mobile-gallery-2026-10-23.md)
  covers Chromium/WebKit behavior, layout, history, retry and capture handoff.
  This screenshot is not physical-phone, native-share or performance evidence.

## Framed keepsake report and sharing

`pulse-painting-report.jpg` and `pulse-painting-sharing.png` were captured directly
from the rebuilt app at `2026-10-23T23:33:00.090Z` and
`2026-10-23T23:33:00.215Z`. Chrome 155.0.8059.85 through Playwright 1.63.0 used
iPhone 13 emulation, a 390 × 844 CSS-pixel viewport, DPR 1, reduced motion and
loaded local fonts. Both images are 390 × 844 pixels. The report is the browser's
native JPEG at quality 92; sharing is its native PNG. No image pixels or UI
values were edited after capture.

The public fixture was processed through `replayPublicFixture(1, 0, 180)` and
the actual accepted-window adapter. Its 30 accepted segments, 59 strokes and
148.9 usable seconds were rendered as Glacial Fjord, seed 39293. The real report
received 175 accepted, HRV-valid beat timestamps from the pinned signal engine.
Computed values are 70.9365 bpm, 53.5937 ms RMSSD and 47.5821 ms SDNN; the keepsake
rounds these to **71 bpm, 54 ms and 48 ms**. Metrics remained on by default. The
card date is fixed at October 23, with a 180-second capture duration; no samples
or measurements were substituted.

The real report's **Share artwork** button opened the sharing dialog after the
PNG was ready; the screenshot waited for the preview image to decode.
`navigator.canShare` was stubbed to return true so the **Share image** action is
visible. `navigator.share` was never invoked. Neither capture used a camera,
uploaded a file, published a painting or created a visitor recording. Both
completed without runtime errors.

Source and served `dist/portrait.js` SHA-256:
`1e14f115e5236880ec16a39fcdc8aacb87e293facc8241d0d71e6b923223fb9b`.
Source and served `dist/portrait.css` SHA-256:
`a03aaa9bee8a27487a220a303fc97a3e8501db78441befc8c62548a11dbc46ed`.
The renderer remains
`2e7e417aeffe1cfef835bfbf49d80e49029de02314a00591a3366aa18d0df794`.

The same frozen build passed 96 card exports across all 16 scenes, full and
short recordings, unavailable metrics, Chromium and WebKit. It also passed
18 report captures at 320, 390 and 1440 CSS pixels, 12 exact-file downloads and
12 local public-export preparations. Hiding metrics preserved every painting
pixel. These are browser presentation checks, separate from physical-phone,
native-share, physiological-accuracy and performance validation.

Capture helper, exact file copies and metadata are in ignored
`.dream-loop/keepsake-cards/readme.mjs` and `.dream-loop/keepsake-cards/readme/`.
The complete visual matrix is in `.dream-loop/keepsake-cards/final/result.json`.

## Earlier sharing and personal sketchbook

The previous sharing image and retained `pulse-painting-sketchbook.png` were captured
directly from the actual built app on `2026-10-23T15:28:30.307Z`, served locally
by a fresh `tools/serve.mjs` process with the sandbox font CORS headers enabled.
They use Chrome 155.0.8059.85 through Playwright, device scale factor 1, reduced
motion and loaded local fonts. The phone viewport is 430 × 932 with touch and
an emulated iPhone user agent; desktop is 1440 × 1100.

The capture opened the labeled **Quiet lake** example through the real gallery
UI, then passed its existing, unchanged `quiet-lake-share.jpg` to the actual
`PulseShare.open` API. The example gallery's own Share button retains its native
share/copy behavior; this API invocation is recorded explicitly rather than
presented as that button's behavior. The image itself says it was made from a
public pulse recording. No visitor recording or public submission was created.

The desktop capture selected **Open your sketchbook** and scrolled only the
outer dialog body to show the full book, caption, zoom controls and magnifier.
All three book spreads come from that same prepared image. The captures were
saved as direct PNGs with no pixel, interface or document-content edits. Both
completed without runtime errors; actual-app dialog centering was also checked.

Helper and detailed evidence are in ignored
`.dream-loop/community-share/capture-readme.mjs` and `readme-capture.json`.
These are browser presentation checks, not physical-phone, native-share,
social-post delivery or sustained frame-rate evidence.

## Image integrity

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `pulse-painting-desktop-candidate.jpg` | 188941 | `71f997d63b0146af03e7cebbaea9b092c927ffd8c044959c591d36365a01fd4f` |
| `pulse-painting-qr.jpg` | 81054 | `56374f21d8c42f2edc94165adb7b06a762b95fae80e95c147e157f7038c52898` |
| `pulse-painting-ready.jpg` | 51933 | `1da91b18ec49b70eebb09af1fcea4dff9f87078637b8ffcc70adf00e375a1ddf` |
| `pulse-painting-capture.jpg` | 52023 | `99a0fcbf0565654a7eafc2b346c26e88744f1c2ef4526472bdc5d7561f6a9835` |
| `pulse-painting-report.jpg` | 72429 | `00bf687a8592d16f0848eebf5bc756dee6e90191fba23b052715274f2c6eff93` |
| `pulse-painting-mobile-gallery.png` | 469347 | `2f7f07374fb73399156555da8a86281d6b982db7714efe9a7bd2b4d4caa1889b` |
| `pulse-painting-sharing.png` | 112629 | `2108b3314600dcda8a89d8e1aa0fe9b19e550fece694c7abfca10ec26ff664d3` |
| `pulse-painting-sketchbook.png` | 533165 | `3a39ce8438a318de609cb2ef215e22b07ff9758e1abd86741d1f5f72afbdfb04` |
