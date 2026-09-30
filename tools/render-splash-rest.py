#!/usr/bin/env python3
"""Draw assets/images/splash-rest.png: the native splash for the animated launch.

The splash gauge at rest — needle at 0 (150°), arc empty on its track, red end
segment unlit, LCD 000 — which is exactly the first frame of
components/LaunchOverlay.tsx, so the handover from the native splash to the
overlay has nothing to jump. Every number is the one in that component's header
(measured from assets/images/splash-icon.png). Transparent background: the
splash's #121212 comes from app.json.

    python3 tools/render-splash-rest.py      # needs Pillow
"""
import math
from pathlib import Path

from PIL import Image, ImageDraw

SS = 4  # supersampling
BOX = 1024
CX, CY = 511.5, 495.5
ARC_R, ARC_W = 320, 64
START, SWEEP = 150, 240
RED_START_DEG = 350.2
NEEDLE = [(268, 0), (0, 23.5), (-70, 0), (0, -23.5)]
NEEDLE_DEG = START  # at rest
HUB_RING_R, HUB_R = 57, 38
TRACK, RED_UNLIT = (0x2A, 0x2A, 0x2A, 255), (0x58, 0x21, 0x1F, 255)
AMBER, NEEDLE_C, HUB, LCD = (0xFF, 0xB3, 0x00, 255), (0xFF, 0x5F, 0x00, 255), (0x0E, 0x0E, 0x0E, 255), (0xED, 0xED, 0xED, 255)
SEGMENTS = {
    'a': [(4, 1), (18, 1), (15.5, 3.5), (6.5, 3.5)],
    'b': [(19, 2), (19, 17), (16.5, 15.5), (16.5, 4.5)],
    'c': [(19, 19), (19, 34), (16.5, 31.5), (16.5, 20.5)],
    'd': [(4, 35), (18, 35), (15.5, 32.5), (6.5, 32.5)],
    'e': [(3, 19), (3, 34), (5.5, 31.5), (5.5, 20.5)],
    'f': [(3, 2), (3, 17), (5.5, 15.5), (5.5, 4.5)],
}
LCD_SCALE = 86 / 34
LCD_X0, LCD_Y0, LCD_PITCH = 430 - 3 * LCD_SCALE, 662 - LCD_SCALE, 62.5


def s(v):
    return v * SS


def arc(draw, a0, a1, color, cap_start=True, cap_end=True):
    r_out, r_in = ARC_R + ARC_W / 2, ARC_R - ARC_W / 2
    # Annular sector as a polygon (fine steps), plus round caps.
    steps = max(8, int(abs(a1 - a0) * 8))
    pts = []
    for i in range(steps + 1):
        a = math.radians(a0 + (a1 - a0) * i / steps)
        pts.append((s(CX + r_out * math.cos(a)), s(CY + r_out * math.sin(a))))
    for i in range(steps, -1, -1):
        a = math.radians(a0 + (a1 - a0) * i / steps)
        pts.append((s(CX + r_in * math.cos(a)), s(CY + r_in * math.sin(a))))
    draw.polygon(pts, fill=color)
    for a, cap in ((a0, cap_start), (a1, cap_end)):
        if not cap:
            continue
        a = math.radians(a)
        x, y = CX + ARC_R * math.cos(a), CY + ARC_R * math.sin(a)
        r = ARC_W / 2
        draw.ellipse([s(x - r), s(y - r), s(x + r), s(y + r)], fill=color)


def main():
    img = Image.new('RGBA', (BOX * SS, BOX * SS), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    arc(d, START, START + SWEEP, TRACK)
    arc(d, RED_START_DEG, START + SWEEP, RED_UNLIT, cap_start=False)
    for pos in range(3):
        for seg, pts in SEGMENTS.items():  # '0': every segment but g
            color = NEEDLE_C if pos == 2 else LCD
            d.polygon([(s(LCD_X0 + pos * LCD_PITCH + x * LCD_SCALE), s(LCD_Y0 + y * LCD_SCALE)) for x, y in pts], fill=color)
    a = math.radians(NEEDLE_DEG)
    ca, sa = math.cos(a), math.sin(a)
    d.polygon([(s(CX + x * ca - y * sa), s(CY + x * sa + y * ca)) for x, y in NEEDLE], fill=NEEDLE_C)
    for r, color in ((HUB_RING_R, AMBER), (HUB_R, HUB)):
        d.ellipse([s(CX - r), s(CY - r), s(CX + r), s(CY + r)], fill=color)
    out = Path(__file__).resolve().parent.parent / 'assets/images/splash-rest.png'
    img.resize((BOX, BOX), Image.LANCZOS).save(out, optimize=True)
    print(out)


if __name__ == '__main__':
    main()
