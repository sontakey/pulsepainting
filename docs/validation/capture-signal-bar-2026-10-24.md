# Capture signal meter and header spacing

The healthy recording header now shows five ascending signal bars under LIVE,
without a Good signal label. Bars follow the engine's real gate-aware 0–100
qualityScore. Missing/nonfinite scores are never fabricated, and rejected quality
cannot display a high score. Brief issue prompts replace verbose internal reasons.
The issue live region stays mounted; unchanged messages are not re-announced.

The title and camera share a row; status/countdown and the meter share a second
row. The normal recording footer is empty and hidden. Meaningful renderer-fallback
and completed-reveal notices still work. Capture processing, acceptance, rendering,
reports, gallery images and exported artwork are unchanged. The runtime manifest
comparison changes only `app.css`, `app.js`, and `index.html`.

## Source and checks

Feature head: `9f1058c1e5cade5c76d2d3f654857931d19792dd`.
PR: https://github.com/sontakey/pulsepainting/pull/13
Node 24 build: 109 static files. Renderer SHA-256:
`7d1d2abb53ee40e7d8c9fcab773aefdc7fb749c77cbf10494d93a8e190e8cba1`.

- Chromium and WebKit app regressions pass: real public replay fixture/engine,
  quality-gated readouts, cancellation, stale callbacks, recovery, report/export
  parity, metric-toggle isolation, layout and unavailable data.
- Final WebKit app run includes exported artwork review. Scene parity max pixel
  delta is zero; metric toggling changes only its reserved band.
- Both browsers pass healthy, motion and finding-signal layouts at 320, 390 and
  430px, locally and on the hosted preview. Header rows align, prompts occupy
  one 18px line, the normal footer is hidden, and no overflow/page errors occur.
  These screenshots use the existing QA state hook, not a real capture.
- Preview `pulsepainting-k42s4lufr-sontakeys-projects.vercel.app` matches all 109
  frozen runtime files at `2026-10-24T16:00:42.511Z`.

Ignored evidence: `.dream-loop/capture-signal-bar/` (manifest, layout screenshots,
preview verification and exported artwork). No raw/private session is committed.
This presentation-only change does not rerun the full timed three-minute replay;
the previous camera-guidance replay remains separately documented. Browser checks
are not physical-phone camera, thermal, native-share or physiological validation.

## Release

[PR #13](https://github.com/sontakey/pulsepainting/pull/13) merged as
`c0a3c5028c9259a2e5352876e042ab65e8ac4254` after the full Linux
[`npm test` suite](https://github.com/sontakey/pulsepainting/actions/runs/40109481742)
passed. The merged tree is identical to the tested feature head. Vercel's Git
integration deployed the merge to the existing production project.

Production `dpl_GryR4JVFhes2oV16LMz44YT6Mfir` is READY at
https://www.pulsepainting.com/. All 109 public files matched the frozen build at
`2026-10-24T16:14:43.015Z`. Anonymous Chromium/WebKit checks then
passed all 18 mobile header states, without page errors, camera acquisition or
public writes. The post-deploy error/fatal log query returned no entries.
The feature branch was removed after the merge.

The README capture image was refreshed from the same source using accelerated
public-fixture replay. See [image provenance](../media/README.md). Later
image/documentation-only deployments may have different IDs with identical
runtime files. npm publication remains pending.
