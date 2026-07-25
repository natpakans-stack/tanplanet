# Hardware Bring-Up Checklist

Use this when the ESP32 CYD 3.5" board arrives.

## 1. Identify Exact Variant

Record:

| Item | Value |
| --- | --- |
| Seller link |  |
| Board model |  |
| R/C variant |  |
| Screen resolution |  |
| Display driver |  |
| Touch driver |  |
| USB type |  |
| Audio amp / speaker connector |  |
| Case fit confirmed |  |

## 2. Mac Connection

Run:

```bash
ls /dev/cu.*
```

Expected examples:

```text
/dev/cu.usbserial-...
/dev/cu.SLAB_USBtoUART
/dev/cu.wchusbserial...
```

If no serial port appears:

- confirm USB cable is a data cable
- check CP210x or CH340/CH341 driver
- approve driver in macOS Privacy & Security if prompted

## 3. Seller Example First

Before writing TanPlanet firmware:

- flash seller example
- confirm display works
- confirm touch works
- confirm orientation
- confirm brightness/backlight
- confirm RGB LED if present
- confirm speaker/beep if present

## 4. Pinout Notes To Verify

Common references for ESP32-3248S035 mention:

| Feature | Common GPIO | Must Verify |
| --- | --- | --- |
| Backlight | 27 | yes |
| Audio amp | 26 | yes |
| RGB red | 4 | yes |
| RGB green | 16 | yes |
| RGB blue | 17 | yes |
| Resistive touch IRQ | 36 | yes |
| Resistive touch CS | 33 | yes |
| Capacitive touch SCL | 32 | yes |
| Capacitive touch SDA | 33 | yes |
| Capacitive touch RST | 25 | yes |

Do not treat this table as final truth until the real board is confirmed.

## 5. First TanPlanet Firmware Test

After display/touch example works:

1. Start backend mock:

   ```bash
   npm run dev:backend
   ```

2. Edit `DEVICE_SUMMARY_URL` in `firmware/platformio.ini` to point to the Mac IP:

   ```text
   -D DEVICE_SUMMARY_URL=\"http://<mac-ip>:8787/api/device-summary\"
   ```

3. Upload firmware scaffold.

4. Open serial monitor and confirm cards are printed.

## 6. Done Criteria

- Mac can flash board
- Serial monitor works
- Display example works
- Touch example works
- TanPlanet scaffold fetches `/api/device-summary`
- Config page opens from phone or Mac


---

## ผล Bring-Up จริง (2026-07-25)

| Item | Value |
| --- | --- |
| Seller link | modulemore.com/product/2898 (฿640) |
| Board model | ESP32-035 · ESP32-D0WD-V3 rev3.1 · flash 4MB |
| Screen resolution | 480x320 (rotation 1) |
| Display driver | **ST7796** — vendor repo ที่ระบุ ILI9341_2 ผิด (ให้ 240x320) |
| Touch driver | XPT2046 · CS=33 · IRQ=36 · **แชร์ SPI bus กับจอ** |
| USB type | USB-C (ไม่มี CC resistors) · CH340 · `/dev/cu.usbserial-120` |
| Audio amp | LTK8002D — pin ยังไม่ยืนยัน (คาด GPIO26) ต้องต่อลำโพงถึงทดสอบได้ |
| LDR | **ไม่มีจริง** — GPIO32/34/35/39 ไม่มีพินไหนตอบสนองแสง |
| Case fit | ยังไม่มีเคส |

### กับดักที่เจอจริง (อ่านก่อนแก้บั๊กจอ)

1. **CH340 บน Mac พังที่ baud สูง** — `read_flash` ที่ 921600/460800 ได้ข้อมูล corrupt ต้องใช้ 115200 (4MB ≈ 6 นาที) ส่วน upload ที่ 460800 ใช้ได้
2. **driver ผิด → จอไม่เพี้ยน แต่ขนาดผิด** — เช็คด้วย `tft.width()x tft.height()` ใน serial เร็วกว่าดูด้วยตา
3. **สร้าง `SPIClass(VSPI)` ใหม่ให้ touch = จอตายสนิท** — touch แชร์สาย 12/13/14 กับจอ การ begin VSPI ทับ pin เดิมยึด GPIO matrix จน TFT เขียนไม่ออก **ต้องใช้ `touch.begin(tft.getSPIinstance())`**
4. **`LV_USE_TFT_ESPI` ของ LVGL ใช้กับบอร์ดนี้ไม่ได้** — driver `new TFT_eSPI()` ขึ้นมาอีกตัวซ้อนกับของเรา เขียน flush_cb เอง 10 บรรทัดจบ
5. **TFT_eSPI Font 6/7/8 มีแต่ตัวเลข** — ใส่ตัวอักษรแล้วหายทั้งบรรทัด
6. **ฟอนต์ในตัวไม่มี glyph ไทย** — จึงเลือก LVGL 9 + Anuphan แปลงด้วย `lv_font_conv`

### วิธี debug ที่ได้ผล

ใส่ตัวนับ `flushCount` ใน flush callback แล้ว print ทาง serial — แยกได้ทันทีว่า LVGL ไม่วาด (flushes=0) หรือวาดแล้วแต่ pixel ไม่ถึงจอ (flushes=10 แต่จอดำ)
