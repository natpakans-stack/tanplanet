#!/usr/bin/env bash
# ติดตั้ง rich menu น้องกริ่ง — รันซ้ำได้ (ลบของเก่าก่อน)
# ต้องมี ring-bot/.env: CHANNEL_ACCESS_TOKEN, WEBAPP_URL, SHEET_URL
# ไม่ตั้งเป็น default menu โดยตั้งใจ — ผูกรายคนด้วย ringSyncMenu() ใน Apps Script
set -euo pipefail
cd "$(dirname "$0")/.."
set -a; source .env; set +a
: "${CHANNEL_ACCESS_TOKEN:?ยังไม่ได้ใส่ CHANNEL_ACCESS_TOKEN ใน .env}"
: "${WEBAPP_URL:?ยังไม่ได้ใส่ WEBAPP_URL ใน .env}"
: "${SHEET_URL:?ยังไม่ได้ใส่ SHEET_URL ใน .env}"
AUTH="Authorization: Bearer $CHANNEL_ACCESS_TOKEN"
IMG=richmenu/menu.png
[ -f "$IMG" ] || { echo "ไม่เจอ $IMG — เรนเดอร์จาก menu.html ก่อน"; exit 1; }

for id in $(curl -s -H "$AUTH" https://api.line.me/v2/bot/richmenu/list \
    | python3 -c "import sys,json;print(' '.join(m['richMenuId'] for m in json.load(sys.stdin)['richmenus'] if m['name'].startswith('ring-console')))"); do
  curl -s -X DELETE -H "$AUTH" "https://api.line.me/v2/bot/richmenu/$id" >/dev/null
  echo "ลบเมนูเก่า $id"
done

BODY=$(WEBAPP_URL="$WEBAPP_URL" SHEET_URL="$SHEET_URL" python3 - <<'PY'
import json, os
W, H = 833, 843
def area(col, row, w, action):
    return {"bounds": {"x": col, "y": row, "width": w, "height": H}, "action": action}
def pb(label, act):
    return {"type": "postback", "label": label, "data": "action=" + act, "displayText": label}
print(json.dumps({
  "size": {"width": 2500, "height": 1686},
  "selected": True,
  "name": "ring-console v2",
  "chatBarText": "แผงคุมน้องกริ่ง",
  "areas": [
    area(0,    0,   W,   {"type": "uri", "label": "สร้างบิล", "uri": os.environ["WEBAPP_URL"]}),
    area(833,  0,   834, pb("บิลที่รออยู่", "due")),
    area(1667, 0,   W,   pb("เครดิตเดือนนี้", "quota")),
    area(0,    843, W,   pb("สถิติการส่ง", "stats")),
    area(833,  843, 834, {"type": "uri", "label": "เปิดชีต", "uri": os.environ["SHEET_URL"]}),
    area(1667, 843, W,   pb("วิธีใช้", "help")),
  ]
}, ensure_ascii=False))
PY
)

ID=$(curl -s -X POST https://api.line.me/v2/bot/richmenu -H "$AUTH" \
  -H 'Content-Type: application/json' -d "$BODY" \
  | python3 -c "import sys,json;d=json.load(sys.stdin);print(d.get('richMenuId') or sys.exit('สร้างไม่สำเร็จ: '+json.dumps(d,ensure_ascii=False)))")
echo "สร้างเมนู $ID"

curl -s -f -X POST "https://api-data.line.me/v2/bot/richmenu/$ID/content" \
  -H "$AUTH" -H 'Content-Type: image/png' --data-binary "@$IMG" >/dev/null
echo "อัปโหลดรูปแล้ว"

# กันพลาด: ห้ามเป็น default เด็ดขาด ไม่งั้นใครแอดบอทก็เห็นเมนู
curl -s -X DELETE "https://api.line.me/v2/bot/user/all/richmenu" -H "$AUTH" >/dev/null || true
echo
echo "เสร็จ — ยังไม่มีใครเห็นเมนู"
echo "ไปรัน ringSyncMenu() ใน Apps Script เพื่อผูกเมนูให้คนที่ติ๊ก \"ให้ใช้เมนู\" ในชีต targets"
