# Pulse Painting screenshots

These are direct browser captures of the actual static app. The capture image
was refreshed on October 23, 2026 for the crisp pulse brush. Report and desktop
images retain the October 22 foreground release. Ready and QR retain their
unchanged first-release images.
The mobile gallery PNG documents the separately tested October 23 build
described below. Its release was subsequently verified on the public site;
the screenshot itself was captured locally.
See [HANDOFF.md](../../HANDOFF.md) for deployment status.

## Crisp brush capture

`pulse-painting-capture.jpg` is the direct native-browser JPEG (quality 92) from
`2026-10-23T19:22:20.933Z`. Chrome 155.0.8059.85 through Playwright captured the
actual app at 390 × 844 CSS pixels, DPR 3, with normal motion and loaded fonts.
The resulting image is 1170 × 2532. No image pixels or UI values were edited.

The checked-in public recording was preloaded through forty seconds using the
real signal engine, acceptance adapter and app callbacks. Quiet Lake seed 39293
shows its active measured contour and pointed brush at source-stroke progress
0.651–0.710. The countdown is 2:39; computed values are 69 bpm, 43 ms RMSSD and
33 ms SDNN. Camera I/O is mocked, so the camera thumbnail is empty. No samples
were duplicated and no metrics were substituted. There were no runtime errors.

Source and distribution renderer SHA-256:
`a033c4bd89461a08f97af86bc971f738257cab1270c750872ce31c35ea749008`.
The raw PNG, native JPEG and metadata are in ignored
`.dream-loop/crisp-brush/performance-fixed/public-replay-active-mobile.*`.
This is presentation evidence, separate from the full-session and performance
checks in [the brush validation record](../validation/crisp-brush-2026-10-23.md).

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
- The actual **Finish painting** button starts the animated zoom-out. The report
  screenshot waits for the same-scene export to become ready. Report values are
  **71 bpm, 52.8 ms RMSSD and 46.8 ms SDNN**. A separate PNG export was also checked.
- The desktop background is the earlier public-fixture gallery example: the
  same seed, replay through 180 seconds, 148.9 usable seconds. The desktop and
  report images came from the final screenshot pass at
  `2026-10-23T04:21:11.940Z` and `2026-10-23T04:21:30.194Z`.
- Both screenshot passes completed without runtime errors. Helper and raw
  evidence are in ignored `.dream-loop/foreground-pulse/screens/`.

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

## Sharing and personal sketchbook

`pulse-painting-sharing.png` and `pulse-painting-sketchbook.png` were captured
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
| `pulse-painting-capture.jpg` | 262553 | `fea6f9434b2a72767ed7d66bc471e288dc4e4887cf651d647747e7ef8cc930b7` |
| `pulse-painting-report.jpg` | 65173 | `c2f8559f395c9d6ed8d36738f68a0df638aab51f30377e413e8966e1ce234f4c` |
| `pulse-painting-mobile-gallery.png` | 469347 | `2f7f07374fb73399156555da8a86281d6b982db7714efe9a7bd2b4d4caa1889b` |
| `pulse-painting-sharing.png` | 196999 | `882d6c79830173bd54366dd235f7477d8eb1484481638ca0f446dbf177e7ce04` |
| `pulse-painting-sketchbook.png` | 533165 | `3a39ce8438a318de609cb2ef215e22b07ff9758e1abd86741d1f5f72afbdfb04` |
