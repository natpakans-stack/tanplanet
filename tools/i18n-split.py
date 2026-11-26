#!/usr/bin/env python3
"""แยก myfolio เป็น 2 ภาษา: ไทย = /  · อังกฤษ = /en/
ใช้: python3 tools/i18n-split.py   (สร้าง/อัปเดตโครง · ไม่แปลเนื้อหา — แปลแยกทีละหน้า)

- สร้าง tanplanet-sites/myfolio/en/<หน้าเดิม> จากหน้าปัจจุบัน (ถ้ายังไม่มี) · asset → path จากราก (/_ext/, /hero/ …)
- ทุกหน้าทั้งสองภาษา: <html lang> · canonical ของภาษานั้น · hreflang th/en/x-default · ปุ่มสลับภาษาใน navbar
- ชุด /en/: ตัดย่อหน้าไทยที่ซ้ำ (class "th") ออก
รันซ้ำได้: ส่วนหัว (hreflang/canonical/ปุ่ม) เขียนทับทุกครั้ง · ไฟล์ /en/ ที่มีอยู่แล้วไม่สร้างทับ (กันงานแปลหาย)
"""
import re
from pathlib import Path

SITE = "https://myfolio.tanplanet.work"
ROOT = Path(__file__).resolve().parent.parent / "tanplanet-sites/myfolio"
EN = ROOT / "en"


def url_path(rel):  # about.html → /about · index.html → / · blog/x.html → /blog/x
    p = "/" + rel.removesuffix(".html")
    return "/" if p == "/index" else p


def absolutize(s):  # asset ใน /en/ ต้องชี้ราก (ลิงก์หน้าปล่อย relative ให้อยู่ใน /en/ ต่อ)
    s = re.sub(r'((?:href|src|srcset)=")(?:\.\./|\./)+(_ext/|hero/|logos/|logo-header\.png|favicon\.png|apple-touch-icon\.png)', r"\1/\2", s)
    s = re.sub(r'(, )(?:\.\./|\./)+(_ext/)', r"\1/\2", s)  # srcset รายการถัดไป
    s = re.sub(r'href="\./article\.css"', 'href="/blog/article.css"', s)
    s = re.sub(r'src="\./article\.js"', 'src="/blog/article.js"', s)
    s = re.sub(r'url\((["\']?)(?:\.\./|\./)+(_ext/)', r"url(\1/\2", s)
    return s


def strip_th(s):  # ย่อหน้าไทยที่วางคู่กับอังกฤษ (class มีคำว่า th)
    return re.sub(r'<(p|div|h\d)\s+class="([^"]*\bth\b[^"]*)"[^>]*>.*?</\1>', "", s, flags=re.S)


def head_and_switch(s, lang, path):
    th_url, en_url = SITE + path, SITE + ("/en" + (path if path != "/" else "/"))
    s = re.sub(r'<html([^>]*?)\slang="[^"]*"', rf'<html\1 lang="{lang}"', s, count=1)
    s = re.sub(r'\s*<link rel="alternate" hreflang="[^"]+" href="[^"]*"\s*/?>', "", s)
    s = re.sub(r'<link rel="canonical" href="[^"]*"\s*/?>', f'<link rel="canonical" href="{th_url if lang == "th" else en_url}"/>', s)
    alt = (f'<link rel="alternate" hreflang="th" href="{th_url}"/><link rel="alternate" hreflang="en" href="{en_url}"/>'
           f'<link rel="alternate" hreflang="x-default" href="{th_url}"/>')
    s = s.replace("</head>", alt + "</head>", 1)
    s = re.sub(r'(<meta content=")[^"]*(" property="og:url"/?>)', rf'\g<1>{th_url if lang == "th" else en_url}\2', s)
    # ปุ่มสลับภาษา: วางหน้าลิงก์ Resume ใน navbar
    s = re.sub(r'<a class="lang-switch"[^>]*>.*?</a>', "", s, flags=re.S)
    other = ("/en" + (path if path != "/" else "/")) if lang == "th" else path
    btn = (f'<a class="lang-switch" href="{other}" hreflang="{"en" if lang == "th" else "th"}" '
           f'aria-label="{"TH EN – Switch to English" if lang == "th" else "TH EN – เปลี่ยนเป็นภาษาไทย"}">'
           f'<span class="{"on" if lang == "th" else ""}">TH</span> <span class="{"on" if lang == "en" else ""}">EN</span></a>')
    s = re.sub(r'(<div class="split-content header-right">)', r"\1" + btn, s, count=1)
    return s


def main():
    pages = sorted(p.relative_to(ROOT).as_posix() for p in ROOT.rglob("*.html")
                   if not p.relative_to(ROOT).as_posix().startswith(("_ext/", "en/")))
    made = 0
    for rel in pages:
        src = ROOT / rel
        dst = EN / rel
        if not dst.exists():
            dst.parent.mkdir(parents=True, exist_ok=True)
            dst.write_text(strip_th(absolutize(src.read_text())))
            made += 1
        path = url_path(rel)
        src.write_text(head_and_switch(src.read_text(), "th", path))
        dst.write_text(head_and_switch(dst.read_text(), "en", path))
    print(f"หน้า {len(pages)} · สร้าง /en/ ใหม่ {made}")


if __name__ == "__main__":
    main()
