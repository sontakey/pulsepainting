# Pulse Painting handoff

## Current candidate and release status

Pulse Painting is the art application extracted from ppg-js source commit
`732e1ef51f76bce9145bb7f666f92a30be5e0181`. The scientific library and its simple
ChatPPG demo remain separate. The landscape candidate has not replaced the
verified manuscript release on production.

The retained candidate uses all sixteen scene families, usable-time density,
organic terrain mapping of the actual accepted samples, a close-up artwork
camera, and a continuous zoom-out to the same scene used for sharing. The
original waveform manuscript and computed report remain available. Original
samples are unchanged; pigment texture and terrain placement are artistic.

Desktop now has a full-viewport painted hero, QR phone handoff, explanatory
copy, sixteen actual public-fixture examples, filters, a keyboard-accessible
viewer, image sharing and canonical example links. Default mobile capture
fetches no gallery imagery. The gallery never uploads visitor recordings.
See `docs/design/desktop-gallery.md` for the Mobbin references and provenance.

The user approved further natural-watercolor work on October 22. The retained
renderer reached 7.0/10 in independent visual review, up from 6.6 for round9 and
6.7 for the first broad underpainting. It fixes the river gutter, curves the
fjord, gives short forest recordings a complete background, and adds a natural
pigment material. The subsequent absorption experiment regressed to 6.5 and
was discarded; it exists only in ignored `.dream-loop/absorption-study/`.
The best candidate is tracked, renderer SHA-256:
`878928ede818f9866dca9994506df2802570f2c6673c961310d9988a10866b1a`.

The dream-loop workflow reached its stalled criterion after that major
experiment. A user question is pending: release the current illustrative
watercolor style, or perfect one scene first before carrying the treatment
across all sixteen. Prior authorization to deploy still stands; the pending
question concerns visual direction, not deployment permission. Do not silently
resume broad visual iterations or promote the candidate before that answer.
Independent validation, a source checkpoint and a reviewable preview can proceed.

## Current verification

The retained candidate passed `npm test`: model and source preservation,
all-family live/direct parity, partial rendering, capture/report/export,
GPU fallback, and Chromium/WebKit desktop-gallery checks. Live/direct artwork
compositing differs by at most one channel level with mean error below 0.001;
repeat rendering is exact. Pigment canvases and immutable pattern snapshots
have a fixed 4,489,216-pixel budget; the live raster layers use 2,560,000 pixels.
A gallery hash guard checks the renderer, engine, acceptance adapter, fixture
and every published image.

The mobile deep-link race was reproduced and fixed: a delayed gallery manifest
cannot open a modal after the visitor has started capture. Focus, sharing,
cancellation, mobile asset avoidance and failure recovery are tested in both
engines. Round9 desktop screenshots remain historical evidence; current assets
use the retained renderer hash above.

The latest interrupted WebKit replay completed 180.387 seconds of active
measurement in 209.833 wall seconds. Camera-frame pause, main-thread stall and
hidden-page interruption recovered without recording credit for stale time.
Active painting averaged 59.76 fps, p95 18 ms, with a 201 ms maximum interval.
Report, artwork, same-scene parity and export retries passed. Browser evidence
uses replayed public camera data and does not establish physical iPhone camera,
thermal or native-share performance. The corrected cadence measurement retains
long active intervals; it no longer discards every gap over 100 ms.

The source/build snapshot and latest timing outputs are in ignored
`.dream-loop/landscape-round11-functional/`. All four 20-second Chrome cases
(WebGPU/WebGL2 entry backends, 1×/4× CPU) passed at 60 fps active painting,
p95 16.7–16.8 ms and maximum 16.8 ms. This is desktop Chrome on Apple M4 with
a mobile viewport, not a physical-phone guarantee. Painted QR decoding passed
66/66 rendered/perturbed cases across Chromium and WebKit; byte-identical QR
evidence is preserved in that snapshot's `qr/` directory. See the
[current validation record](docs/validation/landscape-desktop-candidate-2026-10-22.md)
for scope, exact measurements and evidence paths. Older evidence is retained
separately, including round9's 266.6 ms WebGL2 outlier; it is not validation of
the current build.

Draft source PR1 is https://github.com/sontakey/pulsepainting/pull/1. Runtime and
desktop checkpoint `35b6195` is pushed to `codex/landscape-reveal`. GitHub CI run
39822883752 timed out in the Ubuntu apt mirror download before app tests ran.
CI now uses the official Playwright 1.63.0 Noble image, matching the pinned
package and providing Chromium/WebKit dependencies without runtime apt setup.
The unchanged application checks are being rerun.

Current protected preview: https://pulsepainting-muws2mix2-sontakeys-projects.vercel.app
Deployment `dpl_Ej9RxFtVzDFMhcuyWdNPPQCSTrVd` is READY. All 73 served files
exactly match the frozen timed-test build and local dist. Hosted Chromium/WebKit
gallery checks and accelerated WebKit capture, animated reveal, report, artwork,
original manuscript export and retry checks passed. Same-scene export parity
was exact; there were no runtime errors or failed first-party requests.
Evidence: `.dream-loop/landscape-round11-functional/hosted-preview/`.
The hosted tests use replayed public data and mocked camera/sharing APIs.

The old round5 preview is historical evidence only. Production still serves the
manuscript app. Canonical gallery links and social metadata become publicly
available with the candidate's future production release; the preview is
protected by Vercel authentication. The goal is active and incomplete while the
visual direction question is pending. Source and preview publication do not
imply production release.

## Runtime and build

Use Node 24, `npm ci`, and `npm run build`. The complete static output is `dist/`. The optional compositor is built with Three.js 0.186.1. Runtime HTML references remain relative, and optional assets resolve from the current script URL.

The pinned library artifact is the exact tested 0.3.1 browser bundle from the extraction commit; its SHA-256 is verified by the build. npm 0.3.1 publication is deliberately pending. Keep this documented artifact until a published replacement passes the existing lifecycle checks. No npm publication or library-source fork is part of this extraction.

## Deployment boundary

GitHub target: `sontakey/pulsepainting`.

The previous ChatPPG host release integrates this repository as `apps/pulsepainting`
and publishes `dist/` under `/pulse-painting/v-<contenthash>/`. Host PR 251 moves
its entry route to the standalone domain while retaining those immutable assets
for existing sessions. That migration is pending the standalone landscape release.
The ppg-js library demo remains separate at `/ppg-js-demo`.

The user connected the standalone `pulsepainting` Vercel project to this GitHub
repository and verified both domains. Primary URL: `https://www.pulsepainting.com/`;
the apex redirects to www with 308. HTTPS was verified on both on October 21, 2026.
Project `prj_14qDiHVKhjNCMJEKvAz4Hg04H6Yo`, account
`team_nZ98TMx5s8pjLaFvpyIaux0r`, builds main with Node 24, `npm ci`,
`npm run build`, output `dist`. The existing production at verification time is
the earlier manuscript app; the landscape candidate still needs its release gates.
Canonical metadata and the regenerated painted QR now target the primary domain.

## Historical verification: manuscript extraction

The previous manuscript app passed its standalone build, capture/report/export
suite, and both GPU fallback cases. Its full WebKit session completed 180.489
seconds of active measurement in 210.059 seconds wall time and recovered all three
interruptions. Painting averaged 59.67 fps with an 18 ms p95 interval. See
`docs/validation/standalone-extraction-2026-10-21.md`. Those results predate the
landscape implementation and are not its release evidence.

Physical iPhone capture, camera/flash behavior, sustained thermal performance, and native share-sheet acceptance remain separate from browser replay checks.
