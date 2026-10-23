# Simple sharing and mobile capture polish — October 23, 2026

## Scope

The main sharing dialog now presents the prepared painting with Share image,
Save image and Copy painting link, or Copy app link while the artwork is private.
Caption is collapsed and Add to gallery remains an optional, explicit publication
flow. Platform tiles and the sketchbook preview are removed. Publication success
and community actions lead to `/p/<id>`; existing `/book/<id>` links remain supported.
The original ThreeUI source, its assets and the painting renderer are unchanged.

Authored emoji-capable arrows are replaced by decorative SVGs. Placement's
Find your pulse title is centered; irregular/FFT-disagreement guidance says
Finding signal without changing quality gating or metrics. Cancel reading now
releases capture resources, clears unfinished artwork and returns to the start.
Late camera callbacks cannot revive a cancelled reading. Finish painting retains
the separate completed-artwork path.

## Browser evidence

- App checks passed in Chromium and WebKit: cancellation/restart, stale callback
  isolation, quality attribution, reports, export retries and exact portrait parity.
- Sharing and publication checks cover trusted native-share invocation with exact
  image bytes, quiet cancellation, downloads, safe public/app links, explicit
  consent, default-off measurements, delayed responses and removal-key privacy.
- Community and public painting pages passed both engines. Existing public book
  routes and direct adapted-component tests retain compatibility coverage; the
  normal sharing flow does not request the book bundle or assets.
- Actual-app visual inspection passed at 320, 390, 887 and 1440 CSS pixels in both
  engines. Mobile actions stay reachable when caption expands; no page overflow.
- The same capture runtime passed a full WebKit session: 180.434 active seconds,
  all three interruption/recovery cases, zero first-frame recovery time credit,
  report metrics and pixel-exact completed artwork. Active painting measured
  58.39 fps with p95 20 ms in browser emulation. The replay used the public fixture
  and its documented timestamp-shifted tail extension after interruptions.

Renderer SHA-256: `2e7e417aeffe1cfef835bfbf49d80e49029de02314a00591a3366aa18d0df794`.
The sharing change does not alter capture or scenic rendering. A more continuous
brush/paper motion was discussed following the user's video; it is not part of
this release.

Local evidence is in ignored `.dream-loop/simple-sharing/` and
`.dream-loop/no-emoji/safari-session/`. The README sharing image is a direct
browser screenshot; see `docs/media/README.md` for provenance. These checks are
not physical-phone capture, native social-app delivery or thermal-performance
validation. No QA paintings are published to production.

## Release status

Local verification is complete. Final-source CI and hosted verification are
required before release; production identifiers are recorded in HANDOFF.md.
The ppg-js npm publication remains intentionally pending.
