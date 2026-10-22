# Pulse Painting handoff

## Scope

Pulse Painting has been extracted from the ppg-js camera application at source commit `732e1ef51f76bce9145bb7f666f92a30be5e0181`. The app owns capture presentation, painting, reports, and exports; ppg-js retains scientific and camera-acquisition source.

The landscape release candidate implements sixteen source-mapped scene families,
usable-time density, a close-up artwork camera and a continuous same-scene reveal.
Local visual and regression validation is in progress. It has not yet replaced
the verified manuscript release on production.

The user explicitly approved curving real traces along terrain and adding
organic curves within the pulse strokes. Those curves are implemented; the
original manuscript and computed report remain unchanged. Connected channels,
perspective and source-derived land fills are also implemented. The latest
independent visual reviews scored 5.5 and 5.3/10. Terrain continuity improved,
but smooth stacked fills still look artificial, several scene families remain
too similar, and sparse/dense compositions need stronger art direction.

The dream-loop workflow reached its stalled criterion again after this major
revision. The user has been shown the actual current atlas and asked whether to
pursue natural watercolor texture/distinct scenery (recommended) or retain the
abstract contour style and finish deployment. Await that direction before a
further renderer rewrite or release. Draft source PR 1 is open at
https://github.com/sontakey/pulsepainting/pull/1; its first checkpoint is
`7d4b42b`. Vercel preview `dpl_ChGLMjcdfhecNVooYbatvteiyEDt` is READY at
https://pulsepainting-eo0kdeo0a-sontakeys-projects.vercel.app. This is a preview,
not a landscape production release. Hosted acceptance passed: all 21 assets
match the tested snapshot, WebKit replay/report/export checks passed, the same
scene zooms from 2.8× to 1×, and the painted QR passed ten decode variants. The
goal remains active awaiting the user's visual direction.

The current curve/volume candidate passes the Node source model and browser view
suite, including all sixteen families, retained source knots, no interpolated
amplitude overshoot, fragmentation density, pause/resume, reduced motion, bounded
cache storage, and exact live/direct raster parity. Chromium and accelerated
WebKit app/report/export checks pass. A full three-minute interrupted WebKit
session passed with 59.68 fps active painting, and four 20-second performance
cases measured 60 fps at 1×/4× CPU throttling. These used an immutable snapshot
of `7d4b42b`. The portrait parity test now compares identical destination
coordinates; Chromium, WebKit and Linux CI all report zero difference with its
original tolerance. GitHub Actions run `39726258318` passed on `91ef060`, including
build, model/view, app/report/export and GPU fallback checks. The style choice
remains pending. See
`docs/validation/landscape-candidate-2026-10-21.md` for scoped results and retained
intermediate failures. Tests do not imply visual acceptance.

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
