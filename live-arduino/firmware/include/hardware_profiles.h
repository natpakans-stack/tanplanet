#pragma once

#include <Arduino.h>

// Confirmed board (2026-07-17): ESP32-035 จาก modulemore (฿640)
// Bring-up บอร์ดจริง 2026-07-25: ESP32-D0WD-V3 rev3.1, flash 4MB, port /dev/cu.usbserial-120 (CH340)
// จอ 320x480 + XPT2046 resistive touch (แชร์ SPI bus เดียวกับจอ)
// Driver: ✅ ST7796 ยืนยันแล้ว — ILI9341_2 ของ vendor ให้ 240x320 (ผิดขนาด), ST7796 ให้ 480x320 ถูกต้อง
// Pinout จาก github.com/littleCdev/ESP32-035 (Hardware.md) + ยืนยันด้วย self-test:
//   TFT:   MISO=12, MOSI=13, SCLK=14, CS=15, DC=2, RST=3 (tied +3V), BL=27 (Q2 transistor)  ✅
//   Touch: CS=33, IRQ=36 (DIN/DOUT/DCLK แชร์กับ TFT SPI)  ✅ อ่านพิกัดได้จริง
//   SD:    CLK=18, DAT0=19, CMD=23, CD/DAT3=5
//   RGB:   R=4, G=17, B=16 (active LOW)  ✅ ไล่สีได้จริง
//   LDR:   ❌ ไม่มีจริงบนบอร์ดนี้ — สแกน GPIO32/34/35/39 ไม่มีพินไหนตอบสนองแสง (ร้านโฆษณาเกิน)
//          → auto-dim ต้องอิงเวลาจาก NTP แทน
//   Audio: LTK8002D input ยังไม่ยืนยัน (คาด GPIO26 DAC) — Hardware.md ไม่ระบุ, ยังไม่ได้ต่อลำโพงทดสอบ
// ⚠️ CH340 บน Mac: read/write ที่ 921600 ข้อมูลเพี้ยน — ใช้ 460800 หรือต่ำกว่า
// ⚠️ USB-C บนบอร์ดไม่มี CC resistors — ต้องใช้สาย/อะแดปเตอร์ USB-C to USB-A เท่านั้น

struct HardwareProfile {
  const char* name;
  uint16_t width;
  uint16_t height;
  const char* displayDriver;
  const char* touchDriver;
  int pinBacklight;
  int pinAudioAmp;
  int pinRgbRed;
  int pinRgbGreen;
  int pinRgbBlue;
  int pinTouchIrq;
  int pinTouchSclk;
  int pinTouchMosi;
  int pinTouchMiso;
  int pinTouchCs;
  int pinTouchScl;
  int pinTouchSda;
  int pinTouchRst;
  int pinLdr;  // -1 = บอร์ดไม่มี LDR
};

inline HardwareProfile activeHardwareProfile() {
  return {
    "ESP32-035",
    480,
    320,
    "ST7796 (ยืนยันบอร์ดจริง 2026-07-25)",
    "XPT2046 resistive touch (shared SPI)",
    27,
    26,  // audio amp input — คาดการณ์ ยังไม่ได้ทดสอบด้วยลำโพงจริง
    4,
    17,
    16,
    36,
    14,
    13,
    12,
    33,
    -1,
    -1,
    -1,
    -1,  // LDR: ไม่มีบนบอร์ดนี้
  };
}
