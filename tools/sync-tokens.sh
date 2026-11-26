#!/bin/sh
# myfolio deploy แยกจาก repo หลัก (vercel จากโฟลเดอร์ myfolio) → ใช้สำเนา · ต้นฉบับ = common/tokens.css + common/components.css
# ใช้: sh tools/sync-tokens.sh   (รันก่อน deploy myfolio · --check = แค่ตรวจว่าตรงกัน)
cd "$(dirname "$0")/.." || exit 1
rc=0
for f in tokens.css components.css; do
  src=common/$f dst=tanplanet-sites/myfolio/$f
  if [ "$1" = "--check" ]; then cmp -s "$src" "$dst" && echo "$f ตรงกัน" || { echo "$f ไม่ตรง — รัน sh tools/sync-tokens.sh"; rc=1; }
  else cp "$src" "$dst" && echo "sync แล้ว → $dst"; fi
done
exit $rc
