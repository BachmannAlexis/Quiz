#!/usr/bin/env python3
"""Draw the ABC pictures (pictures/letter-a.svg … letter-z.svg, a big capital and its small letter)
the numbers (pictures/number-1.svg … number-19.svg, the digits above as many dots and sticks of ten to count,
and the tens up to 100),
the colours (pictures/color-*.svg, a paint splash) and the shapes (pictures/shape-*.svg).

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
    for n in range(1, 11):
        color = COLORS[(n - 1) % len(COLORS)]
        digits = [glyph(f, ch) for ch in str(n)]
        h = 64
        widths = [place(p, b, 0, 0, h, cap)[1] for p, b in digits]
        gap = 3
        x = (128 - sum(widths) - gap * (len(digits) - 1)) / 2
        parts = []
        for (p, b), w in zip(digits, widths):
            parts.append(place(p, b, x, 70, h, cap)[0]); x += w + gap
        # dots: one row up to 5, two rows of 5 for 6-10
        rows = [n] if n <= 5 else [5, n - 5]
        dots = []
        for r, count in enumerate(rows):
            y = 90 + r * 21 if len(rows) == 2 else 100
            for k in range(count):
                cx = 64 + (k - (count - 1) / 2) * 22
                dots.append(f'<circle cx="{cx}" cy="{y}" r="9"/>')
        svg = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">\n'
               f'  <g fill="{color}">{"".join(parts)}</g>\n'
               f'  <g fill="{color}" opacity=".7">{"".join(dots)}</g>\n</svg>\n')
        open(os.path.join(ROOT, "pictures", f"number-{n}.svg"), "w").write(svg)
    print("10 numbers")
    for tens in range(2, 11):  # the tens: digits above as many sticks of ten
        n = tens * 10
        color = COLORS[(tens - 1) % len(COLORS)]
        digits = [glyph(f, ch) for ch in str(n)]
        h = 46
        widths = [place(p, b, 0, 0, h, cap)[1] for p, b in digits]
        x = (128 - sum(widths) - 3 * (len(digits) - 1)) / 2
        parts = []
        for (p, b), w in zip(digits, widths):
            parts.append(place(p, b, x, 52, h, cap)[0]); x += w + 3
        gap = 3.5
        rw = min(14, (112 - (tens - 1) * gap) / tens)
        left = 64 - (tens * rw + (tens - 1) * gap) / 2
        rods = []
        for r in range(tens):
            rx = left + r * (rw + gap)
            rods.append(f'<rect x="{rx:.1f}" y="62" width="{rw:.1f}" height="58" rx="2"/>')
            for k in range(1, 10):  # the ten units of each stick
                rods.append(f'<line x1="{rx:.1f}" x2="{rx + rw:.1f}" y1="{62 + k * 5.8:.1f}" y2="{62 + k * 5.8:.1f}"/>')
        svg = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">\n'
               f'  <g fill="{color}">{"".join(parts)}</g>\n'
               f'  <g fill="{color}" opacity=".75" stroke="#fff" stroke-width="1.2">{"".join(rods)}</g>\n</svg>\n')
        open(os.path.join(ROOT, "pictures", f"number-{n}.svg"), "w").write(svg)
    print("9 tens")
    for n in range(11, 20):  # 11-19: one stick of ten and the units as dots
        color = COLORS[(n - 1) % len(COLORS)]
        digits = [glyph(f, ch) for ch in str(n)]
        h = 46
        widths = [place(p, b, 0, 0, h, cap)[1] for p, b in digits]
        x = (128 - sum(widths) - 3) / 2
        parts = []
        for (p, b), w in zip(digits, widths):
            parts.append(place(p, b, x, 52, h, cap)[0]); x += w + 3
        rod = [f'<rect x="20" y="62" width="14" height="58" rx="2"/>'] + [
            f'<line x1="20" x2="34" y1="{62 + k * 5.8:.1f}" y2="{62 + k * 5.8:.1f}"/>' for k in range(1, 10)]
        units = n - 10
        # rows of three: two roomy rows up to 6, three tighter rows for 7-9
        top, step, r = (78, 26, 9) if units <= 6 else (72, 20, 8)
        dots = [f'<circle cx="{56 + (k % 3) * 22}" cy="{top + (k // 3) * step}" r="{r}"/>' for k in range(units)]
        svg = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">\n'
               f'  <g fill="{color}">{"".join(parts)}</g>\n'
               f'  <g fill="{color}" opacity=".75" stroke="#fff" stroke-width="1.2">{"".join(rod)}</g>\n'
               f'  <g fill="{color}" opacity=".75">{"".join(dots)}</g>\n</svg>\n')
        open(os.path.join(ROOT, "pictures", f"number-{n}.svg"), "w").write(svg)
    print("11 to 19")
    colors()
    shapes()

COLOR_SWATCHES = {"red": "#e53935", "blue": "#1e88e5", "yellow": "#fdd835", "green": "#43a047", "orange": "#fb8c00",
                  "purple": "#8e24aa", "pink": "#f06292", "brown": "#8d6e63", "black": "#263238", "white": "#ffffff",
                  "grey": "#9e9e9e", "turquoise": "#1ccfc4", "light-blue": "#81d4fa", "navy": "#1a237e",
                  "light-green": "#9ccc65", "dark-green": "#1b5e20", "gold": "url(#gold)", "silver": "url(#silver)",
                  "beige": "#e8d5b0", "burgundy": "#7b1e3a", "mauve": "#c39bd3", "khaki": "#8f8a4c", "coral": "#ff7f6b"}
METAL = {"gold": ("#fff3b0", "#f5c518", "#b8860b"), "silver": ("#ffffff", "#c8ccd0", "#7d858c")}

def colors():
    """A round paint splash with drops, in the colour (white gets an outline to show on the white card)."""
    import math, random
    for name, fill in COLOR_SWATCHES.items():
        rnd = random.Random(name)
        pts = []
        for k in range(12):  # a soft, wobbly blob: a smooth curve through uneven points
            a = k / 12 * 2 * math.pi
            r = 46 + rnd.uniform(-5, 5)
            pts.append((64 + r * math.cos(a), 62 + r * math.sin(a)))
        mid = [((x1 + x2) / 2, (y1 + y2) / 2) for (x1, y1), (x2, y2) in zip(pts, pts[1:] + pts[:1])]
        d = f"M{mid[-1][0]:.1f},{mid[-1][1]:.1f}" + "".join(
            f" Q{x:.1f},{y:.1f} {mx:.1f},{my:.1f}" for (x, y), (mx, my) in zip(pts, mid)) + "Z"
        drops = "".join(f'<circle cx="{x}" cy="{y}" r="{r}"/>' for x, y, r in [(18, 108, 6), (110, 20, 5), (114, 104, 7), (16, 26, 4)])
        stroke = ' stroke="#b0bec5" stroke-width="2.5"' if name == "white" else ""
        shine = "#ffffff" if name != "white" else "#eceff1"
        defs = ""
        if name in METAL:  # shiny metal: a gradient
            a, b, c = METAL[name]
            defs = (f'  <defs><linearGradient id="{name}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{a}"/>'
                    f'<stop offset=".45" stop-color="{b}"/><stop offset="1" stop-color="{c}"/></linearGradient></defs>\n')
        svg = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">\n' + defs +
               f'  <g fill="{fill}"{stroke} stroke-linejoin="round"><path d="{d}"/>{drops}</g>\n'
               f'  <ellipse cx="48" cy="44" rx="12" ry="7" fill="{shine}" opacity=".35" transform="rotate(-30 48 44)"/>\n</svg>\n')
        open(os.path.join(ROOT, "pictures", f"color-{name}.svg"), "w").write(svg)
    print(len(COLOR_SWATCHES), "colours")

def shapes():
    import math
    def poly(n, r, rot=-90, cx=64, cy=64):
        return " ".join(f"{cx + r * math.cos(math.radians(rot + 360 * k / n)):.1f},{cy + r * math.sin(math.radians(rot + 360 * k / n)):.1f}" for k in range(n))
    star = " ".join(f"{64 + (50 if k % 2 == 0 else 21) * math.cos(math.radians(-90 + 36 * k)):.1f},{66 + (50 if k % 2 == 0 else 21) * math.sin(math.radians(-90 + 36 * k)):.1f}" for k in range(10))
    SHAPES = {
        "circle": ('<circle cx="64" cy="64" r="50"/>', "#e53935"),
        "square": ('<rect x="18" y="18" width="92" height="92" rx="6"/>', "#1e88e5"),
        "triangle": (f'<polygon points="{poly(3, 56, -90, 64, 72)}"/>', "#43a047"),
        "rectangle": ('<rect x="8" y="34" width="112" height="60" rx="6"/>', "#fb8c00"),
        "star": (f'<polygon points="{star}"/>', "#fdd835"),
        "heart": ('<path d="M64 112 C 20 82 6 58 18 36 C 30 14 56 18 64 38 C 72 18 98 14 110 36 C 122 58 108 82 64 112 Z"/>', "#ec407a"),
        "oval": ('<ellipse cx="64" cy="64" rx="56" ry="36"/>', "#8e24aa"),
        "diamond": ('<polygon points="64,8 112,64 64,120 16,64"/>', "#00897b"),
        "hexagon": (f'<polygon points="{poly(6, 54, 0)}"/>', "#5c6bc0"),
        "crescent": ('<path d="M84 14 A 52 52 0 1 0 84 114 A 42 42 0 1 1 84 14 Z"/>', "#ffb300"),
    }
    for name, (shape, fill) in SHAPES.items():
        svg = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">\n'
               f'  <g fill="{fill}" stroke="#00000022" stroke-width="3" stroke-linejoin="round">{shape}</g>\n</svg>\n')
        open(os.path.join(ROOT, "pictures", f"shape-{name}.svg"), "w").write(svg)
    print(len(SHAPES), "shapes")

if __name__ == "__main__":
    main()
