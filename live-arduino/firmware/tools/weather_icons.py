#!/usr/bin/env python3
"""ไอคอนอากาศ Google (maps.gstatic.com) → C array แบบ LVGL RGB565A8

RGB565A8 = พิกเซล RGB565 ทั้งภาพ แล้วต่อด้วยระนาบ alpha 8-bit — ฟอร์แมตเดียว
ที่ให้ขอบโปร่งใสบนจอ 16-bit โดยไม่ต้องแบก ARGB8888 (ประหยัด flash ไป 25%)

รันใหม่เมื่ออยากเปลี่ยนขนาด/ชุดไอคอน:  python3 tools/weather_icons.py
"""
import io
import urllib.request
from pathlib import Path

from PIL import Image

BASE = "https://maps.gstatic.com/weather/v1/"
SIZE = 28  # พอดีช่องพยากรณ์กว้าง 54px และยังอ่านออกที่ระยะโต๊ะทำงาน
OUT = Path(__file__).resolve().parent.parent / "src" / "icons"

# ชื่อไฟล์ฝั่ง Google → ชื่อตัวแปรฝั่งเรา (ใช้ _dark เพราะ UI เราพื้นเข้ม)
ICONS = [
    "sunny", "partly_cloudy", "mostly_cloudy", "cloudy", "mist",
    "drizzle", "showers", "heavy", "scattered_showers",
    "isolated_tstorms", "strong_tstorms",
]


def fetch(name: str) -> Image.Image:
    url = f"{BASE}{name}_dark.png"
    with urllib.request.urlopen(url, timeout=20) as r:
        img = Image.open(io.BytesIO(r.read())).convert("RGBA")
    return img.resize((SIZE, SIZE), Image.LANCZOS)


def to_rgb565a8(img: Image.Image) -> bytes:
    px = img.load()
    rgb, alpha = bytearray(), bytearray()
    for y in range(SIZE):
        for x in range(SIZE):
            r, g, b, a = px[x, y]
            v = ((r & 0xF8) << 8) | ((g & 0xFC) << 3) | (b >> 3)
            rgb += bytes((v & 0xFF, v >> 8))  # LVGL อ่าน little-endian
            alpha.append(a)
    return bytes(rgb + alpha)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    body, decls = [], []
    for name in ICONS:
        data = to_rgb565a8(fetch(name))
        rows = ",\n  ".join(
            ", ".join(f"0x{b:02X}" for b in data[i:i + 16])
            for i in range(0, len(data), 16)
        )
        body.append(
            f"static const uint8_t wi_{name}_map[] = {{\n  {rows}\n}};\n\n"
            f"const lv_image_dsc_t wi_{name} = {{\n"
            f"  .header = {{ .magic = LV_IMAGE_HEADER_MAGIC, .cf = LV_COLOR_FORMAT_RGB565A8,\n"
            f"               .flags = 0, .w = {SIZE}, .h = {SIZE}, .stride = {SIZE * 2} }},\n"
            f"  .data_size = sizeof(wi_{name}_map), .data = wi_{name}_map,\n}};\n"
        )
        decls.append(f"extern const lv_image_dsc_t wi_{name};")
        print(f"  {name} ok ({len(data)} bytes)")

    header = "// สร้างจาก tools/weather_icons.py — ห้ามแก้มือ\n#pragma once\n#include <lvgl.h>\n\n"
    (OUT / "weather_icons.h").write_text(header + "\n".join(decls) + "\n", encoding="utf-8")
    (OUT / "weather_icons.c").write_text(
        '// สร้างจาก tools/weather_icons.py — ห้ามแก้มือ\n#include "weather_icons.h"\n\n'
        + "\n".join(body),
        encoding="utf-8",
    )
    print(f"เขียนแล้ว: {OUT}/weather_icons.c ({len(ICONS)} ไอคอน)")


if __name__ == "__main__":
    main()
