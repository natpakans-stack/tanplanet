# Data Fixtures

ไฟล์ในโฟลเดอร์นี้ใช้เตรียม integration ก่อน hardware มาถึง

| File | Purpose |
| --- | --- |
| `device-summary.sample.json` | payload ตัวอย่างที่ ESP32 จะดึงจาก backend |
| `device-config.default.json` | ค่า config เริ่มต้นของอุปกรณ์ |
| `calendar.sample.json` | placeholder สำหรับ calendar/lunar UI |

หมายเหตุ: `calendar.sample.json` ยังไม่ใช่แหล่งข้อมูลวันพระ production ต้อง verify กับ data source หรือ algorithm จริงก่อนใช้กับอุปกรณ์จริง
