// TanPlanet Smart Astro Calendar — จอหลัก
// Wi-Fi (captive portal) → GET /api/device-summary → เรนเดอร์การ์ดภาษาไทยด้วย LVGL 9
// build: pio run -e esp32_035_lvgl -t upload --upload-port /dev/cu.usbserial-120

#include <Arduino.h>
#include <lvgl.h>
#include <TFT_eSPI.h>
#include <XPT2046_Touchscreen.h>
#include <WiFi.h>
#include <WiFiManager.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <Preferences.h>
#include <time.h>
#include <mbedtls/base64.h>
#include <algorithm>
#include <esp_task_wdt.h>

#include "icons/weather_icons.h"

LV_FONT_DECLARE(thai14);
LV_FONT_DECLARE(thai18);
LV_FONT_DECLARE(thai22);
LV_FONT_DECLARE(thai36);
LV_FONT_DECLARE(clock48);

// design tokens — ปรับที่นี่ที่เดียวทั้งจอ
static const uint32_t C_BG = 0x0A0F1F;      // พื้นจอ
static const uint32_t C_HERO = 0x121B36;    // แถบบน
static const uint32_t C_CARD = 0x161F3C;    // การ์ด
static const uint32_t C_GRID = 0x223056;    // เส้นตาราง (ต้องจางกว่าเส้นข้อมูลเสมอ)
static const uint32_t C_TEXT = 0xF2F5FF;
static const uint32_t C_MUTED = 0x8492BC;
static const uint32_t C_UP = 0x4ADE80;
static const uint32_t C_WARN = 0xFBBF24;
static const uint32_t C_DOWN = 0xF87171;

static TFT_eSPI tft;
// ponytail: touch แชร์สาย SPI 12/13/14 กับจอ — ห้ามสร้าง SPIClass ใหม่ ไม่งั้นจอตายสนิท
static XPT2046_Touchscreen touch(TOUCH_CS_PIN, TOUCH_IRQ_PIN);

// ponytail: 32 บรรทัด (30KB) — ยิ่งใหญ่ยิ่ง flush น้อยครั้ง จอลื่นขึ้น
// เพดานคือ DRAM: 40 บรรทัดล้น 7KB — 32 คือค่ามากสุดที่ลงได้พร้อม WiFi stack
static const uint32_t kBufPixels = 480 * 32;
static uint8_t drawBuf[kBufPixels * 2];

static lv_obj_t* headValue;
static lv_obj_t* headDetail;
static lv_obj_t* busyRing;
static lv_obj_t* heroWeather;
static lv_obj_t* heroLunar;
static lv_obj_t* cardList;
static lv_obj_t* detailView;
static lv_obj_t* detailBody;
static lv_obj_t* detailTitle;
static lv_obj_t* detailValue;
static lv_obj_t* detailText;

// ponytail: ไม่มี LDR บนบอร์ด — หรี่จอตามเวลาแทน ปรับ 2 ตัวนี้ถ้าอยากได้ช่วงอื่น
static const int kNightStartHour = 22;
static const int kNightEndHour = 6;
static const uint8_t kBacklightDay = 255;
static const uint8_t kBacklightNight = 60;

static const char* kThaiDays[] = {"อาทิตย์", "จันทร์", "อังคาร", "พุธ",
                                  "พฤหัสบดี", "ศุกร์", "เสาร์"};
static const char* kThaiMonths[] = {"ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
                                    "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."};

// ข้อมูลสำหรับวาดกราฟในหน้า detail — เก็บเฉพาะตัวเลขที่ใช้จริง ไม่เก็บ JSON ทั้งก้อน
enum VizKind : uint8_t { VIZ_NONE, VIZ_TOKENS, VIZ_HOURLY, VIZ_SCORE, VIZ_PRICE, VIZ_CALENDAR, VIZ_SAJU };
struct CardViz {
  VizKind kind = VIZ_NONE;
  float v[24] = {0};
  char lbl[6][28] = {{0}};
  uint8_t n = 0;
  char ticker[8] = {0};
  float changePct = 0;
  int8_t logoIdx = -1;

  // กราฟย่อบนหน้าการ์ด — spark = เส้นแนวโน้ม, gauge = สัดส่วนเทียบเพดาน
  bool isGauge = false;
  float spark[24] = {0};
  uint8_t sparkN = 0;
  float gaugeVal = 0, gaugeMax = 0;
  float quotaPct = -1, quotaWeekPct = -1;
  int quotaMinutes = 0;
  char gaugeUnit[12] = {0};
  uint32_t accent = 0x8492BC;
};

// อากาศมีการ์ดเดียวเสมอ — เก็บก้อนเดียวแยกไว้ ดีกว่าบวม cardViz[] ทั้ง 14 ช่อง
struct WeatherViz {
  char hourLbl[8][8] = {{0}};
  uint8_t hourRain[8] = {0};
  uint8_t hourN = 0;
  int nowTemp = 0, nowRain = 0, nowHum = 0, nowWind = 0;
  uint16_t nowCode = 0;
  char nowCond[40] = {0};
  char fcDay[8][10] = {{0}};
  int8_t fcHi[8] = {0}, fcLo[8] = {0};
  uint16_t fcCode[8] = {0};
  uint8_t fcN = 0;
};
static WeatherViz gWeather;

// พลังงานรายยามแบบสาจู — 12 ยาม ระดับ 0 ระวัง / 1 ท้าทาย / 2 พลังดี
struct SajuViz {
  uint8_t lv[12] = {0};
  uint8_t hr[12] = {0};
  uint8_t nowH = 99;
  uint8_t n = 0;
};
static SajuViz gSaju;

// ปฏิทินเดือนปัจจุบัน — backend ส่งวันพระ/วันหยุดมาครบทั้งเดือนอยู่แล้ว
struct CalMonth {
  int y = 0, m = 0, today = 0;
  uint32_t buddhaMask = 0;  // บิตที่ n = วันพระวันที่ n (1-31) เก็บเป็น mask ไม่ต้องวนหา
  uint8_t holidayDay[6] = {0};
  char holidayLbl[6][128] = {{0}};
  uint8_t holidayN = 0;

  // นัดจากปฏิทินภายนอก (ตารางแข่ง ฯลฯ) — จุดสีต่อฟีด
  uint8_t evDay[16] = {0};
  uint8_t evFeed[16] = {0};
  char evTime[16][6] = {{0}};
  char evLabel[16][56] = {{0}};
  uint8_t evN = 0;
  uint32_t feedColor[4] = {0x4ADE80, 0xF472B6, 0xA78BFA, 0x22D3EE};
  int8_t sajuLv[32];  // -1 = ไม่ได้ตั้งวันเกิด จึงไม่มีระดับพลัง
};
static CalMonth gCal;

// โลโก้หุ้นมาเป็น RGB565 ดิบ 28x28 จาก backend (ESP32 decode PNG เองไม่ไหว)
static const int kLogoPx = 28;
static const int kMaxLogos = 4;
static uint8_t logoBuf[kMaxLogos][kLogoPx * kLogoPx * 2];
static lv_image_dsc_t logoDsc[kMaxLogos];
static int logoUsed = 0;
static const int kMaxCards = 14;
static CardViz cardViz[kMaxCards];
static int cardCount = 0;

static uint32_t lastFetch = 0;
static uint32_t kRefreshMs = 5UL * 60UL * 1000UL;  // หลังบ้านสั่งเปลี่ยนได้ ไม่ต้อง flash

// ความสว่าง: หลังบ้านคุมทั้งค่ากลางวัน/กลางคืนและช่วงเวลา
static int briDay = kBacklightDay, briNight = kBacklightNight;
static int nightStartMin = 22 * 60, nightEndMin = 6 * 60 + 30;
static const uint32_t kRetryMs = 30UL * 1000UL;  // ดึงพลาดแล้วรอ 5 นาทีนานเกินไป

// ponytail: flush เอง — LV_USE_TFT_ESPI สร้าง TFT_eSPI ซ้อนอีกตัวแล้ว pixel ไม่ออกจอ
static volatile bool flushing = false;
static void flushCb(lv_display_t* disp, const lv_area_t* area, uint8_t* px_map) {
  flushing = true;
  uint32_t w = area->x2 - area->x1 + 1;
  uint32_t h = area->y2 - area->y1 + 1;
  tft.startWrite();
  tft.setAddrWindow(area->x1, area->y1, w, h);
  tft.pushColors((uint16_t*)px_map, w * h, true);
  tft.endWrite();
  flushing = false;
  lv_display_flush_ready(disp);
}

// ค่าคาลิเบรตทัช เก็บถาวรใน NVS — แตะจอค้างไว้ตอนเปิดเครื่องเพื่อคาลิเบรตใหม่
struct TouchCal {
  bool swapAxes;
  int32_t xMin, xMax, yMin, yMax;
} static cal = {false, 200, 3800, 200, 3800};

static Preferences prefs;
// ค่าคาลิเบรตเก่ามาจากอัลกอริทึมที่เพี้ยน — ผูกเวอร์ชันไว้ ของเก่าจะถูกบังคับทำใหม่
static const int kCalVersion = 3;

static void touchRead(lv_indev_t*, lv_indev_data_t* data) {
  // ทัชกับจอใช้สาย SPI เส้นเดียวกัน — อ่านทัชระหว่างจอวาดอยู่ = แย่ง bus แล้วสะดุด
  static lv_indev_state_t lastState = LV_INDEV_STATE_RELEASED;
  static lv_point_t lastPoint = {0, 0};
  if (flushing) {
    data->state = lastState;
    data->point = lastPoint;
    return;
  }
  if (!touch.touched()) {
    data->state = lastState = LV_INDEV_STATE_RELEASED;
    return;
  }
  TS_Point p = touch.getPoint();
  int32_t rx = cal.swapAxes ? p.y : p.x;
  int32_t ry = cal.swapAxes ? p.x : p.y;
  data->point.x = map(constrain(rx, min(cal.xMin, cal.xMax), max(cal.xMin, cal.xMax)),
                      cal.xMin, cal.xMax, 0, 479);
  data->point.y = map(constrain(ry, min(cal.yMin, cal.yMax), max(cal.yMin, cal.yMax)),
                      cal.yMin, cal.yMax, 0, 319);
  data->point.x = constrain(data->point.x, 0, 479);
  data->point.y = constrain(data->point.y, 0, 319);
  data->state = lastState = LV_INDEV_STATE_PRESSED;
  lastPoint = data->point;
}

// รอแตะแล้วคืนค่า raw แบบ median — ค่าเฉลี่ยพังง่ายเพราะตอนนิ้วแตะ/ปล่อย
// แรงกดยังไม่นิ่ง ค่าจะกระโดด ทำให้จุดคาลิเบรตเพี้ยนไปหลายสิบพิกเซล
static bool readRawPoint(int32_t& rx, int32_t& ry, uint32_t timeoutMs = 12000) {
  uint32_t start = millis();
  while (millis() - start < timeoutMs) {
    if (!touch.touched()) { delay(10); continue; }

    int32_t xs[48], ys[48];
    int n = 0;
    while (touch.touched() && n < 48) {
      TS_Point p = touch.getPoint();
      if (p.z > 400) {  // ทิ้งตัวอย่างตอนแรงกดยังเบา ค่าเพี้ยนมาก
        xs[n] = p.x;
        ys[n] = p.y;
        n++;
      }
      delay(8);
    }
    if (n < 8) continue;  // แตะแวบเดียว ไม่พอเชื่อถือ

    std::sort(xs, xs + n);
    std::sort(ys, ys + n);
    rx = xs[n / 2];
    ry = ys[n / 2];
    while (touch.touched()) delay(10);  // รอปล่อยนิ้วก่อนไปจุดถัดไป
    return true;
  }
  return false;
}

static void drawTarget(int x, int y, int step) {
  tft.fillScreen(TFT_BLACK);
  tft.drawLine(x - 20, y, x + 20, y, TFT_CYAN);
  tft.drawLine(x, y - 20, x, y + 20, TFT_CYAN);
  tft.drawCircle(x, y, 12, TFT_CYAN);
  tft.fillCircle(x, y, 3, TFT_WHITE);
  tft.setTextColor(TFT_WHITE, TFT_BLACK);
  tft.drawString("TOUCH CALIBRATION", 120, 120, 4);
  char msg[48];
  snprintf(msg, sizeof(msg), "press center of cross  %d/4", step);
  tft.drawString(msg, 120, 150, 2);
  tft.drawString("hold until it moves", 120, 170, 2);
}

