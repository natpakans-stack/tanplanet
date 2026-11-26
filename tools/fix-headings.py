#!/usr/bin/env python3
"""หัวข้อห้ามข้ามระดับ (H2 → H4) — ลดระดับให้ไล่ทีละขั้นตามลำดับในหน้า (ตัวตรวจคุณภาพ heading-skip · WCAG 1.3.1)
ใช้: python3 tools/fix-headings.py <ไฟล์ html ...>   · ต้นฉบับ _case-src ไม่มี H1 (generator ใส่ให้) → เริ่มนับที่ H1
"""
import re, sys

TAG = re.compile(r"<(/?)h([1-6])\b", re.I)

def fix(html):
    body = re.sub(r"<!--.*?-->|<script.*?</script>|<style.*?</style>", lambda m: "\0" * len(m.group()), html, flags=re.S | re.I)
    prev, stack, out, last = 1 if "<h1" not in body.lower() else 0, [], [], 0
    for m in TAG.finditer(body):
        close, lv = m.group(1), int(m.group(2))
        if close:
            new = stack.pop() if stack else lv
        else:
            new = lv if not prev or lv <= prev + 1 else prev + 1
            stack.append(new)
            prev = new
        out.append(html[last:m.start()] + f"<{close}h{new}")
        last = m.end()
    return "".join(out) + html[last:]

if __name__ == "__main__":
    assert fix("<h1>a</h1><h4>b</h4><h5>c</h5><h2>d</h2>") == "<h1>a</h1><h2>b</h2><h3>c</h3><h2>d</h2>"
    assert fix("<h2>a</h2><h4>b</h4>") == "<h2>a</h2><h3>b</h3>"
    n = 0
    for f in sys.argv[1:]:
        s = open(f, encoding="utf-8").read(); t = fix(s)
        if t != s: open(f, "w", encoding="utf-8").write(t); n += 1
    print("fixed", n, "files")
