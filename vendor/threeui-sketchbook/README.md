# Exact ThreeUI Sketchbook

This directory preserves the three complete source files supplied by
<https://threeui.com/source-code/sketchbook.json>, revision
`3938bc8def563f89ed587e52ac35ddc056c0a5f0`. The component reference is
<https://threeui.com/css/sketchbook>.

The seventeen matching assets in `app/sketchbook/` were extracted from the
published `@designcodeio/threeui@1.2.0` npm archive. Every source and asset SHA-256
matches the supplied manifest. The npm renderer produces the exact same
canonical HTML and configured document as the supplied renderer source.

Run `node tools/verify-sketchbook.mjs` to check source, assets, notices and
canonical HTML. The checks are offline. No assets are substituted or generated.

The original component accepts only `assetBaseUrl` and `className`. It contains
nine authored Singapore spreads, a draggable magnifier, page turning, zoom and
keyboard navigation. It has no personal-artwork, content or export API. These
plates must not be labeled as a visitor's pulse painting.

All seventeen assets total 8,607,345 bytes. The renderer preloads the nine plates
when mounted. Keep this component lazy and separate from capture and the normal
sharing path. Remove its React root when its containing view closes.

The outer shared stylesheet is retained completely. It includes unrelated
components and an unused Fragment Mono font reference that is not included in
the npm package. The adapter imports this stylesheet as text into an isolated
shadow root. The Sketchbook itself uses only the three verified bundled fonts.

Source and ThreeUI-authored assets are MIT; bundled fonts are SIL OFL 1.1.
See `LICENSE`, `ASSET-LICENSES.md` and `FONT-LICENSES.md`. These notices are also
distributed at `/sketchbook/`. No endorsement by the author is implied.
