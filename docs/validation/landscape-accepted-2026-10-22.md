# Accepted Pulse Painting landscape candidate

The user accepted the publicly hosted Quiet Lake V18-combined study with **Keep**.
Its pigment treatment is integrated across all sixteen scene families. The
original measured samples, timestamps, quality attribution and usable-time
density remain unchanged. Independent visual review passed at 8/10; subsequent
raster consistency changes retain that visible treatment. A mirrored Coastal
Cliffs taper bug is corrected and covered by a negative-control regression.

The final renderer under verification has SHA-256
`a84ebe6772a518e2e9d44e6db5d2f30392a75e488884bbfa4e606765a78384d8`.
The source and generated gallery provenance must match this hash before release.

## Rendering consistency

Stable Canvas2D contexts and fixed-rectangle texture clipping preserve the
existing four-raster live budget and pigment budget. The preceding layer-only
candidate passed all 96 macOS cases in both engines. Extending its Linux check
exposed one Coastal Cliffs early-frame edge mismatch; the final all-surface
candidate fixes the targeted case exactly and also passes the previously
sensitive River Valley case. The final broad matrix remains pending.

The strict isolated-painter zero-alpha-loss diagnostic remains separate and
failed in WebKit at one 8-bit alpha level. Source geometry was retained; no
visible end-to-end flicker was demonstrated. It is a documented precision
limitation, not a missing-sample defect. The failed diagnostic and its unchanged
criterion remain available; no exact-alpha-retention claim is made. See
[the detailed raster record](landscape-raster-parity.md).

## Release verification

Final browser cadence, the three-minute interrupted WebKit replay, CI and hosted
asset verification will be recorded here as they finish. Browser replay uses the
public fixture and mocked camera/share APIs. It is not physical-phone camera,
thermal or native-share acceptance. The main product remains unchanged until
the production deployment and public checks succeed.
