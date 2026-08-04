#!/usr/bin/env python3
"""สร้าง sitemap.xml + llms.txt จากการ์ดใน index.html

รันทุกครั้งที่เพิ่มโปรเจกต์ใหม่:  python3 tools/gen-seo.py
(ก่อนหน้านี้ sitemap เขียนมือ เลยค้างที่ 17 URL ทั้งที่มีการ์ด 28 ใบ)
"""
import html
import re
import subprocess
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BASE = "https://projects.tanplanet.info/"

CARD_RE = re.compile(r'<a class="card[^"]*"[^>]*href="([^"]+)"[^>]*>(.*?)</a>', re.S)


def text(fragment: str) -> str:
    return html.unescape(re.sub(r"<[^>]+>", "", fragment)).replace("&middot;", "·").strip()


def grab(pattern: str, body: str) -> str:
    m = re.search(pattern, body, re.S)
    return text(m.group(1)) if m else ""


def cards():
    src = (ROOT / "index.html").read_text()
    for href, body in CARD_RE.findall(src):
        if href.startswith("http"):  # ลิงก์ออกนอกเว็บ ไม่ใช่หน้าของเรา
            continue
        yield {
            "url": BASE + href.lstrip("/"),
            "path": href,
            "name": grab(r"<h3>(.*?)</h3>", body),
            "type": grab(r'<div class="card-type">(.*?)</div>', body),
            "desc": grab(r"<p>(.*?)</p>", body),
        }


def lastmod(path: str) -> str:
    """วันที่แก้ล่าสุดจาก git — ถ้าไม่มีประวัติ (ไฟล์ใหม่) ใช้วันนี้"""
    target = ROOT / path.strip("/")
    out = subprocess.run(
        ["git", "log", "-1", "--format=%cs", "--", str(target)],
        cwd=ROOT, capture_output=True, text=True,
    ).stdout.strip()
    return out or date.today().isoformat()


def write_sitemap(items):
    today = date.today().isoformat()
    rows = [
        "  <url>\n"
        f"    <loc>{BASE}</loc>\n"
        f"    <lastmod>{today}</lastmod>\n"
        "    <changefreq>weekly</changefreq>\n"
        "    <priority>1.0</priority>\n"
        "  </url>"
    ]
    for it in items:
        rows.append(
            "  <url>\n"
            f"    <loc>{it['url']}</loc>\n"
            f"    <lastmod>{lastmod(it['path'])}</lastmod>\n"
            "    <changefreq>monthly</changefreq>\n"
            "    <priority>0.8</priority>\n"
            "  </url>"
        )
    (ROOT / "sitemap.xml").write_text(
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + "\n".join(rows)
        + "\n</urlset>\n"
    )
    return len(rows)


def write_llms(items):
    head = (ROOT / "tools" / "llms-head.md").read_text().rstrip()
    lines = [head, "", "## Case studies"]
    for it in items:
        label = f"{it['name']} ({it['type']})" if it["type"] else it["name"]
        lines.append(f"- [{label}]({it['url']}): {it['desc']}")
    lines += [
        "",
        "## Optional",
        f"- [Sitemap]({BASE}sitemap.xml): รายการ URL ทั้งหมดของเว็บนี้",
        "",
    ]
    (ROOT / "llms.txt").write_text("\n".join(lines))
    return len(items)


if __name__ == "__main__":
    items = list(cards())
    assert items, "หาการ์ดใน index.html ไม่เจอ — โครง HTML เปลี่ยนไปหรือเปล่า"
    assert all(i["name"] and i["desc"] for i in items), "มีการ์ดที่ไม่มีชื่อหรือคำอธิบาย"
    print(f"sitemap.xml: {write_sitemap(items)} urls")
    print(f"llms.txt: {write_llms(items)} projects")
