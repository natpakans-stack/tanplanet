#!/usr/bin/env bash
# ปลดล็อก PDF ที่ติดรหัส/ติด restriction → ไฟล์เปิดได้ปกติ (สำหรับส่งเข้า AI)
# ใช้: ./unlock.sh ไฟล์.pdf [รหัสผ่าน]
# ได้ผลลัพธ์: ไฟล์-unlocked.pdf ในโฟลเดอร์เดียวกัน
set -euo pipefail

src="${1:?ใส่ path ไฟล์ PDF ด้วย: ./unlock.sh ไฟล์.pdf [รหัส]}"
pw="${2:-}"
[ -f "$src" ] || { echo "❌ ไม่เจอไฟล์: $src" >&2; exit 1; }

out="${src%.pdf}-unlocked.pdf"

# qpdf --decrypt: ถอด restriction ได้เลยถ้าไม่มี user password;
# ถ้าไฟล์ตั้งรหัสเปิด ต้องส่ง --password
if [ -n "$pw" ]; then
  qpdf --decrypt --password="$pw" "$src" "$out"
else
  qpdf --decrypt "$src" "$out"
fi

echo "✅ $out"
