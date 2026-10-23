# Pulse Painting handoff

## Current production release

The user accepted the hosted Quiet Lake V18-combined paint treatment with
**Keep** after reviewing the public study at
https://pulsepainting-quiet-lake-study.vercel.app/. This resolves the latest
visual checkpoint. Preserve that treatment while integrating it into the
sixteen-family app; the previous pending-style notes below are historical.
The accepted renderer SHA-256 is
`3f61aab31f73cc4ae16c591160f441709ad124383342de650502239838f38e16`.
The study is a separate static Vercel project, not the main product release.
The treatment is now integrated across all sixteen families and the gallery is
regenerated. Final runtime SHA-256:
`a84ebe6772a518e2e9d44e6db5d2f30392a75e488884bbfa4e606765a78384d8`.
Independent visual review passed at 8/10. GitHub CI is green on `b9c1b29`.
The real-time three-minute interrupted WebKit session passed at 59.85 fps active
painting; dense Chromium capture measured approximately 60 fps (57 fps at 4×
CPU throttling). The final full macOS matrix passed 96 cases / 288 checkpoints
per engine; Linux WebKit passed 32 cases / 96 checkpoints. Every live/export and
repeated-export comparison was pixel-exact. The separate transparent-prefix
zero-alpha diagnostic still fails and is documented; source data is unchanged.
The landscape release is now public at https://www.pulsepainting.com/.
Deployment `dpl_BTQ7ht7H9XUbd7dmTRJAjJSkm7Kk` is READY; anonymous verification at
`2026-10-23T03:53:55.163Z` matched all 73 served files to the tested build.
The apex returns 308 to www. Hosted WebKit app checks and the complete Chromium /
WebKit gallery suite passed. PR #1 merged as `3ddae4e20f294a0d53a7669c4927235a42e4d764`;
final pre-merge source `5c3b247` passed CI run `39897117567`.
ChatPPG's landing/migration update is being released separately.
See `docs/validation/landscape-accepted-2026-10-22.md` for current evidence.
The older study and hold notes below are historical, not a new style checkpoint.

Pulse Painting is the art application extracted from ppg-js source commit
`732e1ef51f76bce9145bb7f666f92a30be5e0181`. The scientific library and its simple
ChatPPG demo remain separate. The landscape release replaces the earlier manuscript presentation on the
standalone site; the original measured waveform manuscript remains in its menu.

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
That visual baseline had renderer SHA-256
`878928ede818f9866dca9994506df2802570f2c6673c961310d9988a10866b1a`.
The development renderer now includes the compositor-only correction described
below, SHA-256 `a7807450f85972d3677e6bdc7830594525663c425a94bb7418cf441a4cfee25a`.
Its geometry and materials retain that visual baseline.

The prior whole-set dream-loop stalled after the absorption experiment. On
October 22 the user chose **Perfect one scene first**. Production remains held
while Quiet Lake is refined against a focused target before carrying the paint
treatment across the other fifteen scenes. Broad iteration is no longer waiting
on a style decision; work is intentionally scoped to one representative scene.
Study code stays in ignored `.dream-loop/quiet-lake-study/`, with a generated
visual target and prompt in `.dream-loop/quiet-lake-target/`. These are design
studies; the tracked runtime retains round11 visuals with the compositor fix,
while the hosted preview remains on its earlier verified build.

Focused Quiet Lake review progressed from 4.0 to 7.1. After a finer-ripple
regression, the user chose **Denser, crisper ripples closer to the target**.
V6 through v10 then reached 7.3, 7.4, 7.8, 7.9 and 7.9. V10 improves pigment
edges but still reads as curved ribbons and stacked reflections. The major
boundary redesign reached the dream-loop stall checkpoint. Root showed the
actual rendered image, and the user immediately chose **Flatter, more natural
washes**. That resolved that checkpoint. V11 changed
the artistic lake-water projection into broader, flatter overlapping washes.
Every measured sample/time and the original waveform manuscript remain intact.

