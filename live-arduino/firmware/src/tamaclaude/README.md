# tamaclaude (vendored)

มาสคอตในการ์ด Claude Code มาจาก [thaitop/tamaclaude](https://github.com/thaitop/tamaclaude)
ไม่ได้วาดใหม่ — ก็อปโค้ดสร้างรูปมาทั้งชุด จึงได้ท่าทางและสัดส่วนตรงต้นฉบับทุกพิกเซล

| ไฟล์ | มาจาก | หน้าที่ |
| --- | --- | --- |
| `ct_rects.[ch]` | `firmware/main/` | รายการสี่เหลี่ยมในพิกัด unit — รูปแบบ asset เดียวของระบบ |
| `ct_mascot.[ch]` | `firmware/main/` | mood (ตา/ตัว/ขา) — สร้าง rect list ของมาสคอตหนึ่งตัว |
| `ct_props.[ch]` | `firmware/main/` | prop (แล็ปท็อป/ค้อน/แว่นขยาย/ลูกโลก/zZ ฯลฯ) |
| `layout.h` | `firmware/main/` | ค่าคงที่ + จานสี RGB565 + `ct_state_t` |

ทั้งหมดเป็น C99 ล้วน ไม่พึ่ง ESP-IDF และไม่พึ่ง LVGL — ปล่อยออกมาเป็นข้อมูลอย่างเดียว
ตัววาดอยู่ฝั่งเรา (`drawMascotRects()` ใน `app_main.cpp`) วาดด้วย `lv_draw_rect`
ใน `LV_EVENT_DRAW_MAIN` แบบเดียวกับต้นฉบับ จึงไม่ต้องจอง canvas buffer

ไฟล์ที่ไม่ได้เอามา: ฉาก/แถบโควตา/BLE/Wi-Fi (`ct_ui.c`, `ct_ble.c`, `ct_lan.c`, ...)
กับ pipeline ฝั่ง Python (`tools/gen/`) — ของเราประกอบฉากเองในหน้า detail

**อัปเดต:** ก็อปทับจาก repo ต้นทางได้เลย ไฟล์พวกนี้ไม่ถูกแก้เพื่อโปรเจกต์นี้แม้แต่บรรทัดเดียว

MIT — Copyright (c) 2026 Uthai Moolpak · ดู `LICENSE-tamaclaude`
