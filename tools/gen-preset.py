#!/usr/bin/env python3
"""หน้า preset = แคตตาล็อกคอมโพเนนต์ชุดเดียวของ tanplanet (common/components.css + เปลือกบทความ article.css)
ใช้: python3 tools/gen-preset.py [--local]   → preset/index.html บน projects (noindex)
เพิ่มคอมโพเนนต์ใหม่: ใส่ CSS ใน common/components.css + ตัวอย่างใน ITEMS ด้านล่าง แล้วรันใหม่
"""
import re
import runpy
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
cta = runpy.run_path(str(ROOT / "tools/case-to-article.py"), run_name="lib")
BASE, absolutize, MF = cta["BASE"], cta["absolutize"], cta["MF"]

ICO = '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 8v4l2 2"/></svg>'
CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="m5 12 5 5L20 7"/></svg>'

# (ชื่อ, คลาส, ใช้เมื่อ, ตัวอย่าง HTML)
ITEMS = [
    ("หัวช่วง", "section.section-intro > .eyebrow + h2 + p", "เปิดแต่ละช่วงของเรื่อง (Empathize · Define · Ideate …)",
     '<section class="section-intro"><span class="eyebrow">Empathize · Define</span><h2>หัวข้อของช่วงนี้</h2><p>คำโปรยสั้น ๆ หนึ่งถึงสองบรรทัด บอกว่าช่วงนี้จะเล่าอะไร</p></section>'),
    ("ย่อหน้า + โค้ดในบรรทัด", "p · code", "เนื้อหาปกติ",
     '<p>ข้อความเนื้อหาปกติ มี <b>ตัวหนา</b> และ <code>inline code</code> ได้ ลิงก์ <a href="#">แบบนี้</a></p>'),
    ("ภาพประกอบ", "figure.shot (+ .shot-narrow · .shot-phone · .shot-pair)", "ภาพหน้าจอ/ภาพจริง · คลิกขยายได้",
     '<figure class="shot"><img src="../android-box-portfolio/img/00-before-home.jpg" alt="" loading="lazy"><figcaption>หน้าโฮมตอนรับเครื่องมา &mdash; แอปที่ใช้จริงมีไม่กี่ตัวจากทั้งหมด</figcaption></figure>'),
    ("คำพูดผู้ใช้", "div.quote-block > p + .author", "ยกคำพูดจริงของผู้ใช้/โจทย์",
     '<div class="quote-block"><p>อยากดูว่าคลังว่างหน้าตาเป็นยังไง ต้องลบของทิ้งเองทุกครั้ง</p><div class="author">— โจทย์ตั้งต้น</div></div>'),
    ("กล่องบทเรียน / หมายเหตุ", "div.learning-card (+ .note · .ok)", "สรุปบทเรียน ข้อควรรู้ ข้อตกลง",
     '<div class="learning-card"><p><strong>บทเรียน:</strong> เวลาหน้าเว็บค้าง ให้เปิดแท็บ Network ก่อนเปิดโค้ด</p></div>'
     '<div class="learning-card note"><p><strong>หมายเหตุ:</strong> แบบ .note พื้นขาว ใช้กับข้อความเสริม</p></div>'
     '<div class="learning-card ok"><p><strong>ผลลัพธ์:</strong> แบบ .ok มีเส้นซ้าย ใช้สรุปสิ่งที่ได้</p></div>'),
    ("การ์ดในกริด", "div.pain-grid > .pain-card (เหมือนกันทั้ง solution · module · partner)", "ปัญหา ทางแก้ โมดูล 2–4 ข้อ",
     '<div class="pain-grid">' + "".join(f'<div class="pain-card">{ICO}<h3>หัวข้อการ์ด {n}</h3><p>คำอธิบายสั้น ๆ ไม่เกินสองบรรทัด</p></div>' for n in (1, 2)) + '</div>'),
    ("ปัญหาที่เจอ + วิธีแก้", "div.hack-grid > .hack-card > h3 + p + .highlight", "ช่วง Test & Iterate",
     '<div class="hack-grid"><div class="hack-card"><h3><span>รวม PDF แล้วตัวหนังสือไม่คม</span></h3><p>อาการที่เจอ เล่าเป็นประโยคเดียว</p><div class="highlight"><strong>แก้:</strong> สิ่งที่ทำ และเหตุผลสั้น ๆ</div></div>'
     '<div class="hack-card"><h3><span>ตัวหนังสือไทยเป็นกล่องสี่เหลี่ยม</span></h3><p>อาการที่เจอ</p><div class="highlight"><strong>แก้:</strong> ฝังฟอนต์ลงในไฟล์</div></div></div>'),
    ("ขั้นตอน", "div.flow-grid > .flow-step > .step-num + h4 + p", "ลำดับการทำงาน 3–8 ขั้น",
     '<div class="flow-grid">' + "".join(f'<div class="flow-step"><div class="step-num">0{n}</div><h4>{t}</h4><p>คำอธิบายขั้นนี้</p></div>' for n, t in ((1, "สำรองทุกอย่าง"), (2, "ปิดตัวติดตั้งก่อน"), (3, "ยืนยันว่ามันหยุดจริง"))) + '</div>'),
    ("ตัวเลขผลลัพธ์", "div.metrics > .metric-card > .num + .label", "ผลที่วัดได้ · คอลัมน์ปรับตามจำนวน (4 → 2×2 · 6 → 3×2)",
     '<div class="metrics">' + "".join(f'<div class="metric-card"><div class="num">{a}</div><div class="label">{b}</div></div>' for a, b in (("3", "แอปบนหน้าโฮม จากเดิม 12"), ("23", "แอปที่ถอนออก"), ("2.2×", "RAM ว่างเพิ่มขึ้น"), ("0", "การเชื่อมต่อแปลกปลอม"))) + '</div>'),
    ("รายการมีไอคอน", "ul.plain > li > svg + span", "เหตุผล/จุดเด่น 3–5 ข้อ",
     '<ul class="plain">' + "".join(f'<li>{ICO}<span><b>{t}</b> คำอธิบายต่อท้ายในบรรทัดเดียวกัน</span></li>' for t in ("เส้นทางสั้นกว่า", "ออกแบบตามข้อจำกัด", "อยู่ในเครือข่ายบ้าน")) + '</ul>'),
    ("ตารางเปรียบเทียบทางเลือก", "div.ledger-wrap > table.ledger · tr[data-picked] + .pick", "เทียบทางเลือกแล้วบอกว่าเลือกอันไหน",
     '<div class="ledger-wrap"><table class="ledger"><thead><tr><th>ทางเลือก</th><th>เห็นอะไร</th><th>ต้นทุน</th><th>เหตุที่ตก / รับ</th></tr></thead><tbody>'
     '<tr><td>ทางเลือก A</td><td>ทีละชิ้น</td><td>สูง</td><td>เหตุผลที่ไม่เลือก</td></tr>'
     f'<tr data-picked><td>ทางเลือก B<span class="pick">{CHECK} เลือก</span></td><td>หน้าจริง</td><td>ต่ำ</td><td>เหตุผลที่เลือก</td></tr></tbody></table></div>'),
    ("ป้าย", ".chips > .chip (+ .own) · .stack-icons > .stack-icon", "เทคโนโลยี/หมวด · ทึบ = ของเราเอง · ขอบ = ของภายนอก",
     '<div class="chips"><span class="chip own">เขียนเอง</span><span class="chip">แอปภายนอก</span><span class="chip">Next.js</span><span class="chip">Claude Code</span></div>'),
    ("แผนผังชั้น", "div.arch-diagram > .arch-layers > .arch-layer (ข้อความ + .arch-sub > span) · .arch-arrow", "สถาปัตยกรรม/ลำดับชั้นของระบบ 2–5 ชั้น",
     '<div class="arch-diagram"><div class="arch-layers">'
     '<div class="arch-layer">ชั้นแรก — สิ่งที่ผู้ใช้เห็น<div class="arch-sub"><span>หน้าเว็บ</span><span>LINE Bot</span></div></div><div class="arch-arrow">↕</div>'
     '<div class="arch-layer">ชั้นกลาง — ตัวประมวลผล<div class="arch-sub"><span>API</span><span>คิวงาน</span></div></div><div class="arch-arrow">↕</div>'
     '<div class="arch-layer">ชั้นล่าง — ที่เก็บข้อมูล<div class="arch-sub"><span>Postgres</span><span>ไฟล์บน S3</span></div></div></div></div>'),
    ("คำถามที่พบบ่อย", "div.faq > details.faq-item > summary + p.faq-a · คู่กับ JSON-LD FAQPage", "ตอบคำถามสั้น ตรงประเด็น (AEO) · หน้า About",
     '<div class="faq"><details class="faq-item" name="pv-faq" open><summary>คำถามสั้น ๆ ที่คนค้นหาจริง</summary><p class="faq-a">คำตอบสั้น ชัด ตรงประเด็นในย่อหน้าเดียว</p></details>'
     '<details class="faq-item" name="pv-faq"><summary>คำถามข้อที่สอง</summary><p class="faq-a">คำตอบข้อที่สอง</p></details></div>'),
    ("เส้นคั่น", "hr.divider", "คั่นภายในช่วงเดียวกัน (ระหว่างช่วงใช้ section-intro แทน)", '<hr class="divider">'),
]

