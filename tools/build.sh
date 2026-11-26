#!/bin/bash
# สร้างหน้าทั้งหมดของ myfolio + projects ใหม่จากต้นฉบับ แล้วเก็บงานที่ตัวตรวจคุณภาพกำหนด (หัวข้อไม่ข้ามระดับ · รูปมีขนาด)
# ใช้: bash tools/build.sh          → URL จริง (ก่อน push/deploy)
#      bash tools/build.sh --local  → ชี้ localhost:3001/3003 (ดูในเครื่อง)
# จบแล้วตรวจด้วย: bash tools/seo-check.sh
set -e
cd "$(dirname "$0")/.."
L="$1"
python3 tools/case-to-article.py $L
python3 tools/myfolio-project-article.py $L
python3 tools/gen-myfolio-projects.py $L
python3 tools/gen-preset.py $L
python3 tools/gen-404.py $L
python3 tools/gen-privacy.py
python3 tools/gen-seo.py
bash tools/sync-tokens.sh
OUT=(tanplanet-sites/myfolio/*.html tanplanet-sites/myfolio/en/*.html tanplanet-sites/myfolio/*/*.html tanplanet-sites/myfolio/en/*/*.html */index.html en/*/index.html index.html en/index.html)
OUT=($(printf "%s\n" "${OUT[@]}" | grep -v "^claude-skills-registry/"))  # VitePress คุมขนาดโลโก้ด้วย CSS เอง — ใส่ width/height แล้วโลโก้บาน 720px
python3 tools/fix-headings.py "${OUT[@]}"
python3 tools/fix-img-size.py "${OUT[@]}"
echo "build เสร็จ ${L:-(URL จริง)}"
