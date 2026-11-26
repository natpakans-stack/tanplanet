#!/usr/bin/env python3
"""หน้ารวมผลงาน projects.tanplanet.work (/ และ /en/) ในเทมเพลตเดียวกับ myfolio (navbar · footer · tokens)
ใช้: python3 tools/gen-myfolio-projects.py            (asset ชี้ https://myfolio.tanplanet.work — ใช้ตอนจะ push)
     python3 tools/gen-myfolio-projects.py --local    (asset ชี้ http://localhost:3001 — ดูในเครื่องก่อน deploy myfolio)
รันมือหลังเพิ่มการ์ดใน #projectsGrid ของ index.html (การ์ดแรก) — ไม่มีระบบรันเอง
- การ์ด = <a class="card …"> ใน index.html ราก repo (อ่านจากไฟล์ตัวเอง → รันซ้ำได้)
- เปลือกหน้า (navbar · footer · CSS/JS) ยืมจาก myfolio/blog.html ของภาษานั้น · CSS/JS ของหน้านี้อยู่ที่ pj/
- เมนู "ผลงาน"/"Portfolio" ทุกหน้า myfolio ชี้มาที่นี่
"""
import posixpath
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MF = ROOT / "tanplanet-sites/myfolio"
PROJ = "https://projects.tanplanet.work"
BASE = "http://localhost:3001" if "--local" in sys.argv else "https://myfolio.tanplanet.work"
CARD_RE = re.compile(r'<a\s(?=[^>]*class="card\b)[^>]*>.*?</a>', re.S)

TXT = {
    "th": dict(title="ณัฐปคัลภ์ ศิริรัตน์ (Natpakan Sirirat / Tan) — ผลงาน", h1="ผลงาน",
               lead="รวมโปรเจกต์ที่ออกแบบและสร้างเอง ตั้งแต่ UX/UI ไปจนถึงเครื่องมือที่ใช้ AI ช่วยสร้าง กดการ์ดเพื่ออ่าน case study",
               search="ค้นหาผลงาน เช่น LINE Bot, Design System…", all="ทั้งหมด", grid="มุมมองตาราง", list="มุมมองรายการ",
               empty_t="ไม่พบผลงานที่ตรงกับคำค้น", empty_p="ลองคำอื่น หรือเลือกหมวด “ทั้งหมด”", count="งาน"),
    "en": dict(title="Natpakan Sirirat (Tan) — Product design & AI-built projects", h1="Projects",
               lead="Projects I designed and built, from UX/UI work to AI-assisted tools. Open a card to read the case study.",
               search="Search projects, e.g. LINE Bot, Design System…", all="All", grid="Grid view", list="List view",
               empty_t="No projects match your search", empty_p="Try another word, or pick “All”.", count="projects"),
}
CATS = [("web-app", "Web App"), ("automation", "Automation"), ("design-thinking", "Design Thinking"), ("tooling", "Tooling"), ("content", "Content")]
SEARCH_IC = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>'


def cards():
    out = []
    for c in CARD_RE.findall((ROOT / "index.html").read_text()):
        c = re.sub(r'\s(target|rel)="[^"]*"', "", c)
        c = re.sub(r'(href|src)="https://projects\.tanplanet\.work/', r'\1="', c)  # path จากราก repo
        out.append(c)
    return out


def en_card(c):
    """การ์ดฉบับอังกฤษจาก pj/cards-en.json (คีย์ = href ใน index.html) — ไม่มีคำแปล = ใช้ของเดิม"""
    import json
    f = ROOT / "pj/cards-en.json"
    if not f.exists():
        return c
    href = re.search(r'href="([^"]+)"', c).group(1)
    t = json.loads(f.read_text()).get(href)
    if not t:
        return c
    c = re.sub(r'(<div class="card-type">)(.*?)(</div>)', lambda m: m.group(1) + t["type"] + m.group(3), c, count=1, flags=re.S)
    c = re.sub(r"(<h3>)(.*?)(</h3>)", lambda m: m.group(1) + t["title"] + m.group(3), c, count=1, flags=re.S)
    c = re.sub(r"(<p>)(.*?)(</p>)", lambda m: m.group(1) + t["desc"] + m.group(3), c, count=1, flags=re.S)
    tags = iter(t.get("tags", []))
    c = re.sub(r'(<span class="tag">)(.*?)(</span>)', lambda m: m.group(1) + next(tags, m.group(2)) + m.group(3), c, flags=re.S)
    if t.get("footer"):
        c = re.sub(r'(<div class="card-footer">.*?<span>)(.*?)(</span>)', lambda m: m.group(1) + t["footer"] + m.group(3), c, count=1, flags=re.S)
    return c


