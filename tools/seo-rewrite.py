#!/usr/bin/env python3
"""เขียนชื่อ/คำอธิบายบน Google ใหม่ให้หน้าที่ตัวตรวจคุณภาพเจอ (ยาวเกิน · ไม่มีคำค้น) ด้วย Claude (Claude Code CLI = subscription)
ใช้: python3 tools/seo-rewrite.py <ไฟล์ผลตรวจ audit-run> [--dry]
แก้ทั้งหน้าที่ได้ และต้นฉบับใน _case-src (ไม่งั้น generator รอบหน้าทับกลับ) · แทนเฉพาะใน <head>
"""
import html, json, re, subprocess, sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MF = ROOT / "tanplanet-sites/myfolio"
KW = "Product Designer, Product Design, UX/UI, UX, UI, ออกแบบ, AI, Natpakan, ณัฐปคัลภ์, portfolio, case study"
CLAUDE = str(Path.home() / ".local/bin/claude")
SCHEMA = {"type": "object", "properties": {"title": {"type": "string"}, "description": {"type": "string"}}, "required": ["title", "description"], "additionalProperties": False}
SYSTEM = f"""คุณคือบรรณาธิการ SEO ของเว็บส่วนตัวของ ณัฐปคัลภ์ ศิริรัตน์ (แทน) Product Designer & AI Builder
เขียนชื่อ (title) และคำอธิบาย (description) บน Google ใหม่ ภาษาเดียวกับหน้า ไม่อวดเกินจริง ใช้แต่ข้อมูลที่มีในหน้า
- title: ยาวรวมไม่เกิน 60 ตัวอักษร (นับตัวอักษรไทยทีละตัว) ถ้าชื่อเดิมลงท้ายด้วยชื่อเว็บ (เช่น "· Natpakan Sirirat") ให้คงไว้ แล้วย่อส่วนหน้าให้พอ
- description: 80–150 ตัวอักษร บอกว่าเปิดแล้วได้อะไร
- ทั้งสองช่องต้องมีอย่างน้อย 1 คำจากรายการนี้แบบเป็นธรรมชาติ (ตรงตัวอักษร): {KW}
- หน้า case study ของผลงาน ใส่ "Case Study" หรือ "UX/UI" ได้ถ้าตรงเรื่อง"""

def file_of(url):
    host, path = re.match(r"https://([^/]+)(/.*)", url).groups()
    if host.startswith("myfolio"):
        p = path.strip("/")
        return MF / (p + "/index.html" if p in ("", "en") else p + ".html") if p not in ("", "en") else MF / (p and p + "/") / "index.html" if p else MF / "index.html"
    return ROOT / path.strip("/") / "index.html"

def sources(url, out):
    m = re.match(r"https://projects[^/]+/(en/)?([^/]+)/$", url)
    if m: return [out, ROOT / "_case-src" / (m.group(1) or "") / f"{m.group(2)}.html"]
    m = re.match(r"https://myfolio[^/]+/(en/)?project/([^/]+)$", url)
    if m: return [out, ROOT / "_case-src/myfolio" / ("en" if m.group(1) else "th") / f"{m.group(2)}.html"]
    return [out]

def head(s): i = s.find("</head>"); return s[:i], s[i:]
def meta(s, name):
    m = re.search(rf'<meta[^>]*name="{name}"[^>]*content="([^"]*)"', s) or re.search(rf'<meta[^>]*content="([^"]*)"[^>]*name="{name}"', s)
    return m.group(1) if m else ""

def ask(url, title, desc, text):
    user = f"URL: {url}\nชื่อเดิม: {title}\nคำอธิบายเดิม: {desc}\n\nข้อความในหน้า:\n{text[:12000]}"
    r = subprocess.run([CLAUDE, "-p", user, "--system-prompt", SYSTEM, "--output-format", "json", "--json-schema", json.dumps(SCHEMA), "--tools", "", "--model", "sonnet",
                        "--strict-mcp-config", "--setting-sources", "", "--disable-slash-commands"], capture_output=True, text=True, cwd="/tmp", timeout=300)
    d = json.loads(r.stdout); return d.get("structured_output") or json.loads(d["result"])

def work(url):
    out = file_of(url)
    s = out.read_text(encoding="utf-8"); h, _ = head(s)
    t_raw = re.search(r"<title>([^<]*)</title>", h).group(1); d_raw = meta(h, "description")
    body = re.sub(r"<script.*?</script>|<style.*?</style>|<[^>]+>", " ", s[len(h):], flags=re.S)
    new = ask(url, html.unescape(t_raw), html.unescape(d_raw), re.sub(r"\s+", " ", html.unescape(body)))
    nt, nd = html.escape(new["title"], quote=True), html.escape(new["description"], quote=True)
    if len(new["title"]) > 65 or not (70 <= len(new["description"]) <= 160): return url, "ข้าม (ยาวไม่ผ่าน)", new
    if "--dry" not in sys.argv:
        for f in sources(url, out):
            if not f.is_file(): continue
            x = f.read_text(encoding="utf-8"); a, b = head(x)
            for old, rep in ((t_raw, nt), (d_raw, nd)):
                if old: a = a.replace(old, rep).replace(html.unescape(old).replace('"', '\\"'), new["title"] if old == t_raw else new["description"])
            f.write_text(a + b, encoding="utf-8")
    return url, "ok", new

if __name__ == "__main__":
    rep = Path(sys.argv[1]).read_text()
    urls, cur = [], None
    for line in rep.splitlines():
        if line.startswith("["): cur = re.search(r"\] (\S+)", line).group(1)
        elif cur in ("title-long", "desc-len", "keyword-title", "keyword-desc") and line.startswith("  "):
            u = "https://" + line.strip().split(" — ")[0]
            if u not in urls: urls.append(u)
    print(len(urls), "pages")
    with ThreadPoolExecutor(5) as ex:
        for url, st, new in ex.map(work, urls): print(st, url, "|", new["title"], "|", len(new["description"]))
