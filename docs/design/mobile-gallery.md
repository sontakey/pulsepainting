# Pulse Painting mobile gallery

The phone opening screen offers **Explore the paintings** before capture. It
opens the same sixteen public-fixture examples as the desktop collection in a
layout made for a phone. The existing capture, renderer, metrics and report
behavior remain unchanged.

This is a tested implementation. [Browser verification](../validation/mobile-gallery-2026-10-23.md)
records its checks; [HANDOFF.md](../../HANDOFF.md) records deployment status.
The [desktop design note](desktop-gallery.md) retains the original inspected
Mobbin references and gallery publishing contract. This extension reuses that
direction; it does not claim a new reference study.

## A collection made for a phone

One brush heading, **A world within.**, introduces the collection. Quiet lake
opens at full column width, followed by a two-column grid of square, uncropped
artworks. Readable names and descriptions sit outside each image. Filters offer
all sixteen landscapes, eight Water scenes, six Land scenes and two Sky scenes.
The phone does not display the desktop QR invitation.

The existing floating ready-screen dock becomes **Back** and **Start painting**.
Content has space to scroll above it, including the final explanatory note.
Start is the original capture button, with its existing camera-permission
handler and brush transition. Selecting it begins capture from the user's
actual click, after closing the gallery synchronously.

Opening an artwork uses the shared native modal dialog. Swipe on the image,
use previous/next buttons, or use keyboard arrows to browse. Close returns to
the collection with focus restored to a visible scene card. **Make a painting
of your own** returns to the capture instructions and focuses Start; it does
not request the camera automatically. Reduced motion, one visible brush
heading, at least 14 px supporting text and 44 px touch targets keep the
collection usable on smaller screens.

![Mobile gallery with the featured Quiet lake and floating capture dock](../media/pulse-painting-mobile-gallery.png)

This is a direct 390 × 844 WebKit browser screenshot. See
[image provenance](../media/README.md) for its source and checksum.

## Loading, history and capture safety

The default phone page fetches no gallery manifest or artwork until the visitor
chooses Explore. The invitation itself uses local markup and styling. An
explicit shared scene link also opens the collection. Once opened, the shared
manifest loads once and thumbnails load lazily. A failed request shows an
inline retry action; capture remains available.

Navigation follows ready screen → collection → artwork. Browser Back closes
the artwork, then returns to the instructions. Moving between scenes replaces
the current scene entry, so Back does not require retracing every swipe. Shared
scene links create a local ready/collection fallback, and Forward restores the
appropriate collection or artwork state.

Back and Start invalidate pending gallery requests. A response arriving after
the visitor leaves cannot reopen the collection, download its abandoned
artwork, or cover camera placement. Reusing the actual Start button preserves
the camera user gesture; the gallery does not acquire or replace the stream.

## Source and sharing

The sixteen examples come from one already-public pulse recording through the
actual accepted-window adapter and renderer. They are labeled examples, not
visitor submissions or a community feed. No new recording is needed to browse,
and the gallery makes no uploads. The renderer and all generated image pixels
are unchanged by this navigation work.

The shared viewer retains its existing user-initiated sharing: it prepares one
labeled example JPEG, then invokes native sharing from the share-button click
where supported, with link/copy fallback. Captured personal paintings remain
separate. Browser checks mock sharing and camera acquisition; physical-phone,
native-share and mobile performance acceptance remain separate scopes.
