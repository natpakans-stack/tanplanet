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

LV_FONT_DECLARE(thai18);
LV_FONT_DECLARE(thai36);

static TFT_eSPI tft;
// ponytail: touch แชร์สาย SPI 12/13/14 กับจอ — ห้ามสร้าง SPIClass ใหม่ ไม่งั้นจอตายสนิท
static XPT2046_Touchscreen touch(TOUCH_CS_PIN, TOUCH_IRQ_PIN);

// ponytail: 16 บรรทัด (15KB) — DRAM เหลือน้อยหลัง WiFi stack, 32 บรรทัดทำ link ล้ม
static const uint32_t kBufPixels = 480 * 16;
static uint8_t drawBuf[kBufPixels * 2];

static lv_obj_t* headValue;
static lv_obj_t* headDetail;
static lv_obj_t* statusLabel;
static lv_obj_t* cardList;
static lv_obj_t* detailView;
static lv_obj_t* detailTitle;
static lv_obj_t* detailValue;
static lv_obj_t* detailText;

static uint32_t lastFetch = 0;
static const uint32_t kRefreshMs = 5UL * 60UL * 1000UL;

// ponytail: flush เอง — LV_USE_TFT_ESPI สร้าง TFT_eSPI ซ้อนอีกตัวแล้ว pixel ไม่ออกจอ
static void flushCb(lv_display_t* disp, const lv_area_t* area, uint8_t* px_map) {
  uint32_t w = area->x2 - area->x1 + 1;
  uint32_t h = area->y2 - area->y1 + 1;
  tft.startWrite();
  tft.setAddrWindow(area->x1, area->y1, w, h);
  tft.pushColors((uint16_t*)px_map, w * h, true);
  tft.endWrite();
  lv_display_flush_ready(disp);
}

// ค่าคาลิเบรตทัช เก็บถาวรใน NVS — แตะจอค้างไว้ตอนเปิดเครื่องเพื่อคาลิเบรตใหม่
struct TouchCal {
  bool swapAxes;
  int32_t xMin, xMax, yMin, yMax;
} static cal = {false, 200, 3800, 200, 3800};

static Preferences prefs;