// 4 มุม แล้วเฉลี่ยคู่ตรงข้าม — ทนกว่า 3 จุดเพราะความเพี้ยนที่มุมหนึ่งถูกหักล้าง
static void calibrateTouch() {
  const int32_t m = 34;
  const int32_t sx[4] = {m, 479 - m, m, 479 - m};
  const int32_t sy[4] = {m, m, 319 - m, 319 - m};
  int32_t rx[4], ry[4];

  for (int i = 0; i < 4; i++) {
    drawTarget(sx[i], sy[i], i + 1);
    if (!readRawPoint(rx[i], ry[i])) return;
    delay(250);
  }

  // ขอบซ้าย-ขวาของจอ = ค่าเฉลี่ยของสองจุดในคอลัมน์เดียวกัน
  int32_t leftX = (rx[0] + rx[2]) / 2, rightX = (rx[1] + rx[3]) / 2;
  int32_t topY = (ry[0] + ry[1]) / 2, botY = (ry[2] + ry[3]) / 2;

  // แกนสลับไหม: ถ้าขยับตามแนวนอนแล้ว raw y เปลี่ยนมากกว่า raw x แสดงว่าสลับ
  cal.swapAxes = abs((ry[1] + ry[3]) / 2 - (ry[0] + ry[2]) / 2) > abs(rightX - leftX);
  if (cal.swapAxes) {
    int32_t t1 = leftX, t2 = rightX;
    leftX = topY; rightX = botY; topY = t1; botY = t2;
  }

  // ยืดจากจุดที่แตะ (34..445) ออกไปถึงขอบจอจริง (0..479)
  double sxSpan = (double)(rightX - leftX) / (sx[1] - sx[0]);
  double sySpan = (double)(botY - topY) / (sy[2] - sy[0]);
  cal.xMin = leftX - (int32_t)(m * sxSpan);
  cal.xMax = cal.xMin + (int32_t)(479 * sxSpan);
  cal.yMin = topY - (int32_t)(m * sySpan);
  cal.yMax = cal.yMin + (int32_t)(319 * sySpan);

  prefs.begin("tanplanet", false);
  prefs.putBool("swap", cal.swapAxes);
  prefs.putInt("xMin", cal.xMin);
  prefs.putInt("xMax", cal.xMax);
  prefs.putInt("yMin", cal.yMin);
  prefs.putInt("yMax", cal.yMax);
  prefs.putInt("calv", kCalVersion);
  prefs.end();

  Serial.printf("touch cal: swap=%d x[%d..%d] y[%d..%d]\n",
                cal.swapAxes, cal.xMin, cal.xMax, cal.yMin, cal.yMax);

  // ตรวจงานตัวเอง: ให้แตะเป้ากลางจอ แล้ววัดว่าห่างจากจุดจริงเท่าไร
  tft.fillScreen(TFT_BLACK);
  tft.drawLine(220, 160, 260, 160, TFT_GREEN);
  tft.drawLine(240, 140, 240, 180, TFT_GREEN);
  tft.setTextColor(TFT_WHITE, TFT_BLACK);
  tft.drawString("verify: press center", 130, 200, 4);
  int32_t vx, vy;
  if (readRawPoint(vx, vy, 15000)) {
    int32_t ax = cal.swapAxes ? vy : vx, ay = cal.swapAxes ? vx : vy;
    int gotX = map(ax, cal.xMin, cal.xMax, 0, 479);
    int gotY = map(ay, cal.yMin, cal.yMax, 0, 319);
    int err = abs(gotX - 240) + abs(gotY - 160);
    Serial.printf("verify: got (%d,%d) เป้า (240,160) คลาด %d px\n", gotX, gotY, err);
    tft.fillScreen(TFT_BLACK);
    tft.setTextColor(err <= 30 ? TFT_GREEN : TFT_ORANGE, TFT_BLACK);
    char r[48];
    snprintf(r, sizeof(r), err <= 30 ? "OK  error %d px" : "off by %d px - redo if bad", err);
    tft.drawString(r, 110, 150, 4);
    delay(1400);
  }
  tft.fillScreen(TFT_BLACK);
}

static void loadTouchCal() {
  prefs.begin("tanplanet", true);
  bool has = prefs.isKey("xMin") && prefs.getInt("calv", 1) == kCalVersion;
  if (has) {
    cal.swapAxes = prefs.getBool("swap", false);
    cal.xMin = prefs.getInt("xMin", 200);
    cal.xMax = prefs.getInt("xMax", 3800);
    cal.yMin = prefs.getInt("yMin", 200);
    cal.yMax = prefs.getInt("yMax", 3800);
  }
  prefs.end();
  Serial.printf("touch cal %s: swap=%d x[%d..%d] y[%d..%d]\n",
                has ? "loaded" : "default", cal.swapAxes, cal.xMin, cal.xMax, cal.yMin, cal.yMax);

  // แตะจอค้างไว้ตอนเปิดเครื่อง = คาลิเบรตใหม่ (หรือยังไม่เคยคาลิเบรตเลย)
  if (!has || touch.touched()) calibrateTouch();
}

// LVGL ไม่ทำ Thai mark stacking — วรรณยุกต์ที่ตามหลังสระบนจะซ้อนทับกัน ("ตั้ง" พัง)
// สลับเป็นวรรณยุกต์ชุดยกสูงใน PUA ที่ tools/make_thai_font.py ฝังไว้ในฟอนต์
static bool isUpperVowel(uint32_t cp) {
  return cp == 0x0E31 || (cp >= 0x0E34 && cp <= 0x0E37) || cp == 0x0E4D || cp == 0x0E47;
}

// ฟอนต์มีเฉพาะ ASCII, ไทย, PUA วรรณยุกต์ยกสูง และสัญลักษณ์ 6 ตัวที่ backend ใช้จริง
// ที่เหลือ (emoji ☀ 🌘 🔥, variation selector) ทิ้งไป — วาดไม่ได้อยู่ดี โชว์เป็นกล่องยิ่งแย่
static bool isRenderable(uint32_t cp) {
  if (cp >= 0x20 && cp <= 0x7E) return true;
  if (cp >= 0x0E00 && cp <= 0x0E7F) return true;
  if (cp >= 0xF70A && cp <= 0xF70E) return true;
  switch (cp) {
    case 0x00B0: case 0x00B7: case 0x2013:
    case 0x2014: case 0x2026: case 0x2192:
      return true;
  }
  return cp == '\n';
}

static String thaiFix(const char* src) {
  String out;
  if (!src) return out;
  out.reserve(strlen(src) + 8);
  uint32_t prev = 0;
  const uint8_t* p = (const uint8_t*)src;
  while (*p) {
    uint32_t cp;
    int len;
    if (*p < 0x80) {
      cp = *p; len = 1;
    } else if ((*p & 0xE0) == 0xC0 && p[1]) {
      cp = ((*p & 0x1F) << 6) | (p[1] & 0x3F); len = 2;
    } else if ((*p & 0xF0) == 0xE0 && p[1] && p[2]) {
      cp = ((*p & 0x0F) << 12) | ((p[1] & 0x3F) << 6) | (p[2] & 0x3F); len = 3;
    } else if ((*p & 0xF8) == 0xF0 && p[1] && p[2] && p[3]) {
      // emoji อยู่ในช่วง 4 ไบต์ — ถ้าไม่กินให้ครบ จะแตกเป็นกล่อง 4 ใบ
      cp = ((*p & 0x07) << 18) | ((p[1] & 0x3F) << 12) | ((p[2] & 0x3F) << 6) | (p[3] & 0x3F);
      len = 4;
    } else {
      cp = *p; len = 1;
    }

    // สระอำ (ำ) มีนิคหิตอยู่ข้างบนเหมือนสระบน — วรรณยุกต์ที่มาก่อนมันต้องยกสูงด้วย ("ค่ำ")
    uint32_t next = 0;
    {
      const uint8_t* q = p + len;
      if (*q) {
        if (*q < 0x80) next = *q;
        else if ((*q & 0xE0) == 0xC0 && q[1]) next = ((*q & 0x1F) << 6) | (q[1] & 0x3F);
        else if ((*q & 0xF0) == 0xE0 && q[1] && q[2])
          next = ((*q & 0x0F) << 12) | ((q[1] & 0x3F) << 6) | (q[2] & 0x3F);
      }
    }

    if (!isRenderable(cp)) {
      p += len;
      continue;  // ทิ้ง emoji / อักขระที่ฟอนต์ไม่มี (prev ไม่ต้องอัปเดต)
    }

    uint32_t outCp = cp;
    if (cp >= 0x0E48 && cp <= 0x0E4C && (isUpperVowel(prev) || next == 0x0E33)) {
      outCp = cp - 0x0E48 + 0xF70A;
    }

    if (outCp < 0x80) {
      out += (char)outCp;
    } else if (outCp < 0x800) {
      out += (char)(0xC0 | (outCp >> 6));
      out += (char)(0x80 | (outCp & 0x3F));
    } else {
      out += (char)(0xE0 | (outCp >> 12));
      out += (char)(0x80 | ((outCp >> 6) & 0x3F));
      out += (char)(0x80 | (outCp & 0x3F));
    }

    prev = cp;
    p += len;
  }
  return out;
}

static void setThaiText(lv_obj_t* label, const char* text) {
  lv_label_set_text(label, thaiFix(text).c_str());
}

static uint32_t toneColor(const char* tone) {
  if (!tone) return 0x8B95B5;
  if (!strcmp(tone, "ok")) return 0x4ADE80;
  if (!strcmp(tone, "warn")) return 0xFBBF24;
  if (!strcmp(tone, "alert")) return 0xF87171;
  return 0x8B95B5;
}

// แตะการ์ด → กางรายละเอียดเต็มจอ; แตะที่ไหนก็ได้เพื่อปิด
// ponytail: อ่านข้อความจาก label ลูกของการ์ดเอง ไม่ต้องเก็บ state ซ้ำอีกชุด
static lv_obj_t* vizBox = nullptr;

// โควตาจริงจาก Anthropic — มีเพดาน 100% จึงวาดเป็นวงได้อย่างมีความหมาย
static void drawQuota(lv_obj_t* parent, const CardViz& viz) {
  lv_obj_t* row = lv_obj_create(parent);
  lv_obj_set_size(row, lv_pct(100), 104);
  lv_obj_set_style_bg_opa(row, LV_OPA_TRANSP, 0);
  lv_obj_set_style_border_width(row, 0, 0);
  lv_obj_set_style_pad_all(row, 0, 0);
  lv_obj_clear_flag(row, LV_OBJ_FLAG_SCROLLABLE);
  lv_obj_add_flag(row, LV_OBJ_FLAG_EVENT_BUBBLE);

  int pct = (int)(viz.quotaPct + 0.5f);
  uint32_t col = pct >= 80 ? C_DOWN : pct >= 50 ? C_WARN : C_UP;

  lv_obj_t* arc = lv_arc_create(row);
  lv_obj_set_size(arc, 96, 96);
  lv_obj_align(arc, LV_ALIGN_LEFT_MID, 0, 0);
  lv_arc_set_rotation(arc, 270);
  lv_arc_set_bg_angles(arc, 0, 360);
  lv_arc_set_range(arc, 0, 100);
  lv_arc_set_value(arc, max(pct, 1));  // 0% จะมองไม่เห็นเลยว่ามีวง
  lv_obj_remove_style(arc, nullptr, LV_PART_KNOB);
  lv_obj_clear_flag(arc, LV_OBJ_FLAG_CLICKABLE);
  lv_obj_set_style_arc_color(arc, lv_color_hex(0x232C4A), LV_PART_MAIN);
  lv_obj_set_style_arc_color(arc, lv_color_hex(col), LV_PART_INDICATOR);
  lv_obj_set_style_arc_width(arc, 11, LV_PART_MAIN);
  lv_obj_set_style_arc_width(arc, 11, LV_PART_INDICATOR);

  lv_obj_t* num = lv_label_create(arc);
  lv_obj_set_style_text_font(num, &thai22, 0);
  lv_obj_set_style_text_color(num, lv_color_hex(col), 0);
  lv_label_set_text_fmt(num, "%d%%", pct);
  lv_obj_center(num);

  lv_obj_t* info = lv_label_create(row);
  lv_obj_set_style_text_font(info, &thai18, 0);
  lv_obj_set_style_text_color(info, lv_color_hex(C_MUTED), 0);
  setThaiText(info, (String("รอบ 5 ชม. · รีเซ็ตอีก ") + (viz.quotaMinutes / 60) + " ชม. " +
                     (viz.quotaMinutes % 60) + " นาที" +
                     (viz.quotaWeekPct >= 0 ? String("\nรอบ 7 วัน · ") + (int)viz.quotaWeekPct + "%" : ""))
                        .c_str());
  lv_obj_align(info, LV_ALIGN_LEFT_MID, 112, 0);
}

// แท่งนอนพร้อมป้ายชื่อ+ค่า — ใช้กับ token usage ที่ค่าต่างกันหลักพันเท่า
static void drawBars(lv_obj_t* parent, const CardViz& viz) {
  float maxV = 1;
  for (int i = 0; i < viz.n; i++) maxV = max(maxV, viz.v[i]);

  for (int i = 0; i < viz.n; i++) {
    lv_obj_t* row = lv_obj_create(parent);
    lv_obj_set_size(row, lv_pct(100), 30);
    lv_obj_set_style_bg_opa(row, LV_OPA_TRANSP, 0);
    lv_obj_set_style_border_width(row, 0, 0);
    lv_obj_set_style_pad_all(row, 0, 0);
    lv_obj_clear_flag(row, LV_OBJ_FLAG_SCROLLABLE);

    lv_obj_t* name = lv_label_create(row);
    lv_obj_set_style_text_font(name, &thai18, 0);
    lv_obj_set_style_text_color(name, lv_color_hex(0x8B95B5), 0);
    lv_label_set_text(name, viz.lbl[i]);
    lv_obj_align(name, LV_ALIGN_LEFT_MID, 0, 0);

    lv_obj_t* bar = lv_bar_create(row);
    lv_obj_set_size(bar, 150, 14);
    lv_obj_align(bar, LV_ALIGN_LEFT_MID, 100, 0);
    lv_obj_set_style_bg_color(bar, lv_color_hex(0x232C4A), LV_PART_MAIN);
    lv_obj_set_style_bg_color(bar, lv_color_hex(0x4ADE80), LV_PART_INDICATOR);
    lv_obj_set_style_radius(bar, 7, LV_PART_INDICATOR);
    lv_bar_set_range(bar, 0, 1000);
    lv_bar_set_value(bar, (int32_t)(viz.v[i] / maxV * 1000), LV_ANIM_OFF);

    lv_obj_t* val = lv_label_create(row);
    lv_obj_set_style_text_font(val, &thai18, 0);
    lv_obj_set_style_text_color(val, lv_color_hex(0xF5F7FF), 0);
    char buf[16];
    float x = viz.v[i];
    if (x >= 1e6f) snprintf(buf, sizeof(buf), "%.1fM", x / 1e6f);
    else if (x >= 1e3f) snprintf(buf, sizeof(buf), "%.0fk", x / 1e3f);
    else snprintf(buf, sizeof(buf), "%.0f", x);
    lv_label_set_text(val, buf);
    lv_obj_align(val, LV_ALIGN_RIGHT_MID, 0, 0);
  }
}

