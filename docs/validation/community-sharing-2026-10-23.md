# Community gallery, social sharing and personal sketchbook

This release adds optional public paintings, an artwork-first sharing screen,
and a personal paper book adapted from ThreeUI. Capture acquisition, accepted
samples, computed metrics and the landscape renderer are unchanged.

Renderer SHA-256:
`981c49eccf799a030199c2d694bfb7e8af9bc64a9dca3d6d4dfa331b1ef82637`.

## Verified boundaries

- Publication requires explicit consent. Display name is optional; summary
  measurements start off. A fresh public raster omits session timestamps,
  renderer seed and raw recording data. The server normalizes image dimensions
  and strips metadata before storage.
- Private exports work without publication. Native file sharing runs within
  the click, retains the original prepared image bytes and handles cancellation
  quietly. Social link destinations distinguish an app invitation from a
  published painting's own page. No action automatically posts to an account.
- The community collection and the sixteen public-fixture examples are
  separate. Default phone capture fetches neither community records nor book
  assets. Empty, error and retry states are explicit.
- Idempotent publication preserves a removal receipt before the request.
  Tests cover uncertain responses, late success after closing, immutable retry,
  invalid-request editing, pending withdrawal, public-view navigation and
  cleanup. Removal keys never enter public responses, share links or metadata.
- Public pages render their image and Open Graph metadata on the server.
  Hostile names remain escaped. Removed paintings return 410 with noindex and
  no artwork metadata; unknown paintings return 404.

## Real persistence checks

The Neon schema was applied first on an isolated development branch, tested,
then applied to the production main branch before release. An independent
read-only audit confirmed all three tables, expected columns and seven indexes.
The database and public Blob store are provisioned, not simulated services.

The real integration suite exercises database transactions, atomic quotas,
idempotency, failed/uncertain writes, reporting, removal and Blob cleanup.
Separate WebKit UI checks published two paintings with summary measurements
off/on through the real isolated API, decoded the stored JPEG/WebP, opened
their public pages and gallery views, then removed both. Test records and
images were cleaned up; they do not seed the production gallery.

Local evidence: `.dream-loop/community-real-dev/result.json`.
Operator setup, namespace selection, moderation and cleanup are documented in
[`db/README.md`](../../db/README.md). Reports require manual operator review;
downloaded copies cannot be recalled.

## ThreeUI preservation and adaptation

The complete registered source at revision
`3938bc8def563f89ed587e52ac35ddc056c0a5f0`, all seventeen binary assets and
their license notices remain byte-for-byte preserved. The build verifies hashes.
The exact configured original has its own reference fixture and tests.

The user's approved separate adaptation replaces fixed travel plates with
three locally composed spreads of the prepared share image. Full-portrait
pixel comparisons cover the first and last spread; the middle spread uses
labeled detail crops. Neither composition nor framing invents pulse marks.
All three images must decode inside the opaque sandbox before readiness.
Local PNG data images avoid parent Blob URL access failures while preserving
`sandbox="allow-scripts"` isolation.

Chromium and WebKit cover desktop, phone, reduced motion and 320×568. The
checks include initial control bounds without iframe autoscroll, page arrows,
taps and dragging, keyboard navigation, zoom, tilt, magnifier, lazy loading,
decode/encoding failure and disposal during preparation. Shared source bytes
remain unchanged. The original source's pointer-arrow limitation is recorded;
the derived copy alone fixes its pointer-capture handling.

Evidence: `.dream-loop/personal-sketchbook/`,
`.dream-loop/community-share/` and the checked-in browser suites. See the
[adaptation record](../design/threeui-sketchbook.md).

## Full capture regression

The full local `npm test` passed, covering the existing capture/report/export,
landscape parity, GPU fallbacks and galleries alongside the new sharing,
community and original/personal sketchbook suites.

A separate wall-clock WebKit replay completed 180.388 seconds of active
measurement in 209.861 seconds. Camera-frame pause, a deliberate 2.5-second
main-thread stall and simulated backgrounding all recovered with zero
first-resume credit for stale time. The same-scene reveal, report labels,
private artwork, original manuscript export and renderer/encoder recovery
passed. The documented recorded-tail extension supplied sufficient replay data.
Active painting measured 59.59 fps, p95 19 ms, maximum 240 ms. Other browser
checks ran concurrently on this Mac, so this is a regression observation,
not an isolated performance benchmark or physical-phone claim. Evidence:
`.dream-loop/safari-session-check/result.json`.

## Release status and scope

Source review and local browser checks are recorded here. Hosted preview,
CI and production verification are added to the release record when complete;
local success alone does not establish a public release.

These checks use browser emulation, a public recording fixture and mocked
camera/native-share interfaces. They do not establish physical iPhone camera,
thermal performance, social-app delivery or a device-level frame-rate guarantee.
The personal book loads only after capture, on explicit request.
