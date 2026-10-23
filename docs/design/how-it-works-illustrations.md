# How it works illustrations

Generated on 2026-10-23 for the three-step Pulse Painting walkthrough. These are editorial instructional illustrations, not images generated from a user recording or evidence of biometric accuracy.

## Generation and approval

- Requested source: Sunburst through Higgsfield. All three attempts were rejected because the connected workspace had no credits; no Sunburst jobs or outputs were created.
- The user explicitly approved the built-in image generator as the fallback, following prior approval to generate and add all three illustrations.
- Actual mode: built-in `image_gen` tool, opaque background. One generation per illustration, then one targeted image edit to correct rear-camera fingertip placement in the first image. No CLI/API fallback was used.
- Originals are preserved byte-for-byte in the ignored `.dream-loop/slow-phone/how-it-works-originals/` directory and at their original generator paths. Only responsive WebPs belong to the application asset directory.
- Optimization uses Sharp resize and WebP encoding only: width 480 or 960, quality 82, effort 6. No crop, compositing, recoloring, painting, or generated content replacement was performed by image-processing code.

## Visual verification

All three originals were inspected in the image-generation output, then the final 480 px WebPs were opened and inspected. They retain a matching warm ivory paper, deep teal/cobalt pigment, fine contours, and translucent washes, with no lettering, branding, or watermarks. All have a 4:3 aspect ratio.

1. **Find a quiet rhythm:** a fingertip covers the rear camera area, with a warm glow under the pad. The initial output left a rear lens visibly uncovered, so it was rejected and corrected using the built-in image editor. The final image shows the fingertip over the lens rather than the screen. This is a stylized capture-pose illustration, not a device-specific camera-layout guide.
2. **Let your pulse paint:** a rounded pulse trace flows from a phone screen into a small lake landscape, meeting a pointed paintbrush. It communicates the transformation without claiming to depict a real recording.
3. **Keep a piece of the moment:** a held art card and open sketchbook show a matching landscape with rounded pulse contours. This represents the save/share keepsake concept.

## Application assets

| Asset | Dimensions | Bytes | SHA-256 |
| --- | --- | ---: | --- |
| `app/assets/how-it-works/01-find-rhythm-480.webp` | 480 × 360 | 14400 | `3401140157367a91349b10017ac383c2647f6aca24ba24be1860e12bd0e27ea7` |
| `app/assets/how-it-works/01-find-rhythm-960.webp` | 960 × 720 | 46324 | `b64c8a2474d07809718691715c0ca910c6e5ff9347ec23dd7986cd42637f715b` |
| `app/assets/how-it-works/02-pulse-paints-480.webp` | 480 × 360 | 15372 | `9c95ce7b8af4096b9aa823dcc30be0ccfd78976bfc949dfa0cc7529d4b2b28d3` |
| `app/assets/how-it-works/02-pulse-paints-960.webp` | 960 × 720 | 54154 | `e1e4e086f5032d7ded37fa1c3388b16c9242a216056be4ba8d02fbe931764d99` |
| `app/assets/how-it-works/03-keepsake-480.webp` | 480 × 360 | 21212 | `a01f62e123c16f6bb7bbcd29c084d8bf604b4cae94251744e23bd5c92ac355a2` |
| `app/assets/how-it-works/03-keepsake-960.webp` | 960 × 720 | 75036 | `932b928ce00720bea94b8d732f13f9130a8199425e3415eaf29ab33edae4b036` |

All six WebPs total **226498 bytes**. The three 960 px variants total **175514 bytes**. Every individual file is below 100 KB.

## Original source provenance

### 01-find-rhythm

- Original generator path: `/Users/anton/.codex/generated_images/01a16a7b-4efa-75b3-8626-71f7f12a67e4/exec-180da9a5-6562-4bda-b1e2-8ef14343d90e.png`
- Preserved project copy: `.dream-loop/slow-phone/how-it-works-originals/01-find-rhythm.png`
- Dimensions: 1448 × 1086; PNG; 2134666 bytes.
- SHA-256 of both copies: `18be3557070d2deca9d036b504a106dba29492295830432623a7f9872250e511`.

### 02-pulse-paints

- Original generator path: `/Users/anton/.codex/generated_images/01a16a7b-4efa-75b3-8626-71f7f12a67e4/exec-4308a0d7-d7c0-45d7-a0a5-b8ae5886fe60.png`
- Preserved project copy: `.dream-loop/slow-phone/how-it-works-originals/02-pulse-paints.png`
- Dimensions: 1448 × 1086; PNG; 2426753 bytes.
- SHA-256 of both copies: `b9a6b9eb170a147617a134e1c59359eda649bc024299590f77071d9f25c4674d`.

### 03-keepsake

- Original generator path: `/Users/anton/.codex/generated_images/01a16a7b-4efa-75b3-8626-71f7f12a67e4/exec-b6466a39-5e93-4107-9948-34fbb1472942.png`
- Preserved project copy: `.dream-loop/slow-phone/how-it-works-originals/03-keepsake.png`
- Dimensions: 1448 × 1086; PNG; 2593482 bytes.
- SHA-256 of both copies: `46a5f32acbbad340332222111422f87f0182afeaede9340e64f73478ab517d2d`.

### Rejected first capture-pose generation

