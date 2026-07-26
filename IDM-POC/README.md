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

## ทำไมต้องมี host

JS ในเบราว์เซอร์เรียก binary ไม่ได้ `host/idm_host.py` คือตัวกลาง (Chrome native messaging)
ที่รับ job จากป๊อปอัปแล้วสั่ง `yt-dlp` ให้ — Chrome เรียกเองอัตโนมัติ ไม่ต้องเปิดค้างไว้

- log การโหลด: `~/Library/Logs/idm-poc/`
- โหลดแบบยิงแล้วปล่อย ปิดป๊อปอัปได้ งานไม่ตาย แต่**ไม่มี progress bar** —
  ดูความคืบหน้าที่ log หรือรอไฟล์โผล่ใน Downloads

## ถอนออก

ลบ `~/Library/Application Support/Google/Chrome/NativeMessagingHosts/com.tanplanet.idm.json`
