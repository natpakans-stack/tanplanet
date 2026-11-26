#!/bin/bash
# ตรวจ SEO/การเข้าถึงทุกหน้าใน sitemap ของ myfolio + projects ด้วยกติกาเดียวกับหลังบ้าน (tanplanet-cms › ตรวจคุณภาพ)
# ต้องเปิด myfolio :3001 และ projects :3003 ในเครื่อง · ผ่าน = exit 0 · เจอเรื่องค้าง = exit 1 + รายการ
# แก้ชื่อ/คำอธิบายที่ยาวเกินอัตโนมัติ: python3 tools/seo-rewrite.py <ไฟล์ผลตรวจ>  (Claude ผ่าน subscription)
set -e
CMS="${TANPLANET_CMS:-/Volumes/My Passport/Projects/tanplanet-cms}"
OUT="${1:-/tmp/tp-seo-check.txt}"
cd "$CMS/apps/api"
docker exec tanplanet-cms-postgres-1 psql -U tanplanet -d tanplanet -qc "delete from settings where key like 'audit:site:%'" >/dev/null 2>&1 || true
ALL=1 npx tsx scripts/audit-run.mts > "$OUT" 2>&1
cat "$OUT" | grep -E "^pages|^ERR|^\[" || true
grep -qE "^\[|^ERR" "$OUT" && { echo "ไม่ผ่าน — ดูรายละเอียดที่ $OUT"; exit 1; } || echo "ผ่านทุกหน้า"
