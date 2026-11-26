#!/usr/bin/env python3
"""หน้าผลงานเก่า 6 หน้าของ myfolio (/project/<slug>) → เลย์เอาต์บทความแบบเดียวกับบล็อก/หน้าเคส
ใช้: python3 tools/myfolio-project-article.py [--local]
ต้นฉบับ Webflow เก็บครั้งแรกที่ _case-src/myfolio/{th,en}/<slug>.html แล้วสร้างหน้าใหม่ทับ project/<slug>.html ทุกครั้ง
"""
import html
import re
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MF = ROOT / "tanplanet-sites/myfolio"
SRC = ROOT / "_case-src/myfolio"
PROJ = "http://localhost:3003" if "--local" in sys.argv else "https://projects.tanplanet.work"
SITE = "https://myfolio.tanplanet.work"
SLUGS = ["nocnoc-quiz-pesonlity-test", "kollab-webapp-uxui", "ncds-app-ux-ui-design",
         "pukao-budget-spending", "jump-ui-travel-app-v2", "line-man-mart-feature-ux-research"]
T = {"th": dict(cat="ผลงาน", ghost="UX/UI", latest="ผลงานอื่น ๆ", prev="ก่อนหน้า", next="ถัดไป", pn="ผลงานก่อนหน้าและถัดไป",
                read="อ่าน {} นาที", view="ดูงานจริง", facts="ข้อมูลโปรเจกต์"),
     "en": dict(cat="Projects", ghost="UX/UI", latest="More projects", prev="Previous", next="Next", pn="Previous and next project",
                read="{} min read", view="See the work", facts="Project facts")}


def block(s, start):
    """<div …> ถึง </div> ที่ปิดคู่กัน"""
    i = s.find(start)
    if i < 0:
        return None
    d = 0
    for m in re.finditer(r"<div\b|</div>", s[i:]):
        d += 1 if m.group(0) == "<div" else -1
        if d == 0:
            return s[i:i + m.end()]


def text(x):
    return html.unescape(re.sub(r"<[^>]+>", "", x)).strip()


def source(slug, lang):
    rel = ("en/" if lang == "en" else "") + f"project/{slug}.html"
    keep = SRC / lang / f"{slug}.html"
    if not keep.exists():  # ครั้งแรก: เก็บต้นฉบับ Webflow ไว้ก่อนสร้างทับ
        keep.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy(MF / rel, keep)
    return keep.read_text(), MF / rel


def parse(s):
    sec = block(s, '<div class="section portfolio-page"')
    title = text(re.search(r'class="title portfolio-project-title">(.*?)</h1>', sec, re.S).group(1))
    summary = text((re.search(r'class="paragraph portfolio-project-summary">(.*?)</p>', sec, re.S) or [None, ""])[1])
    view = re.search(r'<a [^>]*href="([^"]+)"[^>]*class="link-primary', sec)
    facts = []
    for w in re.findall(r'<div class="portfolio-project-about-wrapper">(.*?</div>)</div>', sec, re.S):
        k = re.search(r'portfolio-project-about-title">(.*?)</div>', w, re.S)
        v = re.sub(r'<div class="portfolio-project-about-title">.*?</div>', "", w, count=1, flags=re.S)
        facts.append((text(k.group(1)) if k else "", re.sub(r"\s+", " ", text(v))))
    body = sec[sec.find('<div class="divider portfolio-divider-1"'):]
    body = re.sub(r'<a [^>]*href="#"[^>]*class="link-primary[^"]*"[^>]*>.*?</a>', "", body, flags=re.S)
    # "ดูภาพเต็ม" เดิมพาออกไป Google Drive → เปิดรูปข้างบนใน lightbox ของหน้าแทน (header-autohide.js · .tp-zoom-prev)
    body = re.sub(r'<a [^>]*href="https://drive\.google\.com[^"]*"[^>]*>\s*(?:<strong>)?\s*(ดูภาพเต็ม|View full image)\s*(?:</strong>)?\s*</a>', r'<button type="button" class="tp-zoom-prev">\1</button>', body)  # ลิงก์ตัวอย่างของ template Webflow (href="#")
    body = re.sub(r'<div class="divider[^"]*"></div>', "", body)
    body = re.sub(r'<div class="rich-text w-richtext">', "", body)
    body = re.sub(r"\s(style|sizes|srcset)=\"[^\"]*\"", "", body)
    body = re.sub(r'\sclass="w-richtext-[^"]*"', "", body)
    body = re.sub(r"<figure>\s*<div>(.*?)</div>", r"<figure>\1", body, flags=re.S)
    body = re.sub(r"<p>(&zwj;|‍|\s)*</p>", "", body)
    body = re.sub(r"<div\b[^>]*>|</div>", "", body)  # ตัวห่อ div ของ Webflow ทิ้งทั้งเปิดและปิด (เปิดค้าง = sidebar หลุดลงใต้เนื้อหา)
    body = re.sub(r'<a [^>]*href="https://drive\.google\.com[^"]*"[^>]*>\s*(<img[^>]*>)\s*</a>', r"\1", body)  # รูปที่ห่อลิงก์ Drive → รูปเปล่า (lightbox จับได้)
    href = view.group(1) if view else ""
    return title, summary, "" if href in ("", "#") else href, facts, body


