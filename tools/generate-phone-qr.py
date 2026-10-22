"""Render the fixed phone handoff QR as a static, subtly inked SVG.

No encoder or SVG filter is shipped to the browser. This is the saved
version-4 / error-correction-Q matrix generated with qrcode 8.2, for the URL
below. Keep the fixed pattern rather than making QR generation a runtime job.
"""
from pathlib import Path
import random

URL = "https://www.pulsepainting.com/"
MATRIX = """111111100111100011000111001111111
100000100001011011011110101000001
101110101101011100011011001011101
101110100110100111111101101011101
101110101111101100111000101011101
100000101110101110010010001000001
111111101010101010101010101111111
000000000001111111000101000000000
010010101100011111011110010110100
000101011101000010100001010001110
011110111001001011001111011001000
111010000101000101100100101000011
111100111110001110101001100001001
111011000110100000010110011001000
101001110110110010110100011001110
111001000011001110011110111000000
110110110111011010101111101010010
111011010011110101100111100001110
010001101100011010001001100101010
000000011011111110100010110100001
000101100101111010010010011011000
100001000000010011011000101000110
001110111110100001101011110010110
001000011010100111100101011000001
111001100011000110011110111110000
000000001100100101100001100010110
111111100111011010000110101011010
100000100110100100000100100010010
101110101001100101011000111111010
101110100101011101010011001111001
101110100100000011010100011110100
100000101010110010011101011000000
111111100001010111100111010000001""".splitlines()
SIZE = len(MATRIX)
DARK = {(x, y) for y, row in enumerate(MATRIX) for x, v in enumerate(row) if v == "1"}


def functional(x, y):
    # Finder, separator, timing, format, dark module and alignment patterns.
    return ((x <= 8 and y <= 8) or (x >= SIZE - 9 and y <= 8)
            or (x <= 8 and y >= SIZE - 9) or x == 6 or y == 6
            or (SIZE - 9 <= x <= SIZE - 5 and SIZE - 9 <= y <= SIZE - 5))


def module_path(x, y):
    # Only exposed outside corners soften. Adjoining modules remain joined;
    # no shrinking, pale gaps, distortion or filter touches the QR geometry.
    corners = [((-1, 0), (0, -1)), ((1, 0), (0, -1)),
               ((1, 0), (0, 1)), ((-1, 0), (0, 1))]
    tl, tr, br, bl = [0.12 if all((x + dx, y + dy) not in DARK for dx, dy in pair) else 0
                      for pair in corners]
    x, y = x + 4, y + 4
    if not any((tl, tr, br, bl)):
        return f"M{x} {y}h1v1h-1z"
    return (f"M{x+tl:g} {y}H{x+1-tr:g}Q{x+1} {y} {x+1} {y+tr:g}"
            f"V{y+1-br:g}Q{x+1} {y+1} {x+1-br:g} {y+1}"
            f"H{x+bl:g}Q{x} {y+1} {x} {y+1-bl:g}"
            f"V{y+tl:g}Q{x} {y} {x+tl:g} {y}Z")


def render():
    fixed, painted = [], []
    for x, y in sorted(DARK, key=lambda p: (p[1], p[0])):
        if functional(x, y):
            fixed.append(f"M{x+4} {y+4}h1v1h-1z")
        else:
            painted.append(module_path(x, y))
    ink = "".join(painted)
    rng = random.Random(21)
    # Frozen overprints suggest paper granulation. The underlying pigment is
    # always solid and dark; these overlays never remove any encoded mark.
    grain = "".join(f'<circle cx="{rng.uniform(4, SIZE + 4):.2f}" cy="{rng.uniform(4, SIZE + 4):.2f}" '
                    f'r="{rng.uniform(.035,.11):.3f}"/>' for _ in range(180))
    bristles = "".join(f'<path d="M4 {y:.2f}q{SIZE / 2} -.18 {SIZE} .03"/>'
                       for y in [4.37 + i * .63 for i in range(round(SIZE / .63))])
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {SIZE + 8} {SIZE + 8}">
<title>{URL}</title>
<desc>Indigo ink QR code. The four-module paper border and all scan markers are preserved.</desc>
<defs>
  <linearGradient id="ink" x1="0" y1="0" x2="1" y2=".85">
    <stop stop-color="#173669"/><stop offset=".5" stop-color="#343362"/><stop offset="1" stop-color="#174a52"/>
  </linearGradient>
  <path id="ink-shape" d="{ink}"/>
  <clipPath id="pigment"><use href="#ink-shape"/></clipPath>
</defs>
<path fill="#fffdf8" d="M0 0h{SIZE + 8}v{SIZE + 8}H0z"/>
<use href="#ink-shape" fill="url(#ink)"/>
<g clip-path="url(#pigment)">
  <g fill="#8297ab" opacity=".16">{grain}</g>
  <g fill="none" stroke="#0f244b" stroke-width=".045" opacity=".2">{bristles}</g>
</g>
<path fill="#182e56" d="{"".join(fixed)}"/>
</svg>
'''


if __name__ == "__main__":
    target = Path(__file__).resolve().parents[1] / "app/assets/phone-qr.svg"
    target.write_text(render())
    print(f"Wrote {target} ({target.stat().st_size} bytes)")
