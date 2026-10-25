# Pulse Painting screenshots

These images document the actual app and its exported artwork. The capture and
keepsake images were refreshed on October 25, 2026 from a full WebKit session
replay. Their current provenance is below; earlier captures remain documented
for history. The sharing image retains the October 23 framed keepsake flow,
and the desktop image retains the October 22 foreground release. Ready and QR
retain their unchanged first-release images. The mobile gallery PNG documents
the separately tested October 23 build; it was captured locally before the
release was verified on the public site.
See [HANDOFF.md](../../HANDOFF.md) for deployment status.

## Current immersive capture and balanced keepsake

`pulse-painting-capture.jpg` comes from the actual app screenshot at **60.009
seconds of wall time** in the full WebKit session replay. The browser is WebKit
26.6 with an emulated iPhone 13 viewport. Source was
`4f88137b2e1e28809c4fc9cadf8dd456a2f91ecf`; the capture runtime is unchanged in final
`098a752a422d5a56917f6b312a6ef355b7a2158a`, merged through PR #16 as
`42a0fc0a83569d2617d7747cc2363bfd7a4fc47a`.

The capture shows the real **2:20** countdown, **72 bpm**, **40 ms HRV** and an
unavailable Breathing estimate. At that checkpoint, 41.105 seconds of active
measurement had accrued, six segments were accepted, and 29.75 accepted seconds
had reached the background cache. The brush follows the same accepted samples;
the camera thumbnail is empty because camera I/O is mocked.

`pulse-painting-report.jpg` shows the actual final **Quiet Lake** keepsake from
that session, rendered by the final portrait compositor. Seed 39293 contains
**65 strokes and 157.2667 usable seconds**. The completed measurement has 193
accepted beats; report values of 71 bpm, 54.6 ms RMSSD and 51.9 ms SDNN round to
**71 bpm, 55 ms and 52 ms** in the artwork. Metrics remain on by default. The
larger painting, cursive name, complete golden frame and date/website footer
are part of the exported artwork, not added to the screenshot.

Both delivery files were resized to **780 pixels wide** and encoded as JPEG
from the actual session capture PNG and final portrait PNG. No interface text,
countdown, metric values, paint strokes or other content was altered. The prepared
JPEGs were copied byte-for-byte into this folder. The capture is 780 × 1328;
the keepsake is 780 × 975, preserving the original 1080 × 1350 export ratio.

The public `test/fixtures/iphone-200s.json` was replayed through the real signal
engine and app callbacks at **1× wall-clock speed**. Camera-frame interruption,
a main-thread stall and simulated visibility interruption were exercised. The
session reached 180.404 active measuring seconds in 209.86 wall seconds, then
completed the reveal. To cover acquisition and interruption overhead beyond the
fixture's original 199.452 seconds, the replay repeated its final 60 seconds once
with monotonically shifted timestamps; that extension was used. This is an
explicit test input extension, not an additional real recording. Expired samples
were dropped during interruptions instead of replayed as a catch-up backlog.

Public fixture SHA-256:
`5f09524bc151460d1a1a1fa58c30681dd84eaf30d989f4637edf6183e4a03b66`.
Final landscape renderer SHA-256:
`277a3163b8d797944e264e2775f9232645f3f1c9cbcaead4865ce72d78802849`.
Final portrait compositor SHA-256:
`ea232aab358b7cdf9b0ecdb89f9a3aeb8656c7db9e8723ca432eafa67f4f877e`.

Session evidence is in ignored `.dream-loop/immersive-capture/session/result.json`;
the prepared images are `capture-readme.jpg` and `report-readme.jpg` in the parent
folder. See [current verification](../validation/immersive-capture-2026-10-25.md).
These images illustrate browser replay and artwork presentation. They do not
establish physical iPhone camera, thermal, physiological-accuracy, native-sharing
or sustained phone frame-rate performance.

## Camera guidance

`pulse-painting-camera-help.png` is a direct WebKit browser screenshot from the
protected preview, captured during the checks completed at
`2026-10-24T15:31:56.152Z`. It uses a 390 × 844 CSS-pixel iPhone 13 viewport at
DPR 1 and source `5c4640074f7ddb5bdb3170d30e0ff8f06529c079`. The actual phone-entry
help button opens the dialog; browser selection and steps, rendered 48px touch
target, focus and close behavior were checked. No camera was requested, and no
public data was written. The PNG is copied byte-for-byte without image editing.

This illustrates Pulse Painting's help, not the operating system's controls or
a physical iPhone permission prompt. The SVG inside the dialog is explicitly a
schematic. See [camera verification](../validation/camera-guidance-2026-10-24.md).