- Path: `/Users/anton/.codex/generated_images/01a16a7b-4efa-75b3-8626-71f7f12a67e4/exec-fdd05d27-e492-4750-b8a7-4d43cd8a1a4c.png`
- SHA-256: `f5b641a75fca37273ee21907ea6e03243f55a7a0dd88cf0e7cd1ace135a40ac2`
- Reason: a rear lens remained visible rather than being covered by the fingertip. This output is not an application asset.

## Exact generation prompts

### 01-find-rhythm

Create a refined watercolor editorial illustration for Pulse Painting's three-step how-it-works section. This is one image in a matching set: warm ivory handmade watercolor paper (#fdfbf7), restrained deep petrol teal, cobalt blue and moss green washes, fine crisp hand-drawn ink contour, realistic translucent pigment blooms, generous blank paper around a centered small composition. Tactile, artistic, serene, premium, immediately legible at 280 pixels wide. Landscape 4:3 composition. No writing, labels, numbers, letters, logos, watermark, border, or UI cards. Do not paint an ECG zigzag; when a pulse contour appears use rounded photoplethysmographic waves with a quick rounded upstroke and gradual descending shoulder. This is an instructional illustration, no clinical claims. Scene 1: A close three-quarter rear view of a modern dark teal smartphone resting in a person's relaxed hand. The person's index fingertip gently covers the REAR camera lens AND adjacent flash together at the phone's upper corner, showing clearly how fingertip-camera pulse capture works. The finger pad visibly rests on the rear lens area, NOT on the screen; a faint warm crimson light leaks from beneath the fingertip. Accurate natural human hand anatomy; one phone, one holding hand and the single touching fingertip. Cropped wrists are okay, no face. Phone and hand occupy the middle two-thirds, with a few pale blue watercolor pools underneath. Keep device recognizable yet sketched, not photorealistic.

### 02-pulse-paints

Create a refined watercolor editorial illustration for Pulse Painting's three-step how-it-works section. This is one image in a matching set: warm ivory handmade watercolor paper (#fdfbf7), restrained deep petrol teal, cobalt blue and moss green washes, fine crisp hand-drawn ink contour, realistic translucent pigment blooms, generous blank paper around a centered small composition. Tactile, artistic, serene, premium, immediately legible at 280 pixels wide. Landscape 4:3 composition. No writing, labels, numbers, letters, logos, watermark, border, or UI cards. Do not paint an ECG zigzag; when a pulse contour appears use rounded photoplethysmographic waves with a quick rounded upstroke and gradual descending shoulder. This is an instructional illustration, no clinical claims. Scene 2: A modern phone viewed from the front at a slight angle with an elegant thin cobalt PPG pulse wave visibly drawing across its otherwise blank ivory screen. The trace sweeps out from the screen onto the paper and becomes a small tranquil watercolor landscape: teal lake, layered soft blue mountains, delicate green shore. A tiny pointed artist's brush touches the latest crisp wave; soft pigment blooms sit behind the line. Show the transformation from measured rhythm into painting clearly with one continuous fine organic trace, without arrows or text. Lots of quiet blank paper, coherent small centered composition.

### 03-keepsake

Create a refined watercolor editorial illustration for Pulse Painting's three-step how-it-works section. This is one image in a matching set: warm ivory handmade watercolor paper (#fdfbf7), restrained deep petrol teal, cobalt blue and moss green washes, fine crisp hand-drawn ink contour, realistic translucent pigment blooms, generous blank paper around a centered small composition. Tactile, artistic, serene, premium, immediately legible at 280 pixels wide. Landscape 4:3 composition. No writing, labels, numbers, letters, logos, watermark, border, or UI cards. Do not paint an ECG zigzag; when a pulse contour appears use rounded photoplethysmographic waves with a quick rounded upstroke and gradual descending shoulder. This is an instructional illustration, no clinical claims. Scene 3: A finished watercolor landscape on a beautiful off-white loose art card, beside a slightly opened tactile paper sketchbook showing the same teal lake and cobalt mountain painting. The artwork itself has delicate recognizable rounded pulse contours threading along water and hills. A hand gently holds the lower edge of the card as a keepsake; the open book sits behind and to the side. Gentle overlapping paper edges, fine ink outlines, soft blue-green pigment pools and warm natural paper. No phone or sharing app logos, no headings or lettering, no additional objects. Elegant small centered still life.

### Targeted correction for 01-find-rhythm

Edit target: the rejected first capture-pose generation listed above.

Correct only the rear-camera fingertip placement in this watercolor instructional illustration. Keep the exact warm ivory paper, watercolor style, colors, hand, phone, background and composition. The illustration must show fingertip PPG capture correctly: move the index fingertip upward and left so the fleshy pad FULLY COVERS the large rear camera lens currently visible at the top left. Reconfigure the camera module as a simple single-camera phone with one tiny flash immediately adjacent to that lens, also completely covered by the same broad fingertip. The back of the phone is visible; no screen. The dark lens and bright white flash must no longer be visible because the fingertip sits over both. Leave only the outer rim of the small camera bump peeking around the finger, with a faint crimson glow leaking from under the finger pad as the cue. Natural relaxed anatomy. No new objects, text, arrows, labels, symbols or logos. This is a precise correction to the instructional pose, not a new design.
