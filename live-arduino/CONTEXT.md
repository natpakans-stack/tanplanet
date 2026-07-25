# Context Snapshot

Updated: 2026-07-17

## Current Goal

เตรียมโปรเจกต์ TanPlanet Smart Astro Calendar ก่อน hardware มาถึง โดยให้พร้อมทั้ง project brief, backend mock, data contract, firmware scaffold, mock UI และ checklist สำหรับ bring-up บอร์ด ESP32 CYD 3.5"

## Product Direction

โปรเจกต์นี้เป็นจออัจฉริยะตั้งโต๊ะบน ESP32 CYD 3.5" สำหรับ:

- ปฏิทินไทย / วันที่ พ.ศ. / วันหยุด
- จันทรคติไทย / วันพระ
- สภาพอากาศ
- ดวงลงทุนวันนี้จาก MegaCoach / Thai Astrology engine
- Market focus จาก MegaCoach เช่น VST, NVDA, QQQ, VOO, Idea Radar
- North Star investing principle เช่น `Fear of Ruin > FOMO`
- AI Token / Status card
- Web dashboard/config
- Brightness / day-night mode
- RGB LED และ sound/beep ถ้า hardware รองรับจริง

ESP32 ควรเป็น display/client ไม่ใช่สมองหลัก ส่วน logic หนัก เช่น astrology, AI summary, token usage และ MegaCoach knowledge ควรอยู่ใน backend แล้วส่ง summary JSON สั้น ๆ ให้ ESP32

## Hardware Decision

Target hardware — **ยืนยันแล้ว (2026-07-17): ESP32-035** จาก modulemore:

- ร้าน: modulemore.com/product/2898 ราคา ฿640 (แถม Touch Pen, สาย USB, สาย Molex Picoblade)
- จอ TFT 3.5" **ST7796** resolution **320x480**, มุมมอง 120°
- Touch: **XPT2046 resistive** single-touch (แชร์ SPI bus กับจอ)
- ESP32 dual core 240MHz, SRAM 520KB, **Flash 4MB**, Wi-Fi 2.4GHz + BT 4.2
- **มี Audio amp LTK8002D** 2.9W @4Ω พร้อมช่องต่อลำโพง (3-8Ω) → sound alert ทำได้จริง
- **มี LDR light sensor ในตัว** → auto dim ตามแสงจริงได้ ไม่ต้องซื้อ sensor เพิ่ม
- **มี RGB LED**: R=GPIO4, G=GPIO17, B=GPIO16
- Micro SD slot, USB CDC ผ่าน CH340C (Mac อาจต้องลง CH340 driver)
- ไฟ 5V ผ่าน Micro USB หรือ Molex Picoblade, ขนาดบอร์ด 101x55mm มีรูน็อต 3.2mm
- Pinout เต็ม: github.com/littleCdev/ESP32-035 → บันทึกลง `firmware/include/hardware_profiles.h` แล้ว
- ⚠️ **ไม่มีเคสขาย** — บอร์ดเปลือย ต้องหาเคส/print เอง (มีรูยึดน็อต)
- ⚠️ USB-C port ไม่มี CC resistors → ต้องใช้สาย USB-C to USB-A (ต่อกับ USB-C charger ตรง ๆ ไม่ติด)
- ⚠️ IO เหลือน้อย: IO-pins 3, PWM 2, ADC 1, UART 1, I2C 1 — พอสำหรับโปรเจกต์นี้เพราะทุกอย่าง on-board แล้ว

Confirmed spec — 2.8" variant (จอเล็ก, reference ไม่ใช่ target) จากร้าน 2026-07-17:

- ESP32 dual core 240MHz, SRAM 520KB, Wi-Fi 802.11b/g/n + BT 4.2/BLE
- จอ TFT 2.8" driver **ILI9341** resolution **320x240**, RGB 65K 16-bit
- Touch: มีปากกา stylus แถม → เป็น resistive touch (น่าจะ XPT2046)
- มีช่อง TF card, สาย Type-C, ขั้วต่อ 4P, ไฟ 5V กินไฟ ~115mA
- เคสเป็น optional แยกซื้อ
- ⚠️ driver ILI9341/320x240 ของ 2.8" ใช้ code ข้ามกับ 3.5" (ST7796/320x480) ไม่ได้ตรง ๆ

Important hardware concerns:

- **ยืนยันแล้ว: จอ 3.5" resolution 320x480** (2026-07-17)
- ตัวอย่างโค้ดของ 2.8" ใช้ข้ามกับ 3.5" ไม่ได้เสมอ
- audio/speaker มักไม่ใช่ speaker built-in อาจมีแค่ audio amp / speaker connector
- pinout ใน scaffold เป็น placeholder จาก reference ตระกูล ESP32-3248S035 ต้อง verify กับบอร์ดจริง

## Local Project Files

Main docs:

- `PROJECT_BRIEF.md` — project brief ฉบับเต็ม รวมตารางและ Mermaid diagrams
- `README.md` — วิธีรัน project mock
- `CONTEXT.md` — snapshot นี้

Backend:

- `backend/server.mjs` — local mock backend
- `backend/README.md` — วิธีรันและ environment variables

Data:

- `data/device-summary.sample.json` — sample device payload
- `data/device-config.default.json` — default device config
- `data/calendar.sample.json` — placeholder calendar/lunar data
- `data/README.md`

Docs:

