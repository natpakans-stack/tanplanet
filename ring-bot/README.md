# น้องกริ่ง — แผงคุม (ring-bot)

Apps Script เดิมของบอทสวัสดีตอนเช้า ต่อยอดเป็นแผงคุม:
**สร้างบิล → เตือนตามวัน-เวลาที่ตั้ง (ทำซ้ำได้)** + ดูเครดิต/สถิติการส่ง

| ไฟล์ | ทำอะไร |
|---|---|
| `Ring.js` | ของใหม่ทั้งหมด — ฟอร์ม, webhook, การ์ด Flex, เครื่องยิงบิล, สิทธิ์เมนู |
| `bill.html` | หน้าฟอร์มสร้างบิล (เสิร์ฟจาก `doGet`) |
| `banklogos.html` | โลโก้ธนาคาร 14 แห่ง ฝังเป็น data URI |
| `qrlib.html` | qrcode-generator (MIT) สำหรับวาด QR พร้อมเพย์ |
| `Code.js` `LineApi.js` `ImageGen.js` `DayData.js` | ของเดิม (บอทรูปสวัสดี จบภารกิจ 29 พ.ค. 69) |
| `richmenu/menu.html` → `menu.png` | ภาพ Rich Menu 2500×1686 |
| `richmenu/setup.sh` | สร้าง + อัปโหลด rich menu (ไม่ตั้ง default) |

> **repo นี้เป็น public** — URL ของ web app คือความลับในตัว (ใครมีก็เปิดฟอร์มสร้างบิลได้)
> ค่าจริงทั้งหมดอยู่ใน `.env` ซึ่ง gitignored ไว้ · ดู deployment ปัจจุบันด้วย `npx @google/clasp list-deployments`


---

## ใครใช้เมนูได้บ้าง

**ไม่มี default rich menu** — คนที่แอดน้องกริ่งเฉย ๆ จะไม่เห็นเมนู ไม่มีทางเปิดฟอร์ม

เพิ่มคน:
1. คนนั้นทัก 1:1 น้องกริ่งหนึ่งครั้ง → ชื่อโผล่แท็บ `targets`
2. ในชีต ช่อง **`ให้ใช้เมนู`** พิมพ์ `ใช่`
3. Apps Script → Run **`ringSyncMenu`** → เมนูไปโผล่เฉพาะคนที่ติ๊ก (ลบ `ใช่` แล้วรันซ้ำ = ถอนสิทธิ์)

> ดึงรายชื่อสมาชิกกลุ่มอัตโนมัติไม่ได้ — `/group/{id}/members/ids` เปิดให้เฉพาะ OA verified/premium
> (เช็กแล้ว: `/followers/ids` ตอบ 403) เลยใช้ allowlist ในชีตแทน

---

## ตั้งครั้งแรก

1. Apps Script → เลือกไฟล์ `Ring.gs` → Run **`ringSetup`** (อนุญาตสิทธิ์ครั้งแรก)
   สร้างแท็บ `bills`/`pushlog`/`targets` + ตั้ง trigger `ringTick` ทุก 5 นาที
2. LINE Developers → Messaging API → Webhook URL = `$WEBAPP_URL` → เปิด *Use webhook*
   (ปุ่ม Verify จะขึ้นแดง 302 เสมอ — ปกติของ Apps Script ไม่ใช่พัง)
3. LINE OA Manager → Response settings → Response method = **Manual chat** (ปิด auto-response)
4. ทัก 1:1 → ติ๊ก `ให้ใช้เมนู` = `ใช่` → Run **`ringSyncMenu`**
5. ติดตั้งเมนู (ทำแล้ว รันซ้ำเมื่อแก้ภาพ/ปุ่ม):
   ```bash
   cp .env.example .env      # ใส่ CHANNEL_ACCESS_TOKEN
   ./richmenu/setup.sh
   ```

---

## ชีต `bills`

`id` `สร้างเมื่อ` `โหมด` `ปลายทาง` `ชื่อบิล` `คู่กรณี` `ยอด` `ธนาคาร` `ชื่อบัญชี` `เลขบัญชี`
`เริ่มเมื่อ` `เตือนเมื่อ` `ทำซ้ำ` `จำนวนครั้ง` `ส่งไปแล้ว` `สถานะ` `ส่งล่าสุด` `โน้ต`

- **โหมด** — `ทวง` (เราเก็บเงิน) / `จ่าย` (เราต้องจ่าย) — เปลี่ยนหัวการ์ดกับสี
- **ทำซ้ำ** — ว่าง / `เดือน` / `สัปดาห์`
- **จำนวนครั้ง** — ว่าง = ไม่มีจุดสิ้นสุด
- **เริ่มเมื่อ** — วันหลักที่ใช้คำนวณทุกรอบ (แก้ตรงนี้ = เลื่อนทั้งชุด ไม่ drift)
- **สถานะ** — ว่าง = รออยู่ · `จบแล้ว` = ครบรอบ · `ปิดแล้ว` = กดปิดจากการ์ด
- เดือนที่ไม่มีวันที่ 29/30/31 → เลื่อนเป็นวันสิ้นเดือน แล้วเดือนถัดไปกลับวันเดิม

## แก้โค้ดแล้ว

```bash
npx @google/clasp push -f
npx @google/clasp deploy -i $DEPLOY_ID
```

แก้ภาพเมนู:
```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless --disable-gpu \
  --hide-scrollbars --window-size=2500,1686 --virtual-time-budget=8000 \
  --screenshot="$PWD/richmenu/menu.png" "file://$PWD/richmenu/menu.html"
./richmenu/setup.sh && # แล้วรัน ringSyncMenu ใหม่ (menu id เปลี่ยน)
```

## พร้อมเพย์ / QR

- ฟอร์มโหมด "พร้อมเพย์" → ใส่เบอร์/เลขบัตรครบหลัก → QR ขึ้นสด
- payload สร้างฝั่ง server (`ppPayload` ใน `Ring.js`) ที่เดียว — ฝั่งหน้าเว็บแค่วาด
- ใส่ยอด = ยอดล็อกมากับ QR (POI `12`) · เว้นว่าง = ผู้จ่ายกรอกเอง (POI `11`)
- QR ที่สร้างถูกเก็บใน Drive โฟลเดอร์ `น้องกริ่ง QR` แชร์แบบ anyone-with-link เพื่อให้ LINE โหลดรูปได้
- `ringSelfTest` คุม CRC-16/CCITT (ค่า check `"123456789" → 0x29B1`) + โครง payload

## ที่ต้องรู้

- โควตาฟรี 300 ข้อความ/เดือน — **push กินโควตา, reply ไม่กิน** ปุ่มในเมนูใช้ reply ทั้งหมด
- บิลทำซ้ำ "ไม่มีจุดสิ้นสุด" = 1 ข้อความ/รอบ ตลอดไป — ดูโควตาก่อนตั้ง
- `ringTick` เขียนสถานะลงชีต **ก่อน** push → push พังก็ไม่ยิงซ้ำ (แลกกับพลาดรอบนั้นไป)
- `ringSelfTest` — เช็ก logic เงิน/วันที่/รอบทำซ้ำ รันก่อนแก้อะไรที่แตะเลข
- ความแม่นเวลา ±5 นาที (คาบ trigger) ปรับที่ `ringSetup`