Frozen v12 renderer SHA-256 is
`07faaf182c9d598fe360f28a543c25974abe7f9355cca51ea51e75a04630bcf7`.
The independent review scores its full scene 8.0/10 and short recording 7.8/10,
up from v11's 8.0/7.4. Flatter overlapping washes meet the main direction.
The shorter initial underwash and compact early water groups give short
recordings a deliberate vignette, preserving stable placement as later data
arrives. Some repeated wash chains and a dense middle-water break remain.
This is a concrete one-scene review checkpoint, not a claim of perfect fidelity.
V12 source/model/current-adapter and other-fifteen-scene pixel checks pass.
All twelve actual-fixture cases produce exact completed live/export and
repeated-export pixels; 77 progress-boundary checks retain existing pigment.
These compare completed views of partial source records, not an actively
animating partial stroke; the stronger partial-stroke gate described below
subsequently found a separate compositing defect.
A real-fixture canvas edge discrepancy found in v7/v8 was fixed by matching layer
consumption cadence in live and export rendering, without added rasters or CPU
readback. No test tolerance was relaxed. All eight v12 desktop Chrome cases
(first acceptance and late capture; WebGPU/WebGL2 entry; 1x/4x CPU) measured
60 fps active painting with p95 16.7 ms and maximum 16.8 ms. Entry animation
also measured 60 fps; submission CPU p95 was at most 1.8 ms. No runtime or console
errors occurred. This is mobile-viewport browser evidence, not physical-phone
validation. Material and live raster budgets remain unchanged. Earlier v11
measurements, including two 33.3 ms active intervals, remain archived separately.

All focused studies and evidence remain beneath ignored
`.dream-loop/quiet-lake-study/`; the running design record is
`.dream-loop/quiet-lake-target/status.md`. Root showed the actual V12 full and
short recordings at the one-scene checkpoint. The user then said the PPG
waveforms were not clear enough and reattached the focused target because its
pulse-shaped contours remain visible. That is the current direction: retain
soft washes but restore distinct source-derived waveform edges in water,
mountains and trees, readable after the zoom-out. V13 restored legibility but
its contours looked separate from the paint (independent review: 7.3 dense,
7.7 sparse). V14 makes the measured contour the upper edge of a pigment body,
with pooled color and a soft underside; its frozen renderer hash is
`197392c816b0dc2fb595619139be69bd703c9484e2be625a3138a3976e2a886e`.
Source/model checks pass and the other fifteen families remain pixel-exact.
The fresh V14 review scored 7.0 dense and 6.9 sparse: waves are visible at
390px, but water still reads as separate ribbons. Root showed the actual render
and asked the user whether to rebuild water as overlapping pulse-shaped marks
closer to the target or keep explicit bands. The user chose **option 1: overlapping
pulse-shaped brushstrokes**, preserving recognizable PPG peaks with stronger
foreground contours and softer distant ones. That resolves the visual checkpoint.
The next pass is scoped to Quiet Lake before broad material transfer. Original
source knots, normalization, timestamps, quality and accepted counts remain
unchanged; no study has replaced the runtime renderer yet.

That direction was implemented through V15–V18. V15 uses overlapping source-edge
marks; V16 removes hanging polygon flaps; V17 broadens the pigment beneath each
pulse. V18 makes a larger architectural change: cached small, irregular brush-tip
impressions anchored to every original measured knot replace the water bands.
Its frozen renderer SHA-256 is
`e3dcc1c69a6bf0953a1f417abc0e9dd5f16150a211b1c2d7920f830013646bdd`.
The independent full/short visual scores progress from 7.2/6.6 through 7.4/6.7
and 7.5/6.9 to 7.6/6.9. V18 removes angular flaps and retains visible pulse peaks,
but the water still reads as uniform soft cords and the sparse underwash remains
too broad. The fresh reviewer identifies another dream-loop stall. Root has
shown the actual working study and asked whether this paint treatment is natural
enough or still too regular. Stop aesthetic iteration at this checkpoint until
that feedback arrives; do not treat the earlier option-1 choice as still pending.

V18 passes source/model/current-adapter and other-fifteen-family pixel checks.
An independent stamp audit confirms exact original-knot ownership and exact
cached-completion/forced-prefix pixels, but **fails strict retained-pigment
coverage**: advancing prefixes lose up to sixteen alpha levels at raster edges.
No criterion was relaxed. All evidence is in ignored
`.dream-loop/quiet-lake-study/v18/`. No release is justified by these results.
Follow-up diagnosis in `.dream-loop/retention-review/` shows that the original
audit uses a read-frequency context and repeated readbacks, unlike runtime.
Fresh default-context drawing histories preserve solid-mask coverage exactly;
actual textured pigment still loses one alpha level at 800px in the bounded
probe, and zero at 1080px. The strict-zero check remains failed. The original
up-to-sixteen result does not demonstrate visible live flicker. No style or
renderer workaround was made while the visual checkpoint is pending.

