#!/usr/bin/env python3
"""โครงหน้าบทความบล็อก myfolio — fork จาก takra-site ArticleView.vue (โครง/คลาสเดียวกัน · ธีมสว่าง · สีของ myfolio)
ใช้: python3 tools/blog-article-shell.py   (รันหลัง blog-article-layout.py · รันซ้ำได้ ไฟล์ที่แปลงแล้วข้าม)

.ap-band (ป้ายหมวด · หัวข้อ · meta) → .ap-grid [ .ap-main: ปก 16:9 · .ap-row(แชร์ | เนื้อหา · ผู้เขียน · ก่อน/ถัดไป) · อ่านเพิ่มเติม ]
                                               [ .ap-side: บทความล่าสุด ] · วงแหวน % การอ่าน
ไม่เปลี่ยนข้อความในบทความ (ย้ายตำแหน่งอย่างเดียว · ตรวจท้ายสคริปต์)
"""
import datetime, html, re
from pathlib import Path

BLOG = Path(__file__).resolve().parent.parent / "tanplanet-sites/myfolio/blog"
SITE = "https://myfolio.tanplanet.work"
AVATAR = "../_ext/cdn.prod.website-files.com/608d62778637273e1880cb8d/688f5899cad39483c4e11c49_Profile_Webflow.webp"
TH = "มกราคม กุมภาพันธ์ มีนาคม เมษายน พฤษภาคม มิถุนายน กรกฎาคม สิงหาคม กันยายน ตุลาคม พฤศจิกายน ธันวาคม".split()
P = {  # ไอคอนเส้น 24px (แทน Font Awesome ของต้นทาง)
    "facebook": '<path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>',
    "x": '<path d="M4 4l16 16M20 4L4 20"/>',
    "line": '<rect x="3" y="3" width="18" height="18" rx="5"/><path d="M7.5 9.5v5h2.5M12 9.5v5M14.5 14.5v-5l3 5v-5"/>',
    "linkedin": '<path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6zM2 9h4v12H2zM4 2a2 2 0 1 1 0 4 2 2 0 0 1 0-4z"/>',
    "instagram": '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><path d="M17.5 6.5h.01"/>',
    "link": '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
    "clock": '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    "doc": '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
    "left": '<path d="M19 12H5M12 19l-7-7 7-7"/>', "right": '<path d="M5 12h14M12 5l7 7-7 7"/>',
}
SOCIAL = [("linkedin", "https://www.linkedin.com/in/natpakan/", "LinkedIn"), ("facebook", "https://www.facebook.com/tan.natpakan", "Facebook"),
          ("instagram", "https://www.instagram.com/npkant/", "Instagram")]
svg = lambda k: f'<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{P[k]}</svg>'
text = lambda s: re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", "", s))).strip()
esc = lambda s: html.escape(s, quote=True)


def block(s, start):
    """ช่วงของ <div> ที่เริ่มที่ start (นับ div ซ้อน)"""
    depth = 0
    for m in re.finditer(r"<(/?)div\b[^>]*>", s[start:]):
        depth += -1 if m.group(1) else 1
        if depth == 0:
            return start, start + m.end()


def info(p):
    s = p.read_text()
    d = datetime.datetime.strptime(re.search(r'class="blog-post-page-date">([^<]+)<', s).group(1), "%b %d, %Y")
    cat = re.search(r'<a href="([^"]+)" class="blog-post-page-category">([^<]+)</a>', s)
    img = re.search(r'<img[^>]*src="([^"]+)"', s[s.index("w-richtext"):])
    return {"slug": p.stem, "d": d, "date": f"{d.day} {TH[d.month - 1]} {d.year}", "iso": d.strftime("%Y-%m-%d"),
            "cat_href": cat.group(1), "cat": cat.group(2), "title": text(re.search(r"<h1[^>]*>(.*?)</h1>", s, re.S).group(1)),
            "mins": re.search(r'icon-min-read[^>]*/><div>(\d+)</div>', s).group(1), "thumb": img.group(1) if img else ""}


