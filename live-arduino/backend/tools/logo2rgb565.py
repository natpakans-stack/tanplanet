#!/usr/bin/env python3
"""แปลงโลโก้หุ้น PNG → RGB565 ดิบ ให้ ESP32 วาดตรง ๆ

ESP32 ไม่มีแรมพอจะ decode PNG ตอน runtime จึงแปลงที่ backend แล้วส่ง base64
พื้นหลังโปร่งใสถูก composite ลงสีการ์ด (#151C33) เพื่อไม่ให้ขอบดำ

usage: python3 logo2rgb565.py NVDA out/NVDA.bin [--size 28]
"""
import struct
import sys
import urllib.request

from PIL import Image

SOURCE = "https://raw.githubusercontent.com/nvstly/icons/main/ticker_icons/{}.png"
CARD_BG = (0x15, 0x1C, 0x33)


def main():
    ticker, out = sys.argv[1], sys.argv[2]
    size = int(sys.argv[sys.argv.index("--size") + 1]) if "--size" in sys.argv else 28

    req = urllib.request.Request(SOURCE.format(ticker.upper()), headers={"User-Agent": "tanplanet"})
    with urllib.request.urlopen(req, timeout=10) as res:
        raw = res.read()

    with open(out + ".png", "wb") as f:
        f.write(raw)

    # ย่อให้พอดีกรอบโดยคงสัดส่วน แล้ววางกลางผืนจัตุรัส — resize((size, size)) ตรง ๆ
    # จะยืดโลโก้ที่อาร์ตเวิร์กไม่จัตุรัส (บั๊กเดียวกับ tamaclaude `19daa2b`)
    art = Image.open(out + ".png").convert("RGBA")
    art.thumbnail((size, size), Image.LANCZOS)
    img = Image.new("RGBA", (size, size), CARD_BG + (255,))
    img.paste(art, ((size - art.width) // 2, (size - art.height) // 2), art)
    img = img.convert("RGB")

    # RGB565 little-endian — ตรงกับที่ LVGL คาดไว้บน ESP32
    data = bytearray()
    for r, g, b in list(img.getdata()):
        data += struct.pack("<H", ((r & 0xF8) << 8) | ((g & 0xFC) << 3) | (b >> 3))

    with open(out, "wb") as f:
        f.write(data)
    print(f"{ticker} → {out} ({size}x{size}, {len(data)} bytes)")


if __name__ == "__main__":
    main()
