#!/bin/sh
# myfolio deploy แยกจาก repo หลัก (vercel จากโฟลเดอร์ myfolio) → ใช้สำเนา tokens · ต้นฉบับ = common/tokens.css
# ใช้: sh tools/sync-tokens.sh   (รันก่อน deploy myfolio · --check = แค่ตรวจว่าตรงกัน)
cd "$(dirname "$0")/.." || exit 1
src=common/tokens.css dst=tanplanet-sites/myfolio/tokens.css
if [ "$1" = "--check" ]; then cmp -s "$src" "$dst" && echo "tokens ตรงกัน" || { echo "tokens ไม่ตรง — รัน sh tools/sync-tokens.sh"; exit 1; }
else cp "$src" "$dst" && echo "sync แล้ว → $dst"; fi
