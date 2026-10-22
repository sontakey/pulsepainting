"""Render the fixed phone handoff QR as a static, subtly inked SVG.

No encoder or SVG filter is shipped to the browser. This is the original
version-4 / error-correction-Q matrix generated with qrcode 8.2, for the URL
below. Keep the fixed pattern rather than making QR generation a runtime job.
"""
from pathlib import Path
import random

URL = "https://chatppg.com/pulse-painting"
MATRIX = """111111101010010111011011001111111
100000100111111101000010101000001
101110100001011101100000101011101
101110100011100110001110001011101
101110101001100110100100101011101
100000101010001010001100001000001
111111101010101010101010101111111
000000000011100100000100100000000
011111110101101111001010000110001
100011011111000100111101001101101
101101100000100010101100110010100
101011000011100110011110000011110
101101101010101000110100110011010
101000011100110100001110001001011
100100101110001001010011111111110
101011001001001001011111011011100
110101101100101011010001010111001
111000000101010011010001001101101
111010111000111010101010001110110
001110011001001010101000110111111
010101111000001000111110110111000
110101000000011111100000101000101
100111100001111011001010000000110
101110010000110000100101011111101
100001111010001010000010111110000
000000001111100001111100100010111
111111101101110101101101101010110
100000101110100110111111100011100
101110101001011011110100111111011
101110101111000101001110110010101
101110101010110010110000001101100
100000101000010100011110011011100
111111100010100110110011101100010""".splitlines()
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