def body(lang, cs):
    t = TXT[lang]
    pre = "../" if lang == "en" else ""
    def cover_key(c):  # คีย์ปก = โฟลเดอร์ในเครื่อง หรือส่วนท้ายของ URL ภายนอก (ตรงกับ pj/covers.d/batch-4)
        h = re.search(r'href="([^"]+)"', c).group(1)
        if not h.startswith("http"):
            return h.strip("/").split("/")[0]
        last = [x for x in h.split("?")[0].split("/") if x][-1]
        return last.split(".")[0] if last.endswith((".webflow.io", ".vercel.app", ".github.io")) else last  # โดเมนล้วน → ชื่อ subdomain

    def with_cover(c):  # มีปกจาก engine (pj/covers) → ใช้ปกแทนไอคอน
        key = cover_key(c)
        if not (ROOT / f"pj/covers/{key}-{lang}.webp").exists():
            return c
        if "card-cover" in c:  # การ์ดต้นทาง (index.html) มีปกไทยอยู่แล้ว → สลับเป็นปกภาษาของหน้า
            return c.replace(f"{key}-th.webp", f"{key}-{lang}.webp")
        return c.replace('<div class="card-visual">', f'<div class="card-visual has-cover"><img class="card-cover" src="pj/covers/{key}-{lang}.webp" alt="" width="1600" height="900" loading="lazy" decoding="async">', 1)
    cs = [with_cover(en_card(c) if lang == "en" else c) for c in cs]
    def link(c):  # ฉบับอังกฤษของ case study มีแล้ว → การ์ดหน้า /en/ ชี้ /en/<slug>/ (relative ไม่ต้องเติม ../)
        m = re.search(r'href="([^"/]+)/?"', c)
        if lang == "en" and m and (ROOT / "_case-src/en" / f"{m.group(1)}.html").exists():
            c = c.replace(m.group(0), f'href="@EN@{m.group(1)}/"', 1)
        return c
    cs = [link(c) for c in cs]
    cs = [re.sub(r'(href|src)="(?!https?:|/|#|data:|@EN@)', rf'\1="{pre}', c).replace("@EN@", "") for c in cs]
    chips = f'<button class="pj-chip on" data-f="all">{t["all"]}</button>' + "".join(
        f'<button class="pj-chip" data-f="{k}">{v}</button>' for k, v in CATS)
    return f'''<div class="section pj" role="main"><div class="container-default w-container">
<header class="pj-head"><h1 class="pj-title">{t["h1"]}</h1><p class="pj-lead">{t["lead"]}</p></header>
<div class="pj-search">{SEARCH_IC}<input type="search" id="pj-q" placeholder="{t["search"]}" aria-label="{t["search"]}" autocomplete="off"></div>
<div class="pj-bar"><div class="pj-chips" role="group">{chips}</div>
<span class="pj-count" aria-live="polite"><b>{len(cs)}</b> {t["count"]}</span>
<div class="pj-views" role="group"><button class="pj-view on" data-v="grid" aria-label="{t["grid"]}" aria-pressed="true"><svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><rect x="1" y="1" width="6" height="6" rx="1"/><rect x="9" y="1" width="6" height="6" rx="1"/><rect x="1" y="9" width="6" height="6" rx="1"/><rect x="9" y="9" width="6" height="6" rx="1"/></svg></button><button class="pj-view" data-v="list" aria-label="{t["list"]}" aria-pressed="false"><svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><rect x="1" y="2" width="14" height="2" rx="1"/><rect x="1" y="7" width="14" height="2" rx="1"/><rect x="1" y="12" width="14" height="2" rx="1"/></svg></button></div></div>
<h2 class="pj-sr">{t["h1"]}</h2><div class="projects pj-grid" id="projectsGrid">
{chr(10).join(cs)}
</div>
<div class="pj-empty" hidden><span class="pj-empty-ico" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/><path d="M8.5 11h5"/></svg></span><p class="pj-empty-t">{t["empty_t"]}</p><p>{t["empty_p"]}</p></div>
</div></div>
<link rel="stylesheet" href="{pre}pj/projects.css?v=7"/><script src="{pre}pj/projects.js?v=7" defer></script>
'''


