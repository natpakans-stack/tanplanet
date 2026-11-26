#!/usr/bin/env python3
"""หน้า case study ของ projects.tanplanet.work → เลย์เอาต์บทความของ myfolio (navbar · แถบหัว · ปก · แชร์ · sidebar · footer)
ใช้: python3 tools/case-to-article.py [--local] slug [slug …]   (ไม่ใส่ slug = ทุกหน้าที่เป็นแพทเทิร์น hero + article)
- ต้นฉบับเก็บที่ _case-src/<slug>.html (Jekyll ไม่เผยแพร่โฟลเดอร์ขึ้นต้น _) · รันครั้งแรกคัดลอกให้ · รันซ้ำอ่านจากที่นี่เสมอ
  → แก้เนื้อหา case study ที่ _case-src แล้วรันใหม่
- CSS ของหน้าเดิมถูกจำกัดให้อยู่ใน .cs (กล่องเนื้อหา) — ไม่ชน navbar/footer ของ myfolio
- หัวข้อ/ป้าย/วันที่/สีปก มาจากการ์ดใน index.html (#projectsGrid)
"""
import html
import posixpath
import re
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MF = ROOT / "tanplanet-sites/myfolio"
SRC = ROOT / "_case-src"
PROJ = "https://projects.tanplanet.work"
BASE = "http://localhost:3001" if "--local" in sys.argv else "https://myfolio.tanplanet.work"
TH_MONTHS = "มกราคม กุมภาพันธ์ มีนาคม เมษายน พฤษภาคม มิถุนายน กรกฎาคม สิงหาคม กันยายน ตุลาคม พฤศจิกายน ธันวาคม".split()
# คลาสที่หน้าตามาจาก common/components.css เท่านั้น (กฎเดิมของหน้าที่แตะคลาสพวกนี้ถูกตัดทิ้ง)
CANON = {"section-intro", "eyebrow", "divider", "shot", "shot-narrow", "shot-phone", "shot-pair", "quote-block", "learning-card",
         "pain-grid", "pain-card", "solution-grid", "solution-card", "module-grid", "module-card", "partner-grid", "partner-card",
         "hack-grid", "hack-card", "highlight", "flow-grid", "flow-step", "step-num", "metrics", "metric-card", "plain",
         "ledger", "ledger-wrap", "pick", "chip", "chips", "stack-icon", "stack-icons", "legend",
         "arch-diagram", "arch-layers", "arch-layer", "arch-sub", "arch-arrow"}
CANON_RE = re.compile(r"\.(" + "|".join(sorted(CANON, key=len, reverse=True)) + r")(?![\w-])")
CAT = {"web-app": "Web App", "automation": "Automation", "design-thinking": "Design Thinking", "tooling": "Tooling", "content": "Content"}  # ป้ายสั้นชุดเดียวกับตัวกรองหน้าผลงาน
CARD_RE = re.compile(r'<a\s(?=[^>]*class="card\b)[^>]*>.*?</a>', re.S)


# ---------- CSS: จำกัดขอบเขตกฎทั้งหมดไว้ใน .cs ----------
def scope_css(css, scope=".cs"):
    css = re.sub(r"/\*.*?\*/", "", css, flags=re.S)   # คอมเมนต์ก่อน @media ทำให้หัวกฎเพี้ยน
    out, i, n = [], 0, len(css)
    while i < n:
        j = css.find("{", i)
        if j < 0:
            out.append(css[i:]); break
        head = css[i:j].strip()
        depth, k = 1, j + 1
        while k < n and depth:
            depth += {"{": 1, "}": -1}.get(css[k], 0); k += 1
        inner = css[j + 1:k - 1]
        if head.startswith("@media") or head.startswith("@supports") or head.startswith("@container"):
            out.append(f"{head}{{{scope_css(inner, scope)}}}")
        elif head.startswith("@"):
            out.append(f"{head}{{{inner}}}")                   # keyframes / font-face / page
        else:
            sels = []
            for sel in re.split(r",(?![^()]*\))", head):
                sel = sel.strip()
                if not sel or CANON_RE.search(sel):
                    continue
                m = re.match(r"^(?:html|:root)?\s*(?:body)?(?=$|[\s.:#\[>~+])", sel)
                rest = sel[m.end():].strip() if m and m.end() else None
                if rest is not None:
                    sels.append(f"{scope}{(' ' + rest) if rest and not rest[0] in '.:#[' else rest}")
                else:
                    sels.append(f"{scope} {sel}")
            if sels:
                out.append(f"{', '.join(sels)}{{{inner}}}")
        i = k
    return "\n".join(out)


