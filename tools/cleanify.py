#!/usr/bin/env python3
"""แปลงหน้า case study ให้เป็นเลย์เอาต์สะอาดแบบหน้า project ของ myfolio
ใช้: python3 tools/cleanify.py <slug-portfolio> [...]

- แทน <header class="hero"> ด้วยส่วนหัว: โลโก้ · View ↗ · หัวข้อ · คำโปรย · แถวข้อมูล 4 ช่อง · เส้นคั่น
- ย่อหน้ายาวใน hero ย้ายไปเป็น section "Project Overview" แรกของ <article>
- ใส่ common/clean.css ท้าย <head> (ทับสไตล์เดิม) · เนื้อหาส่วนอื่นไม่แตะ
ข้อมูลแถว (ประเภท/วันที่/สี) มาจากการ์ดใน index.html · ขอบเขตจาก hero-badge · Stack จาก hero-tags
"""
import html, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
COL = {"cyan": "#0891b2", "green": "#16a34a", "orange": "#ea580c", "gold": "#ca8a04", "purple": "#7c3aed",
       "magenta": "#c94277", "blue": "#2563eb", "red": "#dc2626"}
TH_MONTH = "ม.ค. ก.พ. มี.ค. เม.ย. พ.ค. มิ.ย. ก.ค. ส.ค. ก.ย. ต.ค. พ.ย. ธ.ค.".split()


def text(s):
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", "", s))).strip()


def card_info(slug):
    idx = (ROOT / "index.html").read_text()
    m = re.search(r'<a\s(?=[^>]*href="%s/")([^>]*)>(.*?)</a>' % re.escape(slug), idx, re.S)
    if not m:
        return {}
    attrs, body = m.groups()
    col = re.search(r"card--(\w+)", attrs)
    added = re.search(r'data-added="(\d{4})-(\d{2})', attrs)
    typ = re.search(r'class="card-type"[^>]*>(.*?)</div>', body, re.S)
    return {"color": COL.get(col.group(1)) if col else None,
            "date": f"{TH_MONTH[int(added.group(2)) - 1]} {added.group(1)}" if added else None,
            "type": text(typ.group(1)) if typ else None}


def convert(slug):
    p = ROOT / slug / "index.html"
    s = p.read_text()
    if 'class="cl-head"' in s:
        return f"{slug}: แปลงแล้ว ข้าม"
    hm = re.search(r'<header class="hero">.*?</header>', s, re.S)
    if not hm:
        return f"{slug}: ไม่มี <header class=\"hero\"> ข้าม"
    hero = hm.group(0)
    info = card_info(slug)

    svg = re.search(r'class="hero-mark"[^>]*>\s*(<svg.*?</svg>)', hero, re.S)
    h1 = re.search(r"<h1[^>]*>(.*?)</h1>", hero, re.S).group(1)
    title, _, rest = h1.partition("<br")
    lead = text(re.sub(r"^[^>]*>", "", rest)) if rest else ""
    para = re.search(r"</h1>\s*<p[^>]*>(.*?)</p>", hero, re.S)
    badge = re.search(r'class="hero-badge"[^>]*>(.*?)</div>', hero, re.S)
    tags = [text(t) for t in re.findall(r'class="hero-tag"[^>]*>(.*?)</span>', hero, re.S)]
    ext = [u for u in re.findall(r'class="cta-btn[^"]*"[^>]*href="(https?://[^"]+)"', hero)]

    meta = [("Project Type", info.get("type")), ("Date", info.get("date")),
            ("Scope", text(badge.group(1)) if badge else None), ("Stack", " · ".join(tags[:5]) or None)]
    meta_html = "".join(f"<div><dt>{k}</dt><dd>{html.escape(v)}</dd></div>" for k, v in meta if v)
    logo = f'<div class="cl-logo" style="--c:{info.get("color") or "#111"}" aria-hidden="true">{svg.group(1) if svg else ""}</div>'
    view = f'<a class="cl-view" href="{ext[0]}" target="_blank" rel="noopener">View &#8599;</a>' if ext else ""
    head = (f'<header class="cl-head">\n    <div class="cl-top">{logo}{view}</div>\n'
            f'    <h1>{text(title)}</h1>\n' + (f'    <p class="cl-lead">{html.escape(lead)}</p>\n' if lead else "") +
            f'    <dl class="cl-meta">{meta_html}</dl>\n  </header>\n  <hr class="cl-rule">')
    s = s.replace(hero, head, 1)
    if para:
        s = re.sub(r"(<article[^>]*>)", r'\1\n\n    <section class="section-intro">\n      <h2>Project Overview</h2>\n      <p>'
                   + para.group(1).replace("\\", "\\\\") + "</p>\n    </section>\n", s, count=1)
    s = s.replace("</head>", '  <link rel="stylesheet" href="../common/clean.css">\n</head>', 1)
    p.write_text(s)
    return f"{slug}: ok · meta {len([1 for _, v in meta if v])} ช่อง · view {'มี' if ext else 'ไม่มี'}"


if __name__ == "__main__":
    for a in sys.argv[1:]:
        print(convert(a.strip("/")))
