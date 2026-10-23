# Framed keepsake cards — October 23, 2026

## Scope

The exported 1080 × 1350 artwork now has one warm paper stock and ochre frame
around the entire card, padded Pulse Painting lettering, a cursive landscape
name, a reserved three-column metrics band, and a date at lower left with
PulsePainting.com at lower right. Landscape names remain visible with metrics.
The generic “A landscape made from a real pulse” copy is removed.

Personal report artwork starts with pulse, RMSSD and SDNN visible. The checkbox
hides metrics without moving or changing the source painting. Missing values are
dashes, never generated readings. Public-gallery preparation remains a separate
fresh image and explicit consent step, with metrics off and no private date by
default. Existing publication records are not rewritten.

All sixteen example share JPEGs use the same card renderer and retain an
explicit public-recording label. The 32 full landscape/thumbnail assets and
social image remain byte-identical. Legacy shared sketchbooks retain their full
first/third plates; detail views use a common crop inside both old/new layouts.

## Validation

- Chromium and WebKit app suites: exact scaled source-painting parity, border
  and text bounds, default metrics, missing values, toggle restoration, retry,
  report controls and public-export privacy.
- Share-sheet checks in both engines: prepared-image sharing, fallbacks, local
  defaults and separate public-metrics consent.
- All 16 scenes × full recording, short recording and unavailable metrics ×
  two browser engines: 96 real card exports. Eighteen report captures cover
  320, 390 and 1440 CSS pixels. Twelve actual Save artwork downloads match the
  prepared PNGs; twelve local public JPEG preparations preserve their privacy
  contract. Input is the already-public fixture through the pinned engine and
  actual accepted-window adapter, not invented pulse values.
- Gallery checks pass all sixteen examples, responsive layouts and prepared
  share-image checks. Full personal-sketchbook suites pass in both engines.
- Book compatibility tests use actual composition of old/new and half-size
  cards, with outside-art sentinel pixels to detect accidental text crops.
  The prior crop fails this negative control; full pages remain intact.
- Independent code review found no blockers. No vendor artifact changed.

The accepted landscape renderer remains
`2e7e417aeffe1cfef835bfbf49d80e49029de02314a00591a3366aa18d0df794`.
Camera capture, waveform processing, live animation and lifecycle are unchanged.
A new three-minute camera replay is unnecessary for this layout-only release;
the previous full WebKit session is recorded in
[simple-sharing validation](simple-sharing-2026-10-23.md).

Ignored evidence: `.dream-loop/keepsake-card/` and
`.dream-loop/keepsake-cards/`. Screenshots are direct browser captures; see
[image provenance](../media/README.md). These checks do not certify physical
phone capture, physiology, native social delivery or thermal performance.

## Deployment

- Tested source: `b6ae978795dbbf6728a9762adbca2a4bd2bc4f04`.
- [PR #9](https://github.com/sontakey/pulsepainting/pull/9), merged as
  `a06fb28cab7a4abbf93170f352e509004a20a8d7`.
- Full Linux [CI 40040417841](https://github.com/sontakey/pulsepainting/actions/runs/40040417841)
  passed on the tested head.
- Preview `dpl_6wgWPYRDARvPYRWy7UarHc26ih3L` was READY; all 107 files matched at
  `2026-10-23T23:35:41.289Z` and real hosted phone/desktop checks passed in
  Chromium/WebKit at `2026-10-23T23:35:54.723Z`.
- Production `dpl_5yJgAfLTDdCC1FueiLX6tNC2ny8z` is READY on https://www.pulsepainting.com/.
  All 107 public files matched the frozen tested build at
  `2026-10-23T23:44:36.548Z`. The apex redirects to www with HTTP 308.
- Anonymous real-site Chromium/WebKit checks at 390px and 1440px passed at
  `2026-10-23T23:44:50.290Z`: prepared share-image bytes, centered artwork
  sharing, gallery, lazy loading, and read-only community requests. No public
  test paintings or messages were created; no runtime or HTTP errors occurred.

Later documentation-only commits can advance the deployment ID without
changing these verified runtime bytes. npm publication remains pending.