- `docs/DATA_CONTRACT.md` — schema ของ `/api/device-summary`
- `docs/HARDWARE_BRINGUP.md` — checklist เมื่อ hardware มาถึง
- `docs/SHOP_QUESTIONS_EN.md` — คำถามร้านภาษาอังกฤษ
- `docs/PRE_HARDWARE_TASKS.md` — งานที่ทำได้ก่อน hardware มา

Firmware:

- `firmware/platformio.ini` — PlatformIO env สำหรับ 3.5" R/C serial scaffold
- `firmware/include/hardware_profiles.h` — hardware profile placeholder
- `firmware/src/main.cpp` — Arduino ESP32 scaffold: Wi-Fi, config, NTP, fetch summary, serial render
- `firmware/README.md`

Mock UI:

- `mock-ui/index.html` — interactive browser mock UI

Reference images:

- `th-11134208-81zth-mqots8ngxc74e7@resize_w1750_nl.webp`
- `th-11134207-81zte-mqotpdckdl35d6.jpeg`
- `th-11134207-81zte-mqotpu5e88p9c3@resize_w900_nl.webp`
- `th-11134207-81ztc-mqotxd4prncw20.webp`
- `th-11134207-81zto-mqotz1muy2o18b.webp`
- `th-11134207-81ztq-mqotyvcl6lmqf1.webp`

## Current Local Backend

Command:

```bash
npm run dev:backend
```

URLs:

- `http://localhost:8787`
- `http://localhost:8787/ui`
- `http://localhost:8787/api/status`
- `http://localhost:8787/api/device-summary`
- `http://localhost:8787/api/mock`

Current behavior:

- `/api/device-summary` returns 10 cards
- Reads local MegaCoach data from `/Users/natpakansirirat/Documents/Projects/tanplanet/megacoach`
- Pulls sanitized local cards from MegaCoach files where available
- Does not expose raw private portfolio or secrets

Mock UI behavior:

- Open `http://localhost:8787/ui`
- Click a card to open detail view
- Use `Back` or `Esc` to close detail view
- Use `‹` / `›` to page through cards

## Validation Already Run

Passed:

```bash
npm run check:backend
jq empty data/device-summary.sample.json data/device-config.default.json data/calendar.sample.json package.json
npm run print:summary
curl -sS http://localhost:8787/api/status
curl -sS http://localhost:8787/api/device-summary
```

Backend summary confirmed:

- `status.overall`: `ok`
- `source`: `megacoach+mock`
- `card_count`: `10`
- Astro card was able to return `ปานกลาง · 53/100` when network access to Thai Astrology API was available

Not validated yet:

- Firmware compile, because `pio` CLI was not installed/found
- Any real display/touch/audio behavior, because hardware has not arrived

## MegaCoach Context

Local MegaCoach path:

```text
/Users/natpakansirirat/Documents/Projects/tanplanet/megacoach
```

Important files inspected:

- `README.md` — MegaCoach overview
- `coach-playbook.md` — investment coaching playbook
- `portfolio.md` — user strategy and guardrails
- `liff-app/api/astro-summary.js` — AI summary for daily investment astrology
- `liff-app/api/coach.js` — MegaCoach API
- `liff-app/entry-signal-data.json` — market signals
- `liff-app/idea-radar.json` — theme radar
- `liff-app/monthly-plan.json` — monthly plan
- `liff-app/northstar.json` — long-term target
- `thai-astrology/api/index.py` — FastAPI astrology wrapper
- `thai-astrology/engine/daily_invest.py` — daily investment astrology score

MegaCoach interests found:

- Core: `VOO`, `QQQ`
- Holdings/focus: `NVDA`, `VST`
- Watchlist/radar examples: `MU`, `INTC`, `SEI`, `BE`, `CEG`, `OKLO`
- Themes: AI infrastructure, nuclear/power, HBM memory, custom AI silicon
- Principle: `Fear of Ruin > FOMO`

## MVP1 Scope

MVP1 is feature-complete prototype, not tiny demo.

Must include:

- ESP32 3.5" device shell
- Wi-Fi setup
- NTP clock
- Web config
- Persistent config
- Brightness/day-night mode
- Calendar
- Lunar/Buddha day
- Weather
- Astro card
- Market card
- North Star card
- AI Token/Status card hook
- Cache/offline state
- RGB if hardware supports it
- Sound/beep if hardware supports it

Non-goals:

- Full astrology chart on ESP32
- Swiss Ephemeris on ESP32
- AI generation on ESP32
- API keys inside firmware
- Production multi-user cloud

## Next Steps

Before hardware arrives:

1. Confirm exact 3.5" hardware variant with seller using `docs/SHOP_QUESTIONS_EN.md`
2. Decide weather provider
3. Decide token/status source
4. Optionally install PlatformIO CLI to compile firmware scaffold
5. Refine `mock-ui/index.html` card design and content
6. Replace mock calendar/lunar data with verified source or backend endpoint

When hardware arrives:

1. Follow `docs/HARDWARE_BRINGUP.md`
2. Confirm serial port on Mac with `ls /dev/cu.*`
3. Flash seller example first
4. Confirm display, touch, brightness, RGB, speaker
5. Update `firmware/include/hardware_profiles.h` with real pinout
6. Update `firmware/platformio.ini` `DEVICE_SUMMARY_URL` to Mac LAN IP
7. Flash TanPlanet firmware scaffold
8. Confirm ESP32 can fetch `/api/device-summary`

## Important Reminder

Do not finalize display, touch, RGB, or audio code until the seller or real board confirms:

- exact model
- screen driver
- touch driver
- pin mapping
- speaker/audio amp availability
- case compatibility