static void touchRead(lv_indev_t*, lv_indev_data_t* data) {
  if (!touch.touched()) {
    data->state = LV_INDEV_STATE_RELEASED;
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
  data->state = LV_INDEV_STATE_PRESSED;
}

// รอแตะ 1 ครั้งแล้วคืนค่า raw เฉลี่ย (กันมือสั่น)
static bool readRawPoint(int32_t& rx, int32_t& ry, uint32_t timeoutMs = 30000) {
  uint32_t start = millis();
  while (millis() - start < timeoutMs) {
    if (touch.touched()) {
      int32_t sx = 0, sy = 0, n = 0;
      while (touch.touched() && n < 40) {
        TS_Point p = touch.getPoint();
        sx += p.x; sy += p.y; n++;
        delay(10);
      }
      if (n >= 4) { rx = sx / n; ry = sy / n; return true; }
    }
    delay(10);
  }
  return false;
}

static void drawTarget(int x, int y, const char* label) {
  tft.fillScreen(TFT_BLACK);
  tft.drawLine(x - 14, y, x + 14, y, TFT_CYAN);
  tft.drawLine(x, y - 14, x, y + 14, TFT_CYAN);
  tft.drawCircle(x, y, 9, TFT_CYAN);
  tft.setTextColor(TFT_WHITE, TFT_BLACK);
  tft.drawString(label, 120, 150, 4);
}

// 3 จุด: มุมบนซ้าย → บนขวา → ล่างซ้าย
// จุดที่ 2 บอกว่าแกน x ของจอผูกกับ raw แกนไหน (ตัวไหนขยับมากกว่า)
static void calibrateTouch() {
  const int32_t sx1 = 30, sy1 = 30, sx2 = 450, sy2 = 30, sx3 = 30, sy3 = 290;
  int32_t r1x, r1y, r2x, r2y, r3x, r3y;

  drawTarget(sx1, sy1, "tap the target 1/3");
  if (!readRawPoint(r1x, r1y)) return;
  delay(400);
  drawTarget(sx2, sy2, "tap the target 2/3");
  if (!readRawPoint(r2x, r2y)) return;
  delay(400);
  drawTarget(sx3, sy3, "tap the target 3/3");
  if (!readRawPoint(r3x, r3y)) return;

  // จุด1→จุด2 จอขยับแกน x อย่างเดียว — raw แกนที่ขยับมากกว่าคือแกน x ของทัช
  cal.swapAxes = abs(r2y - r1y) > abs(r2x - r1x);
  int32_t ax1 = cal.swapAxes ? r1y : r1x, ay1 = cal.swapAxes ? r1x : r1y;
  int32_t ax2 = cal.swapAxes ? r2y : r2x;
  int32_t ay3 = cal.swapAxes ? r3x : r3y;

  // extrapolate จากจุดที่แตะ (30..450 / 30..290) ออกไปถึงขอบจอ (0..479 / 0..319)
  double sxSpan = (double)(ax2 - ax1) / (sx2 - sx1);
  double sySpan = (double)(ay3 - ay1) / (sy3 - sy1);
  cal.xMin = ax1 - (int32_t)(sx1 * sxSpan);
  cal.xMax = cal.xMin + (int32_t)(479 * sxSpan);
  cal.yMin = ay1 - (int32_t)(sy1 * sySpan);
  cal.yMax = cal.yMin + (int32_t)(319 * sySpan);

  prefs.begin("tanplanet", false);
  prefs.putBool("swap", cal.swapAxes);
  prefs.putInt("xMin", cal.xMin);
  prefs.putInt("xMax", cal.xMax);
  prefs.putInt("yMin", cal.yMin);
  prefs.putInt("yMax", cal.yMax);
  prefs.end();

  Serial.printf("touch cal: swap=%d x[%d..%d] y[%d..%d]\n",
                cal.swapAxes, cal.xMin, cal.xMax, cal.yMin, cal.yMax);
  tft.fillScreen(TFT_BLACK);
}

static void loadTouchCal() {
  prefs.begin("tanplanet", true);
  bool has = prefs.isKey("xMin");
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
static void cardClicked(lv_event_t* e) {
  lv_obj_t* card = (lv_obj_t*)lv_event_get_target(e);
  lv_label_set_text(detailTitle, lv_label_get_text(lv_obj_get_child(card, 0)));
  lv_label_set_text(detailValue, lv_label_get_text(lv_obj_get_child(card, 1)));
  lv_obj_t* third = lv_obj_get_child(card, 2);
  lv_label_set_text(detailText, third ? lv_label_get_text(third) : "");
  lv_obj_remove_flag(detailView, LV_OBJ_FLAG_HIDDEN);
}

static void addCard(const char* title, const char* value, const char* detail, const char* tone) {
  lv_obj_t* card = lv_obj_create(cardList);
  lv_obj_add_flag(card, LV_OBJ_FLAG_CLICKABLE);
  lv_obj_add_event_cb(card, cardClicked, LV_EVENT_CLICKED, nullptr);
  lv_obj_set_width(card, lv_pct(100));
  lv_obj_set_height(card, LV_SIZE_CONTENT);
  lv_obj_set_style_bg_color(card, lv_color_hex(0x151C33), 0);
  lv_obj_set_style_border_width(card, 0, 0);
  lv_obj_set_style_pad_all(card, 10, 0);
  lv_obj_set_style_margin_bottom(card, 8, 0);
  lv_obj_set_flex_flow(card, LV_FLEX_FLOW_COLUMN);

  lv_obj_t* t = lv_label_create(card);
  lv_obj_set_style_text_font(t, &thai18, 0);
  lv_obj_set_style_text_color(t, lv_color_hex(toneColor(tone)), 0);
  setThaiText(t, title);

  lv_obj_t* v = lv_label_create(card);
  lv_obj_set_style_text_font(v, &thai18, 0);
  lv_obj_set_style_text_color(v, lv_color_hex(0xF5F7FF), 0);
  setThaiText(v, value);

  if (detail && *detail) {
    lv_obj_t* d = lv_label_create(card);
    lv_obj_set_style_text_font(d, &thai18, 0);
    lv_obj_set_style_text_color(d, lv_color_hex(0x8B95B5), 0);
    lv_obj_set_width(d, lv_pct(100));
    lv_label_set_long_mode(d, LV_LABEL_LONG_WRAP);
    setThaiText(d, detail);
  }
}

static void setStatus(const char* msg, uint32_t color) {
  setThaiText(statusLabel, msg);
  lv_obj_set_style_text_color(statusLabel, lv_color_hex(color), 0);
}

static void fetchAndRender() {
  if (WiFi.status() != WL_CONNECTED) {
    setStatus("Wi-Fi หลุด", 0xF87171);
    return;
  }

  HTTPClient http;
  http.setTimeout(8000);
  http.begin(DEVICE_SUMMARY_URL);
  int code = http.GET();
  if (code != HTTP_CODE_OK) {
    Serial.printf("http failed: %d\n", code);
    setStatus(String("ต่อ backend ไม่ได้ (").c_str(), 0xF87171);
    setThaiText(statusLabel, (String("ต่อ backend ไม่ได้ (") + code + ")").c_str());
    http.end();
    return;
  }

  // ponytail: อ่านเป็น String ก่อน — parse จาก stream ตรง ๆ ได้ InvalidInput (chunked encoding)
  String payload = http.getString();
  http.end();
  JsonDocument doc;
  DeserializationError err = deserializeJson(doc, payload);
  if (err) {
    Serial.printf("json failed: %s (payload %u bytes)\n", err.c_str(), payload.length());
    setStatus("อ่านข้อมูลไม่ได้", 0xF87171);
    return;
  }

  lv_obj_clean(cardList);
  int n = 0;
  for (JsonObject c : doc["cards"].as<JsonArray>()) {
    const char* type = c["type"] | "";
    const char* value = c["value"] | "-";
    const char* detail = c["detail"] | "";

    // การ์ดนาฬิกาไปอยู่หัวจอ ไม่ต้องซ้ำในลิสต์
    if (!strcmp(type, "clock")) {
      setThaiText(headValue, value);
      setThaiText(headDetail, detail);
      continue;
    }
    addCard(c["title"] | "", value, detail, c["tone"] | "neutral");
    n++;
  }

  setThaiText(statusLabel, (String(n) + " การ์ด · " + (const char*)(doc["status"]["message"] | "ok")).c_str());
  lv_obj_set_style_text_color(statusLabel, lv_color_hex(0x4ADE80), 0);
  Serial.printf("rendered %d cards (payload %u bytes)\n", n, (unsigned)doc.size());
}

void setup() {
  Serial.begin(115200);
  delay(300);
  Serial.println("\n=== TanPlanet Smart Astro Calendar ===");

  pinMode(TFT_BL, OUTPUT);
  digitalWrite(TFT_BL, HIGH);
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
  lv_obj_set_style_bg_color(scr, lv_color_hex(0x0B1020), 0);
  lv_obj_set_style_pad_all(scr, 12, 0);

  headValue = lv_label_create(scr);
  lv_obj_set_style_text_font(headValue, &thai36, 0);
  lv_obj_set_style_text_color(headValue, lv_color_hex(0xF5F7FF), 0);
  lv_label_set_text(headValue, "--:--");
  lv_obj_align(headValue, LV_ALIGN_TOP_LEFT, 0, 0);

  headDetail = lv_label_create(scr);
  lv_obj_set_style_text_font(headDetail, &thai18, 0);
  lv_obj_set_style_text_color(headDetail, lv_color_hex(0x8B95B5), 0);
  setThaiText(headDetail, "กำลังเริ่มระบบ");
  lv_obj_align(headDetail, LV_ALIGN_TOP_LEFT, 0, 46);

  statusLabel = lv_label_create(scr);
  lv_obj_set_style_text_font(statusLabel, &thai18, 0);
  setThaiText(statusLabel, "ต่อ Wi-Fi...");
  lv_obj_align(statusLabel, LV_ALIGN_TOP_RIGHT, 0, 4);

  cardList = lv_obj_create(scr);
  lv_obj_set_size(cardList, 390, 220);  // เว้น 66px ขวาให้ปุ่มเลื่อน
  lv_obj_align(cardList, LV_ALIGN_BOTTOM_LEFT, 0, 0);
  lv_obj_set_style_bg_opa(cardList, LV_OPA_TRANSP, 0);
  lv_obj_set_style_border_width(cardList, 0, 0);
  lv_obj_set_style_pad_all(cardList, 0, 0);
  lv_obj_set_flex_flow(cardList, LV_FLEX_FLOW_COLUMN);

  // ปุ่มเลื่อนขึ้น-ลง — resistive touch ลากไม่ลื่น กดปุ่มแม่นกว่า
  // ponytail: ใช้ LV_SYMBOL ของ montserrat ในตัว ไม่ต้องเพิ่ม glyph ลูกศรในฟอนต์ไทย
  struct ScrollBtn { const char* icon; int dy; lv_align_t align; int y; };
  const ScrollBtn scrollBtns[] = {
    {LV_SYMBOL_UP, -110, LV_ALIGN_BOTTOM_RIGHT, -118},
    {LV_SYMBOL_DOWN, 110, LV_ALIGN_BOTTOM_RIGHT, -8},
  };
  for (const ScrollBtn& b : scrollBtns) {
    lv_obj_t* btn = lv_button_create(scr);
    lv_obj_set_size(btn, 58, 100);  // touch target ใหญ่กว่า 44px ตามที่ควรเป็น
    lv_obj_align(btn, b.align, 0, b.y);
    lv_obj_set_style_bg_color(btn, lv_color_hex(0x1F2947), 0);
    lv_obj_set_style_radius(btn, 10, 0);
    lv_obj_set_user_data(btn, (void*)(intptr_t)b.dy);
    lv_obj_add_event_cb(btn, [](lv_event_t* e) {
      int dy = (int)(intptr_t)lv_obj_get_user_data((lv_obj_t*)lv_event_get_target(e));
      lv_obj_scroll_by(cardList, 0, -dy, LV_ANIM_ON);
    }, LV_EVENT_CLICKED, nullptr);

    lv_obj_t* icon = lv_label_create(btn);
    lv_label_set_text(icon, b.icon);
    lv_obj_set_style_text_color(icon, lv_color_hex(0xB9C4E6), 0);
    lv_obj_center(icon);
  }

  // detail view: ซ้อนเต็มจอ ซ่อนไว้ก่อน แตะที่ไหนก็ปิด
  detailView = lv_obj_create(scr);
  lv_obj_set_size(detailView, 480, 320);
  lv_obj_center(detailView);
  lv_obj_set_style_bg_color(detailView, lv_color_hex(0x151C33), 0);
  lv_obj_set_style_border_width(detailView, 0, 0);
  lv_obj_set_style_pad_all(detailView, 20, 0);
  lv_obj_set_flex_flow(detailView, LV_FLEX_FLOW_COLUMN);
  lv_obj_add_flag(detailView, LV_OBJ_FLAG_HIDDEN);
  lv_obj_add_flag(detailView, LV_OBJ_FLAG_CLICKABLE);
  lv_obj_add_event_cb(detailView, [](lv_event_t* e) {
    lv_obj_add_flag((lv_obj_t*)lv_event_get_target(e), LV_OBJ_FLAG_HIDDEN);
  }, LV_EVENT_CLICKED, nullptr);

  detailTitle = lv_label_create(detailView);
  lv_obj_set_style_text_font(detailTitle, &thai18, 0);
  lv_obj_set_style_text_color(detailTitle, lv_color_hex(0x8B95B5), 0);

  detailValue = lv_label_create(detailView);
  lv_obj_set_style_text_font(detailValue, &thai36, 0);
  lv_obj_set_style_text_color(detailValue, lv_color_hex(0xF5F7FF), 0);
  lv_obj_set_width(detailValue, lv_pct(100));
  lv_label_set_long_mode(detailValue, LV_LABEL_LONG_WRAP);

  detailText = lv_label_create(detailView);
  lv_obj_set_style_text_font(detailText, &thai18, 0);
  lv_obj_set_style_text_color(detailText, lv_color_hex(0xB9C4E6), 0);
  lv_obj_set_width(detailText, lv_pct(100));
  lv_label_set_long_mode(detailText, LV_LABEL_LONG_WRAP);
  lv_obj_set_style_pad_top(detailText, 12, 0);

  lv_obj_t* hint = lv_label_create(detailView);
  lv_obj_set_style_text_font(hint, &thai18, 0);
  lv_obj_set_style_text_color(hint, lv_color_hex(0x5A6688), 0);
  setThaiText(hint, "แตะเพื่อปิด");

  lv_refr_now(disp);

  // captive portal: ถ้ายังไม่เคยตั้ง Wi-Fi จะเปิด AP "TanPlanet_Config" ให้ตั้งจากมือถือ
  WiFiManager wm;
  // ponytail: ไม่ตั้ง timeout — เป็นจอตั้งโต๊ะ ให้ portal ค้างรอจนกว่าจะตั้งเสร็จ
  wm.setConfigPortalTimeout(0);
  setStatus("รอตั้ง Wi-Fi", 0xFBBF24);
  setThaiText(headValue, "ตั้ง Wi-Fi");
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
    setStatus("กำลังดึงข้อมูล...", 0xFBBF24);
    lv_refr_now(disp);
    fetchAndRender();
    lastFetch = millis();
  }
}

void loop() {
  lv_timer_handler();
  delay(5);

  if (millis() - lastFetch > kRefreshMs) {
    lastFetch = millis();
    fetchAndRender();
  }
}