def build(slug, lang, info):
    en = lang == "en"
    t = T[lang]
    raw, out = source(slug, lang)
    title, summary, view, facts, body = info[lang][slug]
    shell = (MF / ("en/" if en else "") / "blog/dream-faculty.html").read_text()
    url = f"{SITE}/{'en/' if en else ''}project/{slug}"

    # head: เปลือกบทความ + meta/ld ของหน้าผลงานเดิม
    head = shell[:shell.find("</head>")]
    pat = r'<title>.*?</title>|<meta[^>]+(?:name="description"|property="og:[^"]+"|name="twitter:[^"]+")[^>]*>|<link rel="(?:canonical|alternate)"[^>]*>|<script type="application/ld\+json"[^>]*>.*?</script>'
    head = re.sub(pat, "", head, flags=re.S)
    keep = "".join(re.findall(pat, raw[:raw.find("</head>")], re.S))
    keep = re.sub(r'(<meta[^>]+property="og:image"[^>]*content=")[^"]*', rf"\g<1>{PROJ}/pj/covers/{slug}-{lang}-og.jpg", keep)
    keep = re.sub(r'(<meta[^>]+content=")[^"]*("[^>]+property="og:image")', rf"\g<1>{PROJ}/pj/covers/{slug}-{lang}-og.jpg\2", keep)
    head += keep + "</head>"

    a0 = shell.find('<article class="ap"')
    a1 = shell.find("</article>", a0) + len("</article>")
    art = shell[a0:a1]
    ic = re.findall(r"<svg.*?</svg>", re.search(r'<p class="ap-meta">.*?</p>', art, re.S).group(0), re.S)
    words = len(re.findall(r"[A-Za-z0-9]+", text(body))) + len(re.findall(r"[\u0E00-\u0E7F]", text(body))) // 6  # ไทยไม่เว้นวรรค: ~6 ตัวอักษรต่อคำ
    period = next((v for k, v in facts if re.search(r"ช่วงเวลา|period|time|date", k, re.I)), "")
    head_html = (f'<header class="ap-head"><div class="ap-tags"><a href="{PROJ}/{"en/" if en else ""}" class="ap-tag">{t["cat"]}</a>'
                 f'<span class="ap-tag ap-tag--ghost">{t["ghost"]}</span></div><h1 class="ap-title">{html.escape(title)}</h1>'
                 + (f'<p class="cs-sub">{html.escape(summary)}</p>' if summary else "")
                 + f'<p class="ap-meta"><span>{ic[0]}{html.escape(period)}</span><span>{ic[1]}{t["read"].format(max(1, round(words / 200)))}</span></p>'
                 + (f'<p class="pj-view"><a class="ap-btn-all" href="{html.escape(view)}" target="_blank" rel="noopener">{t["view"]} ↗</a></p>' if view else "") + '</header>')
    art = re.sub(r'<header class="ap-head">.*?</header>', lambda m: head_html, art, count=1, flags=re.S)
    cover = f'<figure class="ap-cover"><img src="{PROJ}/pj/covers/{slug}-{lang}.webp" alt="" width="1600" height="900" fetchpriority="high" decoding="async"></figure>'
    art = re.sub(r'<figure class="ap-cover">.*?</figure>', lambda m: cover, art, count=1, flags=re.S)
    # เนื้อหา: ตารางข้อมูลโปรเจกต์ (table.ledger) + ปุ่มดูงาน + เนื้อหาเดิม
    ledger = ('<div class="ledger-wrap"><table class="ledger"><thead><tr>' + "".join(f"<th>{html.escape(k)}</th>" for k, _ in facts)
              + "</tr></thead><tbody><tr>" + "".join(f"<td>{html.escape(v)}</td>" for _, v in facts) + "</tr></tbody></table></div>")
    viewlink = ""  # ปุ่มดูงานอยู่หัวบทความ (ตำแหน่งเดียวกับ "ดูงาน" มุมขวาบนของหน้าเดิม)
    content = f'<div class="rich-text w-richtext ap-content">{ledger}{viewlink}{body}</div>'
    c0 = art.find('<div class="rich-text w-richtext ap-content">')
    c1 = art.find('<section class="ap-author"')
    art = art[:c0] + content + art[c1:]
    art = art.replace("https://myfolio.tanplanet.work/" + ("en/" if en else "") + "blog/dream-faculty", url)
    art = art.replace("https://myfolio.tanplanet.work/blog/dream-faculty", url)

    # ข้าง: ผลงานอื่นใน 6 หน้า · ก่อนหน้า/ถัดไป
    others = [s for s in SLUGS if s != slug]
    side = "".join(f'<li><a href="./{s}" class="ap-rank-item"><span class="ap-rank-thumb"><img src="{PROJ}/pj/covers/{s}-{lang}.webp" alt="" loading="lazy" width="112" height="63">'
                   f'<span class="ap-rank-no" aria-hidden="true">{n}</span></span><span class="ap-rank-title"><span class="ap-rank-t">{html.escape(info[lang][s][0])}</span></span></a></li>'
                   for n, s in enumerate(others, 1))
    art = re.sub(r'(<h2 id="ap-latest-h" class="ap-widget-title"><span>).*?(</span>)', rf"\g<1>{t['latest']}\2", art, count=1)
    art = re.sub(r'<ol class="ap-rank">.*?</ol>', lambda m: f'<ol class="ap-rank">{side}</ol>', art, count=1, flags=re.S)
    i = SLUGS.index(slug)
    arrow = re.search(r'<span class="ap-pn-label">(<svg.*?</svg>)', art, re.S)
    arrow = arrow.group(1) if arrow else ""
    pn = "".join(f'<a href="./{s}" class="ap-pn-item ap-pn-{k}"><span class="ap-pn-label">{arrow if k == "prev" else ""} {lab}</span><span class="ap-pn-title">{html.escape(info[lang][s][0])}</span></a>'
                 for s, k, lab in ((SLUGS[i - 1] if i else None, "prev", t["prev"]), (SLUGS[i + 1] if i + 1 < len(SLUGS) else None, "next", t["next"])) if s)
    art = re.sub(r'<nav class="ap-pn".*?</nav>', lambda m: f'<nav class="ap-pn" aria-label="{t["pn"]}">{pn}</nav>', art, count=1, flags=re.S)
    art = re.sub(r'<section class="ap-more".*?</section>', "", art, count=1, flags=re.S)  # "อ่านเพิ่มเติม: บล็อก" ไม่เกี่ยวกับหน้าผลงาน

    page = head + shell[shell.find("</head>") + 7:a0] + art + shell[a1:]
    page = page.replace('href="./article.css', 'href="/blog/article.css').replace('src="./article.js', 'src="/blog/article.js')  # เปลือกอ้างจากโฟลเดอร์ blog
    page = page.replace(' aria-current="page"', "").replace(" w--current", "")
    page = re.sub(r'(<a class="lang-switch" href=")[^"]*', rf'\g<1>{"/project/" if en else "/en/project/"}{slug}', page)
    # หน้านี้ใช้คอมโพเนนต์กลาง (ตาราง ledger ฯลฯ)
    page = page.replace("</head>", "<style>.pj-view{margin:20px 0 0}</style></head>", 1)
    if "components.css" not in page:
        page = page.replace("</head>", '<link rel="stylesheet" href="/components.css?v=12"/></head>', 1)
    # ลิงก์บทความที่ติดมากับเปลือกหน้าบล็อก (./<slug>.html) ชี้ผิดโฟลเดอร์เมื่ออยู่ใน /project/ → ชี้ /blog/<slug>
    page = re.sub(r'href="\./([a-z0-9-]+)\.html"', lambda m: f'href="{"/en" if en else ""}/blog/{m.group(1)}"' if (MF / "blog" / f"{m.group(1)}.html").exists() else m.group(0), page)
    out.write_text(page)
    return out


if __name__ == "__main__":
    info = {lang: {s: parse(source(s, lang)[0]) for s in SLUGS} for lang in ("th", "en")}
    for lang in ("th", "en"):
        for s in SLUGS:
            print("ok", build(s, lang, info).relative_to(ROOT))
