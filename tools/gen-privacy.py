#!/usr/bin/env python3
"""หน้านโยบายความเป็นส่วนตัวของ myfolio (ไทย /privacy · อังกฤษ /en/privacy) — เปลือกเดียวกับหน้าบล็อก (แบบ gen-404.py)
เนื้อหาต้องตรงกับที่เก็บจริง: ฟอร์มติดต่อ (apps/api lead · FormSubmit) · ตัวนับไม่ใช้คุกกี้ (header-autohide.js + /api/track) · ระยะเก็บ (tanplanet-cms lib/retention.ts)
ใช้: python3 tools/gen-privacy.py
"""
import re, runpy
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
g = runpy.run_path(str(ROOT / "tools/gen-myfolio-projects.py"), run_name="lib")
MF, absolutize, BASE = g["MF"], g["absolutize"], g["BASE"]
EMAIL = "natpakan.design@gmail.com"
UPDATED = ("27 พฤศจิกายน 2026", "27 November 2026")

TH = f"""<h1>นโยบายความเป็นส่วนตัว</h1>
<p class="pv-meta">อัปเดตล่าสุด {UPDATED[0]}</p>
<p>myfolio.tanplanet.work และ projects.tanplanet.work เป็นเว็บส่วนตัวของ ณัฐปคัลภ์ ศิริรัตน์ (แทน) หน้านี้บอกว่าเว็บเก็บข้อมูลอะไร ใช้ทำอะไร เก็บนานแค่ไหน และขอลบได้อย่างไร</p>
<h2>1. ฟอร์มติดต่อ</h2>
<ul><li>เก็บ: ชื่อ ช่องทางติดต่อ (อีเมลหรือเบอร์โทร) ข้อความ และหน้าที่คุณส่งมา</li>
<li>ส่งเข้าอีเมลของผมผ่านบริการ FormSubmit และเก็บสำเนาไว้ในระบบหลังบ้านของผม</li>
<li>ใช้เพื่อตอบกลับคุณเท่านั้น ไม่ขาย ไม่ส่งต่อ และไม่ส่งข่าวการตลาด</li>
<li>เก็บ 12 เดือนแล้วลบ · IP และชื่อเบราว์เซอร์ที่ส่งมาพร้อมฟอร์มเก็บ 30 วันเพื่อกันสแปม แล้วลบ</li></ul>
<h2>2. ตัวนับผู้เข้าชม</h2>
<ul><li>ไม่ใช้คุกกี้ และไม่เก็บ IP</li>
<li>ตอนเปิดหน้า เว็บส่ง: หน้าที่เปิด เว็บที่พามา (เฉพาะชื่อโดเมน) และพารามิเตอร์ UTM ถ้ามี · ระบบอ่านประเภทอุปกรณ์ เบราว์เซอร์ และระบบปฏิบัติการจากข้อมูลมาตรฐานของเบราว์เซอร์</li>
<li>นับคนไม่ซ้ำด้วยรหัสที่สร้างใหม่ทุกวัน จึงตามตัวคุณข้ามวันไม่ได้</li>
<li>ถ้าเบราว์เซอร์เปิด Do Not Track หรือ Global Privacy Control จะไม่นับเลย</li>
<li>เก็บ 13 เดือนแล้วลบ</li></ul>
<h2>3. คุกกี้และบริการภายนอก</h2>
<ul><li>เว็บนี้ไม่ใช้คุกกี้ติดตามหรือโฆษณา จึงไม่มีแถบขอความยินยอมคุกกี้</li>
<li>ฟอนต์บางส่วนโหลดจาก Google Fonts และเว็บฝากไว้ที่ Vercel และ GitHub Pages ผู้ให้บริการเหล่านี้อาจเห็น IP ตามปกติของการโหลดไฟล์ ตามนโยบายของแต่ละราย</li></ul>
<h2>4. สิทธิ์ของคุณ</h2>
<p>ตาม พ.ร.บ.คุ้มครองข้อมูลส่วนบุคคล (PDPA) คุณขอดู แก้ไข หรือลบข้อมูลที่ส่งผ่านฟอร์มติดต่อได้ ส่งอีเมลมาที่ <a href="mailto:{EMAIL}" data-channel="email">{EMAIL}</a> ผมจะตอบภายใน 30 วัน</p>"""