// สไตล์กราฟกลาง — เส้นตารางต้องจางกว่าเส้นข้อมูลเสมอ ไม่งั้นแย่งสายตา
static lv_obj_t* makeChart(lv_obj_t* parent, int h) {
  lv_obj_t* chart = lv_chart_create(parent);
  lv_obj_set_size(chart, 380, h);
  lv_chart_set_type(chart, LV_CHART_TYPE_LINE);
  lv_obj_set_style_bg_color(chart, lv_color_hex(C_BG), 0);
  lv_obj_set_style_border_width(chart, 0, 0);
  lv_obj_set_style_radius(chart, 10, 0);
  lv_obj_set_style_pad_all(chart, 8, 0);
  lv_obj_set_style_line_color(chart, lv_color_hex(C_GRID), LV_PART_MAIN);
  lv_obj_set_style_line_width(chart, 1, LV_PART_MAIN);
  lv_obj_set_style_size(chart, 0, 0, LV_PART_INDICATOR);
  lv_obj_set_style_line_width(chart, 3, LV_PART_ITEMS);
  lv_obj_set_style_line_rounded(chart, true, LV_PART_ITEMS);
  lv_chart_set_div_line_count(chart, 4, 0);
  return chart;
}

// กล่องโปร่งไม่มีขอบ ไม่เลื่อน — ใช้เป็นโครงวางของอย่างเดียว
static lv_obj_t* plainBox(lv_obj_t* parent, int w, int h) {
  lv_obj_t* box = lv_obj_create(parent);
  lv_obj_set_size(box, w, h);
  lv_obj_set_style_bg_opa(box, LV_OPA_TRANSP, 0);
  lv_obj_set_style_border_width(box, 0, 0);
  lv_obj_set_style_pad_all(box, 0, 0);
  lv_obj_remove_flag(box, LV_OBJ_FLAG_SCROLLABLE);
  lv_obj_add_flag(box, LV_OBJ_FLAG_EVENT_BUBBLE);  // แตะตรงไหนก็ปิดหน้าได้เหมือนเดิม
  return box;
}

static const int kNavW = 64, kBodyW = 480 - kNavW;
static const int kGraphW = kBodyW - 32, kGraphH = 72, kGraphTop = 20;

// WMO code → ไอคอน Google (ชุด dark เพราะ UI พื้นเข้ม) — ตารางย่อเท่าที่ไทยเจอจริง
static const lv_image_dsc_t* weatherIcon(uint16_t code) {
  switch (code) {
    case 0:  case 1:  return &wi_sunny;
    case 2:            return &wi_partly_cloudy;
    case 3:            return &wi_mostly_cloudy;
    case 45: case 48:  return &wi_mist;
    case 51: case 53:  return &wi_drizzle;
    case 55: case 61:  return &wi_showers;
    case 63:           return &wi_showers;
    case 65: case 82:  return &wi_heavy;
    case 80: case 81:  return &wi_scattered_showers;
    case 95: case 96:  return &wi_isolated_tstorms;
    case 99:           return &wi_strong_tstorms;
    default:           return &wi_cloudy;
  }
}

static void drawWeatherIcon(lv_obj_t* parent, uint16_t code) {
  lv_obj_t* img = lv_image_create(parent);
  lv_image_set_src(img, weatherIcon(code));
  lv_obj_add_flag(img, LV_OBJ_FLAG_EVENT_BUBBLE);
}

// header อากาศ: ไอคอน + อุณหภูมิใหญ่ + ตัวเลขย่อยซ้าย / วัน-เวลา-สภาพอากาศชิดขวา
static void drawWeatherHeader(lv_obj_t* parent) {
  lv_obj_t* head = plainBox(parent, kGraphW, 60);

  lv_obj_t* icon = lv_image_create(head);
  lv_image_set_src(icon, weatherIcon(gWeather.nowCode));
  lv_image_set_scale(icon, 366);  // 256 = ขนาดจริง 28px → 366 ได้ ~40px
  lv_obj_add_flag(icon, LV_OBJ_FLAG_EVENT_BUBBLE);
  lv_obj_align(icon, LV_ALIGN_LEFT_MID, 6, 0);

  lv_obj_t* temp = lv_label_create(head);
  lv_obj_set_style_text_font(temp, &thai36, 0);
  lv_obj_set_style_text_color(temp, lv_color_hex(C_TEXT), 0);
  lv_label_set_text_fmt(temp, "%d°", gWeather.nowTemp);
  lv_obj_align(temp, LV_ALIGN_LEFT_MID, 48, 0);

  lv_obj_t* stats = lv_label_create(head);
  lv_obj_set_style_text_font(stats, &thai14, 0);
  lv_obj_set_style_text_color(stats, lv_color_hex(C_MUTED), 0);
  lv_obj_set_style_text_line_space(stats, 2, 0);
  char buf[96];
  snprintf(buf, sizeof(buf), "โอกาสฝนตก: %d%%\nความชื้น: %d%%\nลม: %d กม./ชม.",
           gWeather.nowRain, gWeather.nowHum, gWeather.nowWind);
  setThaiText(stats, buf);
  lv_obj_align(stats, LV_ALIGN_LEFT_MID, 120, 0);

  // ขวา: ชื่อหัวข้อ + วันเวลาเครื่อง (NTP) + คำบรรยายสภาพอากาศ
  lv_obj_t* right = lv_label_create(head);
  lv_obj_set_style_text_font(right, &thai14, 0);
  lv_obj_set_style_text_color(right, lv_color_hex(C_MUTED), 0);
  lv_obj_set_style_text_align(right, LV_TEXT_ALIGN_RIGHT, 0);
  lv_obj_set_style_text_line_space(right, 2, 0);
  time_t nowSec = time(nullptr);
  struct tm tmNow;
  localtime_r(&nowSec, &tmNow);
  snprintf(buf, sizeof(buf), "สภาพอากาศ\nวัน%s %02d:%02d\n%s",
           kThaiDays[tmNow.tm_wday], tmNow.tm_hour, tmNow.tm_min, gWeather.nowCond);
  setThaiText(right, buf);
  lv_obj_align(right, LV_ALIGN_RIGHT_MID, -2, 0);
}

// กราฟโอกาสฝน 24 ชม.ข้างหน้า (ทุก 3 ชม.) — แท่งขั้นบันไดสเกลตายตัว 0-100%
// สเกลตายตัวเพราะ % ต้องเทียบกันได้ข้ามวัน ถ้า auto-scale วันฝน 5% จะดูสูงเท่าวันฝน 90%
static void drawRainHours(lv_obj_t* parent) {
  int n = gWeather.hourN;
  if (n < 2) return;

  lv_obj_t* wrap = plainBox(parent, kGraphW, kGraphTop + kGraphH + 20);
  const int slot = kGraphW / n;
  for (int i = 0; i < n; i++) {
    bool nowSlot = (i == 0);  // backend ไล่จากชั่วโมงปัจจุบัน แท่งแรกจึงคือช่วงที่ยืนอยู่
    int x = i * slot;
    int h = kGraphH * gWeather.hourRain[i] / 100;
    if (h < 3) h = 3;  // 0% ก็ยังต้องเห็นเส้นฐาน ไม่งั้นดูเหมือนข้อมูลหาย

    // ช่วงปัจจุบันมีแถบพื้นเต็มความสูง — ระบุตำแหน่งได้แม้ฝน 0% แท่งเตี้ยติดพื้น
    if (nowSlot) {
      lv_obj_t* band = plainBox(wrap, slot, kGraphH + 20);
      lv_obj_set_style_bg_opa(band, LV_OPA_COVER, 0);
      lv_obj_set_style_bg_color(band, lv_color_hex(C_GRID), 0);
      lv_obj_set_style_radius(band, 8, 0);
      lv_obj_set_pos(band, x, kGraphTop);
    }

    lv_obj_t* bar = plainBox(wrap, slot - 4, h);
    lv_obj_set_style_bg_opa(bar, LV_OPA_COVER, 0);
    lv_obj_set_style_bg_color(bar, lv_color_hex(nowSlot ? 0x2F4372 : 0x1C2949), 0);
    lv_obj_set_pos(bar, x + 2, kGraphTop + kGraphH - h);

    lv_obj_t* cap = plainBox(wrap, slot - 4, 3);  // ขอบบนสีน้ำ = เส้นข้อมูลจริง
    lv_obj_set_style_bg_opa(cap, LV_OPA_COVER, 0);
    lv_obj_set_style_bg_color(cap, lv_color_hex(nowSlot ? C_WARN : 0x60A5FA), 0);
    lv_obj_set_pos(cap, x + 2, kGraphTop + kGraphH - h);

    lv_obj_t* pct = lv_label_create(wrap);
    lv_obj_set_style_text_font(pct, &thai14, 0);
    lv_obj_set_style_text_color(pct, lv_color_hex(nowSlot ? C_WARN : 0x60A5FA), 0);
    lv_obj_set_style_text_align(pct, LV_TEXT_ALIGN_CENTER, 0);
    lv_obj_set_width(pct, slot);
    lv_label_set_text_fmt(pct, "%d%%", gWeather.hourRain[i]);
    lv_obj_set_pos(pct, x, 0);

    lv_obj_t* hr = lv_label_create(wrap);
    lv_obj_set_style_text_font(hr, &thai14, 0);
    lv_obj_set_style_text_color(hr, lv_color_hex(nowSlot ? C_WARN : C_MUTED), 0);
    lv_obj_set_style_text_align(hr, LV_TEXT_ALIGN_CENTER, 0);
    lv_obj_set_width(hr, slot);
    if (nowSlot) setThaiText(hr, "ตอนนี้");
    else lv_label_set_text(hr, gWeather.hourLbl[i]);
    lv_obj_set_pos(hr, x, kGraphTop + kGraphH + 2);
  }
}

// พลังงานรายยาม — เส้นต่อจุด 3 ระดับ แบบเดียวกับหน้าปฏิทินของแอป saju
static uint32_t sajuColor(int lv) {
  return lv >= 2 ? C_UP : lv == 1 ? C_WARN : C_DOWN;
}

static const int kSjAxis = 40;                 // ที่ของป้ายระดับฝั่งซ้าย
static const int kSjTop = 16, kSjPlot = 74;    // แถบคำอธิบายด้านบน + ความสูงพื้นที่กราฟ
static int sjX[12], sjY[12], sjN = 0;

// เส้นต่อจุดต้องวาดเอง — lv_chart ผูกกับสเกลตัวเลข แต่นี่เป็นระดับ 3 ขั้นที่ไม่ใช่ปริมาณ
static void drawSajuLine(lv_event_t* e) {
  lv_obj_t* obj = (lv_obj_t*)lv_event_get_target(e);
  lv_layer_t* layer = lv_event_get_layer(e);
  lv_area_t a;
  lv_obj_get_coords(obj, &a);

  lv_draw_line_dsc_t line;
  lv_draw_line_dsc_init(&line);
  line.color = lv_color_hex(0x6B7BA8);
  line.width = 2;
  line.opa = LV_OPA_COVER;
  line.round_start = line.round_end = 1;
  for (int i = 0; i + 1 < sjN; i++) {
    line.p1.x = a.x1 + sjX[i];     line.p1.y = a.y1 + sjY[i];
    line.p2.x = a.x1 + sjX[i + 1]; line.p2.y = a.y1 + sjY[i + 1];
    lv_draw_line(layer, &line);
  }
}

