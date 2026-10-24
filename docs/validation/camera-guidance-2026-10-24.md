# Camera access guidance

## Behavior and scope

The phone entry screen offers **Need help with camera access?** before capture.
Starting a reading shows a calm waiting panel while permission is unresolved;
after ten seconds, its copy suggests checking for a prompt without assuming a
denial. Camera failures open an illustrated native dialog instead of an alert.
The guide distinguishes blocked access, a busy or unavailable camera,
unsupported/insecure contexts, requested settings, interruptions and unknown
failures. Browser selection is overridable. Site permission and phone-level app
permission are separate steps, with official support links and an in-app browser
link-copy fallback. See [source research](../design/camera-guidance.md).

The helper never requests camera access by itself or promises to change phone
settings. Retry is an explicit action. An unresolved cancelled acquisition stays
tracked, so Cancel followed by Begin cannot open a competing request. Late
streams are stopped, and a settled stale request dismisses obsolete waiting
help. An error callback and a rejected start promise produce only one recovery
dialog. Timers, capture callbacks and animation work are stopped on failure.

If capture fails after data has been collected, its painting and report are
preserved. **Keep this painting** returns to that report. **Start a new reading**
explicitly warns that it replaces the reading; separate signal engines are not
silently joined. The signal-processing library, accepted-data adapter, landscape
renderer and gallery assets are unchanged.

## Tested source

Final feature source: `5c4640074f7ddb5bdb3170d30e0ff8f06529c079`.
The full timed replay used `3cc7f25e9f7d65bfd0a063d68f08c6f50bc30f63`;
the only subsequent runtime change is the browser-selector CSS described below.
The capture logic, helper JavaScript, signal library and renderer are identical.
The Node 24 build contains 109 static files. Renderer SHA-256 remains
`7d1d2abb53ee40e7d8c9fcab773aefdc7fb749c77cbf10494d93a8e190e8cba1`.
Ignored evidence is under `.dream-loop/camera-guidance/`; the frozen
`release-manifest.json` records every built file hash and the source commit.

## Browser verification

The existing application suite passes, including cancellation, stale callbacks,
report layouts, export recovery and exact canonical artwork parity. The legacy
camera-denial assertion now closes the new dialog before continuing its later
unrelated UI checks.

The new `test:camera-guidance` suite passed thirteen scenario groups in each of
Chromium and WebKit on the final source at `2026-10-24T15:31:11.119Z`.
It uses the actual monitor and
signal engine, stubbing camera acquisition and frame scheduling at the boundary.
Only the already-public replay fixture supplies physiological samples.

- Manual help makes no camera request. Browser selection updates instructions;
  denied clipboard access selects the canonical URL with an honest fallback.
- Native modal focus, Escape, backdrop behavior, focus restoration, 320px layout
  and enlarged text pass. Additional visual checks cover 390px and 840px.
- Permission, busy, missing-device, constraint, abort and unknown errors each
  open one guide; unsupported and insecure preflight do not acquire a camera.
- Ignored prompts, cancellation, late permission grant/rejection, duplicate
  prevention, fresh explicit retry and stale callbacks pass.
- A visibility round trip does not initiate a permission retry. Failed automatic
  recovery retains the accepted source, metrics and partial report.
- There are no page errors or native alerts in the focused checks.

Hosted visual review caught a Safari-specific issue: native menulist styling
rendered the browser picker too short despite its CSS minimum height. Disabling
that appearance and adding a static SVG chevron preserves native selection
behavior while giving the control a real 48px touch target. Chromium/WebKit
checks at both 320px and 390px confirm 48px height, 16px type, browser switching,
focus restoration and no horizontal overflow. The regression suite now checks
actual rendered height, not just computed CSS.

These are browser-emulation checks, not real iPhone or Android permission,
settings-navigation, camera/flash, physiological-accuracy or native-share
validation. Browser and phone labels are documented with version qualifications.

## Full three-minute WebKit session

The replay passed at `2026-10-24T15:26:57.368Z`, using WebKit 26.6 with an iPhone
13 viewport and mocked camera I/O. Source and served-file hashes matched before
and after the run (`full-session/source-hashes.json`). Quiet Lake used seed 39293.

- Automatic capture completed 180.653 credited seconds in 210.125 wall-clock
  seconds. It retained 33 accepted segments, 65 scene strokes and 157.25 usable
  seconds of artwork source.
