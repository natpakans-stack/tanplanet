#!/usr/bin/env python3
"""หน้า 404 ของ myfolio (Vercel) + projects (GitHub Pages) — เปลือกเดียวกับหน้าบล็อก · ลิงก์เป็น URL เต็ม (404 ถูกเสิร์ฟได้ทุก path)
ใช้: python3 tools/gen-404.py [--local]
ภาษา: เปิดจาก /en/... = อังกฤษ (สลับข้อความด้วย JS ตัวเล็ก) · อื่น ๆ = ไทย
"""
import re
import runpy
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
g = runpy.run_path(str(ROOT / "tools/gen-myfolio-projects.py"), run_name="lib")
MF, absolutize, BASE = g["MF"], g["absolutize"], g["BASE"]
PROJ = "http://localhost:3003" if "--local" in sys.argv else g["PROJ"]

T = {  # (ไทย, อังกฤษ)
    "title": ("ไม่พบหน้านี้", "Page not found"),
    "lead": ("ลิงก์อาจเก่าหรือพิมพ์ผิด ลองเริ่มจากหน้าแรก หรือดูผลงานทั้งหมดก็ได้", "The link may be old or mistyped. Start from the home page, or browse all projects."),
    "home": ("กลับหน้าแรก", "Back to home"),
    "work": ("ดูผลงานทั้งหมด", "See all projects"),
}

CSS = (        ".nf{display:flex;flex-direction:column;justify-content:center;align-items:center;box-sizing:border-box;min-height:calc(100dvh - 120px);max-width:640px;margin:0 auto;padding:48px 24px;text-align:center}"  # เต็มจอ (หักแถบหัว) · footer อยู่ใต้ขอบจอ
        ".nf .nf-code{margin:0;font:800 clamp(140px,26vw,280px)/.9 var(--tp-font-display);letter-spacing:-.06em;color:var(--tp-text)}"
        ".nf h1{margin:16px 0 0;font:600 28px/1.3 var(--tp-font-display);color:var(--tp-text)}"
        ".nf p{margin:12px 0 0;font-size:17px;line-height:1.7;color:var(--tp-text-3)}"
        ".nf-act{display:flex;flex-wrap:wrap;justify-content:center;gap:12px;margin-top:32px}"
        ".nf-act a{display:inline-flex;align-items:center;justify-content:center;min-width:180px;height:48px;padding:0 24px;border-radius:999px;font-weight:600;text-decoration:none;border:1px solid var(--tp-text);transition:opacity .2s}"
        ".nf-act a:hover{opacity:.8}.nf-act .solid{background:var(--tp-text);color:#fff}.nf-act .ghost{color:var(--tp-text);border-color:var(--tp-border)}")


def page(lang):
    en = lang == "en"
    i = 1 if en else 0
    s = (MF / ("en/blog.html" if en else "blog.html")).read_text()
    a, b = s.find('<div class="section'), s.find("<footer")
    head, foot = absolutize(s[:a], lang), absolutize(s[b:], lang)
    head = re.sub(r"<title>[^<]*</title>", f"<title>404 — {T['title'][i]} · Natpakan Sirirat</title>", head, count=1)
    head = re.sub(r'<link rel="(canonical|alternate)"[^>]*>', "", head)
    head = re.sub(r'<script type="application/ld\+json">.*?</script>', "", head, flags=re.S)
    head = head.replace(' aria-current="page"', "").replace(" w--current", "")  # ไม่มีเมนูไหน active
    head = re.sub(r'(<a class="lang-switch" href=")[^"]*', rf'\g<1>{BASE}/' + ("" if en else "en/"), head)
    head = head.replace("</head>", '<meta name="robots" content="noindex"><style>' + CSS + "</style></head>", 1)
    main = (f'<main class="nf" role="main"><p class="nf-code" aria-hidden="true">404</p><h1>{T["title"][i]}</h1><p>{T["lead"][i]}</p>'
            f'<div class="nf-act"><a class="solid" href="{BASE}/{"en/" if en else ""}">{T["home"][i]}</a>'
            f'<a class="ghost" href="{PROJ}/{"en/" if en else ""}">{T["work"][i]}</a></div></main>')
    if not en:  # ponytail: โฮสต์เสิร์ฟ 404.html ไฟล์เดียว → path /en/ ส่งไปฉบับอังกฤษ (URL เปลี่ยนเป็น /en/404 · noindex)
        main += '<script>if(/^\\/en(\\/|$)/.test(location.pathname)&&!/\\/en\\/404/.test(location.pathname))location.replace("/en/404")</script>'
    foot = foot.replace(' aria-current="page"', "").replace(" w--current", "")
    return head + main + foot


def main():
    for root in (MF, ROOT):
        for lang, rel in (("th", "404.html"), ("en", "en/404.html")):
            (root / rel).write_text(page(lang))
            print("ok", (root / rel).relative_to(ROOT))


if __name__ == "__main__":
    main()
