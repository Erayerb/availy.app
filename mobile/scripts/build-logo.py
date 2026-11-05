#!/usr/bin/env python3
"""The app icon, splash and favicon from the Availo mark (same shape as components/Logo.tsx): pip install pillow."""
import math
from pathlib import Path

from PIL import Image, ImageDraw

ASSETS = Path(__file__).resolve().parent.parent / "assets"
DARK = (23, 17, 14, 255)  # theme background at night
CREAM = (251, 244, 232, 255)
RED = (224, 38, 63, 255)
STROKE = 14
DOT = (50, 60, 8)


def path():
    """M18 78 L35.19 35.95 A16 16 0 0 1 64.81 35.95 L82 78 (components/Logo.tsx), as points."""
    tx, ty = 35.19, 35.95
    points = [(18 + (tx - 18) * i / 200, 78 + (ty - 78) * i / 200) for i in range(201)]
    start = math.atan2(ty - 42, tx - 50)
    end = math.atan2(ty - 42, 100 - tx - 50)
    for i in range(401):
        angle = start + (end - start + (2 * math.pi if end < start else 0)) * i / 400
        points.append((50 + 16 * math.cos(angle), 42 + 16 * math.sin(angle)))
    points += [(100 - tx + (82 - 100 + tx) * i / 200, ty + (78 - ty) * i / 200) for i in range(201)]
    return points


def mark(size, share, arch, dot, background=None):
    """The mark taking `share` of a square image."""
    big = size * 4
    image = Image.new("RGBA", (big, big), background or (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    scale = big * share / 100
    # The mark's own box is y 19..85: centered on it, not on the 100 x 100 box
    dx = (big - 100 * scale) / 2
    dy = (big - 100 * scale) / 2 - (52 - 50) * scale
    r = STROKE / 2 * scale
    for x, y in path():
        cx, cy = dx + x * scale, dy + y * scale
        draw.ellipse((cx - r, cy - r, cx + r, cy + r), fill=arch)
    cx, cy, rd = dx + DOT[0] * scale, dy + DOT[1] * scale, DOT[2] * scale
    draw.ellipse((cx - rd, cy - rd, cx + rd, cy + rd), fill=dot)
    return image.resize((size, size), Image.LANCZOS)


mark(1024, 0.80, CREAM, RED, DARK).convert("RGB").save(ASSETS / "icon.png")
mark(1024, 0.80, CREAM, RED).save(ASSETS / "splash-icon.png")
mark(1024, 0.56, CREAM, RED).save(ASSETS / "android-icon-foreground.png")
Image.new("RGB", (1024, 1024), DARK[:3]).save(ASSETS / "android-icon-background.png")
white = (255, 255, 255, 255)
mark(1024, 0.56, white, white).save(ASSETS / "android-icon-monochrome.png")
mark(64, 0.9, CREAM, RED, DARK).convert("RGB").save(ASSETS / "favicon.png")
