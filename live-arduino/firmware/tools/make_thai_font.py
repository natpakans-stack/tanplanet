#!/usr/bin/env python3
"""สร้างฟอนต์ไทยสำหรับ LVGL ที่วางวรรณยุกต์ซ้อนสระบนได้

LVGL ไม่อ่าน GPOS จึงวาง mark ทุกตัวที่ระดับเดียวกัน — "ตั้ง" เลยได้ไม้หันอากาศ
กับไม้โทซ้อนทับกัน วิธีแก้มาตรฐานฝั่ง embedded คือทำวรรณยุกต์ชุด "ยกสูง"
ไว้ใน Private Use Area (ตาม mapping ของ Microsoft Thai) แล้วให้ firmware
สลับใช้เมื่อวรรณยุกต์ตามหลังสระบน

usage: python3 make_thai_font.py Anuphan-400.ttf out-400.ttf [--lift 1.0]
"""
import copy
import sys

from fontTools.ttLib import TTFont

# วรรณยุกต์ปกติ → คู่ยกสูงใน PUA
TONE_TO_PUA = {
    0x0E48: 0xF70A,  # ไม้เอก
    0x0E49: 0xF70B,  # ไม้โท
    0x0E4A: 0xF70C,  # ไม้ตรี
    0x0E4B: 0xF70D,  # ไม้จัตวา
    0x0E4C: 0xF70E,  # ทัณฑฆาต
}

UPPER_VOWEL = 0x0E31  # ไม้หันอากาศ — ใช้ความสูงตัวนี้เป็นระยะยก


def main():
    src, dst = sys.argv[1], sys.argv[2]
    # ponytail: ตัวคูณระยะยก — ปรับตัวนี้ตัวเดียวถ้าวรรณยุกต์ลอยสูงไปหรือยังชนสระ
    lift_ratio = 1.0
    if "--lift" in sys.argv:
        lift_ratio = float(sys.argv[sys.argv.index("--lift") + 1])

    font = TTFont(src)
    glyf = font["glyf"]
    hmtx = font["hmtx"]
    cmap = font.getBestCmap()

    vowel_glyph = glyf[cmap[UPPER_VOWEL]]
    lift = int((vowel_glyph.yMax - vowel_glyph.yMin) * lift_ratio)
    print(f"lift = {lift} units (สระบนสูง {vowel_glyph.yMax - vowel_glyph.yMin})")

    order = font.getGlyphOrder()
    new_names = []
    for tone_cp, pua_cp in TONE_TO_PUA.items():
        name = cmap[tone_cp]
        high_name = f"{name}.high"
        glyph = copy.deepcopy(glyf[name])
        if glyph.numberOfContours > 0:
            glyph.coordinates.translate((0, lift))
            glyph.recalcBounds(glyf)
        glyf.glyphs[high_name] = glyph
        hmtx.metrics[high_name] = hmtx.metrics[name]
        new_names.append(high_name)
        for table in font["cmap"].tables:
            if table.isUnicode():
                table.cmap[pua_cp] = high_name
        print(f"  U+{tone_cp:04X} {name} → U+{pua_cp:04X} {high_name}")

    font.setGlyphOrder(order + new_names)
    font.save(dst)
    print(f"saved {dst}")


if __name__ == "__main__":
    main()
