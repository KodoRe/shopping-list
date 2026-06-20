#!/usr/bin/env python3
"""Generate Home Kitchen PWA app icons with Pillow (no external rasterizer).

Design: terracotta brand square (the app's --accent #c4622d) with a clean white
shopping-basket mark. Three outputs:
  - icon-192.png            (any-purpose, full-bleed art)
  - icon-512.png            (any-purpose, full-bleed art)
  - icon-maskable-512.png   (maskable: art kept inside a 60% safe circle so
                             Android's adaptive-icon mask can crop to any shape)

Run:  python3 scripts/make_icons.py
Deterministic; overwrites icons/*.png.
"""
import os
from PIL import Image, ImageDraw

BRAND = (196, 98, 45)        # #c4622d terracotta (app --accent)
BRAND_DARK = (168, 81, 31)   # #a8511f accent-hover, for subtle depth
WHITE = (255, 255, 255)
ICON_DIR = os.path.join(os.path.dirname(__file__), "..", "icons")


def _rounded_square(size, radius_frac=0.22, bg=BRAND):
    """Full-bleed rounded-square canvas (used for the 'any' purpose icons)."""
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    r = int(size * radius_frac)
    d.rounded_rectangle([0, 0, size - 1, size - 1], radius=r, fill=bg)
    return img


def _solid_square(size, bg=BRAND):
    """Full-bleed square (maskable: the mask supplies the shape, art must bleed)."""
    img = Image.new("RGBA", (size, size), bg + (255,))
    return img


def _draw_basket(img, cx, cy, scale):
    """Draw a clean white shopping-basket mark centered at (cx, cy).

    `scale` is the basket's half-width in px. Pure geometry so it stays crisp
    at any resolution.
    """
    d = ImageDraw.Draw(img)
    w = scale                      # half-width of the basket body
    stroke = max(2, int(scale * 0.12))

    # --- handle (an arc above the basket rim) ---
    handle_w = int(w * 0.95)
    handle_top = cy - int(w * 1.18)
    handle_box = [cx - handle_w, handle_top, cx + handle_w, handle_top + int(w * 1.3)]
    d.arc(handle_box, start=200, end=340, fill=WHITE, width=stroke)

    # --- basket body: a trapezoid (wider at the rim, narrower at the base) ---
    rim_y = cy - int(w * 0.30)
    base_y = cy + int(w * 0.78)
    rim_half = w
    base_half = int(w * 0.66)
    body = [
        (cx - rim_half, rim_y),
        (cx + rim_half, rim_y),
        (cx + base_half, base_y),
        (cx - base_half, base_y),
    ]
    d.polygon(body, fill=WHITE)

    # --- rim cap (rounded bar across the top for a finished look) ---
    cap_h = max(3, int(scale * 0.20))
    d.rounded_rectangle(
        [cx - rim_half - stroke // 2, rim_y - cap_h,
         cx + rim_half + stroke // 2, rim_y + cap_h // 2],
        radius=cap_h, fill=WHITE,
    )

    # --- slats (cut-outs in brand color to read as a basket weave) ---
    for frac in (-0.5, 0.0, 0.5):
        sx = cx + int(frac * w * 0.95)
        # slats follow the taper slightly
        top = (sx, rim_y + cap_h)
        bot = (cx + int(frac * base_half * 0.95), base_y - stroke)
        d.line([top, bot], fill=BRAND, width=max(2, int(scale * 0.10)))


def make(size, maskable=False):
    if maskable:
        img = _solid_square(size)
        # maskable safe zone: keep art within the central ~60% circle
        basket_scale = int(size * 0.20)
    else:
        img = _rounded_square(size)
        basket_scale = int(size * 0.28)
    _draw_basket(img, size // 2, int(size * 0.52), basket_scale)
    return img


def main():
    os.makedirs(ICON_DIR, exist_ok=True)
    outputs = [
        ("icon-192.png", make(192, maskable=False)),
        ("icon-512.png", make(512, maskable=False)),
        ("icon-maskable-512.png", make(512, maskable=True)),
    ]
    for name, img in outputs:
        path = os.path.join(ICON_DIR, name)
        img.save(path, "PNG", optimize=True)
        print(f"wrote {os.path.relpath(path)}  ({img.size[0]}x{img.size[1]})")


if __name__ == "__main__":
    main()
