# Sharing a moment

The sharing screen keeps the finished painting first: warm paper, a quiet
pigment wash, a large artwork preview and one prominent image-share action.
The report retains its two floating controls, **Share artwork** and
**Measure again**. Publishing is a separate, optional action.

## References inspected

Actual Mobbin screens informed the hierarchy, not copied graphics or code:

- [WHOOP](https://mobbin.com/screens/72245e7f-faee-4efb-b078-315632e093d4):
  finished card above compact export controls.
- [Duolingo](https://mobbin.com/screens/207ec34a-5e16-4268-b006-ca2a6e7368f1):
  recognizable destination shortcuts beneath the result.
- [Rodeo](https://mobbin.com/screens/7e9dc638-8fa0-4756-a54f-678a96e55bf3):
  warm paper and restrained sharing controls.

## Image sharing and links

The cached painting is prepared before the visitor taps **Share image**, so
the native share call runs in that click and retains Safari's user activation.
Cancellation is quiet; browsers without file sharing can save the image.

X, LinkedIn, Facebook and WhatsApp open their link-sharing destinations.
Instagram and TikTok use the phone's native image-share sheet or an image
download, with a separate caption-copy action. App availability is controlled
by the operating system. These controls do not automatically publish posts.

Private artwork can be shared without uploading it. Until a painting is
published, link buttons invite people to the application. Published paintings
have a `/p/<uuid>` page with server-rendered Open Graph metadata and the chosen
public image. The distinction is visible in the share screen.

## Public gallery consent

The publication dialog renders a fresh image, independent of the private
report export. It omits session date, duration, seed and raw recording data.
The name is optional; summary measurements and public consent both start off.
Changing either selection requires consent again. The preview shows what
will be uploaded; raster normalization on the server strips metadata.

The community collection is separate from the sixteen labeled fixture
examples. Empty and failed loads are explicit. A default phone visit does not
fetch community data or images. Public artwork is visitor-submitted; the
service does not claim to verify the physiological origin of an uploaded image.

The browser saves a private removal capability before submitting. Retrying an
uncertain upload uses the same identity and content. Closing a submitted upload
does not cancel it; the browser retains a late receipt. Visitors can remove
their painting or preserve a private removal link. Public sharing never
includes that capability. Previously downloaded copies cannot be recalled.

Storage, limits, migration and moderation are documented in
[the operations guide](../../db/README.md).

## Personal sketchbook and exact ThreeUI reference

The personal paper book is adapted from the exact
[ThreeUI Sketchbook source](https://threeui.com/source-code/sketchbook.json),
revision `3938bc8def563f89ed587e52ac35ddc056c0a5f0`. All three registered source
files and seventeen assets are verified by SHA-256 before building. The
original MIT and font licenses accompany the assets.

The original component has only asset-base and class-name props. At the user's
request, a separate adaptation replaces the fixed Singapore plates with three
locally composed spreads of the already prepared share image. The first and
last spreads contain the complete image; the middle spread contains clearly
labeled, aspect-preserving detail crops. Paper grain, framing and text add no
invented pulse marks. No raw recording or private removal capability enters
the book. The native share file remains unchanged.

The original source, complete authored plate set and configured
`<Sketchbook assetBaseUrl="/sketchbook/" />` reference remain intact and have
separate tests. The adapted copy reuses the authored page-curl, drag, tilt,
zoom and magnifier implementation. Its explicit patches correct pointer
capture on arrow buttons and improve touch-target sizes without rewriting the
animation engine. See [the adaptation record](threeui-sketchbook.md).

The personal book is lazy, isolated and unmounted on close. Its temporary
plate URLs are revoked, including when closed during preparation. Default
capture and sharing do not fetch the original Singapore plates.