def css_urls(css, slug, en, R):
    """หน้า /en/<slug>/: url(img/..) ใน CSS ของหน้าต้องชี้กลับโฟลเดอร์ของงาน"""
    if not en:
        return css
    return re.sub(r"url\((['\"]?)(?!https?:|data:|/|#|\.\./)", lambda m: f"url({m.group(1)}{R}{slug}/", css)


def absolutize(s, from_dir):
    def fix(m):
        attr, url = m.group(1), m.group(2)
        if re.match(r"(https?:|//|#|mailto:|data:|tel:|javascript:)", url):
            return m.group(0)
        path = url if url.startswith("/") else "/" + from_dir + re.sub(r"^(\./)+", "", url)
        if not url.startswith("/"):
            path = posixpath.normpath(path) + ("/" if url.endswith("/") else "")
        if path.split("?")[0].endswith(".html"):
            path = re.sub(r"(/index)?\.html", lambda q: "/" if q.group(1) else "", path, count=1)
        return f'{attr}="{BASE}{path}"'
    return re.sub(r'\b(href|src)="([^"]*)"', fix, s)


def card_index():
    out = []
    for c in CARD_RE.findall((ROOT / "index.html").read_text()):
        href = re.search(r'href="([^"]+)"', c).group(1).strip("/").split("/")[0]
        g = lambda rx: (re.search(rx, c, re.S) or [None, ""])[1]
        out.append(dict(slug=href, color=g(r'class="card card--(\w+)'), added=g(r'data-added="([^"]+)"'),
                        cat=g(r'data-category="([^"]+)"'),
                        type=html.unescape(re.sub("<[^>]+>", "", g(r'class="card-type">(.*?)</div>'))).strip(),
                        title=html.unescape(re.sub("<[^>]+>", "", g(r"<h3>(.*?)</h3>"))).strip(),
                        icon=g(r'<span class="icon">(.*?)</span>\s*</div>')))
    return out


class _Blk:
    def __init__(self, t): self.t = t
    def group(self, _=0): return self.t


def div_block(s, start):
    """ตัด <div …> จนถึง </div> ที่ปิดคู่กันจริง (นับ div ซ้อน)"""
    i = s.find(start)
    if i < 0:
        return None
    depth = 0
    for m in re.finditer(r"<div\b|</div>", s[i:]):
        depth += 1 if m.group(0) == "<div" else -1
        if depth == 0:
            return _Blk(s[i:i + m.end()])
    return None


def cover_html(slug, card, lang="th", R="../"):
    if (ROOT / f"pj/covers/{slug}-{lang}.webp").exists():
        return f'<figure class="ap-cover"><img src="{R}pj/covers/{slug}-{lang}.webp" alt="" width="1600" height="900" fetchpriority="high" decoding="async"></figure>'
    return f'<figure class="ap-cover cs-cover card--{card["color"]}">{card["icon"]}</figure>'


def thumb_html(c, n, lang="th", R="../"):
    if (ROOT / f"pj/covers/{c['slug']}-{lang}.webp").exists():
        return f'<span class="ap-rank-thumb"><img src="{R}pj/covers/{c["slug"]}-{lang}.webp" alt="" loading="lazy" width="112" height="63"><span class="ap-rank-no" aria-hidden="true">{n}</span></span>'
    return f'<span class="ap-rank-thumb cs-thumb card--{c["color"]}">{c["icon"]}<span class="ap-rank-no" aria-hidden="true">{n}</span></span>'


EN_MONTHS = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split()
UI = {"th": dict(ghost="ผลงาน", prev="← ผลงานก่อนหน้า", next="ผลงานถัดไป →", pn="ผลงานก่อนหน้าและถัดไป", latest="ผลงานล่าสุด", read="อ่าน {} นาที"),
      "en": dict(ghost="Projects", prev="← Previous project", next="Next project →", pn="Previous and next project", latest="Latest projects", read="{} min read")}


