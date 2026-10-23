# Pulse Painting desktop invitation

The desktop page is an art-led introduction and a handoff to phone capture. It
uses a full-width atmospheric version of an actual generated landscape, a single
brush heading, a stationary painted QR on paper, and an image-first gallery.
The phone's existing capture, floating controls and report flow are unchanged.

The October 23 mobile extension adds an explicit **Explore the paintings**
entrance to this same collection. See the [mobile gallery design](mobile-gallery.md)
and [browser verification](../validation/mobile-gallery-2026-10-23.md).
The renderer and generated example pixels are unchanged by that extension.
The desktop checkpoints below retain their original source and test scope;
current image provenance lives in [the media note](../media/README.md), and
release status lives in [HANDOFF.md](../../HANDOFF.md).

## References inspected on Mobbin

- [Cosmos gallery](https://mobbin.com/screens/f13e59e2-a482-431e-a756-e544a2a1a27e): image-first browsing, open spacing, quiet controls. Adopted the emphasis on images rather than enclosing every work in a dashboard card. Kept square, uncropped artworks rather than its mixed-ratio masonry.
- [Squarespace creative-services hero](https://mobbin.com/sites/sections/baaceef8-070b-4a75-aeca-7aff23fc02cf): a clear editorial headline followed by the creative work itself. Adopted the direct hierarchy and restrained navigation; no carousel or auto-moving showcase.
- [Affinity hero](https://mobbin.com/sites/sections/251e73e3-73b8-46cc-aa28-4bc93d3620a4): one large expressive typographic statement. Adopted the single hero emphasis, with supporting headings in readable sans serif.
- [FLORA gallery](https://mobbin.com/screens/77d8a8b4-d2b2-4153-8545-a5402319290e): clear artwork names beneath previews. Adopted labels outside the art, without its workspace navigation or creator accounts.

These are layout references only. No Mobbin imagery, branding, account details,
creator identities or community statistics are copied into the product.

## Gallery source and publishing contract

`tools/generate-gallery.mjs` runs the actual accepted-window adapter against
`test/fixtures/iphone-200s.json`, the already-public recording, and the pinned
ppg-js engine. It renders all sixteen families with one fixed seed through the
actual `PulseLandscape` module. Nothing is inferred from private session files.

Run it after the renderer freezes:

```sh
node tools/generate-gallery.mjs
```

It writes `app/assets/gallery/`: 640 px thumbnails, 1080 px full examples, labeled 1080×1350 share JPEGs, a
1200×630 social image, and `manifest.json`. The manifest records fixture, engine,
adapter and renderer hashes, accepted duration, seed, filenames and image
hashes. There are no raw waveform samples or personal session metadata in it.
The usual build copies these static assets to `dist/`; generation is an explicit
publishing step, not a browser dependency or production camera workload.

For design iteration a known renderer can be selected with `--renderer`, and
`--out` can keep artifacts in an ignored directory. Regenerate from the final
renderer before publishing. The first desktop design previews use the frozen
round5 candidate solely to establish layout; they do not approve that material.

## Interaction and privacy

The gallery opens a native modal dialog with keyboard focus containment,
Escape to close, previous/next buttons and arrow-key navigation. Opening the viewer prepares one labeled example JPEG in memory; navigation or
close aborts preparation and clears the cached file. Sharing starts only after
a click, using native file sharing where supported and a canonical example-link
or copy-link fallback otherwise. On phones, shared scene links open the mobile
collection behind the viewer. Closing the viewer returns to that collection;
Back returns to capture instructions. The explicit **Make a painting of your
own** action also returns to the instructions without starting the camera.

Examples are explicitly identified as renders of a public recording. There are
no invented users, likes, views, testimonials or claims of community activity.
A visitor's captured artwork is never uploaded or included in this gallery.

Desktop imagery is static, with lazy loading and reserved square dimensions.
There is no full-screen rendering loop. Default mobile capture does not fetch
the gallery manifest or images. Reduced motion removes decorative transitions;
the QR pixels remain stationary and retain their unpainted quiet zone.

## Historical desktop checks and candidate imagery

The initial isolated desktop build used the frozen round5 renderer for layout QA only.
`test/e2e/gallery-checks.mjs` passed Chromium and WebKit at
320/634/1024/1440/1920 widths, all sixteen lightbox items, filters, keyboard focus
containment/restoration, share success/cancel/link fallback, exact shared-image
hashes, canonical phone deep links and manifest failure. Default phone capture
requested no gallery manifest or images; the gallery made no write requests.
The existing painted-QR checks passed 66/66 decoder variants, and QR text passed
the unchanged contrast checks at every tested width. Independent review also
led to darker gallery captions and modal labels, with explicit 4.5:1 checks,
and a guard that lets the ready screen hide correctly during screen changes.

Evidence lives in the ignored `.dream-loop/desktop-gallery/` folder:
`checks-final/`, `qr-final/`, and `contrast-final/`. These are browser checks with
mocked native sharing and clipboard access, not physical-camera, physical-scan,
or native-share acceptance.

The focused test requires the manifest's renderer hash to match
`app/landscape.js`, plus matching public fixture, pinned engine, accepted-window
adapter and generated-image hashes; stale imagery fails before a browser starts. Local design QA
alone may explicitly set `PPG_GALLERY_PROVISIONAL_RENDERER` to a frozen renderer
and `PPG_GALLERY_URL` to a loopback preview. CI cannot use that override.

The gallery was then regenerated from the frozen round8b natural-watercolor
candidate, renderer SHA-256
`6e9b49fae419de4f580c7a6c0bd84e6a40a2c829fb6f1936ef33c0d90c46103b`.
All sixteen scenes use 148.9 seconds of usable public-fixture waveform. A fresh
integrated build was preserved with its 73-file hash manifest under
`.dream-loop/desktop-gallery-round8b/`. Chromium and WebKit passed the focused
checks without a renderer override, both against that snapshot and through
`npm run test:gallery` against the standard build. Updated hero, gallery,
lightbox and mobile screenshots are in the same evidence directory.

`npm test` now includes `test:gallery`, and CI installs both required browser
engines. These checks establish functional behavior and source/image parity;
they do not approve the candidate's visual style. Any later renderer edit must
regenerate the gallery and repeat the focused gate. Full integrated app and
release checks remain separate from this desktop check.

### Previous round9 checkpoint

The round9 generated assets used renderer SHA-256
`7f4e694d6d58a84b1a6f59cbe655657ab42f4b213376dbf3b97f4f3064b78b11`.
The source and gallery manifest matched at that checkpoint. The README's
landscape thumbnails reference the generated assets directly and therefore
advance with later regeneration; its phone screenshots continue to identify
the earlier public manuscript app.

Round9 integrated checks, the interrupted three-minute WebKit replay and the
performance sequence are recorded separately. Their results are not implied by
the earlier round8b evidence above or by the desktop visual check below.

After the timed jobs, the actual integrated round9 site at local port 8094 was
captured at 1920, 1440 and 634 pixels wide. The hero, gallery and Quiet lake
lightbox were visually inspected at each width. Headings, QR handoff, gallery
labels and viewer controls remained readable, images stayed uncropped and the
narrow viewer scrolled normally. No concrete desktop usability defect was found;
there was no horizontal overflow, runtime error or failed first-party request.
The served renderer and manifest matched the current candidate hash above.

Screenshots and `result.json` are under
`.dream-loop/desktop-gallery-round9/`, including `hero-1440.png`,
`gallery-1440.png`, `gallery-all-1440.png` and `lightbox-1440.png`, with matching
1920/634 variants. The capture browser was closed afterward; the existing local
server was left untouched. These screenshots are user-facing candidate previews,
not approval of the renderer's visual style or evidence of deployment. No
production status is changed here.

### Historical round11 candidate: natural pigment and revised geometry

At this checkpoint the renderer SHA-256 was
`878928ede818f9866dca9994506df2802570f2c6673c961310d9988a10866b1a`.
All sixteen gallery examples have been regenerated from this exact source,
using the same 148.9 seconds of usable public-fixture waveform. The source and
gallery manifest match; the README thumbnails now show this candidate.

The desktop experience is implemented and tested. The current `npm test` run
passed, including the gallery checks in Chromium and WebKit, all provenance
guards, and the delayed mobile deep-link regression. A manifest that finishes
loading after capture starts cannot open an example over placement or recording.
The regression reproduced that race before the fix and preserves the active
capture flow afterward; its focused evidence is under
`.dream-loop/gallery-deeplink-race/`.

The current combined pigment/geometry candidate is the strongest visual result
so far, but it remains below the visual target. Its isolated WebKit replay
completed 180.387 active seconds over 209.833 seconds of wall time, including
the interruption cases. Observed active painting was 59.756 fps with an 18 ms
p95 frame interval and a 201 ms maximum. All four 20-second Chrome performance
cases were around 60 fps, and QR decoding passed 66/66 variants. These browser
results remain separate from physical-phone camera, thermal and native-sharing
acceptance; full release evidence is tracked in `HANDOFF.md`.

After those timed runs, fresh actual hero, gallery and Quiet lake lightbox
screenshots were captured and inspected at 1440 and 634 pixels wide. No concrete
desktop usability defect was found: text and controls remained readable,
artworks stayed uncropped, narrow layouts scrolled normally, and there was no
horizontal overflow, runtime error or failed first-party request. The served
renderer and gallery manifest matched the current hash above.

Current capture evidence is under `.dream-loop/desktop-gallery-round11/`.
`docs/media/pulse-painting-desktop-candidate.jpg` is the direct 1440 × 1000,
quality-85 JPEG used by the README; its full provenance is in
`docs/media/README.md`. Earlier screenshots and passes retain their original
source scope. The capture browser was closed and the existing local server was
left untouched. No runtime changes or production deployment are claimed.