ARTICLE_ITEMS = [
    ("คำโปรยหัวบทความ", "blockquote.ap-lead", "บรรทัดแรกของบทความบล็อก",
     '<blockquote class="ap-lead"><span class="ap-quote" aria-hidden="true">&ldquo;</span>ประโยคเปิดเรื่องที่ดึงคนอ่านเข้ามา</blockquote>'),
    ("หัวข้อ + รายการ", "h2 · h3 · ul · ol", "โครงเนื้อหาบทความ",
     '<h2>หัวข้อระดับ 2</h2><p>ย่อหน้าใต้หัวข้อ</p><h3>หัวข้อระดับ 3</h3><ul><li>รายการแบบจุด</li><li>ข้อที่สอง</li></ul><ol><li>รายการแบบเลข</li><li>ข้อที่สอง</li></ol>'),
]


def contrast(a, b="#ffffff"):
    def L(h):
        h = h.lstrip("#"); c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
        c = [x / 12.92 if x <= 0.03928 else ((x + 0.055) / 1.055) ** 2.4 for x in c]
        return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
    la, lb = sorted([L(a), L(b)], reverse=True)
    return (la + 0.05) / (lb + 0.05)


def brand_html():
    items = [("พระอาทิตย์", "ทุกวันคือหน้าใหม่ เริ่มด้วยการทบทวนว่าเมื่อวานได้เรียนรู้อะไร"),
             ("ภูเขา", "ประสบการณ์ที่ค่อย ๆ สะสม จนเป็นฐานที่มั่นคงของงาน"),
             ("สายน้ำ", "ความทรงจำที่ไหลต่อ ส่งต่อให้คนอื่นได้ใช้และต่อยอด")]
    li = "".join(f"<li><b>{a}</b><span>{b}</span></li>" for a, b in items)
    return ('<section class="pv-item" id="f-brand"><header class="pv-head"><span class="pv-no">A</span><h2 class="pv-name">แบรนด์ tanplanet</h2>'
            '<p class="pv-meta"><code>logo-header.png</code><br>tanplanet = ไดอารี่สะสมประสบการณ์และความทรงจำ แชร์ให้คนอื่น และทบทวนตัวเองทุกวัน</p></header>'
            f'<div class="pv-demo pv-brand"><img src="https://myfolio.tanplanet.work/logo-header.png" alt="tanplanet logo" width="200" height="100"><ul>{li}</ul>'
            '<p class="pv-brand-rule">โลโก้สีดำบนพื้นขาวเท่านั้น · ไม่ใส่สี เงา หรือกรอบ · เล่าเรื่องแบรนด์ด้วย 3 ความหมายนี้ชุดเดียว</p></div></section>')