def absolutize(s, lang):
    """ลิงก์/asset ของเปลือก myfolio → URL เต็มของ myfolio (หน้า myfolio ใช้ clean URL)"""
    mf_dir = "en/" if lang == "en" else ""

    def fix(m):
        attr, url = m.group(1), m.group(2)
        if re.match(r"(https?:|//|#|mailto:|data:|tel:)", url):
            return m.group(0)
        if url.startswith("/"):
            path = url
        else:
            path = "/" + mf_dir + re.sub(r"^(\./)+", "", url)
            path = posixpath.normpath(path) + ("/" if url.endswith("/") else "")
        if path.split("?")[0].endswith(".html"):
            path = re.sub(r"(/index)?\.html", lambda m: "/" if m.group(1) else "", path, count=1)
        return f'{attr}="{BASE}{path}"'
    return re.sub(r'\b(href|src)="([^"]*)"', fix, s)


def build(lang, cs):
    s = (MF / ("en/blog.html" if lang == "en" else "blog.html")).read_text()
    a, b = s.find('<div class="section'), s.find("<footer")
    shell = absolutize(s[:a], lang) + "@@BODY@@" + absolutize(s[b:], lang)
    t = TXT[lang]
    url = PROJ + ("/en/" if lang == "en" else "/")
    shell = re.sub(r"<title>[^<]*</title>", f"<title>{t['title']}</title>", shell, count=1)
    shell = re.sub(r'(content=")[^"]*(" (?:property|name)="(?:og|twitter):title")', rf"\g<1>{t['title']}\2", shell)
    for k in ('name="description"', 'property="og:description"', 'name="twitter:description"'):
        shell = re.sub(r'(<meta content=")[^"]*(" ' + re.escape(k) + ')', rf"\g<1>{t['lead']}\2", shell)
    shell = re.sub(r'<link rel="canonical" href="[^"]*"\s*/?>', f'<link rel="canonical" href="{url}"/>', shell)
    shell = re.sub(r'<link rel="alternate" hreflang="[^"]+" href="[^"]*"\s*/?>', "", shell)
    shell = shell.replace("</head>", f'<link rel="alternate" hreflang="th" href="{PROJ}/"/><link rel="alternate" hreflang="en" href="{PROJ}/en/"/><link rel="alternate" hreflang="x-default" href="{PROJ}/"/></head>', 1)
    shell = re.sub(r'(<meta content=")[^"]*(" property="og:url")', rf"\g<1>{url}\2", shell)
    shell = re.sub(r'(<meta content=")[^"]*(" (?:property|name)="(?:og|twitter):image")', rf"\g<1>{PROJ}/pj/covers/site-projects-{lang}-og.jpg\2", shell)
    # ปุ่มสลับภาษา: / ↔ /en/ ของ projects
    shell = re.sub(r'(<a class="lang-switch" href=")[^"]*', rf'\g<1>{PROJ + ("/" if lang == "en" else "/en/")}', shell)
    shell = shell.replace(' aria-current="page"', "").replace(" w--current", "")
    shell = re.sub(rf'(href="{re.escape(url)}" class="nav-link)"', r'\1 w--current" aria-current="page"', shell)
    shell = re.sub(r'<script type="application/ld\+json">.*?</script>', "", shell, flags=re.S)  # ของ myfolio ออก
    ld = (ROOT / "pj/jsonld.json").read_text()  # Person + ItemList เดิมของหน้ารวม (แก้ที่ไฟล์นี้)
    shell = shell.replace("</head>", f'<script type="application/ld+json">{ld}</script></head>', 1)
    out = ROOT / ("en/index.html" if lang == "en" else "index.html")
    out.parent.mkdir(exist_ok=True)
    out.write_text(shell.replace("@@BODY@@", body(lang, cs)))


COLOR = {"magenta": "#db2777", "blue": "#2563eb", "cyan": "#0891b2", "green": "#16a34a", "orange": "#ea580c", "purple": "#7c3aed",
         "yellow": "#ca8a04", "red": "#dc2626", "gold": "#a68945"}