The separate V18-plus-compositor study has SHA-256
`3f61aab31f73cc4ae16c591160f441709ad124383342de650502239838f38e16`.
Quiet Lake live/direct parity passes for three seeds, short/full records and
early/late/complete states in macOS Chromium and WebKit. The Linux focused
check of this same frozen study subsequently fails at live/export maximum 17
and repeated-export maximum 14; see `.dream-loop/linux-repeat/v18-combined/`.
The existing lifecycle
assertions also pass against that exact study: pause/resume, reduced motion,
continuous same-scene reveal, fragmented recordings and disposal. One twenty-
second late-capture probe (desktop Chrome, mobile viewport, WebGL2 entry,
4× CPU slowdown) measures 60 fps active paint, p95 16.7 ms, max 16.8 ms and
submission p95 2.2 ms. This is a limited browser probe, not full-session or
physical-phone acceptance. It does not resolve the independent retention failure
or the older all-family WebKit diagnostic. The local review page offers three
seeds, full/short input, reference comparison and zoom-out; its Chromium/WebKit
desktop/mobile smoke checks pass. It lives in ignored `.dream-loop/quiet-lake-review/`.

The new real-recording harness exposed a real actively-partial compositing
defect: the live stroke blended against already-composed lower layers, while
direct rendering blended against its transparent layer. Completed layer
consumption also differed. The compositor-only correction adds no canvas
or CPU readback and preserves round11 geometry/materials. Across all sixteen
families, three seeds and short/full source records, Chromium is pixel-exact at
all 288 checkpoints. WebKit still differs by up to three channel levels and
fails eleven checkpoints against its newly defined two-level criterion. The
precise native cause remains unproven; the criterion is not widened again.
The correction is now integrated in the development app as a partial fix;
gallery assets were regenerated from its exact hash. A focused real-recording
regression is included in `npm test` and rejects the old renderer at max13.
The corrected focused check passes on macOS at max0 in Chromium and max2 in WebKit.
The default all-family invocation of `test/e2e/landscape-parity.mjs` remains
separate and failed. Fresh observation controls did not remove its max3 residual.
See
[raster parity scope and results](docs/validation/landscape-raster-parity.md).
Neither V13 nor V14 has final performance evidence.

A separate short-screen layout bug was reproduced at 320×568: a 640px capture
minimum pushed live metrics beneath the floating action dock. The app now lets
the painting shrink with viewport height while retaining readable metrics and
44px-or-larger controls. Chromium and WebKit layout checks cover ready,
placement, capture, report and report-bottom at 320×568 and 390×844. The tracked
app suite now asserts that live metrics and the details disclosure stay above
the dock without scrolling. Both Chromium and WebKit app suites pass, including
capture, report, export and recovery checks. This CSS fix does not integrate the
study renderer.
Tracked runtime, hosted preview and production remain on their separate,
previously verified versions. No study has been released.

## Current verification

The compositor integration is pushed as `1ad9d16`; diagnostic exception logging
is pushed as `2bc8c8b`. Linux CI runs 39889412817 and 39889702883 **fail** the new
focused real-recording WebKit regression. The second log identifies repeated
export difference five. The exact official Linux/amd64 browser image reproduces
it locally. The diagnostic now collects all phase failures before asserting;
the formerly unexamined full-record completion differs by up to twenty-six and
also exceeds the mean-error bound. macOS still passes this focused check.
No thresholds or landscape-renderer source changed. Bounded cache/cleanup controls do not
fix the short-case failure; its two export command streams are identical.
See `docs/validation/landscape-raster-parity.md` and ignored
`.dream-loop/linux-repeat/`. This is additional unresolved evidence, not an
invalidation of the separately measured macOS full-session behavior below.

The improved diagnostic is pushed as `d4cb7cd`. Its CI run 39891506680 reports
all short/full failures: WebKit full-completion maximum 27 and mean
0.003170703125; Chromium passes. Explicit pattern-transform reset is also
ineffective. No experimental control was adopted in the runtime.