EN = f"""<h1>Privacy policy</h1>
<p class="pv-meta">Last updated {UPDATED[1]}</p>
<p>myfolio.tanplanet.work and projects.tanplanet.work are the personal sites of Natpakan Sirirat (Tan). This page explains what the sites collect, why, for how long, and how to ask for deletion.</p>
<h2>1. Contact form</h2>
<ul><li>Collected: your name, a way to reach you (email or phone), your message, and the page you sent it from.</li>
<li>It is sent to my email through FormSubmit, and a copy is kept in my own back office.</li>
<li>It is used only to reply to you. It is never sold, shared, or used for marketing.</li>
<li>Kept for 12 months, then deleted. The IP address and browser name sent with the form are kept for 30 days to stop spam, then deleted.</li></ul>
<h2>2. Visitor counter</h2>
<ul><li>No cookies and no IP addresses are stored.</li>
<li>When a page opens, the site sends the page path, the referring site (domain only) and UTM parameters if any. Device type, browser and operating system are read from standard browser data.</li>
<li>Unique visitors are counted with an ID that changes every day, so you cannot be followed across days.</li>
<li>If your browser sends Do Not Track or Global Privacy Control, you are not counted at all.</li>
<li>Kept for 13 months, then deleted.</li></ul>
<h2>3. Cookies and third parties</h2>
<ul><li>The sites use no tracking or advertising cookies, so there is no cookie banner.</li>
<li>Some fonts load from Google Fonts, and the sites are hosted on Vercel and GitHub Pages. These providers may see your IP address as part of serving files, under their own policies.</li></ul>
<h2>4. Your rights</h2>
<p>Under Thailand's Personal Data Protection Act (PDPA) you can ask to see, correct or delete what you sent through the contact form. Email <a href="mailto:{EMAIL}" data-channel="email">{EMAIL}</a> and I will reply within 30 days.</p>"""

CSS = (".tp-doc.pv{max-width:720px;margin:0 auto;padding:clamp(40px,8vw,96px) 24px 96px}"
       ".pv h1{margin:0;font:600 clamp(32px,4vw,44px)/1.2 var(--tp-font-display);color:var(--tp-text)}"
       ".pv .pv-meta{margin:8px 0 32px;font-size:15px;color:var(--tp-text-3)}"
       ".pv h2{margin:40px 0 12px;font-size:22px;line-height:1.35;font-weight:600}"
       ".pv ul{margin:0;padding-left:1.2em}.pv li{margin:6px 0}.pv a{color:var(--tp-text);text-decoration:underline}")

def page(lang):
    en = lang == "en"
    s = (MF / ("en/blog.html" if en else "blog.html")).read_text()
    a, b = s.find('<div class="section'), s.find("<footer")
    head, foot = absolutize(s[:a], lang), absolutize(s[b:], lang)
    url = f"{BASE}/{'en/' if en else ''}privacy"
    title = "Privacy policy · Natpakan Sirirat" if en else "นโยบายความเป็นส่วนตัว · Natpakan Sirirat"
    desc = ("What the contact form and the cookie-free visitor counter on Natpakan Sirirat's portfolio collect, how long it is kept, and how to ask for deletion."
            if en else "เว็บพอร์ตโฟลิโอของ ณัฐปคัลภ์ เก็บข้อมูลอะไรจากฟอร์มติดต่อและตัวนับผู้เข้าชมที่ไม่ใช้คุกกี้ เก็บนานแค่ไหน และขอลบข้อมูลได้อย่างไร")
    head = re.sub(r"<title>[^<]*</title>", f"<title>{title}</title>", head, count=1)
    head = re.sub(r'<link rel="(canonical|alternate)"[^>]*>', "", head)
    head = re.sub(r'<script type="application/ld\+json">.*?</script>', "", head, flags=re.S)
    head = re.sub(r'(<meta[^>]*(?:name="description"|property="og:description"|name="twitter:description")[^>]*content=")[^"]*', rf"\g<1>{desc}", head)
    head = re.sub(r'(<meta[^>]*content=")[^"]*("[^>]*(?:name="description"|property="og:description"|name="twitter:description"))', rf"\g<1>{desc}\2", head)
    head = re.sub(r'(<meta[^>]*(?:property="og:title"|name="twitter:title")[^>]*content=")[^"]*', rf"\g<1>{title}", head)
    head = re.sub(r'(<meta[^>]*content=")[^"]*("[^>]*(?:property="og:title"|name="twitter:title"))', rf"\g<1>{title}\2", head)
    head = re.sub(r'(<meta[^>]*content=")[^"]*("[^>]*property="og:url")', rf"\g<1>{url}\2", head)
    head = head.replace(' aria-current="page"', "").replace(" w--current", "")
    head = re.sub(r'(<a class="lang-switch" href=")[^"]*', rf'\g<1>{BASE}/' + ("privacy" if en else "en/privacy"), head)
    alt = (f'<link rel="canonical" href="{url}"/><link rel="alternate" hreflang="th" href="{BASE}/privacy"/>'
           f'<link rel="alternate" hreflang="en" href="{BASE}/en/privacy"/><link rel="alternate" hreflang="x-default" href="{BASE}/privacy"/>')
    ld = '<script type="application/ld+json">{"@context":"https://schema.org","@type":"WebPage","name":"%s","url":"%s","inLanguage":"%s"}</script>' % (title, url, lang)
    head = head.replace("</head>", alt + ld + "<style>" + CSS + "</style></head>", 1)
    foot = foot.replace(' aria-current="page"', "").replace(" w--current", "")
    return head + f'<main class="tp-doc pv" role="main">{EN if en else TH}</main>' + foot

if __name__ == "__main__":
    for lang, rel in (("th", "privacy.html"), ("en", "en/privacy.html")):
        (MF / rel).write_text(page(lang)); print("ok", rel)
