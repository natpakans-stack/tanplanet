# IDM-POC — MP4/M3U8 Sniffer

Chrome extension ดักลิงก์วิดีโอในหน้าเว็บ แล้วสั่ง `yt-dlp` โหลดให้จบในคลิกเดียว

## ติดตั้ง (ครั้งเดียว)

1. `chrome://extensions` → เปิด **Developer mode** → **Load unpacked** → เลือกโฟลเดอร์นี้
2. คัดลอก **ID** ของ extension ที่ขึ้นในการ์ด
3. รันครั้งเดียวใน Terminal:

```bash
brew install yt-dlp          # ถ้ายังไม่มี
./host/install.sh <EXTENSION_ID>
```

4. กลับไป `chrome://extensions` → กด Reload ที่ extension

จากนั้นกด **⬇ Download** ในป๊อปอัปได้เลย ไฟล์ลงที่ `~/Downloads`

## ใช้คู่กับ ShotDeck (โหลดเข้าซีนโดยตรง)

เปิด `bun server.ts` ของ ShotDeck ไว้ → แถบบนป๊อปอัปจะมีตัวเลือก **โปรเจกต์ → ซีน**
เลือกแล้วปุ่ม **โหลด** ทุกปุ่มยิงเข้า `assets/<id>/footage/sNN-<ชื่อ>.mp4` และจับคู่ซีนนั้นให้เลย (หน้า ShotDeck ที่เปิดอยู่รีเฟรชเอง)
โหลดเสร็จซีนหนึ่ง ตัวเลือกเลื่อนไปซีนว่างถัดไปให้ — เลือกคลิป กดโหลด เลือกคลิป กดโหลด ไปเรื่อย ๆ

- **วางลิงก์เอง** ในช่องบนสุด (ก๊อปจาก Pinterest/TikTok/YouTube) แล้ว Enter — ไม่ต้องเปิดหน้าให้ sniff
- แถวไฟล์ mp4 มีรูปย่อ + ความยาว + ขนาดจริง ให้รู้ว่าแถวไหนคือคลิปไหน (HLS/DASH ไม่มีรูปย่อ)
- อยู่หน้า YouTube / TikTok / Instagram / Facebook / X / Vimeo / **Pinterest (หน้าพิน `/pin/<id>/`)** → มีการ์ด "โหลดจากหน้าเว็บ" โชว์ชื่อคลิป ไม่ต้อง sniff
  - Pinterest: ฟีด/related pins ไม่มี URL ต่อคลิป → คลิกเปิดพินก่อนแล้วค่อยกดโหลด (เหมือนเอาลิงก์พินไปวาง klickpin)
- ติ๊ก **MP3** = เอาเสียงอย่างเดียว (มีมเสียง/เพลง) → ใน ShotDeck เข้าช่อง `sfx` ของซีนแทน footage
- เลือก "ไม่ส่ง ShotDeck" = ลง `~/Downloads` (ผ่าน server ถ้าเปิดอยู่ · ไม่งั้นผ่าน host)
- **คิวโหลด (แถบล่างป๊อปอัป):** ทุกงานมีแถบ % · ความเร็ว · ETA · ปุ่ม ⏸ หยุดชั่วคราว (เก็บที่โหลดไว้ กด ▶ โหลดต่อ) · ✕ ยกเลิก/เอาออก · คิวอยู่ที่ server ปิดป๊อปอัปได้ เปิดใหม่ก็เห็น · ช่วง 5–10 วิแรกขึ้น "กำลังแกะลิงก์…" (yt-dlp คุยกับ YouTube) ไม่ใช่ค้าง
- ไอคอนขึ้น badge `↓N` ระหว่างมีงานวิ่ง · **เริ่มโหลด / เสร็จ / ล้ม = notification ของ macOS** บอกซีน/ชื่อไฟล์
- ห้ามเปลี่ยนชื่อ/ย้ายไฟล์ `.part` ระหว่างโหลด — yt-dlp จะประกอบไฟล์ไม่ได้ (ไฟล์ที่ได้เปิดไม่ติด)
- YouTube บีบความเร็วต่อสาย ~200 KB/s → ใช้ `aria2c` 8 สายอัตโนมัติถ้ามี (`brew install aria2`) เร็วขึ้นราว 8 เท่า · โหลดไม่ได้/403 = `brew upgrade yt-dlp` ก่อน

## ทำไมต้องมี host

JS ในเบราว์เซอร์เรียก binary ไม่ได้ `host/idm_host.py` คือตัวกลาง (Chrome native messaging)
ที่รับ job จากป๊อปอัปแล้วสั่ง `yt-dlp` ให้ — Chrome เรียกเองอัตโนมัติ ไม่ต้องเปิดค้างไว้

- log การโหลด: `~/Library/Logs/idm-poc/`
- โหลดแบบยิงแล้วปล่อย ปิดป๊อปอัปได้ งานไม่ตาย แต่**ไม่มี progress bar** —
  ดูความคืบหน้าที่ log หรือรอไฟล์โผล่ใน Downloads

## ถอนออก

ลบ `~/Library/Application Support/Google/Chrome/NativeMessagingHosts/com.tanplanet.idm.json`
