#!/usr/bin/env python3
"""Draw the ABC pictures: pictures/letter-a.svg … letter-z.svg, a big capital and its small letter.

Usage: python3 tools/make_letters.py
Needs fonttools and brotli (pip install fonttools brotli). The letters are Fredoka, the app's font
(embedded in app/font.css), turned into paths so the pictures need no font.
"""
import base64, io, os, re
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.boundsPen import BoundsPen

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
COLORS = ["#e53935", "#fb8c00", "#f9a825", "#43a047", "#00897b", "#1e88e5", "#5e35b1", "#d81b60"]

def font():
    css = open(os.path.join(ROOT, "app", "font.css")).read()
    data = base64.b64decode(re.search(r"base64,([^)]+)\)", css).group(1))
    f = TTFont(io.BytesIO(data))
    return instantiateVariableFont(f, {"wght": 600})

def glyph(f, ch):
    gs = f.getGlyphSet()
    name = f.getBestCmap()[ord(ch)]
    pen, bounds = SVGPathPen(gs), BoundsPen(gs)
    gs[name].draw(pen); gs[name].draw(bounds)
    return pen.getCommands(), bounds.bounds  # font units, y up

def place(path, bounds, x, base, height, cap):
    """transform for a glyph whose capital height is `height` px, left at x, baseline at base"""
    s = height / cap
    return f'<path transform="translate({x - bounds[0] * s:.1f} {base:.1f}) scale({s:.4f} {-s:.4f})" d="{path}"/>', (bounds[2] - bounds[0]) * s

def main():
    f = font()
    cap = f["OS/2"].sCapHeight or 700
    for i, ch in enumerate("ABCDEFGHIJKLMNOPQRSTUVWXYZ"):
        color = COLORS[i % len(COLORS)]
        up, ub = glyph(f, ch)
        lo, lb = glyph(f, ch.lower())
        # capital and small letter side by side at the same size ("Aa"), as big as fits
        h = 80
        _, bw = place(up, ub, 0, 0, h, cap)
        _, sw = place(lo, lb, 0, 0, h, cap)
        gap = 5
        if bw + gap + sw > 118:
            h = h * (118 - gap) / (bw + sw)
            bw, sw = bw * h / 80, sw * h / 80
        x0 = (128 - (bw + gap + sw)) / 2
        base = 64 + h * 0.5
        big, _ = place(up, ub, x0, base, h, cap)
        small, _ = place(lo, lb, x0 + bw + gap, base, h, cap)
        svg = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">\n'
               f'  <g fill="{color}">{big}</g>\n'
               f'  <g fill="{color}" opacity=".6">{small}</g>\n</svg>\n')
        open(os.path.join(ROOT, "pictures", f"letter-{ch.lower()}.svg"), "w").write(svg)
    print("26 letters")

if __name__ == "__main__":
    main()
