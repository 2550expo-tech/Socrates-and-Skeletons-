"""MindPay app icon: a minimal gold money tree on forest green (matches the in-app MoneyTree)."""
import math
from PIL import Image, ImageDraw

FOREST = (14, 59, 44, 255)
GOLD = (226, 182, 74, 255)
CREAM = (244, 241, 230, 255)
S = 4096  # draw large, then downsample for smooth edges

def leaf(d, cx, cy, length, width, angle, color):
    pts = []
    for i in range(64):
        t = i / 63 * math.pi * 2
        x = math.cos(t) * length / 2
        y = math.sin(t) * width / 2 * (1 - 0.35 * math.cos(t))  # slightly pointed tip
        a = math.radians(angle)
        pts.append((cx + x * math.cos(a) - y * math.sin(a), cy + x * math.sin(a) + y * math.cos(a)))
    d.polygon(pts, fill=color)

def curve(d, p0, p1, p2, width, color, steps=600):
    """Thick quadratic curve drawn by stamping discs: smooth edges, no seams."""
    r = width / 2
    for i in range(steps + 1):
        t = i / steps
        x = (1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0]
        y = (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1]
        d.ellipse((x - r, y - r, x + r, y + r), fill=color)

def mark(size, scale, color_trunk, color_leaf, bg=None):
    im = Image.new('RGBA', (S, S), bg or (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    c = S / 2
    k = S * scale / 1000  # 1000-unit design grid centred on the canvas
    P = lambda x, y: (c + x * k, c + y * k)
    # trunk and two branches
    curve(d, P(0, 360), P(-10, 80), P(0, -250), 48 * k, color_trunk)
    curve(d, P(-4, 120), P(-140, 30), P(-210, -120), 34 * k, color_trunk)
    curve(d, P(4, 40), P(150, -40), P(220, -190), 34 * k, color_trunk)
    # ground line
    curve(d, P(-190, 372), P(0, 340), P(190, 372), 26 * k, color_trunk)
    # leaves
    for (x, y, ang, L) in [(0, -330, -90, 190), (-250, -190, -120, 170), (270, -260, -60, 170),
                           (-110, -250, -135, 140), (120, -330, -45, 140)]:
        cx, cy = P(x, y)
        leaf(d, cx, cy, L * k, L * 0.52 * k, ang, color_leaf)
    return im.resize((size, size), Image.LANCZOS)

import os
out = os.path.join(os.path.dirname(__file__), '..', 'assets') + '/'
# iOS / general icon: square, no transparency
icon = mark(1024, 0.74, CREAM, GOLD, bg=FOREST)
icon.convert('RGB').save(out + 'icon.png')
# Android adaptive icon: mark inside the safe zone on transparent + solid background
mark(512, 0.52, CREAM, GOLD).save(out + 'android-icon-foreground.png')
Image.new('RGBA', (512, 512), FOREST).save(out + 'android-icon-background.png')
mono = mark(432, 0.52, (255, 255, 255, 255), (255, 255, 255, 255))
mono.save(out + 'android-icon-monochrome.png')
# splash (shown on forest background from app.json) and web favicon
mark(1024, 0.8, CREAM, GOLD).save(out + 'splash-icon.png')
mark(48, 0.7, CREAM, GOLD, bg=FOREST).save(out + 'favicon.png')
# web app on a phone home screen (iPhone "Add to Home Screen", Android "Install app")
os.makedirs(out + 'web', exist_ok=True)
for name, size in [('apple-touch-icon.png', 180), ('icon-192.png', 192), ('icon-512.png', 512)]:
    mark(size, 0.74, CREAM, GOLD, bg=FOREST).convert('RGB').save(out + 'web/' + name)
print('done')
