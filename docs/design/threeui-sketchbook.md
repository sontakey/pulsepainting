# Preserved sketchbook renderer and existing recipient links

The main sharing sheet now uses a simple painting preview and image/link
actions. Existing public `/book/<id>` pages retain a book made from the
same prepared image. Sharing stays available outside the book with no extra
export step. The book never receives recording samples, metric objects,
display names, publication capabilities or other session data.

The user explicitly chose a separate adaptation for personal paintings while
preserving the original [ThreeUI Sketchbook](https://threeui.com/css/sketchbook).
`vendor/threeui-sketchbook/` retains all three complete source files from the
[source manifest](https://threeui.com/source-code/sketchbook.json), revision
`3938bc8def563f89ed587e52ac35ddc056c0a5f0`, unchanged. All seventeen original
assets match the supplied SHA-256 values and were extracted from the published
`@designcodeio/threeui@1.2.0` npm archive. The package's canonical document output
matches the supplied source exactly. `tools/verify-sketchbook.mjs` verifies this
offline; the original fixture still renders all nine authored Singapore spreads.

## The personal adaptation

`src/pulse-sketchbook-spreads.js` composes three 1760×1240 transparent plates
with procedural warm paper aligned to the original renderer's page geometry.
**Your painting** contains the complete, unmodified portrait. **A closer look**
contains explicitly labeled crops of the same image. **A moment to share**
contains the full portrait and an invitation. No pulse waves, photographs or
other landscape content are invented; the original image blob remains the
unchanged file used by the sharing buttons.

`src/pulse-sketchbook-document.js` derives a separate document from the preserved
renderer using explicit checked substitutions. It replaces the page table and
hidden portfolio content, removes every original image reference, and replaces
the background with a quiet paper wash. It retains the original eighteen-strip
CSS page curl, spring calculations, geometry, zoom, tilt, magnifier and keyboard
navigation. It also fixes the original pointer-arrow issue described below,
enlarges controls to 44px and supporting text to 14px, and makes zoom, canceled
turns, hover tilt and magnifier easing honor reduced motion.
The adapted book width also fits the iframe's height, reserving space for its
caption and 44px toolbar; the desktop panel is taller so controls remain visible.

`src/sketchbook-entry.tsx` mounts this adaptation as a small React island with
`sandbox="allow-scripts"`, without same-origin or parent-navigation privileges.
The original complete shared stylesheet is isolated in a shadow root, keeping
unrelated ThreeUI class rules out of Pulse Painting. React and React DOM are
pinned to 19.3.1, verified against npm and compatible with the original package's
`>=18 <20` peer range.

Only an explicit book action loads the React island. Personal book pages are
embedded PNG data URLs, composed from the prepared image. Parent blob URLs are
converted locally because an opaque sandbox cannot resolve them. Readiness
requires all three plates to decode at their expected size, reported by the
mounted iframe's own window; loading the iframe alone is not success. The live book fetches only
the three shared fonts under `/sketchbook/`; it never downloads the original
8,607,345 bytes of Singapore assets. Asset CORS permits font requests from the
sandbox's opaque origin. No external account or service is needed.

Closing the book or share sheet aborts pending composition, unmounts React,
removes the iframe and revokes all spread URLs. Closing or navigating Back
during the module import invalidates the pending work before it can mount.

Source and authored assets are MIT; fonts are SIL OFL 1.1. Notices are preserved
in `vendor/threeui-sketchbook/` and distributed under `/sketchbook/`. The live book
credits its page-turning source, without presenting the original author as the
creator of the visitor's painting. The npm package's unrelated renderers and
older Three.js aliases are not installed or bundled.

## Exact reference limitations

In the unchanged original, stage pointer capture happens before checking for a
page gesture. Physically clicking its small arrow buttons retargets the later
click to the stage and does not turn the page. This reproduced in all six
Chromium/WebKit desktop, phone and reduced-motion cases. The original test
records `pointerArrowAdvances: false` and prints an explicit upstream-limitation
notice. The separate personal document fixes this by capturing only page zones.

The original also retains small controls/type and some view spring effects under
reduced motion. These remain intact in the reference fixture. They are enlarged
and motion-gated in the personal adaptation; the vendor files are untouched.

## Verification

`test/e2e/sketchbook-checks.mjs` exercises the exact reference in Chromium and
WebKit: nine spreads, fonts, page taps, keyboard turns, zoom, desktop tilt and
magnifier dragging, coarse-pointer magnifier hiding, lazy mounting and disposal.
Chromium also exercises emulated touch dragging. WebKit uses browser pointer
dragging at a phone viewport. Its known arrow limitation is reported separately.

`test/e2e/personal-sketchbook-checks.mjs` exercises the adapted personal book.
`test/e2e/share-sheet-checks.mjs` covers zero book requests before an explicit
action, closed/pending imports, browser Back, reduced-motion mounting, unchanged
personal preview, ready primary sharing and teardown, alongside public-link
safety, native-share gesture/cancellation and default-private publication.

Evidence is under ignored `.dream-loop/sketchbook/` and
`.dream-loop/community-share/`. These are browser checks, not physical-phone,
sustained frame-rate or actual social-post acceptance.

React integration follows its official
[incremental integration guide](https://react.dev/learn/add-react-to-an-existing-project)
and [`createRoot`/`unmount` reference](https://react.dev/reference/react-dom/client/createRoot).