static void drawSaju(lv_obj_t* parent) {
  int n = min((int)gSaju.n, 12);
  if (n < 2) return;
  sjN = n;

  lv_obj_t* wrap = plainBox(parent, kGraphW, kSjTop + kSjPlot + 20);

  // คำอธิบายสีอยู่บนสุด อ่านก่อนแล้วค่อยลงมาดูกราฟ
  static const struct { const char* t; int lv; } keys[] = {{"ดี", 2}, {"ท้าทาย", 1}, {"ระวัง", 0}};
  int kx = kGraphW;
  for (int i = 2; i >= 0; i--) {
    lv_obj_t* t = lv_label_create(wrap);
    lv_obj_set_style_text_font(t, &thai14, 0);
    lv_obj_set_style_text_color(t, lv_color_hex(C_MUTED), 0);
    setThaiText(t, keys[i].t);
    lv_obj_update_layout(t);
    kx -= lv_obj_get_width(t);
    lv_obj_set_pos(t, kx, 0);
    kx -= 10;

    lv_obj_t* d = plainBox(wrap, 6, 6);
    lv_obj_set_style_bg_opa(d, LV_OPA_COVER, 0);
    lv_obj_set_style_bg_color(d, lv_color_hex(sajuColor(keys[i].lv)), 0);
    lv_obj_set_style_radius(d, 3, 0);
    lv_obj_set_pos(d, kx, 6);
    kx -= 14;
  }

  // เส้นระดับ + ป้ายซ้าย
  const int rowY[3] = {kSjTop + 6, kSjTop + kSjPlot / 2, kSjTop + kSjPlot - 8};
  for (int r = 0; r < 3; r++) {
    lv_obj_t* g = plainBox(wrap, kGraphW - kSjAxis, 1);
    lv_obj_set_style_bg_opa(g, 60, 0);
    lv_obj_set_style_bg_color(g, lv_color_hex(C_GRID), 0);
    lv_obj_set_pos(g, kSjAxis, rowY[r]);

    lv_obj_t* t = lv_label_create(wrap);
    lv_obj_set_style_text_font(t, &thai14, 0);
    lv_obj_set_style_text_color(t, lv_color_hex(C_MUTED), 0);
    lv_obj_set_style_text_align(t, LV_TEXT_ALIGN_RIGHT, 0);
    lv_obj_set_width(t, kSjAxis - 6);
    setThaiText(t, keys[r].t);
    lv_obj_set_pos(t, 0, rowY[r] - 9);
  }

  const int slot = (kGraphW - kSjAxis) / n;
  for (int i = 0; i < n; i++) {
    sjX[i] = kSjAxis + slot * i + slot / 2;
    sjY[i] = rowY[2 - gSaju.lv[i]];
  }

  lv_obj_t* plot = plainBox(wrap, kGraphW, kSjTop + kSjPlot);
  lv_obj_set_pos(plot, 0, 0);
  lv_obj_add_event_cb(plot, drawSajuLine, LV_EVENT_DRAW_MAIN_END, nullptr);

  for (int i = 0; i < n; i++) {
    bool nowSlot = (gSaju.hr[i] == gSaju.nowH);
    uint32_t col = sajuColor(gSaju.lv[i]);

    // ยามปัจจุบันเป็นวงแหวน ไม่ใช่จุดใหญ่ — ตายังหาเจอแม้สีเดียวกับเพื่อนบ้าน
    if (nowSlot) {
      lv_obj_t* ring = plainBox(wrap, 18, 18);
      lv_obj_set_style_radius(ring, 9, 0);
      lv_obj_set_style_border_width(ring, 2, 0);
      lv_obj_set_style_border_color(ring, lv_color_hex(col), 0);
      lv_obj_set_style_bg_opa(ring, LV_OPA_COVER, 0);
      lv_obj_set_style_bg_color(ring, lv_color_hex(C_CARD), 0);
      lv_obj_set_pos(ring, sjX[i] - 9, sjY[i] - 9);
    }
    lv_obj_t* dot = plainBox(wrap, nowSlot ? 8 : 9, nowSlot ? 8 : 9);
    lv_obj_set_style_bg_opa(dot, LV_OPA_COVER, 0);
    lv_obj_set_style_bg_color(dot, lv_color_hex(col), 0);
    lv_obj_set_style_radius(dot, 5, 0);
    lv_obj_set_pos(dot, sjX[i] - (nowSlot ? 4 : 5), sjY[i] - (nowSlot ? 4 : 5));

    lv_obj_t* hr = lv_label_create(wrap);
    lv_obj_set_style_text_font(hr, &thai14, 0);
    lv_obj_set_style_text_color(hr, lv_color_hex(nowSlot ? C_TEXT : C_MUTED), 0);
    lv_obj_set_style_text_align(hr, LV_TEXT_ALIGN_CENTER, 0);
    lv_obj_set_width(hr, slot);
    lv_label_set_text_fmt(hr, "%02d", gSaju.hr[i]);
    lv_obj_set_pos(hr, sjX[i] - slot / 2, kSjTop + kSjPlot + 2);
  }
}

// แถวพยากรณ์รายวัน — วันนี้ไฮไลต์ไว้เป็นจุดอ้างอิงสายตา
static void drawForecast(lv_obj_t* parent) {
  int n = min((int)gWeather.fcN, 8);
  if (!n) return;

  lv_obj_t* row = plainBox(parent, kGraphW, 80);
  lv_obj_set_flex_flow(row, LV_FLEX_FLOW_ROW);
  lv_obj_set_flex_align(row, LV_FLEX_ALIGN_SPACE_BETWEEN, LV_FLEX_ALIGN_CENTER, LV_FLEX_ALIGN_CENTER);

  for (int i = 0; i < n; i++) {
    lv_obj_t* tile = plainBox(row, kGraphW / 8, 78);
    lv_obj_set_style_radius(tile, 10, 0);
    if (i == 0) {
      lv_obj_set_style_bg_opa(tile, LV_OPA_COVER, 0);
      lv_obj_set_style_bg_color(tile, lv_color_hex(C_GRID), 0);
    }
    lv_obj_set_flex_flow(tile, LV_FLEX_FLOW_COLUMN);
    lv_obj_set_flex_align(tile, LV_FLEX_ALIGN_CENTER, LV_FLEX_ALIGN_CENTER, LV_FLEX_ALIGN_CENTER);
    lv_obj_set_style_pad_row(tile, 0, 0);

    lv_obj_t* day = lv_label_create(tile);
    lv_obj_set_style_text_font(day, &thai14, 0);
    lv_obj_set_style_text_color(day, lv_color_hex(C_TEXT), 0);
    setThaiText(day, gWeather.fcDay[i]);

    drawWeatherIcon(tile, gWeather.fcCode[i]);

    lv_obj_t* hi = lv_label_create(tile);
    lv_obj_set_style_text_font(hi, &thai14, 0);
    lv_obj_set_style_text_color(hi, lv_color_hex(C_TEXT), 0);
    lv_label_set_text_fmt(hi, "%d°", gWeather.fcHi[i]);

    lv_obj_t* lo = lv_label_create(tile);
    lv_obj_set_style_text_font(lo, &thai14, 0);
    lv_obj_set_style_text_color(lo, lv_color_hex(C_MUTED), 0);
    lv_label_set_text_fmt(lo, "%d°", gWeather.fcLo[i]);
  }
}

// เกจครึ่งวงกลมสำหรับคะแนน 0-100
// ราคาหุ้น: โลโก้ + ticker + %เปลี่ยนแปลง แล้วกราฟเส้น 1 เดือน
static void drawPrice(lv_obj_t* parent, const CardViz& viz) {
  bool up = viz.changePct >= 0;
  uint32_t col = up ? 0x4ADE80 : 0xF87171;

  lv_obj_t* head = lv_obj_create(parent);
  lv_obj_set_size(head, lv_pct(100), 32);
  lv_obj_set_style_bg_opa(head, LV_OPA_TRANSP, 0);
  lv_obj_set_style_border_width(head, 0, 0);
  lv_obj_set_style_pad_all(head, 0, 0);
  lv_obj_clear_flag(head, LV_OBJ_FLAG_SCROLLABLE);

  int textX = 0;
  if (viz.logoIdx >= 0) {
    lv_obj_t* img = lv_image_create(head);
    lv_image_set_src(img, &logoDsc[viz.logoIdx]);
    lv_obj_align(img, LV_ALIGN_LEFT_MID, 0, 0);
    textX = kLogoPx + 10;
  }

  lv_obj_t* name = lv_label_create(head);
  lv_obj_set_style_text_font(name, &thai22, 0);
  lv_obj_set_style_text_color(name, lv_color_hex(C_TEXT), 0);
  lv_label_set_text(name, viz.ticker);
  lv_obj_align(name, LV_ALIGN_LEFT_MID, textX, 0);

  lv_obj_t* chg = lv_label_create(head);
  lv_obj_set_style_text_font(chg, &thai22, 0);
  lv_obj_set_style_text_color(chg, lv_color_hex(col), 0);
  char buf[24];
  snprintf(buf, sizeof(buf), "$%.2f  %+.1f%%", viz.v[viz.n - 1], viz.changePct);
  lv_label_set_text(chg, buf);
  lv_obj_align(chg, LV_ALIGN_RIGHT_MID, 0, 0);

  lv_obj_t* chart = makeChart(parent, 106);
  lv_chart_set_point_count(chart, viz.n);

  float lo = viz.v[0], hi = viz.v[0];
  for (int i = 0; i < viz.n; i++) { lo = min(lo, viz.v[i]); hi = max(hi, viz.v[i]); }
  // คูณ 100 เพราะ lv_chart รับ int — ราคาหุ้นมีทศนิยม 2 ตำแหน่ง
  lv_chart_set_range(chart, LV_CHART_AXIS_PRIMARY_Y, (int32_t)(lo * 100), (int32_t)(hi * 100));
  lv_chart_series_t* ser = lv_chart_add_series(chart, lv_color_hex(col), LV_CHART_AXIS_PRIMARY_Y);
  for (int i = 0; i < viz.n; i++) lv_chart_set_next_value(chart, ser, (int32_t)(viz.v[i] * 100));

  lv_obj_t* range = lv_label_create(parent);
  lv_obj_set_style_text_font(range, &thai18, 0);
  lv_obj_set_style_text_color(range, lv_color_hex(C_MUTED), 0);
  lv_label_set_text_fmt(range, "1 เดือน · ต่ำสุด $%d  ·  สูงสุด $%d", (int)lo, (int)hi);
}

static void drawScore(lv_obj_t* parent, const CardViz& viz) {
  int score = (int)viz.v[0];
  lv_obj_t* arc = lv_arc_create(parent);
  lv_obj_set_size(arc, 150, 150);
  lv_arc_set_rotation(arc, 135);
  lv_arc_set_bg_angles(arc, 0, 270);
  lv_arc_set_range(arc, 0, 100);
  lv_arc_set_value(arc, score);
  lv_obj_remove_style(arc, nullptr, LV_PART_KNOB);
  lv_obj_clear_flag(arc, LV_OBJ_FLAG_CLICKABLE);
  uint32_t col = score >= 66 ? 0x4ADE80 : score >= 40 ? 0xFBBF24 : 0xF87171;
  lv_obj_set_style_arc_color(arc, lv_color_hex(0x232C4A), LV_PART_MAIN);
  lv_obj_set_style_arc_color(arc, lv_color_hex(col), LV_PART_INDICATOR);
  lv_obj_set_style_arc_width(arc, 14, LV_PART_MAIN);
  lv_obj_set_style_arc_width(arc, 14, LV_PART_INDICATOR);

  lv_obj_t* num = lv_label_create(arc);
  lv_obj_set_style_text_font(num, &thai36, 0);
  lv_obj_set_style_text_color(num, lv_color_hex(col), 0);
  lv_label_set_text_fmt(num, "%d", score);
  lv_obj_center(num);
}