def en_title(slug, fallback):
    f = SRC / "en" / f"{slug}.html"
    if f.exists():
        m = re.search(r'<header class="hero">.*?<h1>(.*?)</h1>', f.read_text(), re.S)
        if m:
            return html.unescape(re.sub("<[^>]+>", "", re.split(r"<br\s*/?>", m.group(1))[0])).strip()
    return fallback


def th_date(d, lang="th"):
    y, m, dd = d.split("-")
    return f"{int(dd)} {TH_MONTHS[int(m) - 1]} {y}" if lang == "th" else f"{EN_MONTHS[int(m) - 1]} {int(dd)}, {y}"


def build(slug, cards, lang="th"):
    en = lang == "en"
    R = "../../" if en else "../"                                     # ทางกลับรากของ projects
    page = ROOT / ("en/" if en else "") / slug / "index.html"
    src = SRC / ("en/" if en else "") / f"{slug}.html"
    if en and not src.exists():
        return None                                                    # ยังไม่มีฉบับแปล
    if not src.exists():
        SRC.mkdir(exist_ok=True); shutil.copy(page, src)
    page.parent.mkdir(parents=True, exist_ok=True)
    has_en = (SRC / "en" / f"{slug}.html").exists()
    T = UI[lang]
    s = src.read_text()
    card = next((c for c in cards if c["slug"] == slug), None)
    assert card, f"{slug}: ไม่มีการ์ดใน index.html"
    hero = re.search(r'<header class="hero">(.*?)</header>', s, re.S).group(1)
    h1 = re.search(r"<h1>(.*?)</h1>", hero, re.S).group(1)
    closing = div_block(s, '<div class="closing"')
    # หัวหน้า = ชื่อ + คำอธิบายจากกล่องสรุปท้ายหน้าเดิม (สั้นกว่า hero) · ไม่มีก็ใช้ของ hero
    c_h2 = re.search(r"<h2>(.*?)</h2>", closing.group(0), re.S) if closing else None
    c_p = re.search(r"<p>(.*?)</p>", closing.group(0), re.S) if closing else None
    title_html = html.escape(en_title(slug, card["title"]) if en else re.split(r"\s+[—–]\s+", card["title"])[0])   # ชื่องานจากการ์ด (ทุกหน้าแบบเดียวกัน)
    sub = c_p or re.search(r'<span class="accent">(.*?)</span>', h1, re.S)
    lead = re.search(r"<p>(.*?)</p>", hero, re.S)
    tags = re.findall(r'<span class="hero-tag">(.*?)</span>', hero)
    body = re.search(r"<article>(.*?)</article>", s, re.S).group(1)
    after = s[s.find("</article>") + 10:s.rfind("</body>")]
    scripts = "".join(m for m in re.findall(r"<script\b(?![^>]*closing\.js)[^>]*>.*?</script>", after, re.S))
    # สคริปต์ inline ของหน้าเดิมบางตัวอ้าง element ใน hero ที่ไม่มีแล้ว (เช่น ดาวพื้นหลัง) → ห่อ try ไม่ให้ error
    scripts = re.sub(r"<script>(.*?)</script>", lambda m: f"<script>try{{{m.group(1)}}}catch(e){{}}</script>", scripts, flags=re.S)
    page_css = "\n".join(re.findall(r"<style[^>]*>(.*?)</style>", s, re.S))
    shell = (MF / ("en/" if en else "") / "blog/dream-faculty.html").read_text()
    head_meta = s[s.find("<head>") + 6:s.find("</head>")]
    if (ROOT / f"pj/covers/{slug}-{lang}-og.jpg").exists():
        og = f"{PROJ}/pj/covers/{slug}-{lang}-og.jpg"
        head_meta = re.sub(r'<meta\s[^>]*(?:og:image|twitter:image)[^>]*>\s*', "", head_meta)
        head_meta += (f'<meta property="og:image" content="{og}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">'
                      f'<meta name="twitter:card" content="summary_large_image"><meta name="twitter:image" content="{og}">')
    head_meta = re.sub(r'<link[^>]*rel="(?:icon|shortcut icon|apple-touch-icon)"[^>]*>\s*', "", head_meta)  # favicon เดียวกับ myfolio
    head_meta += "".join(absolutize(l, "blog/") for l in re.findall(r'<link[^>]*rel="(?:icon|shortcut icon|apple-touch-icon)"[^>]*>', shell[:shell.find("</head>")]))
    head_meta = re.sub(r"<style.*?</style>|<link rel=\"stylesheet\" href=\"\.\./common/closing\.css\">", "", head_meta, flags=re.S)
    # ภาษา: canonical · hreflang · og:locale
    th_url, en_url = f"{PROJ}/{slug}/", f"{PROJ}/en/{slug}/"
    head_meta = re.sub(r'<link rel="(?:canonical|alternate)"[^>]*>\s*', "", head_meta)
    head_meta = re.sub(r'<meta property="og:(?:url|locale)"[^>]*>\s*', "", head_meta)
    head_meta += f'<link rel="canonical" href="{en_url if en else th_url}"><meta property="og:url" content="{en_url if en else th_url}"><meta property="og:locale" content="{"en_US" if en else "th_TH"}">'
    if has_en:
        head_meta += f'<link rel="alternate" hreflang="th" href="{th_url}"><link rel="alternate" hreflang="en" href="{en_url}"><link rel="alternate" hreflang="x-default" href="{th_url}">'

    # เปลือก myfolio จากหน้าบทความ (navbar · footer · ชิ้นส่วนแชร์/ผู้เขียน/วงแหวน)
    top = shell[shell.find("<body"):shell.find('<article class="ap"')]
    foot = shell[shell.find("<footer"):]
    share = re.search(r'<aside class="ap-share".*?</aside>', shell, re.S).group(0)
    author = re.search(r'<section class="ap-author".*?</section>', shell, re.S).group(0)
    progress = re.search(r'<div class="ap-progress".*?</div>', shell, re.S).group(0)
    author = absolutize(author, "blog/")                             # รูปโปรไฟล์ชี้ myfolio
    ic = re.findall(r'<svg class="ic".*?</svg>', re.search(r'<p class="ap-meta">.*?</p>', shell, re.S).group(0), re.S)
    url = f"{PROJ}/{'en/' if en else ''}{slug}/"
    share = re.sub(r"https://myfolio\.tanplanet\.work/blog/dream-faculty", url, share)
    shell_links = re.findall(r'<link[^>]+(?:tokens\.css|webflow\.shared|fonts\.googleapis\.com/css2)[^>]*>', shell[:shell.find("</head>")])

    i = cards.index(card)
    latest = [c for c in cards if c is not card][:5]
    side = "".join(
        f'<li><a href="../{c["slug"]}/" class="ap-rank-item">{thumb_html(c, n, lang, R)}<span class="ap-rank-title"><span class="ap-rank-t">{html.escape(en_title(c["slug"], c["title"]) if en else c["title"])}</span></span></a></li>'
        for n, c in enumerate(latest, 1))
    prev_c, next_c = (cards[i - 1] if i else None), (cards[i + 1] if i + 1 < len(cards) else None)
    pn = "".join(
        f'<a href="../{c["slug"]}/" class="ap-pn-item ap-pn-{k}"><span class="ap-pn-label">{lab}</span><span class="ap-pn-title">{html.escape(en_title(c["slug"], c["title"]) if en else c["title"])}</span></a>'
        for c, k, lab in ((prev_c, "prev", T["prev"]), (next_c, "next", T["next"])) if c)
    words = len(re.sub(r"<[^>]+>", " ", body).split())
    minutes = max(1, round(words / 200))
    tag_row = "".join(f'<span class="cs-chip">{t}</span>' for t in tags)

    article = f'''<article class="ap cs-page" role="main"><div class="ap-band"><div class="ap-container"><header class="ap-head">
<div class="ap-tags"><a href="{PROJ}/{'en/' if en else ''}" class="ap-tag">{CAT.get(card["cat"], "Project")}</a><span class="ap-tag ap-tag--ghost">{T["ghost"]}</span></div>
<h1 class="ap-title">{title_html}</h1>{f'<p class="cs-sub">{sub.group(1)}</p>' if sub else ""}
<p class="ap-meta"><span>{ic[0]}<time datetime="{card["added"]}">{th_date(card["added"], lang)}</time></span><span>{ic[1]}{T["read"].format(minutes)}</span></p>
</header></div></div>
<div class="ap-container ap-grid"><div class="ap-main">
{cover_html(slug, card, lang, R)}
<div class="ap-row">{share}<div class="ap-body"><div class="cs">
{f'<p class="cs-lead">{lead.group(1)}</p>' if lead else ""}<div class="cs-chips">{tag_row}</div>
<article>{body}</article>
</div>{author}<nav class="ap-pn" aria-label="{T["pn"]}">{pn}</nav></div></div></div>
<aside class="ap-side"><div class="ap-side-inner"><section class="ap-widget"><h2 class="ap-widget-title"><span>{T["latest"]}</span></h2><ol class="ap-rank">{side}</ol></section></div></aside>
</div>{progress}</article>'''

    html_tag = re.search(r"<html[^>]*>", shell).group(0)            # data-wf-page/site — Webflow IX ต้องใช้ ไม่งั้น page-wrapper ค้าง opacity 0
    html_tag = re.sub(r'\s(data-wf-collection|data-wf-item-slug)="[^"]*"', "", html_tag)
    extras = re.sub(r"<script\b.*?</script>", "", after, flags=re.S)  # ไลท์บ็อกซ์ · ปุ่มกลับขึ้นบน ฯลฯ ที่อยู่นอก <article>
    if closing:
        extras = extras.replace(closing.group(0), "")
    extras = re.sub(r"<footer\b.*?</footer>", "", extras, flags=re.S)
    extras = re.sub(r'<a\s[^>]*class="back-nav".*?</a>', "", extras, flags=re.S)  # navbar ใหม่มีเมนู "ผลงาน" แล้ว
    out = ("<!DOCTYPE html>" + html_tag + "<head>" + head_meta + "".join(absolutize(l, "") for l in shell_links)
           + f'<link rel="stylesheet" href="{BASE}/blog/article.css"/><link rel="stylesheet" href="../common/closing.css">'
           + ''
           + f"<style>{css_urls(scope_css(page_css), slug, en, R)}</style>"
           + '<link rel="stylesheet" href="../common/components.css?v=7"/><link rel="stylesheet" href="../pj/case.css?v=12"/></head>'  # หลัง CSS ของหน้า → ของกลางชนะเสมอ
           + absolutize(top, "blog/") + article + absolutize(foot, "blog/").replace("</body>", f'<div class="cs cs-extras">{extras}</div>' + scripts + "</body>", 1))
    out = re.sub(r'<script src="[^"]*/blog/article\.js"', f'<script src="{BASE}/blog/article.js"', out)
    # ปุ่มสลับภาษา → หน้านี้อีกภาษา (ไม่มีฉบับอังกฤษ = หน้ารวมภาษาอังกฤษ)
    other = th_url if en else (en_url if has_en else f"{PROJ}/en/")
    out = re.sub(r'(<a class="lang-switch" href=")[^"]*', rf"\g<1>{other}", out)
    if en:  # ไฟล์ของหน้าอยู่ใน /<slug>/ · ของกลางอยู่ราก → ปรับ path ให้ถูกจาก /en/<slug>/
        out = re.sub(r'\b(href|src|poster)="\.\./(common|pj)/', rf'\1="{R}\2/', out)
        def fix(m):
            attr, u = m.group(1), m.group(2)
            if re.match(r"(https?:|//|#|mailto:|data:|tel:|javascript:|/|\.\./)", u):
                return m.group(0)
            return f'{attr}="{R}{slug}/{u}"'
        out = re.sub(r'\b(src|poster|href)="([^"]*)"', fix, out)
    page.write_text(out)
    return slug


if __name__ == "__main__":
    cards = card_index()
    slugs = [a for a in sys.argv[1:] if not a.startswith("--")]
    if not slugs:
        slugs = [c["slug"] for c in cards if (ROOT / c["slug"] / "index.html").exists()
                 and ('<header class="hero"' in ((SRC / f"{c['slug']}.html").read_text() if (SRC / f"{c['slug']}.html").exists()
                                                  else (ROOT / c["slug"] / "index.html").read_text()))]
    for sl in slugs:
        print("ok", build(sl, cards), "en" if build(sl, cards, "en") else "")
