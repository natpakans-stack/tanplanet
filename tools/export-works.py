#!/usr/bin/env python3
"""รายการผลงานทั้งหมด (การ์ดหน้ารวม projects + หน้าผลงานเก่าบน myfolio) เป็น JSON — tanplanet-cms นำเข้าเป็นคอนเทนต์ประเภท "ผลงาน"
ใช้: python3 tools/export-works.py > works.json
"""
import html, json, re, runpy, subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
g = runpy.run_path(str(ROOT / "tools/gen-seo.py"), run_name="lib")
EN = json.loads((ROOT / "pj/cards-en.json").read_text())
MF = ROOT / "tanplanet-sites/myfolio"

def created(path):
    out = subprocess.run(["git", "log", "--diff-filter=A", "--format=%cs", "--", str(path)], cwd=ROOT, capture_output=True, text=True).stdout.split()
    return out[-1] if out else None

def head(f):
    h = f.read_text(encoding="utf-8").split("</head>")[0]
    t = re.search(r"<title>([^<]*)</title>", h); d = re.search(r'<meta[^>]*name="description"[^>]*content="([^"]*)"', h) or re.search(r'<meta[^>]*content="([^"]*)"[^>]*name="description"', h)
    return html.unescape(t.group(1)) if t else None, html.unescape(d.group(1)) if d else None

out = []
for c in g["cards"]():
    slug = c["path"].strip("/")
    if not slug or not (ROOT / slug / "index.html").is_file(): continue
    e = EN.get(slug + "/") or {}
    st, sd = head(ROOT / slug / "index.html")
    cover = f"/pj/covers/{slug}-th.webp" if (ROOT / f"pj/covers/{slug}-th.webp").is_file() else None
    out.append({"slug": slug, "url": c["url"], "title": c["name"], "excerpt": c["desc"], "type": c["type"], "date": created(ROOT / slug / "index.html"),
                "cover": cover and "https://projects.tanplanet.work" + cover, "seoTitle": st, "seoDescription": sd,
                "en": e and {"title": e.get("title"), "excerpt": e.get("desc"), "cover": cover and "https://projects.tanplanet.work" + cover.replace("-th.", "-en.")}})
for f in sorted((MF / "project").glob("*.html")):
    slug = f.stem; st, sd = head(f); fe = MF / "en/project" / f.name
    et, ed = head(fe) if fe.is_file() else (None, None)
    cover = f"/pj/covers/{slug}-th.webp" if (ROOT / f"pj/covers/{slug}-th.webp").is_file() else None
    out.append({"slug": "myfolio-" + slug, "url": f"https://myfolio.tanplanet.work/project/{slug}", "title": (st or slug).split(" — ")[0].split(" · ")[0], "excerpt": sd, "type": "UX/UI",
                "date": created(f), "cover": cover and "https://projects.tanplanet.work" + cover, "seoTitle": st, "seoDescription": sd,
                "en": et and {"title": et.split(" — ")[0].split(" · ")[0], "excerpt": ed, "cover": cover and "https://projects.tanplanet.work" + cover.replace("-th.", "-en.")}})
print(json.dumps(out, ensure_ascii=False, indent=1))
