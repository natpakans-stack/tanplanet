# Backend Mock

This folder contains a lightweight Node.js service for pre-hardware development.

It serves the ESP32-facing payload:

```bash
npm run dev:backend
open http://localhost:8787/api/device-summary
```

No dependencies are required. The service uses Node built-ins only.

**บนเครื่องจริง backend รันผ่าน launchd — แก้โค้ดแล้วต้องรีสตาร์ต ไม่งั้นจอยังกินของเก่า:**

```bash
launchctl kickstart -k gui/501/com.tanplanet.astro-backend
```

อาการเวลาลืม: การ์ดบนจอมีข้อความถูกต้อง แต่กราฟ/ฉาก/ค่าที่อ่านจาก `extra` เป็นค่าว่าง
— เพราะฟิลด์ใหม่ยังไม่มีในเวอร์ชันที่รันอยู่

## Environment

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `8787` | Local server port |
| `MEGACOACH_ROOT` | `../megacoach` from project root | Optional local MegaCoach folder |
| `ASTRO_API_BASE` | `https://thai-astrology-flame.vercel.app` | Thai Astrology API base |

If `MEGACOACH_ROOT` exists, the service reads sanitized summaries from:

- `liff-app/entry-signal-data.json`
- `liff-app/idea-radar.json`
- `liff-app/monthly-plan.json`
- `liff-app/northstar.json`

It never exposes raw private portfolio data or API keys.

## รัน backend อัตโนมัติ (launchd)

จอ ESP32 ดึงข้อมูลจาก Mac ผ่าน Wi-Fi ถ้า backend ไม่ได้รันจอจะค้างข้อมูลเดิม
ติดตั้งเป็น LaunchAgent ให้สตาร์ทเองตอนล็อกอินและฟื้นเองถ้า process ตาย:

```bash
cp backend/com.tanplanet.astro-backend.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.tanplanet.astro-backend.plist
```

ตรวจสอบ / จัดการ:

```bash
launchctl list | grep tanplanet          # ดู PID (คอลัมน์แรก) และ exit code
tail -f /tmp/tanplanet-backend.log       # log ปกติ
tail -f /tmp/tanplanet-backend.err       # error
launchctl unload ~/Library/LaunchAgents/com.tanplanet.astro-backend.plist   # หยุด
```

`KeepAlive` = true จึงฟื้นเองภายใน ~10 วินาทีถ้าถูก kill หรือ crash
(ทดสอบแล้ว: kill -9 → กลับมาเองพร้อม PID ใหม่)

⚠️ ไม่ทำงานตอน Mac หลับ — จอจะขึ้น "ต่อ backend ไม่ได้" แล้วลองใหม่ทุก 30 วินาที
ถ้าต้องการให้จอทำงานโดยไม่พึ่ง Mac ต้องย้าย backend ขึ้น cloud (แต่ MegaCoach
กับ token usage อ่านไฟล์ในเครื่อง ตามไปด้วยไม่ได้)