// โครงหน้าเต็มจอ: คอลัมน์เนื้อหา (เลื่อนได้) + แถบปุ่มขวาถาวร ปิด/ขึ้น/ลง
// ปุ่มต้องอยู่คนละ container กับเนื้อหา ไม่ใช่ปุ่มลอย — ปุ่มลอยทับเนื้อหาที่กว้างเต็มจอ
static lv_obj_t* makeFullView(lv_obj_t* parent, lv_obj_t** bodyOut) {
  lv_obj_t* view = lv_obj_create(parent);
  lv_obj_set_size(view, 480, 320);
  lv_obj_center(view);
  lv_obj_set_style_bg_color(view, lv_color_hex(C_CARD), 0);
  lv_obj_set_style_border_width(view, 0, 0);
  lv_obj_set_style_radius(view, 0, 0);
  lv_obj_set_style_pad_all(view, 0, 0);
  lv_obj_set_style_pad_column(view, 0, 0);
  lv_obj_add_flag(view, LV_OBJ_FLAG_HIDDEN);
  lv_obj_add_flag(view, LV_OBJ_FLAG_CLICKABLE);
  lv_obj_set_flex_flow(view, LV_FLEX_FLOW_ROW);
  lv_obj_remove_flag(view, LV_OBJ_FLAG_SCROLLABLE);
  lv_obj_add_event_cb(view, [](lv_event_t* e) {
    lv_obj_add_flag((lv_obj_t*)lv_event_get_current_target(e), LV_OBJ_FLAG_HIDDEN);
  }, LV_EVENT_CLICKED, nullptr);

  lv_obj_t* body = lv_obj_create(view);
  lv_obj_set_size(body, kBodyW, 320);
  lv_obj_set_style_bg_opa(body, LV_OPA_TRANSP, 0);
  lv_obj_set_style_border_width(body, 0, 0);
  lv_obj_set_style_pad_all(body, 16, 0);
  lv_obj_set_style_pad_row(body, 10, 0);
  lv_obj_set_flex_flow(body, LV_FLEX_FLOW_COLUMN);
  lv_obj_set_scrollbar_mode(body, LV_SCROLLBAR_MODE_OFF);
  lv_obj_add_flag(body, LV_OBJ_FLAG_EVENT_BUBBLE);  // แตะพื้นที่ว่างก็ปิดหน้าได้
  *bodyOut = body;

  lv_obj_t* nav = lv_obj_create(view);
  lv_obj_set_size(nav, kNavW, 320);
  lv_obj_set_style_bg_color(nav, lv_color_hex(C_HERO), 0);
  lv_obj_set_style_border_width(nav, 0, 0);
  lv_obj_set_style_radius(nav, 0, 0);
  lv_obj_set_style_pad_all(nav, 8, 0);
  lv_obj_set_style_pad_row(nav, 10, 0);
  lv_obj_set_flex_flow(nav, LV_FLEX_FLOW_COLUMN);
  lv_obj_set_flex_align(nav, LV_FLEX_ALIGN_SPACE_EVENLY, LV_FLEX_ALIGN_CENTER, LV_FLEX_ALIGN_CENTER);
  lv_obj_remove_flag(nav, LV_OBJ_FLAG_SCROLLABLE);

  // ทัชแบบต้านทาน: ตอนปล่อยนิ้วพิกัดกระโดด ถ้าหลุดนอกปุ่ม LVGL ไม่นับเป็น CLICKED
  // จึงยิงตั้งแต่กดลง ไม่รอปล่อย และขยายพื้นที่รับสัมผัสเผื่อไว้
  lv_obj_t* closeBtn = lv_button_create(nav);
  lv_obj_set_size(closeBtn, 44, 44);
  lv_obj_set_ext_click_area(closeBtn, 8);
  lv_obj_set_style_bg_color(closeBtn, lv_color_hex(0x2A3556), 0);
  lv_obj_set_style_radius(closeBtn, 22, 0);
  lv_obj_add_event_cb(closeBtn, [](lv_event_t* e) {
    lv_obj_t* btn = (lv_obj_t*)lv_event_get_current_target(e);
    lv_obj_add_flag(lv_obj_get_parent(lv_obj_get_parent(btn)), LV_OBJ_FLAG_HIDDEN);
  }, LV_EVENT_PRESSED, nullptr);

  lv_obj_t* closeLbl = lv_label_create(closeBtn);
  lv_obj_set_style_text_font(closeLbl, &thai22, 0);
  lv_obj_set_style_text_color(closeLbl, lv_color_hex(C_TEXT), 0);
  lv_label_set_text(closeLbl, "X");
  lv_obj_center(closeLbl);

  // ลากนิ้วบนทัชแบบต้านทานไม่ลื่นพอจะพึ่งอย่างเดียว — ต้องมีลูกศรทุกหน้า
  const struct { const char* icon; int dy; } btns[] = {{LV_SYMBOL_UP, -90}, {LV_SYMBOL_DOWN, 90}};
  for (const auto& b : btns) {
    lv_obj_t* sb = lv_button_create(nav);
    lv_obj_set_size(sb, 44, 74);
    lv_obj_set_style_bg_color(sb, lv_color_hex(0x2A3556), 0);
    lv_obj_set_style_radius(sb, 10, 0);
    lv_obj_set_ext_click_area(sb, 8);
    lv_obj_set_user_data(sb, (void*)(intptr_t)b.dy);
    lv_obj_add_event_cb(sb, [](lv_event_t* e) {
      lv_obj_t* btn = (lv_obj_t*)lv_event_get_current_target(e);
      int dy = (int)(intptr_t)lv_obj_get_user_data(btn);
      lv_obj_t* v = lv_obj_get_parent(lv_obj_get_parent(btn));
      lv_obj_scroll_by(lv_obj_get_child(v, 0), 0, -dy, LV_ANIM_ON);  // ลูกคนแรกคือ body
    }, LV_EVENT_PRESSED, nullptr);

    lv_obj_t* icon = lv_label_create(sb);
    lv_label_set_text(icon, b.icon);
    lv_obj_set_style_text_color(icon, lv_color_hex(0xB9C4E6), 0);
    lv_obj_center(icon);
  }
  return view;
}

static lv_obj_t* monthView = nullptr;
static lv_obj_t* monthBody = nullptr;
static lv_obj_t* monthGrid = nullptr;

static const char* kThaiDayShort[] = {"อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"};
static const char* kThaiMonthsFull[] = {"มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม",
                                        "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม",
                                        "พฤศจิกายน", "ธันวาคม"};

// Sakamoto — 0 = อาทิตย์ ใช้ได้ทุกเดือน ไม่ต้องอิงวันนี้
static int weekdayOf(int y, int m, int d) {
  static const int t[] = {0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4};
  int yy = y - (m < 3 ? 1 : 0);
  return (yy + yy / 4 - yy / 100 + yy / 400 + t[m - 1] + d) % 7;
}

static int daysInMonth(int y, int m) {
  static const int t[] = {31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31};
  if (m == 2 && ((y % 4 == 0 && y % 100 != 0) || y % 400 == 0)) return 29;
  return t[m - 1];
}

static const char* holidayOf(int day) {
  for (int i = 0; i < gCal.holidayN; i++) {
    if (gCal.holidayDay[i] == day) return gCal.holidayLbl[i];
  }
  return nullptr;
}

// ดึงปฏิทินเดือนอื่น — device-summary ส่งมาแค่เดือนปัจจุบัน
// URL ประกอบจาก DEVICE_SUMMARY_URL ตัวเดียว จะได้ไม่ต้องมี build flag ให้ลืม sync
static bool fetchMonth(int y, int m) {
  if (WiFi.status() != WL_CONNECTED) return false;
  String url = DEVICE_SUMMARY_URL;
  url.replace("/api/device-summary", "/api/month");
  url += "?y=" + String(y) + "&m=" + String(m);

  HTTPClient http;
  http.setTimeout(8000);
  http.begin(url);
  if (http.GET() != HTTP_CODE_OK) { http.end(); return false; }
  String payload = http.getString();
  http.end();

  JsonDocument doc;
  if (deserializeJson(doc, payload)) return false;
  int today = gCal.today;
  gCal = CalMonth{};
  gCal.y = doc["y"] | y;
  gCal.m = doc["m"] | m;
  gCal.today = today;
  for (int d : doc["buddhaDays"].as<JsonArray>()) {
    if (d >= 1 && d <= 31) gCal.buddhaMask |= 1UL << d;
  }
  for (JsonObject h : doc["holidays"].as<JsonArray>()) {
    if (gCal.holidayN >= 6) break;
    uint8_t k = gCal.holidayN;
    gCal.holidayDay[k] = h["d"] | 0;
    strncpy(gCal.holidayLbl[k], h["label"] | "", sizeof(gCal.holidayLbl[0]) - 1);
    gCal.holidayN++;
  }
  return true;
}

static void openMonthView();

// เปลี่ยนเดือนต้องทำนอก event — openMonthView ลบ monthGrid ที่ปุ่มตัวเองอยู่ข้างใน
static void monthStep(void* arg) {
  int delta = (int)(intptr_t)arg;
  int y = gCal.y, m = gCal.m + delta;
  if (m > 12) { m = 1; y++; }
  if (m < 1) { m = 12; y--; }
  if (fetchMonth(y, m)) openMonthView();
}

// แตะวันในปฏิทิน → เปิดหน้า detail เดิมซ้อนทับ ปิดแล้วกลับมาที่ปฏิทิน
static void dayClicked(lv_event_t* e) {
  int day = (int)(intptr_t)lv_obj_get_user_data((lv_obj_t*)lv_event_get_current_target(e));
  if (day < 1) return;

  int wd = weekdayOf(gCal.y, gCal.m, day);

  char buf[128];
  snprintf(buf, sizeof(buf), "%d %s %d", day, kThaiMonths[gCal.m - 1], gCal.y + 543);
  setThaiText(detailTitle, "ปฏิทิน");
  setThaiText(detailValue, buf);

  const char* hol = holidayOf(day);
  bool buddha = gCal.buddhaMask & (1UL << day);
  snprintf(buf, sizeof(buf), "วัน%s%s%s%s", kThaiDays[wd],
           hol ? " · " : "", hol ? hol : "",
           buddha ? (hol ? "\nวันพระ" : " · วันพระ") : "");
  if (!hol && !buddha) snprintf(buf, sizeof(buf), "วัน%s", kThaiDays[wd]);
  String text = buf;
  for (int i = 0; i < gCal.evN; i++) {
    if (gCal.evDay[i] != day) continue;
    text += "\n";
    if (gCal.evTime[i][0]) { text += gCal.evTime[i]; text += " · "; }
    text += gCal.evLabel[i];
  }
  setThaiText(detailText, text.c_str());

  if (vizBox) { lv_obj_delete(vizBox); vizBox = nullptr; }
  for (lv_obj_t* o : {detailTitle, detailValue, detailText}) lv_obj_remove_flag(o, LV_OBJ_FLAG_HIDDEN);
  lv_obj_scroll_to_y(detailBody, 0, LV_ANIM_OFF);
  lv_obj_remove_flag(detailView, LV_OBJ_FLAG_HIDDEN);
}

// ตารางปฏิทินรายเดือน 7x6 — วันนี้ไฮไลต์ วันหยุดเป็นสีแดง วันพระมีจุดใต้ตัวเลข
static void openMonthView() {
  if (!gCal.m) return;
  if (monthGrid) lv_obj_delete(monthGrid);

  const int cellW = kGraphW / 7, cellH = 30;
  // 64 = หัวเดือน + ระยะหายใจ + แถวชื่อวัน, ท้ายเผื่อ 24 ให้ legend ไม่โดนกล่องตัดขาด
  const int kGridTop = 64;
  monthGrid = plainBox(monthBody, kGraphW, kGridTop + cellH * 6 + 24);
  lv_obj_remove_flag(monthGrid, LV_OBJ_FLAG_EVENT_BUBBLE);  // แตะช่องว่างไม่ต้องปิดหน้า

  lv_obj_t* title = lv_label_create(monthGrid);
  lv_obj_set_style_text_font(title, &thai22, 0);
  lv_obj_set_style_text_color(title, lv_color_hex(C_TEXT), 0);
  char buf[48];
  snprintf(buf, sizeof(buf), "%s %d", kThaiMonthsFull[gCal.m - 1], gCal.y + 543);
  setThaiText(title, buf);
  lv_obj_set_pos(title, 0, 0);

  // ปุ่มเลื่อนเดือนอยู่ในเนื้อหา ไม่ใช่แถบ nav ขวา — แถบนั้นสงวนไว้ให้ ปิด/เลื่อนจอ
  const struct { const char* icon; int delta; int x; } steps[] = {
    {LV_SYMBOL_LEFT, -1, kGraphW - 88},
    {LV_SYMBOL_RIGHT, 1, kGraphW - 40},
  };
  for (const auto& st : steps) {
    lv_obj_t* b = lv_button_create(monthGrid);
    lv_obj_set_size(b, 40, 32);
    lv_obj_set_style_bg_color(b, lv_color_hex(0x2A3556), 0);
    lv_obj_set_style_radius(b, 8, 0);
    lv_obj_set_ext_click_area(b, 6);
    lv_obj_set_pos(b, st.x, 0);
    lv_obj_set_user_data(b, (void*)(intptr_t)st.delta);
    lv_obj_add_event_cb(b, [](lv_event_t* e) {
      void* d = lv_obj_get_user_data((lv_obj_t*)lv_event_get_current_target(e));
      lv_async_call(monthStep, d);
    }, LV_EVENT_PRESSED, nullptr);

    lv_obj_t* ic = lv_label_create(b);
    lv_label_set_text(ic, st.icon);
    lv_obj_set_style_text_color(ic, lv_color_hex(0xB9C4E6), 0);
    lv_obj_center(ic);
  }

  for (int c = 0; c < 7; c++) {
    lv_obj_t* w = lv_label_create(monthGrid);
    lv_obj_set_style_text_font(w, &thai14, 0);
    lv_obj_set_style_text_color(w, lv_color_hex(c == 0 ? 0xF87171 : C_MUTED), 0);
    lv_obj_set_style_text_align(w, LV_TEXT_ALIGN_CENTER, 0);
    lv_obj_set_width(w, cellW);
    setThaiText(w, kThaiDayShort[c]);
    lv_obj_set_pos(w, c * cellW, kGridTop - 20);
  }

  time_t nowSec = time(nullptr);
  struct tm tmNow;
  localtime_r(&nowSec, &tmNow);
  bool thisMonth = (gCal.y == tmNow.tm_year + 1900 && gCal.m == tmNow.tm_mon + 1);
  int firstWd = weekdayOf(gCal.y, gCal.m, 1);
  int total = daysInMonth(gCal.y, gCal.m);

  for (int day = 1; day <= total; day++) {
    int slot = firstWd + day - 1;
    int col = slot % 7, row = slot / 7;
    bool isToday = thisMonth && day == tmNow.tm_mday;
    const char* hol = holidayOf(day);
    bool buddha = gCal.buddhaMask & (1UL << day);
    int evIdx = -1;
    for (int i = 0; i < gCal.evN; i++) {
      if (gCal.evDay[i] == day) { evIdx = i; break; }
    }

    lv_obj_t* cell = plainBox(monthGrid, cellW - 2, cellH - 2);
    lv_obj_remove_flag(cell, LV_OBJ_FLAG_EVENT_BUBBLE);
    lv_obj_add_flag(cell, LV_OBJ_FLAG_CLICKABLE);
    lv_obj_set_ext_click_area(cell, 2);
    lv_obj_set_user_data(cell, (void*)(intptr_t)day);
    lv_obj_add_event_cb(cell, dayClicked, LV_EVENT_CLICKED, nullptr);
    lv_obj_set_pos(cell, col * cellW + 1, kGridTop + row * cellH);
    if (isToday) {
      lv_obj_set_style_bg_opa(cell, LV_OPA_COVER, 0);
      lv_obj_set_style_bg_color(cell, lv_color_hex(C_WARN), 0);
      lv_obj_set_style_radius(cell, 8, 0);
    }

    // ระดับพลังสาจูเป็นพื้นจาง ๆ ของช่อง ไม่ใช่แถบ — แถบกินขอบล่างซึ่งเป็นที่ของจุดวันพระ/นัด
    // และโชว์เฉพาะวันที่สุดขั้ว (พลังดี/ควรระวัง) เพราะถ้าระบายทุกวันจะไม่เหลือสัญญาณอะไรเลย
    int sajuLv = gCal.sajuLv[day];
    if (!isToday && (sajuLv == 0 || sajuLv == 2)) {
      lv_obj_set_style_bg_opa(cell, 46, 0);
      lv_obj_set_style_bg_color(cell, lv_color_hex(sajuColor(sajuLv)), 0);
      lv_obj_set_style_radius(cell, 8, 0);
    }

    lv_obj_t* num = lv_label_create(cell);
    lv_obj_set_style_text_font(num, &thai18, 0);
    lv_obj_set_style_text_color(
        num, lv_color_hex(isToday ? C_BG : hol ? 0xF87171 : C_TEXT), 0);
    lv_label_set_text_fmt(num, "%d", day);
    lv_obj_align(num, LV_ALIGN_TOP_MID, 0, buddha ? -1 : 2);

    // จุดใต้ตัวเลข — วันพระซ้าย นัดจากปฏิทินภายนอกขวา วันเดียวเป็นได้ทั้งคู่
    if (buddha) {
      lv_obj_t* dot = plainBox(cell, 4, 4);
      lv_obj_set_style_bg_opa(dot, LV_OPA_COVER, 0);
      lv_obj_set_style_bg_color(dot, lv_color_hex(isToday ? C_BG : 0x60A5FA), 0);
      lv_obj_set_style_radius(dot, 2, 0);
      lv_obj_align(dot, LV_ALIGN_BOTTOM_MID, buddha && evIdx >= 0 ? -5 : 0, -1);
    }
    if (evIdx >= 0) {
      lv_obj_t* dot = plainBox(cell, 4, 4);
      lv_obj_set_style_bg_opa(dot, LV_OPA_COVER, 0);
      lv_obj_set_style_bg_color(dot, lv_color_hex(gCal.feedColor[gCal.evFeed[evIdx] & 3]), 0);
      lv_obj_set_style_radius(dot, 2, 0);
      lv_obj_align(dot, LV_ALIGN_BOTTOM_MID, buddha ? 5 : 0, -1);
    }
  }

  lv_obj_t* legend = lv_label_create(monthGrid);
  lv_obj_set_style_text_font(legend, &thai14, 0);
  lv_obj_set_style_text_color(legend, lv_color_hex(C_MUTED), 0);
  setThaiText(legend, gCal.sajuLv[gCal.today] >= 0
                          ? "แดง = วันหยุด · จุดน้ำเงิน = วันพระ · พื้นเขียว/แดง = พลังวันนั้น"
                          : "แดง = วันหยุด · จุดน้ำเงิน = วันพระ · แตะวันเพื่อดูรายละเอียด");
  lv_obj_set_pos(legend, 0, kGridTop + cellH * 6 + 4);

  lv_obj_scroll_to_y(monthBody, 0, LV_ANIM_OFF);
  lv_obj_remove_flag(monthView, LV_OBJ_FLAG_HIDDEN);
}

