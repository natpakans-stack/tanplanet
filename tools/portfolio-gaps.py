#!/usr/bin/env python3
"""หาโปรเจกต์ในโฟลเดอร์ tanplanet ที่ยังไม่มีหน้า case study บน projects.tanplanet.work

รัน:  python3 tools/portfolio-gaps.py
โฟลเดอร์ถือว่า "มีแล้ว" ถ้ามี <ชื่อ>-portfolio/ หรือชื่อโผล่ใน href / data-keywords ของการ์ดใน index.html
โปรเจกต์ที่ตั้งใจไม่ขึ้นเว็บ ใส่ชื่อไว้ใน tools/portfolio-skip.txt (บรรทัดละชื่อ)
"""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
# ponytail: ไม่ใช่โปรเจกต์ — โฟลเดอร์ของเว็บเอง
NOT_PROJECTS = {"common", "tools", "node_modules", "_archive"}


def norm(s: str) -> str:
    return re.sub(r"[^a-z0-9]", "", s.lower())


def main() -> list[str]:
    index = (ROOT / "index.html").read_text()
    cards = norm(" ".join(re.findall(r'(?:href|data-keywords)="([^"]*)"', index)))
    skip_file = ROOT / "tools" / "portfolio-skip.txt"
    skip = {l.strip() for l in skip_file.read_text().splitlines() if l.strip() and not l.startswith("#")} if skip_file.exists() else set()
    gaps = []
    for d in sorted(p for p in ROOT.iterdir() if p.is_dir()):
        n = d.name
        if n.startswith(".") or n in NOT_PROJECTS or n in skip or n.endswith("-portfolio"):
            continue
        if (ROOT / f"{n}-portfolio").is_dir() or norm(n) in cards:
            continue
        gaps.append(n)
    return gaps


if __name__ == "__main__":
    gaps = main()
    print("\n".join(gaps) if gaps else "ครบแล้ว — ทุกโปรเจกต์มีหน้า case study")