def foundations():
    """สี · ตัวอักษร · ไอคอน — อ่านจากของจริง (tokens.css · การ์ดผลงาน) ไม่พิมพ์ค่าซ้ำ"""
    tok = (ROOT / "common/tokens.css").read_text()
    front = tok[tok.find(":root, [data-theme"):tok.find('[data-theme="back"] {')]
    cols = re.findall(r"--(tp-[\w-]+):\s*(#[0-9a-fA-F]{6})\s*;[ \t]*(?:/\*\s*(.*?)\s*\*/)?", front)
    sw = "".join(
        f'<div class="pv-sw"><span class="pv-chip" style="background:{v}"></span><b>--{n}</b><code>{v}</code>'
        f'<small>{note or ""}{(" · " if note else "") + f"{contrast(v):.1f}:1 บนขาว" if re.search(r"text|brand|hero", n) and "4.5:1" not in (note or "") else ""}</small></div>' for n, v, note in cols)
    type_rows = [("หัวเพจ", "48 / 1.15 · 700", "Google Sans", 'style="font:700 48px/1.15 var(--tp-font-display)"', "ผลงาน"),
                 ("หัวช่วง h2", "28 / 1.3 · 600", "Google Sans", 'style="font:600 28px/1.3 var(--tp-font-display)"', "หัวข้อของช่วงนี้"),
                 ("หัวการ์ด h3", "18 / 1.45 · 600", "Google Sans", 'style="font:600 18px/1.45 var(--tp-font-display)"', "รวม PDF แล้วตัวหนังสือไม่คม"),
                 ("เนื้อหา", "17 / 1.75 · 400", "Google Sans → Inter", 'style="font:400 17px/1.75 var(--tp-font);color:var(--tp-text-2)"', "ข้อความเนื้อหาปกติ อ่านสบายทั้งไทยและ English"),
                 ("รอง / คำบรรยาย", "14 / 1.6 · 400", "Google Sans", 'style="font:400 14px/1.6 var(--tp-font);color:var(--tp-text-3)"', "คำบรรยายใต้ภาพ บอกว่าดูอะไรในภาพ"),
                 ("ป้ายเล็ก (eyebrow)", "12 · 600 · ตัวพิมพ์ใหญ่ ห่าง .08em", "Google Sans", 'style="font:600 12px/1.4 var(--tp-font);letter-spacing:.08em;text-transform:uppercase;color:var(--tp-text-3)"', "Empathize · Define")]
    ty = "".join(f'<div class="pv-ty"><div class="pv-ty-meta"><b>{a}</b><span>{b}</span><span>{c}</span></div><p {st}>{ex}</p></div>' for a, b, c, st, ex in type_rows)
    icons, seen = [], set()
    for card in re.findall(r'<a\s(?=[^>]*class="card\b)[^>]*>.*?</a>', (ROOT / "index.html").read_text(), re.S):
        m = re.search(r'<span class="icon">(<svg.*?</svg>)', card, re.S)
        t = re.search(r'class="card-type">(.*?)</div>', card, re.S)
        if m and m.group(1) not in seen:
            seen.add(m.group(1)); icons.append((m.group(1), re.sub("<[^>]+>", "", t.group(1)).strip() if t else ""))
    ic = "".join(f'<figure class="pv-ic">{svg}<figcaption>{lab}</figcaption></figure>' for svg, lab in icons)
    return (brand_html() + f'<section class="pv-item" id="f-color"><header class="pv-head"><span class="pv-no">B</span><h2 class="pv-name">สี</h2><p class="pv-meta"><code>common/tokens.css</code><br>หน้าบ้านขาวดำ · ข้อความทุกสี ≥ 4.5:1 บนขาว (WCAG AA) · สีอื่นใช้เฉพาะคำเน้นใน hero</p></header><div class="pv-demo pv-swatches">{sw}</div></section>'
            f'<section class="pv-item" id="f-type"><header class="pv-head"><span class="pv-no">C</span><h2 class="pv-name">ตัวอักษร</h2><p class="pv-meta"><code>--tp-font · --tp-font-display</code><br>Google Sans ทั้งไทยและอังกฤษ (น้ำหนักเส้นเท่ากันในบรรทัดเดียว) · โค้ดใช้ SF Mono</p></header><div class="pv-demo">{ty}</div></section>'
            f'<section class="pv-item" id="f-icon"><header class="pv-head"><span class="pv-no">D</span><h2 class="pv-name">ไอคอน</h2><p class="pv-meta"><code>svg viewBox 0 0 24 24 · stroke 1.4–1.8 · round</code><br>ไอคอนเส้นชุดเดียว (แนว Lucide) · สีตาม currentColor · ห้ามใช้ emoji แทนไอคอน · {len(icons)} ตัวที่ใช้อยู่</p></header><div class="pv-demo pv-icons">{ic}</div></section>')