def convert(p, posts):
    s = p.read_text()
    if 'class="ap-band"' in s:
        return f"{p.name}: แปลงแล้ว ข้าม"
    me = info(p)
    a, b = block(s, s.index('<div class="container-medium-768px blog-post">'))
    old = s[a:b]

    # เนื้อหา: rich-text ทั้งก้อน · รูปแรก → ปก · คำโปรยได้เครื่องหมาย “ แบบต้นทาง
    ra, rb = block(old, old.index('<div class="rich-text w-richtext">'))
    content = old[ra:rb]
    cover = ""
    fig = re.search(r"<figure[^>]*>.*?</figure>", content, re.S)
    if fig:
        content = content.replace(fig.group(0), "", 1)
        img = re.search(r"<img[^>]*src=\"([^\"]+)\"[^>]*>", fig.group(0))
        cover = f'<figure class="ap-cover"><img src="{img.group(1)}" alt="" width="1200" height="675" fetchpriority="high" decoding="async"></figure>'
    content = content.replace('<blockquote class="ap-lead">', '<blockquote class="ap-lead"><span class="ap-quote" aria-hidden="true">&ldquo;</span>', 1)
    content = content.replace('class="rich-text w-richtext"', 'class="rich-text w-richtext ap-content"', 1)

    q = esc(f"{SITE}/blog/{me['slug']}")
    shares = [("facebook", f"https://www.facebook.com/sharer/sharer.php?u={q}", "Facebook"), ("x", f"https://twitter.com/intent/tweet?url={q}", "X"),
              ("line", f"https://social-plugins.line.me/lineit/share?url={q}", "LINE"), ("linkedin", f"https://www.linkedin.com/sharing/share-offsite/?url={q}", "LinkedIn")]
    share = ('<aside class="ap-share" aria-label="แชร์บทความ"><span class="ap-share-title">SHARE</span>' +
             "".join(f'<a href="{h}" target="_blank" rel="noopener" class="ap-share-btn" aria-label="แชร์ไป {l}">{svg(k)}</a>' for k, h, l in shares) +
             f'<button type="button" class="ap-share-btn" data-copy="{q}" aria-label="คัดลอกลิงก์">{svg("link")}</button></aside>')

    author = ('<section class="ap-author" aria-label="ผู้เขียน">'
              f'<img class="ap-author-avatar" src="{AVATAR}" alt="" width="88" height="88" loading="lazy">'
              '<div class="ap-author-body"><p class="ap-author-name">แทน · Natpakan Sirirat</p>'
              '<p class="ap-author-bio">Product Designer &amp; AI Builder — ออกแบบประสบการณ์ใช้งาน และสร้างเครื่องมือ AI ที่ใช้ได้จริง</p>'
              '<ul class="ap-author-links">' + "".join(f'<li><a href="{u}" target="_blank" rel="noopener" aria-label="{l}">{svg(k)}</a></li>' for k, u, l in SOCIAL) +
              "</ul></div></section>")

    i = [o["slug"] for o in posts].index(me["slug"])
    nxt, prv = (posts[i - 1] if i > 0 else None), (posts[i + 1] if i + 1 < len(posts) else None)
    pn = ('<nav class="ap-pn" aria-label="บทความก่อนหน้าและถัดไป">' +
          (f'<a href="./{prv["slug"]}" class="ap-pn-item ap-pn-prev"><span class="ap-pn-label">{svg("left")} ก่อนหน้า</span><span class="ap-pn-title">{esc(prv["title"])}</span></a>' if prv else '<span class="ap-pn-item" aria-hidden="true"></span>') +
          (f'<a href="./{nxt["slug"]}" class="ap-pn-item ap-pn-next"><span class="ap-pn-label">ถัดไป {svg("right")}</span><span class="ap-pn-title">{esc(nxt["title"])}</span></a>' if nxt else "") +
          "</nav>") if (prv or nxt) else ""

    others = [o for o in posts if o["slug"] != me["slug"]][:4]
    more = ('<section class="ap-more" aria-labelledby="ap-more-h"><h2 id="ap-more-h" class="ap-more-title">อ่านเพิ่มเติม: <span class="hl-word">บล็อก</span></h2><div class="ap-more-grid">' +
            "".join(f'<a href="./{o["slug"]}" class="ap-more-item"><span class="ap-more-text"><span class="ap-more-name">{esc(o["title"])}</span>'
                    f'<span class="ap-more-date">{svg("clock")}{o["date"]}</span></span>'
                    f'<span class="ap-more-thumb"><img src="{o["thumb"]}" alt="" loading="lazy" width="160" height="90"></span></a>' for o in others) +
            '</div><div class="ap-more-all"><a href="../blog" class="ap-btn-all">ดูบทความทั้งหมด</a></div></section>') if others else ""

    side = ('<aside class="ap-side"><div class="ap-side-inner"><section class="ap-widget" aria-labelledby="ap-latest-h">'
            '<h2 id="ap-latest-h" class="ap-widget-title"><span>บทความล่าสุด</span></h2><ol class="ap-rank">' + "".join(
                (f'<li><div class="ap-rank-item is-current" aria-current="page">' if o["slug"] == me["slug"] else f'<li><a href="./{o["slug"]}" class="ap-rank-item">') +
                f'<span class="ap-rank-thumb"><img src="{o["thumb"]}" alt="" loading="lazy" width="112" height="63"><span class="ap-rank-no" aria-hidden="true">{n}</span></span>'
                f'<span class="ap-rank-title">{esc(o["title"])}' + ('<span class="ap-rank-now">กำลังอ่านเรื่องนี้</span>' if o["slug"] == me["slug"] else "") + "</span>" +
                ("</div></li>" if o["slug"] == me["slug"] else "</a></li>") for n, o in enumerate(posts, 1)) + "</ol></section></div></aside>")

    band = ('<div class="ap-band"><div class="ap-container"><header class="ap-head"><div class="ap-tags">'
            f'<a href="{me["cat_href"]}" class="ap-tag">{esc(me["cat"])}</a><a href="../blog" class="ap-tag ap-tag--ghost">บทความ</a></div>'
            f'<h1 class="ap-title">{esc(me["title"])}</h1><p class="ap-meta"><span>{svg("clock")}<time datetime="{me["iso"]}">{me["date"]}</time></span>'
            f'<span>{svg("doc")}อ่าน {me["mins"]} นาที</span></p></header></div></div>')
    grid = (f'<div class="ap-container ap-grid"><div class="ap-main">{cover}<div class="ap-row">{share}<div class="ap-body">'
            f'{content}{author}{pn}</div></div>{more}</div>{side}</div>')
    ring = ('<div class="ap-progress" role="progressbar" aria-label="ความคืบหน้าการอ่าน" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100">'
            '<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="28" class="ap-progress-track"/>'
            '<circle cx="32" cy="32" r="28" class="ap-progress-bar" pathLength="100" stroke-dasharray="100" stroke-dashoffset="100"/></svg><span>0%</span></div>')

    s2 = s[:a] + f'<article class="ap">{band}{grid}{ring}</article>' + s[b:]
    s2 = s2.replace("</body>", '<script src="./article.js" defer></script></body>', 1) if "article.js" not in s2 else s2
    # ตรวจเฉพาะเนื้อความบทความ (rich-text) · แทนแท็กด้วยช่องว่าง ไม่ให้คำข้ามแท็กติดกัน
    words = lambda t: re.findall(r"[฀-๿a-zA-Z0-9]+", html.unescape(re.sub(r"<[^>]+>", " ", t)))
    ow, nw = words(old[ra:rb]), words(s2[a:])
    lost = [w for w in set(ow) if ow.count(w) > nw.count(w)]
    assert not lost, f"ข้อความหาย: {lost[:10]}"
    p.write_text(s2)
    return f"{p.name}: ok · ปก {'มี' if cover else 'ไม่มี'} · ก่อนหน้า {bool(prv)} · ถัดไป {bool(nxt)}"


if __name__ == "__main__":
    files = sorted(BLOG.glob("*.html"))
    posts = sorted((info(f) for f in files), key=lambda o: o["d"], reverse=True)
    for f in files:
        print(convert(f, posts))