static void cardClicked(lv_event_t* e) {
  // ponytail: current_target ไม่ใช่ target — กราฟในการ์ด bubble event ขึ้นมา
  // ถ้าใช้ target จะได้ตัวกราฟแล้ว lv_label_get_text assert ตาย
  lv_obj_t* card = (lv_obj_t*)lv_event_get_current_target(e);
  int cardIdx = (int)(intptr_t)lv_obj_get_user_data(card);
  // การ์ดปฏิทินเข้าหน้าเดือนก่อน แล้วค่อยแตะรายวันเข้า detail
  if (cardIdx >= 0 && cardIdx < cardCount && cardViz[cardIdx].kind == VIZ_CALENDAR) {
    openMonthView();
    return;
  }
  lv_label_set_text(detailTitle, lv_label_get_text(lv_obj_get_child(card, 0)));
  lv_label_set_text(detailValue, lv_label_get_text(lv_obj_get_child(card, 1)));
  lv_obj_t* third = lv_obj_get_child(card, 2);
  lv_label_set_text(detailText, third ? lv_label_get_text(third) : "");

  if (vizBox) { lv_obj_delete(vizBox); vizBox = nullptr; }
  int idx = (int)(intptr_t)lv_obj_get_user_data(card);
  if (idx >= 0 && idx < cardCount && cardViz[idx].kind != VIZ_NONE) {
    vizBox = lv_obj_create(detailBody);
    lv_obj_set_size(vizBox, kGraphW, LV_SIZE_CONTENT);
    lv_obj_set_style_bg_opa(vizBox, LV_OPA_TRANSP, 0);
    lv_obj_set_style_border_width(vizBox, 0, 0);
    lv_obj_set_style_pad_all(vizBox, 0, 0);
    lv_obj_set_flex_flow(vizBox, LV_FLEX_FLOW_COLUMN);
    lv_obj_add_flag(vizBox, LV_OBJ_FLAG_EVENT_BUBBLE);  // แตะกราฟก็ปิดหน้าได้

    switch (cardViz[idx].kind) {
      case VIZ_TOKENS:
        if (cardViz[idx].quotaPct >= 0) drawQuota(vizBox, cardViz[idx]);
        drawBars(vizBox, cardViz[idx]);
        break;
      case VIZ_HOURLY: drawWeatherHeader(vizBox); drawRainHours(vizBox); drawForecast(vizBox); break;
      case VIZ_SAJU:   drawSaju(vizBox); break;
      case VIZ_SCORE:  drawScore(vizBox, cardViz[idx]); break;
      case VIZ_PRICE:  drawPrice(vizBox, cardViz[idx]); break;
      default: break;
    }
    lv_obj_move_to_index(detailText, -1);  // vizBox สร้างทีหลัง ต้องดันคำอธิบายลงท้ายเสมอ
  }
  // อากาศเนื้อหาแน่น — ตัดหัวข้อทิ้งแล้วย่อบรรทัดค่าลง ให้จบในจอเดียวไม่ต้องเลื่อน
  bool weather = idx >= 0 && idx < cardCount && cardViz[idx].kind == VIZ_HOURLY;
  // อากาศมี header ของตัวเองใน vizBox — หัวมาตรฐาน 3 บรรทัดซ้ำซ้อน ซ่อนทิ้ง
  for (lv_obj_t* o : {detailTitle, detailValue, detailText}) {
    if (weather) lv_obj_add_flag(o, LV_OBJ_FLAG_HIDDEN);
    else lv_obj_remove_flag(o, LV_OBJ_FLAG_HIDDEN);
  }

  lv_obj_scroll_to_y(detailBody, 0, LV_ANIM_OFF);  // เปิดการ์ดใหม่ต้องเริ่มอ่านจากบน
  lv_obj_remove_flag(detailView, LV_OBJ_FLAG_HIDDEN);

}

static const int kCardW = 198;
static const int kCardH = 104;

// เส้นแนวโน้มบางในการ์ด — ไม่มีกรอบ ไม่มีตาราง ให้รูปทรงเส้นเล่าเรื่องอย่างเดียว
static void addSpark(lv_obj_t* card, const CardViz& viz) {
  lv_obj_t* chart = lv_chart_create(card);
  lv_obj_set_size(chart, kCardW - 20, 34);
  lv_obj_align(chart, LV_ALIGN_BOTTOM_MID, 0, -6);
  lv_chart_set_type(chart, LV_CHART_TYPE_LINE);
  lv_chart_set_point_count(chart, viz.sparkN);
  lv_chart_set_div_line_count(chart, 0, 0);
  lv_obj_set_style_bg_opa(chart, LV_OPA_TRANSP, 0);
  lv_obj_set_style_border_width(chart, 0, 0);
  lv_obj_set_style_pad_all(chart, 0, 0);
  lv_obj_set_style_size(chart, 0, 0, LV_PART_INDICATOR);
  lv_obj_set_style_line_width(chart, 3, LV_PART_ITEMS);
  lv_obj_set_style_line_rounded(chart, true, LV_PART_ITEMS);
  lv_obj_clear_flag(chart, LV_OBJ_FLAG_CLICKABLE);
  lv_obj_add_flag(chart, LV_OBJ_FLAG_EVENT_BUBBLE);

  float lo = viz.spark[0], hi = viz.spark[0];
  for (int i = 0; i < viz.sparkN; i++) { lo = min(lo, viz.spark[i]); hi = max(hi, viz.spark[i]); }
  if (hi - lo < 0.01f) hi = lo + 1;  // เส้นแบนสนิทจะหายไปกลางกราฟ ดันช่วงให้เห็นเส้น
  lv_chart_set_range(chart, LV_CHART_AXIS_PRIMARY_Y, (int32_t)(lo * 100), (int32_t)(hi * 100));

  lv_chart_series_t* ser = lv_chart_add_series(chart, lv_color_hex(viz.accent), LV_CHART_AXIS_PRIMARY_Y);
  for (int i = 0; i < viz.sparkN; i++) lv_chart_set_next_value(chart, ser, (int32_t)(viz.spark[i] * 100));
}

static void addCard(const char* title, const char* value, const char* detail, const char* tone, int vizIndex) {
  CardViz& viz = cardViz[vizIndex];
  viz.accent = toneColor(tone);

  lv_obj_t* card = lv_obj_create(cardList);
  lv_obj_set_size(card, kCardW, kCardH);
  lv_obj_add_flag(card, LV_OBJ_FLAG_CLICKABLE);
  lv_obj_clear_flag(card, LV_OBJ_FLAG_SCROLLABLE);
  lv_obj_set_user_data(card, (void*)(intptr_t)vizIndex);
  lv_obj_add_event_cb(card, cardClicked, LV_EVENT_CLICKED, nullptr);
  lv_obj_set_style_bg_color(card, lv_color_hex(C_CARD), 0);
  lv_obj_set_style_border_width(card, 0, 0);
  lv_obj_set_style_radius(card, 14, 0);
  lv_obj_set_style_pad_all(card, 0, 0);

  lv_obj_t* t = lv_label_create(card);
  lv_obj_set_style_text_font(t, &thai18, 0);
  lv_obj_set_style_text_color(t, lv_color_hex(C_MUTED), 0);
  lv_obj_set_size(t, kCardW - 20, 20);  // สูง 1 บรรทัด ไม่งั้น LONG_DOT ยัง wrap ได้
  lv_label_set_long_mode(t, LV_LABEL_LONG_DOT);
  setThaiText(t, title);
  lv_obj_align(t, LV_ALIGN_TOP_LEFT, 10, 8);

  lv_obj_t* v = lv_label_create(card);
  lv_obj_set_style_text_font(v, &thai22, 0);
  lv_obj_set_style_text_color(v, lv_color_hex(C_TEXT), 0);
  lv_obj_set_size(v, kCardW - 20, 26);
  lv_label_set_long_mode(v, LV_LABEL_LONG_DOT);
  setThaiText(v, value);
  lv_obj_align(v, LV_ALIGN_TOP_LEFT, 10, 28);

  lv_obj_t* d = lv_label_create(card);
  lv_obj_add_flag(d, LV_OBJ_FLAG_HIDDEN);  // เก็บไว้ให้หน้า detail อ่าน ไม่โชว์บนการ์ด
  setThaiText(d, detail);

  // การ์ดที่ไม่มีเส้นแนวโน้มให้ค่าอยู่กลางการ์ด จะได้ดูตั้งใจ ไม่ใช่ว่างเพราะลืม
  if (viz.sparkN > 1) addSpark(card, viz);
  else lv_obj_align(v, LV_ALIGN_LEFT_MID, 10, 6);
}

// ค่าความสว่างและช่วงเวลามาจากหลังบ้าน — ช่วงกลางคืนคร่อมเที่ยงคืนได้ จึงเช็คสองแบบ
static void applyBacklight(int mins) {
  bool night = nightStartMin <= nightEndMin
                   ? (mins >= nightStartMin && mins < nightEndMin)
                   : (mins >= nightStartMin || mins < nightEndMin);
  static int lastLevel = -1;
  int level = night ? briNight : briDay;
  if (level == lastLevel) return;
  lastLevel = level;
  ledcWrite(1, level);
}

static void updateClock(lv_timer_t*) {
  time_t now = time(nullptr);
  if (now < 1000000000) {  // ยังไม่ได้เวลาจริงจาก NTP
    lv_label_set_text(headValue, "");  // clock48 มีแค่ 0-9 : ° — ขีดจะออกมาเป็นกล่องว่าง
    return;
  }
  struct tm tm;
  localtime_r(&now, &tm);

  char buf[8];
  strftime(buf, sizeof(buf), "%H:%M", &tm);
  lv_label_set_text(headValue, buf);

  // พ.ศ. = ค.ศ. + 543
  setThaiText(headDetail, (String("วัน") + kThaiDays[tm.tm_wday] + "ที่ " + tm.tm_mday + " " +
                           kThaiMonths[tm.tm_mon] + " " + (tm.tm_year + 1900 + 543))
                              .c_str());
  applyBacklight(tm.tm_hour * 60 + tm.tm_min);
}

