# Shareable sketchbooks — 2026-10-23

## Scope

Published paintings gain a canonical `/book/<uuid>` recipient page. It opens
three interactive spreads from the already-consented public JPEG, with the
existing ThreeUI page turns, zoom and magnifier. Mobile actions float above the
safe area. Native sharing sends only the canonical book URL; clipboard denial
leaves a visible, selected link. Optional names remain escaped text. No raw
recording, local receipt or removal key enters the page.

Private paintings first open the public preview and explicit publication consent.
Creating a link also puts the painting in the community gallery. The optional
name/metrics choices and publication-removal mechanism are unchanged. Removing
a painting disables both `/p/<id>` and `/book/<id>`. Book HTML is no-store.
The original source, asset hashes, renderer and capture timing are unchanged.

## Local verification

Tested source: `ecb16f8556815be3365160a0b09328cb4aab3a80` (PR #5).

- Build verifies all three original ThreeUI sources and seventeen binary assets.
- App, community-sharing, share-sheet and public-painting-page checks pass.
- New link suite passes in Chromium/WebKit: canonical URL validation, separate
  file share, trusted native URL activation, cancellation, denied clipboard,
  reviewed publication, default-private metrics, exact public raster reuse and
  late-response isolation.
- New recipient suite passes at 320/390/1440px in Chromium/WebKit: actual SSR/CSP,
  UUIDv7, three decoded spreads, keyboard/page turns/zoom, mobile control bounds,
  copy fallback, 16px link input, reduced motion, failed-module reload retry,
  stalled-image deadline/retry and pagehide/BFCache disposal/reopen. Redirect
  refusal is tested in Chromium; WebKit cannot mock a redirect through its route
  API. Both engines use the same `redirect: error` client fetch.
- Real isolated Neon/Blob checks pass, including book 200/HEAD/400/404/410,
  metadata and owner removal. The suite removes its temporary namespace.

## Hosted preview

Deployment: `https://pulsepainting-9s4wb972l-sontakeys-projects.vercel.app`.
At `2026-10-23T18:14:27.250Z`, all 101 assets matched the frozen tested build.
At `2026-10-23T18:14:55.857Z`, actual preview publication/SSR and recipient checks
passed in Chromium and WebKit at 390 and 1440px. The real normalized JPEG was
used for all three spreads; name escaping, actual-image social metadata,
no-store/HEAD, page turns/zoom, trusted URL sharing and clipboard denial passed.
No CSP, runtime or request errors, and no recipient writes occurred. The single
clearly labeled fixture was removed in `finally`; `/p` and `/book` returned410,
social metadata was removed and Blob cleanup was confirmed. Production received
no test paintings.

Evidence is ignored under `.dream-loop/shareable-sketchbooks/`, including the
asset manifest, hosted preview result/screenshots and guarded smoke helper.
Local responsive screenshots/results are in `/tmp/pulse-public-book-final/`.

## Release status

Full Linux CI run `40001581765` passed the complete `npm test` pipeline.
PR #5 merged as `5c3d91fbaeb1a25837978f1713a474e2dbbc0ef9`.
Production deployment `dpl_DSFTBAKkMLjuxkdueBuAksU969aq` is READY at
`https://www.pulsepainting.com/`. At `2026-10-23T18:25:40.740Z`, all 101 deployed
assets matched the frozen build; the apex redirects308 to www. Anonymous
Chromium/WebKit checks passed at phone and desktop sizes for the real app,
sharing, three decoded book pages, controls and community reads. Production
book-route 400/404/HEAD/no-store checks passed at `18:25:42.794Z`.

The public gallery was empty at verification, so the complete public recipient
flow used one temporary preview record; production received no test paintings.
Read-only production checks and source/asset parity are recorded separately.
Later documentation-only commits can advance the deployment ID without changing
the tested runtime.

Browser checks mock native-share/clipboard APIs. They do not prove social-app
delivery, physical-phone camera performance or a new frame-rate benchmark.
