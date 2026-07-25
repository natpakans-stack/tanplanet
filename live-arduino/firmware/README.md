# Firmware Scaffold

This firmware is prepared before the real hardware arrives.

Current status:

- Wi-Fi setup and local web config scaffold
- NTP time sync for Thailand
- `/api/device-summary` HTTP fetch
- JSON parsing with ArduinoJson
- Serial renderer for device cards
- Hardware profile placeholders for 3.5" ESP32 CYD R/C variants
- Backlight/RGB/speaker pin placeholders based on common ESP32-3248S035 references

Not included yet:

- Real TFT rendering
- Real touch rendering/navigation
- LVGL screen implementation
- Verified pinout for the exact purchased board

## Run Later With PlatformIO

```bash
cd firmware
pio run -e esp32_3248s035r_serial
pio upload -e esp32_3248s035r_serial
pio device monitor
```

For capacitive touch variant:

```bash
pio run -e esp32_3248s035c_serial
```

## Important

Do not trust the placeholder pins until the seller confirms the exact board model.

Ask for:

- exact model number
- display resolution
- display driver
- touch driver
- full pinout
- Arduino/LVGL example code
- speaker connector details

## ฟอนต์ไทย (LVGL)

`src/fonts/thai18.c` (Anuphan 400) และ `thai36.c` (Anuphan 600) generate ไว้แล้ว — ไม่ต้องทำใหม่เว้นแต่จะเปลี่ยนขนาด/น้ำหนัก

สร้างใหม่:

```bash
curl -sL -o Anuphan-var.ttf https://github.com/google/fonts/raw/main/ofl/anuphan/Anuphan%5Bwght%5D.ttf
python3 -c "
from fontTools import ttLib; from fontTools.varLib import instancer
f=ttLib.TTFont('Anuphan-var.ttf'); instancer.instantiateVariableFont(f,{'wght':400},inplace=True); f.save('Anuphan-400.ttf')"
npx -y lv_font_conv --font Anuphan-400.ttf --size 18 --bpp 4 --format lvgl --no-compress \
  --lv-include lvgl.h --range 0x20-0x7E --range 0x0E00-0x0E7F -o src/fonts/thai18.c
```

ช่วง `0x0E00-0x0E7F` ครอบคลุมทั้งพยัญชนะ สระ วรรณยุกต์ และเลขไทย ๐-๙

## Environments

| env | ใช้ทำอะไร |
| --- | --- |
| `esp32_035_serial` | scaffold เดิม render ลง serial |
| `esp32_035_tft` | TFT_eSPI เปล่า (ST7796) |
| `esp32_035_selftest` | bring-up: แถบสี/กรอบ/touch/RGB/ADC scan/beep |
| `esp32_035_lvgl` | LVGL 9 + ฟอนต์ไทย (partition `huge_app`) ← ตัวหลักต่อไป |

Flash: `pio run -e <env> -t upload --upload-port /dev/cu.usbserial-120`
