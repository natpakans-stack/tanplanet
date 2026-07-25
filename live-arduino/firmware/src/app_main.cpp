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

static void touchRead(lv_indev_t*, lv_indev_data_t* data) {
  if (!touch.touched()) {
    data->state = LV_INDEV_STATE_RELEASED;
    return;
  }
  TS_Point p = touch.getPoint();
  // ponytail: calibrate หยาบ — ปรับ 200/3800 ถ้าแตะแล้วเหลื่อมจากตำแหน่งจริง
  data->point.x = map(constrain(p.x, 200, 3800), 200, 3800, 0, 479);
  data->point.y = map(constrain(p.y, 200, 3800), 200, 3800, 0, 319);
  data->state = LV_INDEV_STATE_PRESSED;
}

// LVGL ไม่ทำ Thai mark stacking — วรรณยุกต์ที่ตามหลังสระบนจะซ้อนทับกัน ("ตั้ง" พัง)
// สลับเป็นวรรณยุกต์ชุดยกสูงใน PUA ที่ tools/make_thai_font.py ฝังไว้ในฟอนต์
static bool isUpperVowel(uint32_t cp) {
  return cp == 0x0E31 || (cp >= 0x0E34 && cp <= 0x0E37) || cp == 0x0E4D || cp == 0x0E47;
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
    } else {
      cp = *p; len = 1;
    }

    uint32_t outCp = cp;
    if (cp >= 0x0E48 && cp <= 0x0E4C && isUpperVowel(prev)) {
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

static void addCard(const char* title, const char* value, const char* detail, const char* tone) {
  lv_obj_t* card = lv_obj_create(cardList);
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
  lv_obj_set_size(cardList, lv_pct(100), 220);
  lv_obj_align(cardList, LV_ALIGN_BOTTOM_MID, 0, 0);
  lv_obj_set_style_bg_opa(cardList, LV_OPA_TRANSP, 0);
  lv_obj_set_style_border_width(cardList, 0, 0);
  lv_obj_set_style_pad_all(cardList, 0, 0);
  lv_obj_set_flex_flow(cardList, LV_FLEX_FLOW_COLUMN);
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