// เส้นขอบบนเป็นตัวบอกสถานะตัวเดียวของทั้งเครื่อง:
//   วิ่งอำพัน = กำลังดึงข้อมูล · แดงเต็มความกว้าง = มีปัญหา · หายไป = ปกติ
// เดิมมีจุดสถานะข้างนาฬิกาด้วย แต่มันวางทับเลขและซ้ำหน้าที่กับเส้นนี้
static bool busyError = false;

static void busyAnimate() {
  lv_anim_t a;
  lv_anim_init(&a);
  lv_anim_set_var(&a, busyRing);
  lv_anim_set_values(&a, -130, 480);
  lv_anim_set_duration(&a, 1100);
  lv_anim_set_repeat_count(&a, LV_ANIM_REPEAT_INFINITE);
  lv_anim_set_exec_cb(&a, [](void* o, int32_t v) { lv_obj_set_x((lv_obj_t*)o, v); });
  lv_anim_start(&a);
}

static void setBusy(bool on) {
  if (!busyRing || busyError) return;  // ขึ้นแดงค้างไว้แล้วอย่าให้ตัววิ่งมาทับ
  if (on) {
    lv_obj_set_width(busyRing, 130);
    lv_obj_set_style_bg_color(busyRing, lv_color_hex(C_WARN), 0);
    busyAnimate();
    lv_obj_remove_flag(busyRing, LV_OBJ_FLAG_HIDDEN);
  } else {
    lv_anim_delete(busyRing, nullptr);
    lv_obj_add_flag(busyRing, LV_OBJ_FLAG_HIDDEN);
  }
}

static void setStatus(const char* msg, uint32_t color) {
  busyError = (color != C_UP && color != C_WARN);
  if (busyError) {
    lv_anim_delete(busyRing, nullptr);
    lv_obj_set_x(busyRing, 0);
    lv_obj_set_width(busyRing, 480);
    lv_obj_set_style_bg_color(busyRing, lv_color_hex(color), 0);
    lv_obj_remove_flag(busyRing, LV_OBJ_FLAG_HIDDEN);
  } else if (color == C_UP) {
    lv_anim_delete(busyRing, nullptr);
    lv_obj_add_flag(busyRing, LV_OBJ_FLAG_HIDDEN);
    return;  // ปกติดีก็ไม่ต้องรบกวนด้วยข้อความ
  }
  setThaiText(headDetail, msg);
  lv_obj_set_style_text_color(headDetail, lv_color_hex(color), 0);
}

static bool fetchAndRender() {
  setBusy(true);
  struct Done { ~Done() { setBusy(false); } } done;  // ออกทางไหนก็ปิดวงแหวนเสมอ
  if (WiFi.status() != WL_CONNECTED) {
    setStatus("Wi-Fi หลุด", 0xF87171);
    return false;
  }

  Serial.printf("fetch เริ่ม · heap %u\n", (unsigned)ESP.getFreeHeap());
  HTTPClient http;
  http.setTimeout(8000);
  http.begin(DEVICE_SUMMARY_URL);
  int code = http.GET();
  if (code != HTTP_CODE_OK) {
    Serial.printf("http failed: %d\n", code);
    setStatus(String("ต่อ backend ไม่ได้ (").c_str(), 0xF87171);
    setStatus((String("ต่อ backend ไม่ได้ (") + code + ") · ลองใหม่ใน 30 วิ").c_str(), C_DOWN);
    http.end();
    return false;
  }

  // ponytail: อ่านเป็น String ก่อน — parse จาก stream ตรง ๆ ได้ InvalidInput (chunked encoding)
  String payload = http.getString();
  http.end();
  JsonDocument doc;
  DeserializationError err = deserializeJson(doc, payload);
  if (err) {
    Serial.printf("json failed: %s (payload %u bytes)\n", err.c_str(), payload.length());
    setStatus("อ่านข้อมูลไม่ได้", 0xF87171);
    return false;
  }

  // ค่าคุมตัวจอมาจากหลังบ้าน — ปรับรอบรีเฟรช/ความสว่างได้โดยไม่ต้อง flash ใหม่
  JsonObject dev = doc["device"];
  if (dev) {
    uint32_t sec = dev["refreshSeconds"] | 300;
    kRefreshMs = constrain(sec, 60UL, 3600UL) * 1000UL;
    JsonObject disp = dev["display"];
    if (disp) {
      briDay = constrain((int)(disp["brightnessDay"] | 255), 10, 255);
      briNight = constrain((int)(disp["brightnessNight"] | 40), 0, 255);
      const char* ns = disp["nightStart"] | "22:00";
      const char* ne = disp["nightEnd"] | "06:30";
      nightStartMin = atoi(ns) * 60 + atoi(ns + 3);
      nightEndMin = atoi(ne) * 60 + atoi(ne + 3);
    }
  }

  lv_obj_clean(cardList);
  if (vizBox) { lv_obj_delete(vizBox); vizBox = nullptr; }
  int n = 0;
  cardCount = 0;
  logoUsed = 0;
  for (JsonObject c : doc["cards"].as<JsonArray>()) {
    const char* type = c["type"] | "";
    const char* value = c["value"] | "-";
    const char* detail = c["detail"] | "";

    // การ์ดนาฬิกาข้าม — หัวจอใช้เวลาจาก NTP ในเครื่องแทน แม่นกว่าและไม่ต้องรอ fetch
    if (!strcmp(type, "clock")) continue;

    // ยกอากาศกับจันทรคติขึ้นแถบบน — เป็นข้อมูลที่มองแวบเดียวต้องเห็น
    if (!strcmp(type, "weather")) {
      setThaiText(heroWeather, value);
    } else if (!strcmp(type, "lunar")) {
      setThaiText(heroLunar, value);
    }

    if (cardCount >= kMaxCards) break;

    CardViz& viz = cardViz[cardCount];
    viz = CardViz{};
    JsonObject extra = c["extra"];

    // viz มาตรฐานจาก backend — ทุกการ์ดมีอย่างใดอย่างหนึ่งเสมอ
    JsonObject vz = c["viz"];
    if (vz) {
      const char* kind = vz["kind"] | "";
      if (!strcmp(kind, "spark")) {
        for (float pt : vz["points"].as<JsonArray>()) {
          if (viz.sparkN >= 24) break;
          viz.spark[viz.sparkN++] = pt;
        }
      } else if (!strcmp(kind, "gauge")) {
        viz.isGauge = true;
        viz.gaugeVal = vz["value"] | 0.0f;
        viz.gaugeMax = vz["max"] | 1.0f;
        strncpy(viz.gaugeUnit, vz["unit"] | "", sizeof(viz.gaugeUnit) - 1);
      }
    }

    if (!strcmp(type, "token") && extra["usage"][0]) {
      JsonObject sess = extra["quota"]["session"];
      if (sess) {
        viz.quotaPct = sess["pct"] | 0.0f;
        viz.quotaMinutes = sess["minutesLeft"] | 0;
        viz.quotaWeekPct = extra["quota"]["week"]["pct"] | -1.0f;
      }
      JsonObject u = extra["usage"][0];
      const char* names[] = {"ส่งเข้า", "ตอบกลับ", "อ่านแคช", "เขียนแคช"};
      const char* keys[] = {"input", "output", "cacheRead", "cacheWrite"};
      for (int i = 0; i < 4; i++) {
        viz.v[i] = u[keys[i]] | 0.0f;
        strncpy(viz.lbl[i], names[i], sizeof(viz.lbl[i]) - 1);
      }
      viz.n = 4;
      viz.kind = VIZ_TOKENS;
    } else if (!strcmp(type, "weather") && extra["hourly"]) {
      gWeather = WeatherViz{};
      for (JsonObject h : extra["hourly"].as<JsonArray>()) {
        if (viz.n >= 8) break;
        viz.v[viz.n] = h["v"] | 0.0f;
        gWeather.hourRain[viz.n] = h["p"] | 0;
        strncpy(gWeather.hourLbl[viz.n], h["t"] | "", sizeof(gWeather.hourLbl[0]) - 1);
        viz.n++;
      }
      gWeather.hourN = viz.n;
      JsonObject nw = extra["now"];
      gWeather.nowTemp = nw["temp"] | 0;
      gWeather.nowRain = nw["rain"] | 0;
      gWeather.nowHum = nw["humidity"] | 0;
      gWeather.nowWind = nw["wind"] | 0;
      gWeather.nowCode = nw["code"] | 0;
      strncpy(gWeather.nowCond, nw["condition"] | "", sizeof(gWeather.nowCond) - 1);
      for (JsonObject f : extra["forecast"].as<JsonArray>()) {
        if (gWeather.fcN >= 8) break;
        uint8_t k = gWeather.fcN;
        strncpy(gWeather.fcDay[k], f["d"] | "", sizeof(gWeather.fcDay[0]) - 1);
        gWeather.fcHi[k] = f["hi"] | 0;
        gWeather.fcLo[k] = f["lo"] | 0;
        gWeather.fcCode[k] = f["code"] | 0;
        gWeather.fcN++;
      }
      if (viz.n) viz.kind = VIZ_HOURLY;
    } else if (!strcmp(type, "saju") && extra["saju"]) {
      JsonObject sj = extra["saju"];
      gSaju = SajuViz{};
      for (JsonObject b : sj["blocks"].as<JsonArray>()) {
        if (gSaju.n >= 12) break;
        gSaju.hr[gSaju.n] = b["h"] | 0;
        gSaju.lv[gSaju.n] = b["lv"] | 0;
        gSaju.n++;
      }
      gSaju.nowH = sj["nowH"] | 99;
      if (gSaju.n) viz.kind = VIZ_SAJU;
    } else if (!strcmp(type, "calendar") && extra["calendar"]) {
      JsonObject cal = extra["calendar"];
      gCal = CalMonth{};
      memset(gCal.sajuLv, -1, sizeof(gCal.sajuLv));
      gCal.y = cal["y"] | 0;
      gCal.m = cal["m"] | 0;
      gCal.today = cal["today"] | 0;
      for (int d : cal["buddhaDays"].as<JsonArray>()) {
        if (d >= 1 && d <= 31) gCal.buddhaMask |= 1UL << d;
      }
      for (JsonObject h : cal["holidays"].as<JsonArray>()) {
        if (gCal.holidayN >= 6) break;
        uint8_t k = gCal.holidayN;
        gCal.holidayDay[k] = h["d"] | 0;
        strncpy(gCal.holidayLbl[k], h["label"] | "", sizeof(gCal.holidayLbl[0]) - 1);
        gCal.holidayN++;
      }
      for (JsonObject ev : cal["events"].as<JsonArray>()) {
        if (gCal.evN >= 16) break;
        uint8_t k = gCal.evN;
        gCal.evDay[k] = ev["d"] | 0;
        gCal.evFeed[k] = ev["f"] | 0;
        strncpy(gCal.evTime[k], ev["time"] | "", sizeof(gCal.evTime[0]) - 1);
        strncpy(gCal.evLabel[k], ev["label"] | "", sizeof(gCal.evLabel[0]) - 1);
        gCal.evN++;
      }
      for (JsonObject sv : cal["saju"].as<JsonArray>()) {
        int d = sv["d"] | 0;
        if (d >= 1 && d <= 31) gCal.sajuLv[d] = sv["lv"] | -1;
      }
      int fi = 0;
      for (JsonObject f : cal["feeds"].as<JsonArray>()) {
        if (fi >= 4) break;
        gCal.feedColor[fi++] = strtoul(f["color"] | "4ADE80", nullptr, 16);
      }
      if (gCal.m) viz.kind = VIZ_CALENDAR;
    } else if (extra["stock"]) {
      JsonObject st = extra["stock"];
      strncpy(viz.ticker, st["ticker"] | "", sizeof(viz.ticker) - 1);
      viz.changePct = st["changePct"] | 0.0f;
      for (float close : st["closes"].as<JsonArray>()) {
        if (viz.n >= 24) break;
        viz.v[viz.n++] = close;
      }
      const char* b64 = st["logo"];
      if (b64 && logoUsed < kMaxLogos) {
        size_t written = 0;
        if (mbedtls_base64_decode(logoBuf[logoUsed], sizeof(logoBuf[0]), &written,
                                  (const unsigned char*)b64, strlen(b64)) == 0 &&
            written == sizeof(logoBuf[0])) {
          logoDsc[logoUsed] = lv_image_dsc_t{};
          logoDsc[logoUsed].header.magic = LV_IMAGE_HEADER_MAGIC;
          logoDsc[logoUsed].header.cf = LV_COLOR_FORMAT_RGB565;
          logoDsc[logoUsed].header.w = kLogoPx;
          logoDsc[logoUsed].header.h = kLogoPx;
          logoDsc[logoUsed].header.stride = kLogoPx * 2;
          logoDsc[logoUsed].data_size = written;
          logoDsc[logoUsed].data = logoBuf[logoUsed];
          viz.logoIdx = logoUsed++;
        }
      }
      if (viz.n) viz.kind = VIZ_PRICE;
    } else if (!strcmp(type, "astro")) {
      // คะแนนดวงอยู่ท้าย value เช่น "ตั้งรับ · 15/100"
      const char* slash = strstr(value, "/100");
      if (slash) {
        const char* p2 = slash;
        while (p2 > value && isdigit((unsigned char)*(p2 - 1))) p2--;
        viz.v[0] = atof(p2);
        viz.n = 1;
        viz.kind = VIZ_SCORE;
      }
    }

    addCard(c["title"] | "", value, detail, c["tone"] | "neutral", cardCount);
    cardCount++;
    n++;
  }

  setStatus("ok", C_UP);
  lv_obj_set_style_text_color(headDetail, lv_color_hex(C_MUTED), 0);  // คืนสีบรรทัดวันที่
  Serial.printf("rendered %d cards (payload %u bytes)\n", n, (unsigned)doc.size());
  return true;
}

