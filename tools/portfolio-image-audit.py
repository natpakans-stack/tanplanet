#!/usr/bin/env python3
"""หา section ในหน้า case study ที่ยังไม่มีภาพประกอบ (กติกา: ทุก section ต้องมีอย่างน้อย 1 ภาพ)

รัน:  python3 tools/portfolio-image-audit.py            # ทุกหน้า
      python3 tools/portfolio-image-audit.py hangun-portfolio
section = ช่วงตั้งแต่ <section class="section-intro"> หนึ่งถึงตัวถัดไป · นับ <img>, <video>, <figure>
"""
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
# mockup HTML ในหน้า (การ์ด LINE ฯลฯ) นับเป็นภาพด้วย
MEDIA = re.compile(r"<(img|video|figure)\b|class=\"[^\"]*(mock|phone|device|dev-frame|line-card)")


def audit(page: Path) -> list[str]:
    s = page.read_text()
    starts = [m.start() for m in re.finditer(r'<section class="section-intro"', s)]
    end = s.find('<div class="closing"')
    bounds = starts + [end if end > 0 else len(s)]
    missing = []
    for a, b in zip(bounds, bounds[1:]):
        chunk = s[a:b]
        if not MEDIA.search(chunk):
            h2 = re.search(r"<h2[^>]*>(.*?)</h2>", chunk, re.S)
            missing.append(re.sub(r"<[^>]+>|\s+", " ", h2.group(1)).strip() if h2 else "(ไม่มีหัวข้อ)")
    return missing


if __name__ == "__main__":
    names = sys.argv[1:] or sorted(p.parent.name for p in ROOT.glob("*/index.html"))
    total = 0
    for n in names:
        page = ROOT / n / "index.html"
        if 'class="closing"' not in page.read_text():
            continue  # ไม่ใช่หน้า case study
        if subprocess.run(["git", "-C", str(ROOT), "check-ignore", "-q", str(page)]).returncode == 0:
            continue  # ponytail: หน้าที่ gitignore = เว็บจริงอยู่ repo อื่น แก้ที่นี่ไม่ขึ้นเว็บ
        miss = audit(page)
        total += len(miss)
        for h in miss:
            print(f"{n}: {h}")
    print(f"\nsection ที่ยังไม่มีภาพ: {total}" if total else "ครบแล้ว — ทุก section มีภาพ")
