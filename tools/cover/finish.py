#!/usr/bin/env python3
"""png 1600×900 → <slug>-<lang>.webp (ปก ≤ 250KB) + <slug>-<lang>-og.jpg (1200×630 ≤ 300KB) · ลบ png ทิ้ง"""
from pathlib import Path
from PIL import Image
D = Path(__file__).resolve().parent.parent.parent / "pj/covers"
for png in sorted(D.glob("*.png")):
    im = Image.open(png).convert("RGB")
    im.save(png.with_suffix(".webp"), "WEBP", quality=82, method=6)
    og = im.crop((0, 30, 1600, 870)).resize((1200, 630), Image.LANCZOS)
    for q in (86, 80, 72, 64):
        og.save(png.with_name(png.stem + "-og.jpg"), "JPEG", quality=q, optimize=True, progressive=True)
        if png.with_name(png.stem + "-og.jpg").stat().st_size < 300_000: break
    png.unlink(); print("ok", png.stem)