void setup() {
  Serial.begin(115200);
  delay(300);
  Serial.printf("\n=== TanPlanet Smart Astro Calendar (build %s %s) ===\n", __DATE__, __TIME__);

  // backlight ผ่าน PWM เพื่อหรี่จอกลางคืนได้ (channel 1 — 0 กันไว้ให้ buzzer)
  ledcSetup(1, 5000, 8);
  ledcAttachPin(TFT_BL, 1);
  ledcWrite(1, kBacklightDay);
  tft.init();
  tft.setRotation(1);
  tft.fillScreen(TFT_BLACK);

  lv_init();
  lv_tick_set_cb([]() -> uint32_t { return millis(); });
  lv_display_t* disp = lv_display_create(480, 320);
  lv_display_set_flush_cb(disp, flushCb);
  lv_display_set_buffers(disp, drawBuf, nullptr, sizeof(drawBuf), LV_DISPLAY_RENDER_MODE_PARTIAL);

  touch.begin(tft.getSPIinstance());
  touch.setRotation(1);
  loadTouchCal();
  lv_indev_t* indev = lv_indev_create();
  lv_indev_set_type(indev, LV_INDEV_TYPE_POINTER);
  lv_indev_set_read_cb(indev, touchRead);

  lv_obj_t* scr = lv_screen_active();
  lv_obj_set_style_bg_color(scr, lv_color_hex(C_BG), 0);
  lv_obj_set_style_pad_all(scr, 0, 0);
  lv_obj_clear_flag(scr, LV_OBJ_FLAG_SCROLLABLE);

  // แถบบน: เวลาใหญ่อ่านได้จากอีกฝั่งห้อง + วันที่ไทย + สภาพอากาศย่อ
  lv_obj_t* hero = lv_obj_create(scr);
  lv_obj_set_size(hero, 480, 92);
  lv_obj_align(hero, LV_ALIGN_TOP_MID, 0, 0);
  lv_obj_set_style_bg_color(hero, lv_color_hex(C_HERO), 0);
  lv_obj_set_style_border_width(hero, 0, 0);
  lv_obj_set_style_radius(hero, 0, 0);
  lv_obj_set_style_pad_all(hero, 0, 0);
  lv_obj_clear_flag(hero, LV_OBJ_FLAG_SCROLLABLE);

  headValue = lv_label_create(hero);
  lv_obj_set_style_text_font(headValue, &clock48, 0);
  lv_obj_set_style_text_color(headValue, lv_color_hex(C_TEXT), 0);
  lv_label_set_text(headValue, "");
  lv_obj_align(headValue, LV_ALIGN_TOP_LEFT, 20, 8);

  // ตัวบอกว่ากำลังทำงาน = เส้นบางวิ่งที่ขอบบนสุดของจอ อยู่นอกพื้นที่เนื้อหาทั้งหมด
  // ทับอะไรไม่ได้ และไม่ใช้ฟอนต์จึงไม่มีทางกลายเป็นกล่องว่างเหมือนแบบเดิม
  busyRing = lv_obj_create(scr);
  lv_obj_set_size(busyRing, 130, 3);
  lv_obj_set_pos(busyRing, 0, 0);
  lv_obj_set_style_bg_color(busyRing, lv_color_hex(C_WARN), 0);
  lv_obj_set_style_bg_opa(busyRing, LV_OPA_COVER, 0);
  lv_obj_set_style_border_width(busyRing, 0, 0);
  lv_obj_set_style_radius(busyRing, 0, 0);
  lv_obj_remove_flag(busyRing, LV_OBJ_FLAG_SCROLLABLE);
  lv_obj_add_flag(busyRing, LV_OBJ_FLAG_HIDDEN);

  headDetail = lv_label_create(hero);
  lv_obj_set_style_text_font(headDetail, &thai18, 0);
  lv_obj_set_style_text_color(headDetail, lv_color_hex(C_MUTED), 0);
  setThaiText(headDetail, "กำลังเริ่มระบบ");
  lv_obj_align(headDetail, LV_ALIGN_BOTTOM_LEFT, 20, -8);

  heroLunar = lv_label_create(hero);
  lv_obj_set_style_text_font(heroLunar, &thai18, 0);
  lv_obj_set_style_text_color(heroLunar, lv_color_hex(C_WARN), 0);
  lv_label_set_text(heroLunar, "");
  lv_obj_align(heroLunar, LV_ALIGN_BOTTOM_RIGHT, -18, -8);

  heroWeather = lv_label_create(hero);
  lv_obj_set_style_text_font(heroWeather, &thai36, 0);
  lv_obj_set_style_text_color(heroWeather, lv_color_hex(C_TEXT), 0);
  lv_label_set_text(heroWeather, "");
  lv_obj_align(heroWeather, LV_ALIGN_TOP_RIGHT, -18, 10);

  // กดค้างที่นาฬิกาเพื่อคาลิเบรตทัช — ไม่ต้องมีปุ่มกินพื้นที่
  lv_obj_add_flag(headValue, LV_OBJ_FLAG_CLICKABLE);
  lv_obj_set_ext_click_area(headValue, 16);
  lv_obj_add_event_cb(headValue, [](lv_event_t*) {
    calibrateTouch();
    lv_obj_invalidate(lv_screen_active());
  }, LV_EVENT_LONG_PRESSED, nullptr);

  // 2 คอลัมน์ — เห็น 4 การ์ดต่อหน้า แทนที่จะเลื่อนดูทีละใบ
  cardList = lv_obj_create(scr);
  lv_obj_set_size(cardList, 408, 216);
  lv_obj_align(cardList, LV_ALIGN_TOP_LEFT, 10, 96);
  lv_obj_set_style_bg_opa(cardList, LV_OPA_TRANSP, 0);
  lv_obj_set_style_border_width(cardList, 0, 0);
  lv_obj_set_style_pad_all(cardList, 0, 0);
  lv_obj_set_style_pad_row(cardList, 8, 0);
  lv_obj_set_style_pad_column(cardList, 8, 0);
  lv_obj_set_flex_flow(cardList, LV_FLEX_FLOW_ROW_WRAP);
  lv_obj_set_scrollbar_mode(cardList, LV_SCROLLBAR_MODE_OFF);  // แถบขาวบางแทรกระหว่างการ์ดกับปุ่ม

  // ปุ่มเลื่อนขึ้น-ลง — resistive touch ลากไม่ลื่น กดปุ่มแม่นกว่า
  // ponytail: ใช้ LV_SYMBOL ของ montserrat ในตัว ไม่ต้องเพิ่ม glyph ลูกศรในฟอนต์ไทย
  struct ScrollBtn { const char* icon; int dy; lv_align_t align; int y; };
  const ScrollBtn scrollBtns[] = {
    {LV_SYMBOL_UP, -(kCardH + 8), LV_ALIGN_TOP_RIGHT, 96},
    {LV_SYMBOL_DOWN, kCardH + 8, LV_ALIGN_TOP_RIGHT, 208},
  };
  for (const ScrollBtn& b : scrollBtns) {
    lv_obj_t* btn = lv_button_create(scr);
    lv_obj_set_size(btn, 52, 104);  // touch target ใหญ่กว่า 44px — resistive ต้องกดแรง
    lv_obj_align(btn, b.align, -8, b.y);
    lv_obj_set_style_bg_color(btn, lv_color_hex(C_CARD), 0);
    lv_obj_set_style_radius(btn, 12, 0);
    lv_obj_set_ext_click_area(btn, 8);
    lv_obj_set_user_data(btn, (void*)(intptr_t)b.dy);
    lv_obj_add_event_cb(btn, [](lv_event_t* e) {
      int dy = (int)(intptr_t)lv_obj_get_user_data((lv_obj_t*)lv_event_get_current_target(e));
      lv_obj_scroll_by(cardList, 0, -dy, LV_ANIM_ON);
    }, LV_EVENT_CLICKED, nullptr);

    lv_obj_t* icon = lv_label_create(btn);
    lv_label_set_text(icon, b.icon);
    lv_obj_set_style_text_color(icon, lv_color_hex(0xB9C4E6), 0);
    lv_obj_center(icon);
  }

  // ปฏิทินสร้างก่อน detail เพื่อให้ detail ซ้อนทับได้ — ปิด detail แล้วกลับมาเห็นเดือนเดิม
  monthView = makeFullView(scr, &monthBody);
  detailView = makeFullView(scr, &detailBody);

  // ส่วนหัวติดบนเสมอ — เดิม value ใหญ่ดันหัวข้อจนล้นออกนอกจอ
  detailTitle = lv_label_create(detailBody);
  lv_obj_set_style_text_font(detailTitle, &thai18, 0);
  lv_obj_set_style_text_color(detailTitle, lv_color_hex(C_MUTED), 0);

  detailValue = lv_label_create(detailBody);
  lv_obj_set_style_text_font(detailValue, &thai36, 0);
  lv_obj_set_style_text_color(detailValue, lv_color_hex(C_TEXT), 0);
  lv_obj_set_width(detailValue, kGraphW);
  lv_label_set_long_mode(detailValue, LV_LABEL_LONG_WRAP);

  detailText = lv_label_create(detailBody);
  lv_obj_set_style_text_font(detailText, &thai18, 0);
  lv_obj_set_style_text_color(detailText, lv_color_hex(0xB9C4E6), 0);
  lv_obj_set_width(detailText, kGraphW);
  lv_label_set_long_mode(detailText, LV_LABEL_LONG_WRAP);  // ยาวแค่ไหนก็เลื่อนอ่านได้

  lv_timer_create(updateClock, 1000, nullptr);
  esp_task_wdt_init(20, true);  // loop ค้างเกิน 20 วิ = รีบูตเอง ดีกว่าค้างถาวร
  esp_task_wdt_add(nullptr);
  lv_refr_now(disp);

  // captive portal: ถ้ายังไม่เคยตั้ง Wi-Fi จะเปิด AP "TanPlanet_Config" ให้ตั้งจากมือถือ
  WiFiManager wm;
  // ponytail: ไม่ตั้ง timeout — เป็นจอตั้งโต๊ะ ให้ portal ค้างรอจนกว่าจะตั้งเสร็จ
  wm.setConfigPortalTimeout(0);
  setStatus("รอตั้ง Wi-Fi", 0xFBBF24);
  // ponytail: ห้ามยัดไทยลง headValue — ฟอนต์นาฬิกามีแค่ตัวเลขกับโคลอน ที่เหลือออกมาเป็นกล่องว่าง
  setThaiText(headDetail,
              "มือถือ → ต่อ Wi-Fi ชื่อ TanPlanet_Config\n"
              "ถ้าไม่เด้งหน้าตั้งค่า เปิด 192.168.4.1\n"
              "เลือก Wi-Fi บ้าน (2.4GHz เท่านั้น)");
  lv_refr_now(disp);
  if (!wm.autoConnect("TanPlanet_Config")) {
    setStatus("ตั้ง Wi-Fi ไม่สำเร็จ", 0xF87171);
    Serial.println("wifi portal failed");
  } else {
    Serial.printf("wifi ok: %s\n", WiFi.localIP().toString().c_str());
    // ICT-7 = UTC+7 ไม่มี DST — ตั้งผ่าน TZ string ให้ localtime_r คำนวณให้เอง
    configTzTime("ICT-7", "pool.ntp.org", "time.google.com");
    for (int i = 0; i < 20 && time(nullptr) < 1000000000; i++) delay(250);
    time_t nowSec = time(nullptr);
    Serial.printf("ntp: %s", nowSec > 1000000000 ? ctime(&nowSec) : "ไม่ได้เวลา\n");
    setStatus("กำลังดึงข้อมูล...", 0xFBBF24);
    lv_refr_now(disp);
    if (!fetchAndRender()) lastFetch = millis() - kRefreshMs + kRetryMs;
    else lastFetch = millis();
  }
}

void loop() {
  esp_task_wdt_reset();
  lv_timer_handler();
  delay(2);

  // heartbeat: ถ้าจอค้างแล้วบรรทัดนี้ยังมา = loop ยังหมุน ปัญหาอยู่ที่ LVGL/จอ
  // ถ้าหายไปด้วย = ค้างใน blocking call (HTTP/SPI) หรือ heap หมด
  static uint32_t beat = 0;
  if (millis() - beat > 20000) {
    beat = millis();
    Serial.printf("[%lus] heap %u · ก้อนใหญ่สุด %u\n", millis() / 1000,
                  (unsigned)ESP.getFreeHeap(),
                  (unsigned)heap_caps_get_largest_free_block(MALLOC_CAP_8BIT));
  }

  // ponytail: เปิดหน้า detail ค้างอยู่ = พักการรีเฟรช เพราะ fetchAndRender ลบกล่องกราฟทิ้ง
  // (กราฟผูกกับ cardViz[] ที่ถูกสร้างใหม่ทั้งชุด) — ปิดหน้าเมื่อไหร่ค่อยดึงรอบที่ค้างไว้ทันที
  bool detailOpen = !lv_obj_has_flag(detailView, LV_OBJ_FLAG_HIDDEN);
  if (!detailOpen && millis() - lastFetch > kRefreshMs) {
    lastFetch = fetchAndRender() ? millis() : millis() - kRefreshMs + kRetryMs;
  }
}
