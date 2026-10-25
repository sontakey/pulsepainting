# Immersive capture and balanced keepsakes — 2026-10-25

## Behavior

Recording fills the viewport with paper and watercolor. Pulse, HRV and gated
estimated Breathing overlay the top; the continuous measured pulse is centered.
The LIVE preview, signal bars and floating Cancel reading / Finish painting
controls remain reachable. About your readings opens above the dock without
resizing or moving the painting.

The live nib now reads cached source time/value interpolation directly. It no
longer prepares the terrain's pigment geometry on the main thread when entering
each new stroke; the raster worker already prepares that geometry. Playback
never accelerates to empty a backlog. A delayed animation frame advances at most
33.333 milliseconds of source; missing or rejected source remains a real pen
lift rather than invented pulse data. The final reconstruction retains all
accepted samples, including any not yet drawn when the recording ends.

The atmospheric landscape forms through quiet, monotonic pigment additions
triggered by actual accepted peak timestamps. Each change settles over roughly
1.2 seconds. Fixed, low-resolution background snapshots are prepared at most
once per five-second usable-data milestone, not on every beat. Overall opacity
is limited to 0.58 and the central writing corridor stays clear. Empty beat
metadata cannot invent progress; older saved scenes retain calm time fades.
No health interpretation or new physiological algorithm is added.

The 1080×1350 keepsake makes the landscape larger by trimming only untouched
source paper, with conservative bounds and uniform scaling. Every painted pixel
is retained. The scene name has its own padded cursive band; metrics sit higher
with more space above the date and website footer. The full gold frame and
optional metrics remain. Night scenes retain their complete square composition.

## Verification

- Chromium and WebKit source-timing checks pass across all 16 scene families:
  zero live main-thread terrain preparation with raster workers, exact measured
  frontier parity, unchanged deposited pigment, bounded stalls, rejected-window
  pen lifts and stable late-data recovery.
- Both engines pass immersive layout checks at 320×568, 390×844, 430×932 and
  844×390. Art fills the viewport, readouts clear the pulse, controls are at least
  44px, and expanded details/graphs do not resize the canvas or overflow.
- Both engines pass print checks across all 16 scenes: zero cropped pigment,
  exact cached-source pixel parity and a metrics toggle confined to its band.
  River Valley, long titles, metrics-off and Aurora were visually inspected.
- Sharing regression checks pass in both engines. These use mocked native-share
  support; they do not establish actual native share behavior on a phone.
- Independent runtime review found no blocking issues.

Ignored local evidence is in `.dream-loop/immersive-capture/`,
`.dream-loop/live-brush-timing/verification/` and `.dream-loop/balanced-print/`.
Timed session, performance, Linux CI and hosted deployment results are recorded
below when verified. Browser replay is not physical-phone, camera, thermal or
physiological-accuracy validation. npm publication remains pending.
