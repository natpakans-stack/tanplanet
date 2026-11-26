#!/usr/bin/env python3
"""ใส่ width/height ให้ <img> ที่ยังไม่มี (กันหน้ากระโดดตอนรูปโหลด · CLS) — อ่านขนาดจริงจากไฟล์ในเครื่อง · รูปนอกเว็บข้าม
ใช้: python3 tools/fix-img-size.py <ไฟล์ html ...>
"""
import re, sys
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
MF = ROOT / "tanplanet-sites/myfolio"
HOSTS = {"https://myfolio.tanplanet.work": MF, "http://localhost:3001": MF, "https://projects.tanplanet.work": ROOT, "http://localhost:3003": ROOT}

CACHE = Path("/tmp/tp-img-cache")
def remote(url):
    """รูปนอกเว็บ (Drive ฯลฯ) — โหลดมาวัดขนาดครั้งเดียว เก็บไว้ใน /tmp"""
    import hashlib, urllib.request
    CACHE.mkdir(exist_ok=True)
    f = CACHE / hashlib.sha1(url.encode()).hexdigest()
    if not f.exists():
        try:
            req = urllib.request.Request(html_unescape(url), headers={"User-Agent": "Mozilla/5.0"})
            f.write_bytes(urllib.request.urlopen(req, timeout=20).read())
        except Exception: return None
    return f

def html_unescape(s):
    import html; return html.unescape(s)

def local(src, page):
    src = src if re.match(r"^https?:", src) and not any(src.startswith(h) for h in HOSTS) else src.split("?")[0].split("#")[0]
    for h, base in HOSTS.items():
        if src.startswith(h): return base / src[len(h):].lstrip("/")
    if re.match(r"^https?:", src): return remote(src)
    if re.match(r"^(data:|//)", src): return None
    from urllib.parse import unquote; src = unquote(src)
    if src.startswith("/"): return (MF if MF in page.parents else ROOT) / src.lstrip("/")
    return page.parent / src

def fix(page):
    s = page.read_text(encoding="utf-8")
    def one(m):
        tag = m.group(0)
        if re.search(r"\swidth=", tag) and re.search(r"\sheight=", tag): return tag
        src = re.search(r'\ssrc="([^"]+)"', tag)
        f = local(src.group(1), page) if src else None
        if not f or not f.is_file(): return tag
        try:
            if f.suffix == ".svg":  # SVG: ใช้ width/height หรือ viewBox ของไฟล์
                x = f.read_text(errors="ignore")
                wh = re.search(r'<svg[^>]*\swidth="([\d.]+)(?:px)?"[^>]*\sheight="([\d.]+)(?:px)?"', x) or re.search(r'viewBox="[\d.-]+[ ,]+[\d.-]+[ ,]+([\d.]+)[ ,]+([\d.]+)"', x)
                w, h = round(float(wh.group(1))), round(float(wh.group(2)))
            else:
                w, h = Image.open(f).size
        except Exception: return tag
        return re.sub(r"\s*/?>$", lambda e: f' width="{w}" height="{h}"' + e.group(0), tag, count=1)
    t = re.sub(r"<img\b[^>]*>", one, s)
    if t != s: page.write_text(t, encoding="utf-8")
    return t != s

if __name__ == "__main__":
    print("fixed", sum(fix(Path(f).resolve()) for f in sys.argv[1:]), "files")