Report recovery now retains a successfully rendered artwork canvas across PNG
encoding retries. A failed landscape render is never published as completed,
so renderer retry still runs. The new recovery assertions reject the previous
implementation and verify render counts, the same canvas, exact retained
pixels, source/seed preservation and recovered controls. macOS Chromium,
macOS WebKit and Linux Chromium app suites pass. This does not close the
independent fresh-raster diagnostic or change the pending visual decision.
The changed portrait source and dist both hash to
`87a2725e358dbd2f5dd42d151bc840257bccd6cfdec0791b4925b9303146cb3d`.
A new full WebKit replay on that build passes: 180.404 seconds active in
209.846 seconds wall time, with all three interruption recoveries crediting
zero stale time. Active painting averages 59.98 fps, p95 18 ms, maximum 101 ms;
the deliberate 2.5-second stall remains in the separately reported overall
cadence. Zoom-out, report, same-scene export and both retry paths pass. Encoder
retry performs one total landscape render and retains every artwork pixel;
renderer retry performs the required second attempt. Evidence is in ignored
`.dream-loop/artwork-retry/`, using the same public fixture, documented tail
extension and mocked camera/native-sharing scope.

Before the portrait-retry change, the compositor-corrected candidate passed the complete local `npm test` suite,
including the new focused real-recording regression, model and source
preservation, synthetic presentation-path checks, partial rendering,
capture/report/export, GPU fallback, and Chromium/WebKit desktop-gallery checks.
The older raster checks differ by at most one channel level with mean error
below 0.001 and exact repeat rendering. They did not cover the real-recording
partial-stroke states that fail the stronger diagnostic described above.
Pigment canvases and immutable pattern snapshots
have a fixed 4,489,216-pixel budget; the live raster layers use 2,560,000 pixels.
A gallery hash guard checks the renderer, engine, acceptance adapter, fixture
and every published image.

The mobile deep-link race was reproduced and fixed: a delayed gallery manifest
cannot open a modal after the visitor has started capture. Focus, sharing,
cancellation, mobile asset avoidance and failure recovery are tested in both
engines. Round9 desktop screenshots remain historical evidence; current assets
use the retained renderer hash above.

The compositor-corrected build completed a new full WebKit replay: 180.376 seconds
of active measurement in 209.849 wall seconds. Camera-frame pause, main-thread
stall and hidden-page interruption all recovered with zero first-resume credit
for stale time. Active painting averaged 59.94 fps, p95 18 ms, maximum 97 ms.
The deliberate 2.5-second main-thread stall remains included in the separately
reported overall cadence. Report, same-scene export, normal zoom-out and both
encoder/renderer retry checks pass; no runtime or first-party request errors.
This uses a public fixture, including the explicitly documented recorded-tail
extension, with mocked camera I/O. Evidence is in ignored
`.dream-loop/compositor-integration/safari/`. It is browser replay, not physical
iPhone, physiological-accuracy or native-sharing acceptance.

The earlier pre-correction WebKit replay completed 180.387 seconds of active
measurement in 209.833 wall seconds. Camera-frame pause, main-thread stall and
hidden-page interruption recovered without recording credit for stale time.
Active painting averaged 59.76 fps, p95 18 ms, with a 201 ms maximum interval.
Report, artwork, same-scene parity and export retries passed. Browser evidence
uses replayed public camera data and does not establish physical iPhone camera,
thermal or native-share performance. The corrected cadence measurement retains
long active intervals; it no longer discards every gap over 100 ms.

The pre-correction source/build snapshot and timing outputs are in ignored
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
The replacement configuration is pushed as `01fdadf`. GitHub initially delayed
the PR-head update and run creation while reporting a separate PR-service
incident; causality was unconfirmed. Run 39830531276 started at 18:21 UTC and
passed dependency setup, model and all-family raster checks. It then failed
the artwork encoder recovery test: its five-second polling deadline elapsed
while PNG preparation was still pending (5407.6 ms; original scene preserved).
The following renderer-failure retry succeeded in 1404.1 ms. The recovery harness
now observes terminal UI changes with a bounded 30-second correctness deadline,
records actual elapsed time, and additionally checks recovered share/save controls.
Both local browser app suites passed. A 5.5-second delayed callback succeeds;
null and missing callbacks still fail or time out with sharing disabled.
Runtime and dist were unchanged by that test repair. Replacement Linux run 39832035805 passed the
complete `npm test` suite on checkpoint `cad0f47` at 18:33 UTC. The original CI
failure and fault-injection evidence remain in ignored `.dream-loop/` records.

The later mobile layout fix is pushed as `5006e1f`; Linux run 39848489075 passed
the complete existing suite. That run does not include the newly added manual
real-recording parity diagnostic and does not establish release readiness.

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
approved one-scene refinement is underway. Source and preview publication do not
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