## Earlier capture header refresh

The previous `pulse-painting-capture.jpg` was refreshed from source
`9f1058c1e5cade5c76d2d3f654857931d19792dd` at
`2026-10-24T16:07:44.520Z` to show the signal bars, balanced
header and removed recording footer. This is the direct Chrome native JPEG
(quality 92, 390 × 844, DPR 1), copied byte-for-byte without image editing.

The same public fixture and real signal engine supplied 31 accepted segments
and 153.85 usable seconds for Quiet Lake, seed 39293. The actual countdown is
0:17; live computed values are 81 bpm, RMSSD 61 ms, and SDNN 59 ms. The foreground
was at 11.78 seconds. Camera I/O is mocked, and the source
was supplied in one accelerated chunk; this is composition evidence, not a real
three-minute capture or performance measurement. No metrics or UI values were
substituted. There were no page errors or viewport overflow. Evidence is in
ignored `.dream-loop/capture-signal-bar/readme/`.

Native JPEG SHA-256: `f9bd2cea222ab037c68db9526e4d0d92c292339fd9f847d346091449d3b4cbba`.
The renderer and public-fixture hashes in the preceding-capture section below applied to that refresh.

## Earlier emerging landscape capture

The preceding `pulse-painting-capture.jpg` was the direct native-browser JPEG (quality 92) from
`2026-10-24T14:50:33.737Z`. Chrome 155.0.8059.85 through Playwright captured the
actual app at 390 × 844 CSS pixels, DPR 1, with normal motion and loaded fonts.
The JPEG was copied byte-for-byte; no image pixels or UI values were edited.

This is an **accelerated-source composition capture**, not a three-minute
wall-clock recording. The public fixture was fed in one chunk through 181.989
recorded seconds using the real signal engine, acceptance adapter and app
callbacks. Its 31 accepted segments supply 153.85 usable seconds and 61 terrain
strokes in Quiet Lake, seed 39293. The foreground continued at normal animation
speed and had drawn 11.70 seconds when this frame was captured. The screenshot
shows a continuous measured PPG line, a pointed brush and permanent pigment,
with a faint landscape copied from the same accepted source geometry. Its
position and pigment texture remain fixed while newly accepted details appear.

The actual countdown is **0:17**; computed values are **81 bpm, 61 ms RMSSD and
59 ms SDNN**. Camera I/O is mocked, so the thumbnail is empty. No samples were
duplicated and no metrics were substituted. There were no runtime errors or
horizontal overflow, and previously painted source paths remained unchanged.
The selected frame shows the settled background after the caption has faded.
A companion native PNG captured **“A place that is yours alone.”** at
`2026-10-24T14:50:28.565Z`, while the new wash was appearing.

Source and distribution renderer SHA-256:
`7d1d2abb53ee40e7d8c9fcab773aefdc7fb749c77cbf10494d93a8e190e8cba1`.
Source and distribution landscape stylesheet SHA-256:
`cedd1762c2a157ce60a055f0990f89eed0dc7b49fe1c7eb98fae551212b9cbee`.
Public fixture SHA-256:
`5f09524bc151460d1a1a1fa58c30681dd84eaf30d989f4637edf6183e4a03b66`.

The native JPEG, caption PNG, motion clip and exact metadata are in ignored
`.dream-loop/emerging-landscape/composition-pass6/`. This is browser presentation
evidence, separate from [session and performance validation](../validation/emerging-landscape-2026-10-24.md),
physical-phone testing, physiological-accuracy checks and native sharing.

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

## Earlier framed keepsake report and retained sharing

The previous `pulse-painting-report.jpg` and retained `pulse-painting-sharing.png` were captured directly
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
| `pulse-painting-capture.jpg` | 105141 | `afe7bc706b42c96b58db31b1bd2e6108cb2e35d6a323c8f618771cd8b5a77c36` |
| `pulse-painting-report.jpg` | 102898 | `90e30ef4166ccaa0a4e2e55e28c720055b64a6d579f3353a8d9f45c4a807f9bc` |
| `pulse-painting-mobile-gallery.png` | 469347 | `2f7f07374fb73399156555da8a86281d6b982db7714efe9a7bd2b4d4caa1889b` |
| `pulse-painting-sharing.png` | 112629 | `2108b3314600dcda8a89d8e1aa0fe9b19e550fece694c7abfca10ec26ff664d3` |
| `pulse-painting-sketchbook.png` | 533165 | `3a39ce8438a318de609cb2ef215e22b07ff9758e1abd86741d1f5f72afbdfb04` |