def section(n, name, cls, when, demo):
    return (f'<section class="pv-item" id="c{n}"><header class="pv-head"><span class="pv-no">{n:02d}</span><h2 class="pv-name">{name}</h2>'
            f'<p class="pv-meta"><code>{cls}</code><br>{when}</p></header><div class="pv-demo">{demo}</div></section>')


def main():
    for lang in ("th", "en"):
        build(lang)


def build(lang):
    en = lang == "en"
    shell = (MF / ("en/" if en else "") / "blog/dream-faculty.html").read_text()
    html_tag = re.sub(r'\s(data-wf-collection|data-wf-item-slug)="[^"]*"', "", re.search(r"<html[^>]*>", shell).group(0))
    links = "".join(absolutize(l, "") for l in re.findall(r'<link[^>]+(?:tokens\.css|webflow\.shared|fonts\.googleapis\.com/css2|rel="icon"|rel="apple-touch-icon")[^>]*>', shell[:shell.find("</head>")]))
    top = absolutize(shell[shell.find("<body"):shell.find('<article class="ap"')], "blog/")
    foot = absolutize(shell[shell.find("<footer"):], "blog/")
    foot = re.sub(r'<script src="[^"]*/blog/article\.js[^"]*"[^>]*></script>', "", foot)
    n_case = len(ITEMS)
    def toc_list(items, start):
        return "".join(f'<li><a href="#c{i}"><span class="pv-tn">{i:02d}</span>{n}</a></li>' for i, (n, *_r) in enumerate(items, start))
    body = "".join(section(i, *it) for i, it in enumerate(ITEMS, 1))
    art = "".join(section(i, *it) for i, it in enumerate(ARTICLE_ITEMS, n_case + 1))
    page = f'''<!DOCTYPE html>{html_tag}<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Preset — คอมโพเนนต์ชุดเดียวของ tanplanet</title><meta name="robots" content="noindex, nofollow"><meta property="og:title" content="Preset — คอมโพเนนต์ชุดเดียวของ tanplanet"><meta property="og:image" content="https://projects.tanplanet.work/pj/covers/site-preset-th-og.jpg"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:image" content="https://projects.tanplanet.work/pj/covers/site-preset-th-og.jpg">{links}
<link rel="stylesheet" href="{BASE}/blog/article.css"/><link rel="stylesheet" href="../common/components.css?v=18"/>
<style>
.pv-page {{ max-width: var(--tp-container, 1120px); margin: 0 auto; padding: var(--tp-page-top, 100px) 24px 96px; }}
.pv-title {{ margin: 0; font-family: var(--tp-font-display); font-size: 48px; line-height: 1.15; color: var(--tp-text); }}
.pv-lead {{ max-width: 640px; margin: 12px 0 0; font-size: 17px; line-height: 1.7; color: var(--tp-text-3); }}
.pv-lead code {{ font-size: 14px; }}
.pv {{ display: grid; grid-template-columns: 220px minmax(0, 1fr); gap: 64px; margin-top: 56px; padding-top: 32px; border-top: 1px solid var(--tp-border); }}
.pv-side {{ position: sticky; top: 110px; align-self: start; }}
.pv-group {{ margin: 0 0 12px; font-size: 12px; font-weight: 600; letter-spacing: .08em; text-transform: uppercase; color: var(--tp-text-4); }}
.pv-toc {{ margin: 0 0 28px; padding: 0; list-style: none; }}
.pv-toc a {{ display: flex; gap: 12px; padding: 5px 0; font-size: 14px; line-height: 1.5; color: var(--tp-text-2); text-decoration: none; }}
.pv-toc a:hover {{ color: var(--tp-text); }}
.pv-tn {{ flex: none; width: 24px; color: var(--tp-text-4); font-variant-numeric: tabular-nums; }}
.pv-main > .pv-group {{ margin-top: 48px; }}
.pv-main > .pv-group:first-child {{ margin-top: 0; }}
.pv-item {{ padding: 28px 0; border-top: 1px solid var(--tp-border); scroll-margin-top: 100px; }}
.pv-main > .pv-group + .pv-item {{ border-top: 0; padding-top: 4px; }}
.pv-head {{ display: grid; grid-template-columns: 32px minmax(0, 1fr); align-items: baseline; margin-bottom: 16px; }}
.pv-no {{ font-weight: 600; color: var(--tp-text-4); font-variant-numeric: tabular-nums; }}
.pv-name {{ margin: 0; font-family: var(--tp-font-display); font-size: 19px; line-height: 1.4; color: var(--tp-text); }}
.pv-meta {{ grid-column: 2; margin: 6px 0 0; font-size: 14px; line-height: 1.6; color: var(--tp-text-3); }}
.pv-meta code {{ display: inline-block; margin-bottom: 4px; font-size: 12.5px; }}
.pv-demo {{ margin-left: 32px; padding: 24px; border: 1px solid var(--tp-border); border-radius: 16px; background: var(--tp-surface); }}
.pv-demo > :first-child {{ margin-top: 0 !important; }} .pv-demo > :last-child {{ margin-bottom: 0 !important; }}
.pv-brand {{ display: grid; grid-template-columns: 200px minmax(0, 1fr); gap: 32px; align-items: center; }}
.pv-brand img {{ width: 100%; height: auto; }} .pv-brand ul {{ margin: 0; padding: 0; list-style: none; }}
.pv-brand li {{ display: grid; grid-template-columns: 100px minmax(0, 1fr); gap: 12px; padding: 10px 0; border-top: 1px solid var(--tp-border); font-size: 15px; color: var(--tp-text-3); }}
.pv-brand li:first-child {{ border-top: 0; }} .pv-brand b {{ color: var(--tp-text); }}
.pv-brand-rule {{ grid-column: 1 / -1; margin: 0; font-size: 13px; color: var(--tp-text-3); }}
@media (max-width: 860px) {{ .pv-brand {{ grid-template-columns: minmax(0, 1fr); }} }}
.pv-swatches {{ display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 16px; }}
.pv-sw {{ display: flex; flex-direction: column; gap: 2px; font-size: 13px; color: var(--tp-text-3); }}
.pv-sw b {{ color: var(--tp-text); font-weight: 600; }} .pv-sw code {{ align-self: start; font-size: 12px; }} .pv-sw small {{ font-size: 12px; line-height: 1.5; }}
.pv-chip {{ height: 56px; margin-bottom: 8px; border-radius: 10px; box-shadow: inset 0 0 0 1px rgba(0,0,0,.08); }}
.pv-ty {{ display: grid; grid-template-columns: 200px minmax(0, 1fr); gap: 24px; align-items: baseline; padding: 16px 0; border-top: 1px solid var(--tp-border); }}
.pv-ty:first-child {{ border-top: 0; padding-top: 0; }} .pv-ty p {{ margin: 0; color: var(--tp-text); }}
.pv-ty-meta {{ display: flex; flex-direction: column; font-size: 13px; color: var(--tp-text-3); }} .pv-ty-meta b {{ color: var(--tp-text); font-size: 14px; }}
.pv-icons {{ display: grid; grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); gap: 12px; }}
.pv-ic {{ margin: 0; display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 16px 8px; border: 1px solid var(--tp-border); border-radius: 12px; color: var(--tp-text); }}
.pv-ic svg {{ width: 28px; height: 28px; }} .pv-ic figcaption {{ font-size: 11px; line-height: 1.4; color: var(--tp-text-3); text-align: center; }}
@media (max-width: 860px) {{ .pv-ty {{ grid-template-columns: minmax(0, 1fr); gap: 6px; }} }}
@media (max-width: 860px) {{ .pv {{ grid-template-columns: minmax(0, 1fr); gap: 24px; }} .pv-side {{ position: static; }} .pv-demo {{ margin-left: 0; padding: 16px; }} .pv-title {{ font-size: 36px; }} }}
</style></head>
{top}<main class="pv-page"><h1 class="pv-title">Preset</h1>
<p class="pv-lead">คอมโพเนนต์ชุดเดียวที่ทุกหน้าใช้ ต้นฉบับอยู่ที่ <code>common/components.css</code> ขาดอะไรให้เพิ่มที่นั่นและในหน้านี้ก่อนใช้</p>
<div class="pv"><aside class="pv-side"><p class="pv-group">พื้นฐาน</p><ol class="pv-toc"><li><a href="#f-brand"><span class="pv-tn">A</span>แบรนด์</a></li><li><a href="#f-color"><span class="pv-tn">B</span>สี</a></li><li><a href="#f-type"><span class="pv-tn">C</span>ตัวอักษร</a></li><li><a href="#f-icon"><span class="pv-tn">D</span>ไอคอน</a></li></ol>
<p class="pv-group">เนื้อหา case study</p><ol class="pv-toc">{toc_list(ITEMS, 1)}</ol>
<p class="pv-group">บทความบล็อก</p><ol class="pv-toc">{toc_list(ARTICLE_ITEMS, n_case + 1)}</ol></aside>
<div class="pv-main tp-doc"><p class="pv-group">พื้นฐาน</p>{foundations()}<p class="pv-group">เนื้อหา case study</p>{body}<p class="pv-group">บทความบล็อก</p><div class="ap"><div class="ap-content">{art}</div></div></div></div></main>
{foot}'''
    # ปุ่มสลับภาษา: /preset/ ↔ /en/preset/ (เปลือกยืมมาจากบทความ เลยต้องตั้งใหม่)
    page = re.sub(r'(<a class="lang-switch" href=")[^"]*', r'\g<1>https://projects.tanplanet.work/' + ("preset/" if en else "en/preset/"), page)
    if en:  # แปลทีละข้อความ (text node/alt ที่ตรงทั้งก้อน) จาก pj/preset-en.json
        import json
        tr = json.loads((ROOT / "pj/preset-en.json").read_text())
        a, b = page.find("<title>"), page.find("</main>")
        mid = re.sub(r">(\s*)([^<>]*?)(\s*)<", lambda m: ">" + m[1] + tr.get(m[2], m[2]) + m[3] + "<", page[a:b])
        mid = re.sub(r'(content|alt)="([^"]*)"', lambda m: f'{m[1]}="{tr.get(m[2], m[2])}"', mid)
        for k, v in tr.items():  # ข้อความที่มี > ในตัว (ชื่อคลาส) ไม่หลุดเป็น text node
            if ">" in k:
                mid = mid.replace(k.replace(">", "&gt;"), v).replace(k, v)
        mid = mid.replace("บนขาว", "on white").replace('src="../', 'src="../../').replace('href="../common', 'href="../../common')
        page = page[:a] + mid + page[b:]
    out = ROOT / ("en/preset/index.html" if en else "preset/index.html")
    out.parent.mkdir(exist_ok=True)
    out.write_text(page)
    print("ok", out.relative_to(ROOT), len(ITEMS) + len(ARTICLE_ITEMS), "คอมโพเนนต์", "ไทยค้าง", len(re.findall("[ก-๙]+", page[page.find("<main"):page.find("</main>")])) if en else "")


if __name__ == "__main__":
    main()
