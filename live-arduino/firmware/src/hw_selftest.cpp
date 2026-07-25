// Hardware bring-up self-test สำหรับ ESP32-035 — build เฉพาะ env esp32_035_selftest
// เป้าหมาย: ยืนยัน display driver / rotation / touch / RGB / LDR pin / audio pin ของบอร์ดจริง
// ponytail: ไฟล์เดียวจบ ทดสอบด้วยตาคน ไม่มี test framework

#include <Arduino.h>
#include <TFT_eSPI.h>
#include <XPT2046_Touchscreen.h>
#include <SPI.h>

#include "hardware_profiles.h"

static TFT_eSPI tft;
static SPIClass touchSpi(VSPI);
static XPT2046_Touchscreen touch(TOUCH_CS_PIN, TOUCH_IRQ_PIN);

// LDR: ❌ ไม่มีบนบอร์ดนี้ — สแกน GPIO32/34/35/39 แล้วไม่มีพินไหนตอบสนองแสง (2026-07-25)
// GPIO32 ค้าง 4095, GPIO34 ค้าง 0, GPIO35/39 = noise → auto-dim ต้องใช้เวลาจาก NTP แทน

static void rgb(bool r, bool g, bool b) {
  // ponytail: RGB LED บนบอร์ดนี้เป็น active-LOW (common anode) — สลับ logic ถ้าสีกลับด้าน
  digitalWrite(RGB_R_PIN, r ? LOW : HIGH);
  digitalWrite(RGB_G_PIN, g ? LOW : HIGH);
  digitalWrite(RGB_B_PIN, b ? LOW : HIGH);
}

static void drawDisplayTest() {
  tft.fillScreen(TFT_BLACK);

  // แถบสี: ยืนยันลำดับสี (ถ้า RED ออกเป็นน้ำเงิน = ต้องเพิ่ม -D TFT_RGB_ORDER=TFT_BGR)
  const uint16_t bars[] = {TFT_RED, TFT_GREEN, TFT_BLUE, TFT_WHITE};
  const int barW = tft.width() / 4;
  for (int i = 0; i < 4; i++) {
    tft.fillRect(i * barW, 0, barW, 40, bars[i]);
  }

  // กรอบขอบจอ: ถ้าขอบขาดหรือมีแถบดำ = resolution/offset ผิด driver
  tft.drawRect(0, 0, tft.width(), tft.height(), TFT_YELLOW);
  tft.drawRect(1, 1, tft.width() - 2, tft.height() - 2, TFT_YELLOW);

  tft.setTextColor(TFT_WHITE, TFT_BLACK);
  tft.setTextDatum(TL_DATUM);
  tft.drawString("TanPlanet HW self-test", 10, 55, 4);
  tft.setTextFont(2);
  tft.drawString(String("driver build: ") + TFT_DRIVER_LABEL, 10, 90);
  tft.drawString(String("size: ") + tft.width() + "x" + tft.height(), 10, 110);
  // ponytail: built-in font ของ TFT_eSPI ไม่มี glyph ไทย — ข้อความ test ใช้อังกฤษไปก่อน
  tft.drawString("touch = pink dot", 10, 130);

  // มุมสี่มุม: ใช้เล็งตอน calibrate touch
  tft.fillCircle(6, 6, 5, TFT_CYAN);
  tft.fillCircle(tft.width() - 7, 6, 5, TFT_CYAN);
  tft.fillCircle(6, tft.height() - 7, 5, TFT_CYAN);
  tft.fillCircle(tft.width() - 7, tft.height() - 7, 5, TFT_CYAN);
}

void setup() {
  Serial.begin(115200);
  delay(300);
  Serial.println("\n=== ESP32-035 hardware self-test ===");

  HardwareProfile hw = activeHardwareProfile();
  Serial.printf("profile: %s (%ux%u) %s / %s\n", hw.name, hw.width, hw.height,
                hw.displayDriver, hw.touchDriver);

  pinMode(RGB_R_PIN, OUTPUT);
  pinMode(RGB_G_PIN, OUTPUT);
  pinMode(RGB_B_PIN, OUTPUT);
  rgb(false, false, false);

  pinMode(TFT_BL, OUTPUT);
  digitalWrite(TFT_BL, HIGH);

  tft.init();
  tft.setRotation(1);  // 1 = landscape 480x320
  drawDisplayTest();
  Serial.printf("display init ok: %dx%d rotation=1\n", tft.width(), tft.height());

  touchSpi.begin(TOUCH_SCLK_PIN, TOUCH_MISO_PIN, TOUCH_MOSI_PIN, TOUCH_CS_PIN);
  touch.begin(touchSpi);
  touch.setRotation(1);
  Serial.println("touch init ok — แตะจอแล้วดูพิกัด raw ที่พิมพ์ออกมา");

  Serial.println("ADC scan: ยืนยันแล้วว่าไม่มี LDR — เก็บ log ไว้เผื่อ debug พินอื่น");
  Serial.println("audio: จะ beep ทาง GPIO26 ทุก 5 วิ — ถ้าไม่ได้ยิน ลอง GPIO25/22");
}

static uint32_t lastTick = 0;
static uint8_t phase = 0;

void loop() {
  if (touch.touched()) {
    TS_Point p = touch.getPoint();
    Serial.printf("touch raw x=%d y=%d z=%d\n", p.x, p.y, p.z);
    // map raw → พิกัดจอแบบหยาบ (ค่า 200..3800 เป็นช่วงปกติของ XPT2046)
    int sx = map(constrain(p.x, 200, 3800), 200, 3800, 0, tft.width() - 1);
    int sy = map(constrain(p.y, 200, 3800), 200, 3800, 0, tft.height() - 1);
    tft.fillCircle(sx, sy, 3, TFT_MAGENTA);
    delay(20);
  }

  if (millis() - lastTick < 5000) return;
  lastTick = millis();

  // RGB ไล่สี: RED → GREEN → BLUE → OFF
  switch (phase % 4) {
    case 0: rgb(true, false, false); Serial.println("RGB: RED"); break;
    case 1: rgb(false, true, false); Serial.println("RGB: GREEN"); break;
    case 2: rgb(false, false, true); Serial.println("RGB: BLUE"); break;
    default: rgb(false, false, false); Serial.println("RGB: off"); break;
  }
  phase++;

  // สแกน ADC ที่ยังว่างทั้งหมด ปิดคำถามว่า LDR ต่ออยู่พินไหน (34 = vendor claim)
  for (int pin : {32, 34, 35, 39}) {
    Serial.printf("  ADC GPIO%d = %d\n", pin, analogRead(pin));
  }

  // beep 1kHz 120ms ทาง amp input ที่คาดไว้ (ต้อง ledcSetup ก่อน ไม่งั้น channel ไม่ init)
  ledcSetup(0, 1000, 10);
  ledcAttachPin(AUDIO_PIN, 0);
  ledcWriteTone(0, 1000);
  delay(120);
  ledcWriteTone(0, 0);
  ledcDetachPin(AUDIO_PIN);
  pinMode(AUDIO_PIN, INPUT);
}