def update_hero(cs):
    """การ์ดลอยหน้าแรก myfolio = ผลงานล่าสุดที่มีปก (ลำดับเดียวกับ #projectsGrid) · ตำแหน่ง/ขนาดการ์ดคงเดิม"""
    proj_base = "http://localhost:3003" if "--local" in sys.argv else PROJ
    latest = []
    for c in cs:
        m = re.search(r'href="([^"/]+)/?"', c)
        if m and (ROOT / f"pj/covers/{m.group(1)}-th.webp").exists():
            g = lambda rx: (re.search(rx, c, re.S) or [None, ""])[1]
            latest.append(dict(slug=m.group(1), color=g(r'class="card card--(\w+)'), icon=g(r'<span class="icon">(.*?)</span>\s*</div>'),
                               title=re.split(r"\s+[—–-]\s+", re.sub("<[^>]+>", "", g(r"<h3>(.*?)</h3>")).strip())[0],
                               type=re.sub("<[^>]+>", "", g(r'class="card-type">(.*?)</div>')).strip()))
    import json
    en_map = json.loads((ROOT / "pj/cards-en.json").read_text()) if (ROOT / "pj/cards-en.json").exists() else {}
    for rel, lang in (("index.html", "th"), ("en/index.html", "en")):
        f = MF / rel
        s = f.read_text()
        olds = re.findall(r'<a class="fh-card"[^>]*>.*?</a>', s, re.S)
        for old, it in zip(olds, latest):
            style = re.search(r'style="([^"]*)"', old).group(1)
            new = (f'<a class="fh-card" href="{PROJ}/{it["slug"]}/" style="{style}">'
                   f'<img src="{proj_base}/pj/covers/{it["slug"]}-{lang}.webp" alt="" loading="eager" decoding="async"/>'
                   f'<span class="fh-ava" style="--c:{COLOR.get(it["color"], "#1f1f1f")}" aria-hidden="true">{it["icon"]}</span>'
                   f'<b>{(en_map.get(it["slug"] + "/") or {}).get("title", it["title"]) if lang == "en" else it["title"]}</b>'
                   f'<span>{(en_map.get(it["slug"] + "/") or {}).get("type", it["type"]) if lang == "en" else it["type"]}</span></a>')
            s = s.replace(old, new, 1)
        # การ์ดผลงานในหน้าแรก (section Projects): รูป = ปกจาก engine ของงานนั้น → ตรงกับหน้า case study
        def thumb(m):
            slug = re.search(r'projects\.tanplanet\.work/([^/"]+)/', m.group(0))
            if slug and (ROOT / f"pj/covers/{slug.group(1)}-{lang}.webp").exists():
                return re.sub(r'(<img[^>]*class="pp-thumb"[^>]*src=")[^"]*"|(<img[^>]*src=")[^"]*("[^>]*class="pp-thumb")',
                              lambda q: (q.group(1) or q.group(2)) + f'{proj_base}/pj/covers/{slug.group(1)}-{lang}.webp' + (q.group(3) or '"'), m.group(0), count=1)
            return m.group(0)
        s = re.sub(r'<a [^>]*class="card portfolio-project[^"]*"[^>]*>.*?</a>', thumb, s, flags=re.S)
        f.write_text(s)
    return len(latest)


def relink():  # เมนู "ผลงาน" ทุกหน้า myfolio → projects.tanplanet.work
    n = 0
    for p in MF.rglob("*.html"):
        rel = p.relative_to(MF).as_posix()
        if rel.startswith("_ext/"):
            continue
        s = p.read_text()
        target = PROJ + ("/en/" if rel.startswith("en/") else "/")
        new = re.sub(r'href="(?:/en/projects|/projects|https://projects\.tanplanet\.work/(?:en/)?)"(\s+class="(?:nav-link|footer-nav-link)[^"]*")',
                     rf'href="{target}"\1', s)
        if new != s:
            p.write_text(new); n += 1
    return n


if __name__ == "__main__":
    CS = cards()
    assert len(CS) > 10, "หาการ์ดใน index.html ไม่เจอ"
    n = relink()
    build("th", CS); build("en", CS)
    print("การ์ดลอยหน้าแรก จากผลงานที่มีปก", update_hero(CS))
    print(f"การ์ด {len(CS)} · BASE {BASE} · เปลี่ยนลิงก์เมนูใน {n} หน้า")