- A four-second camera-frame pause, a 2.5-second main-thread stall and a
  4.001-second simulated hidden interval all recovered with zero first-resume
  credit. Camera absence and hidden time received no held-time credit.
- Expired samples were dropped rather than replayed as a backlog. The public
  fixture's final sixty seconds were repeated with shifted monotonic timestamps
  to supply the documented extension beyond its original 200-second duration.
  This is a test stimulus, not an additional physiological recording.
- Eight actual background discoveries occurred, with zero source regressions,
  invalid positions, future foreground/background samples or full-contrast
  scenic raster compositions during capture.
- The 5.823-second reveal preserved the accepted scene and stopped measurement
  clock. The report agreed with the engine: 71 bpm, RMSSD 54.4 ms, SDNN 51.7 ms,
  193 beats. Canonical artwork parity, metrics-band isolation, encoder and
  renderer retries, 320px graph labels and the 1200 × 5920 report export passed.
- There were no page errors, console errors or first-party request failures.

| Browser measurement | FPS | p95 interval | Maximum interval |
| --- | ---: | ---: | ---: |
| Whole session, including deliberate stall | 58.52 | 19 ms | 2515 ms |
| Whole session, excluding deliberate stall | 59.22 | 19 ms | 155 ms |
| Active painting | 59.12 | 19 ms | 155 ms |
| Final reveal | 58.89 | 19 ms | 45 ms |

The single mid-session screenshot readback is included in these measurements.
This unchanged-renderer regression is not a physical-phone performance claim.

## Release status

[PR #12](https://github.com/sontakey/pulsepainting/pull/12) merged as
`96620dd1041b71ad3a0ef210309f09bbe2cae4a2` after
[CI 40107298589](https://github.com/sontakey/pulsepainting/actions/runs/40107298589)
passed the full `npm test` suite on final head
`5c4640074f7ddb5bdb3170d30e0ff8f06529c079`, using PR merge tree
`a1b62054cd2f9ab065051899971eedd31292690c`, Node 24 and Playwright 1.63.0 on Linux.
This includes all sixteen scenes, accepted-source provenance, painting parity,
camera guidance, reports, gallery, sharing and existing book compatibility.
The automatic Git production deployment had not appeared after the merge.
An explicit production deployment was therefore requested from the merged Git
SHA through the authenticated Vercel CLI/API, using the existing team and
project. The Vercel connector itself returned a team-scope 403; no settings,
credentials or project connection were changed.

Protected preview `dpl_8qLttpsxZSCUutaJZBcQdUTnRYHB` is READY at
`https://pulsepainting-3a9mp1nmr-sontakeys-projects.vercel.app/`.
All 109 files matched the frozen build at `2026-10-24T15:31:44.255Z`.
The apex domain returned 308 to `https://www.pulsepainting.com/`.

Protected-preview checks passed in Chromium and WebKit at 390px and 1440px at
`2026-10-24T15:31:56.152Z`. Phone checks exercised the actual manual help button,
visible illustration, browser selection and updated steps, scrolling, native
modal focus, Escape and return focus. A camera-call guard confirmed that opening
help never requests media. The same run checked existing gallery, community
reads, sharing preparation and desktop walkthrough images. No write requests,
page errors or HTTP errors occurred.

Production `dpl_4NKJeY6WvSuZxvrAVg29ewtNcxWK` is READY for the merged Git source
at `https://www.pulsepainting.com/`. All 109 public files matched the frozen build
at `2026-10-24T15:48:45.800Z`; the apex returned 308 to www. Anonymous Chromium
and WebKit checks at 390px and 1440px passed at `2026-10-24T15:48:57.862Z`, with
no page errors, HTTP errors or public writes. The public mobile guide retains
its 48px selector and supports switching browsers, closing and restoring focus.

A five-minute deployment-scoped runtime error scan returned two existing
dependency warnings on the successful community GET: Node's legacy URL-parser
deprecation and pg-connection-string's notice about future SSL-mode semantics.
They were logged on stderr as error-level records, but the checked API requests
returned 200 and no application request failed. No new monitoring integration
or database/SSL configuration change is part of this release.

No production QA paintings were created. Evidence is in `production-create.json`,
`production-deployment.json`, `production-assets.json`,
`production-browser/results.json` and `production-errors.jsonl` beneath the
ignored evidence directory. Later documentation-only deployments may have
different IDs while serving the same verified runtime. npm 0.3.1 publication
remains deliberately pending.
