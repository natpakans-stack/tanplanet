#!/usr/bin/env python3
"""จัดเนื้อหาด้านในบทความบล็อก myfolio แบบบทความ takra.ai (ธีมสว่าง สีของ myfolio)
ใช้: python3 tools/blog-article-layout.py   (ทุกไฟล์ใน tanplanet-sites/myfolio/blog/*.html · รันซ้ำได้)

- ย่อหน้าแรกของบทความ → คำโปรยเด่น (blockquote.ap-lead)
- สร้างสารบัญจากหัวข้อย่อย h5 (ใส่ id ให้ลิงก์ได้) วางต่อจากคำโปรย
- ใส่ blog/article.css · ไม่เปลี่ยนข้อความ (ตรวจท้ายสคริปต์)
"""
import html, re
from pathlib import Path

BLOG = Path(__file__).resolve().parent.parent / "tanplanet-sites/myfolio/blog"
text = lambda s: re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", "", s))).strip()
norm = lambda s: re.sub(r"\s+", "", re.sub(r"<[^>]+>", "", s))


def convert(p):
    s = p.read_text()
    if 'class="ap-lead"' in s:
        return f"{p.name}: แปลงแล้ว ข้าม"
    a = s.index('<div class="rich-text w-richtext">')
    depth = 0
    for m in re.finditer(r"<(/?)div\b[^>]*>", s[a:]):
        depth += -1 if m.group(1) else 1
        if depth == 0:
            b = a + m.end(); break
    rich = s[a:b]

    first_p = re.search(r"<p>(.*?)</p>", rich, re.S)
    lead = f'<blockquote class="ap-lead">{first_p.group(1)}</blockquote>'

    toc = []
    def anchor(m):
        toc.append(text(m.group(2)))
        return f'<h5 id="s{len(toc)}"{m.group(1)}>{m.group(2)}</h5>'
    rich2 = re.sub(r"<h5([^>]*)>(.*?)</h5>", anchor, rich, flags=re.S)
    toc_html = ('<nav class="ap-toc" aria-label="สารบัญ"><p class="ap-toc-title">สารบัญ</p><ol>' +
                "".join(f'<li><a href="#s{i}">{html.escape(t)}</a></li>' for i, t in enumerate(toc, 1)) + "</ol></nav>") if len(toc) > 1 else ""
    # คำโปรย + สารบัญ แทนที่ย่อหน้าแรก (ถ้าย่อหน้าแรกอยู่ใต้หัวข้อย่อยแรก ย้ายหัวข้อนั้นไปไว้ใต้สารบัญ)
    h_first = re.match(r'(<div class="rich-text w-richtext">)\s*(<h5 id="s1"[^>]*>.*?</h5>)\s*', rich2, re.S)
    if h_first and rich2.find(first_p.group(0)) > h_first.end() - 1:
        rich2 = rich2.replace(first_p.group(0), "", 1)
        rich2 = h_first.group(1) + lead + toc_html + h_first.group(2) + rich2[h_first.end():]
    else:
        rich2 = rich2.replace(first_p.group(0), lead + toc_html, 1)

    s2 = s[:a] + rich2 + s[b:]
    if "article.css" not in s2:
        s2 = s2.replace("</head>", '<link rel="stylesheet" href="./article.css"/></head>', 1)
    extra = norm(toc_html) + "สารบัญ"  # ข้อความที่เพิ่มขึ้นมีแค่สารบัญ
    assert sorted(norm(s2).replace(norm(toc_html), "", 1)) == sorted(norm(s)), "ข้อความเปลี่ยน!"
    p.write_text(s2)
    return f"{p.name}: ok · สารบัญ {len(toc)} หัวข้อ"


if __name__ == "__main__":
    for f in sorted(BLOG.glob("*.html")):
        print(convert(f))
