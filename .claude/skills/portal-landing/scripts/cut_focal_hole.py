#!/usr/bin/env python3
"""Content-aware focal cut — VALIDATED combined pipeline (the one to reuse).

The winning recipe is the COMBINATION of two techniques:
  coarse geometric cut  ∪  organic flood-fill  −  protected structures
The ellipse guarantees the whole interior goes (sky, valley, river, haze);
the flood-fill guarantees the edge is organic; the protection guarantees that
structures crossing the boundary (trunk, arch, mossy lip — or a wheel, a hand)
survive inside the zone.

Key discriminators, learned the hard way:
- Protection must be TEXTURE-GATED: a trunk is rough (high local stddev), the
  haze of distant content is smooth. Color predicates alone keep mountains.
- Protection only applies to components CONNECTED to the exterior of the guard;
  enclosed fragments would float and ghost over the moving backdrop.
- Never blanket-dilate (eats structures). Opening kills leaks instead.
- Backdrop margin: interior pasted at ~112% (just enough for parallax travel),
  with a FEATHERED elliptical paste mask — a hard paste edge shows as a line in
  smooth content (clouds) the moment the landing zoom reveals it.

Usage:
  python3 cut_focal_hole.py master.png outdir CX CY RX RY [version]
Then LOOK at inspect-*.png and composite-parallax.png before shipping.
"""
import sys
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage
from collections import deque

SRC, OUT = sys.argv[1], sys.argv[2]
CX, CY, RX, RY = map(int, sys.argv[3:7])
V = sys.argv[7] if len(sys.argv) > 7 else "v1"
GUARD = 1.30

im = Image.open(SRC).convert("RGB")
W, H = im.size
px = np.asarray(im).astype(np.float32)
r, g, b = px[..., 0], px[..., 1], px[..., 2]
L = 0.299 * r + 0.587 * g + 0.114 * b

# --- Local texture (7x7 stddev): rough structure vs smooth haze ---
mean = ndimage.uniform_filter(L, 7)
std = np.sqrt(np.clip(ndimage.uniform_filter(L * L, 7) - mean * mean, 0, None))

# --- Material classification (ADAPT predicates per scene after sampling) ---
rim = (L < 58) & (g >= r - 12)                                   # dark boundary
bark = (r > g + 8) & (r > b + 8) & (L < 150) & (std > 9)         # rough trunks
moss = (g > b + 25) & (L >= 58) & (L < 130) & (g >= r) & (std > 9)
protected = rim | bark | moss

yy, xx = np.mgrid[0:H, 0:W]
guard = ((xx - CX) / (RX * GUARD)) ** 2 + ((yy - CY) / (RY * GUARD)) ** 2 <= 1.0

# --- Organic flood-fill ---
visit = ~protected & guard
flood = np.zeros((H, W), dtype=bool)
q = deque()
for dy in range(-RY // 2, RY // 2 + 1, 40):
    for dx in range(-RX // 2, RX // 2 + 1, 40):
        x, y = CX + dx, CY + dy
        if 0 <= x < W and 0 <= y < H and visit[y, x]:
            flood[y, x] = True
            q.append((x, y))
while q:
    x, y = q.popleft()
    for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
        if 0 <= nx < W and 0 <= ny < H and not flood[ny, nx] and visit[ny, nx]:
            flood[ny, nx] = True
            q.append((nx, ny))

# --- Coarse ellipse (the interior MUST go) ∪ flood, − rim-connected protected ---
ellipse = ((xx - CX) / (RX * 1.05)) ** 2 + ((yy - CY) / (RY * 1.02)) ** 2 <= 1.0
hole = flood | ellipse
labp, _ = ndimage.label(protected)
keep_ids = set(np.unique(labp[~guard])) - {0}
hole &= ~np.isin(labp, list(keep_ids))

# --- Cleanup: opening, largest component, absorb enclosed islands, closing ---
hole = ndimage.binary_opening(hole, iterations=2)
lab, n = ndimage.label(hole)
if n > 1:
    sizes = ndimage.sum(hole, lab, range(1, n + 1))
    hole = lab == (np.argmax(sizes) + 1)
lab2, n2 = ndimage.label(~hole)
border = set(np.unique(np.concatenate([lab2[0], lab2[-1], lab2[:, 0], lab2[:, -1]])))
for i in range(1, n2 + 1):
    if i not in border:
        hole |= (lab2 == i)
hole = ndimage.binary_closing(hole, iterations=2)

# Defringe LAST: 2px bite eats the bright fringe clinging to organic edges.
# Safe ONLY here, on the protected cleaned mask (dilating an unprotected mask
# is what ate structures in early iterations). +1px at a time if needed.
hole = ndimage.binary_dilation(hole, iterations=2)

# --- Feather + versioned outputs ---
soft = np.asarray(Image.fromarray((hole * 255).astype(np.uint8))
                  .filter(ImageFilter.GaussianBlur(2.5))).astype(np.float32)
rgba = np.dstack([np.asarray(im).astype(np.uint8),
                  (255 - soft).clip(0, 255).astype(np.uint8)])
full = Image.fromarray(rgba, "RGBA")
full.save(f"{OUT}/full-scene-{V}.png")
left = rgba.copy(); left[:, CX:, 3] = 0
right = rgba.copy(); right[:, :CX, 3] = 0
Image.fromarray(left, "RGBA").save(f"{OUT}/portal-left-{V}.png")
Image.fromarray(right, "RGBA").save(f"{OUT}/portal-right-{V}.png")

# --- Backdrop: interior at 112% with FEATHERED elliptical paste mask ---
inner = im.crop((CX - int(RX * 1.12), CY - int(RY * 1.12),
                 CX + int(RX * 1.12), CY + int(RY * 1.12)))
big = inner.resize((int(inner.width * 1.12), int(inner.height * 1.12)), Image.LANCZOS)
bw, bh = big.size
byy, bxx = np.mgrid[0:bh, 0:bw]
d = np.sqrt(((bxx - bw / 2) / (bw / 2)) ** 2 + ((byy - bh / 2) / (bh / 2)) ** 2)
pmask = Image.fromarray((np.clip((1.0 - d) / 0.14, 0, 1) * 255).astype(np.uint8)) \
             .filter(ImageFilter.GaussianBlur(8))
sky = im.copy()
sky.paste(big, (CX - bw // 2, CY - bh // 2), pmask)
sky.save(f"{OUT}/sky-{V}.png")

# --- Self-verification material: LOOK AT IT ---
for name, box in {"haut": (CX - 300, max(0, CY - RY - 150), CX + 300, CY - RY + 150),
                  "gauche": (CX - RX - 200, CY - 300, CX - RX + 160, CY + 300),
                  "droite": (CX + RX - 160, CY - 300, CX + RX + 200, CY + 300),
                  "bas": (CX - 350, CY + RY - 150, CX + 350, CY + RY + 180)}.items():
    chk = Image.new("RGBA", (box[2] - box[0], box[3] - box[1]), (255, 0, 255, 255))
    chk.alpha_composite(full.crop(box))
    chk.save(f"{OUT}/inspect-{name}.png")
base = Image.new("RGBA", (W, H))
base.paste(Image.open(f"{OUT}/sky-{V}.png").convert("RGBA"), (25, 15))
base.alpha_composite(full)
base.convert("RGB").resize((1100, int(1100 * H / W)), Image.LANCZOS) \
    .save(f"{OUT}/composite-parallax.png")
print(f"ok {W}x{H} hole={int(hole.sum())}px -> inspect-*.png + composite-parallax.png")
