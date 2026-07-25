#include <Arduino.h>
#include <ArduinoJson.h>
#include <HTTPClient.h>
#include <Preferences.h>
#include <WebServer.h>
#include <WiFi.h>
#include <algorithm>
#include <time.h>

#include "hardware_profiles.h"

#ifndef DEVICE_SUMMARY_URL
#define DEVICE_SUMMARY_URL "http://192.168.1.100:8787/api/device-summary"
#endif

namespace {

constexpr const char* kPrefsNamespace = "tanplanet";
constexpr const char* kSetupApName = "TanPlanet_Setup";
constexpr uint32_t kDefaultRefreshMs = 5UL * 60UL * 1000UL;

Preferences prefs;
WebServer server(80);
HardwareProfile hw = activeHardwareProfile();

String wifiSsid;
String wifiPass;
String deviceSummaryUrl = DEVICE_SUMMARY_URL;
String lastPayload;
String lastError;
uint32_t refreshMs = kDefaultRefreshMs;
uint32_t lastFetchMs = 0;
bool setupMode = false;

String htmlEscape(const String& input) {
  String out;
  out.reserve(input.length());
  for (char c : input) {
    switch (c) {
      case '&': out += F("&amp;"); break;
      case '<': out += F("&lt;"); break;
      case '>': out += F("&gt;"); break;
      case '"': out += F("&quot;"); break;
      default: out += c; break;
    }
  }
  return out;
}

void setBacklight(uint8_t value) {
  if (hw.pinBacklight < 0) return;
  pinMode(hw.pinBacklight, OUTPUT);
#if defined(ESP_ARDUINO_VERSION_MAJOR) && ESP_ARDUINO_VERSION_MAJOR >= 3
  ledcAttach(hw.pinBacklight, 5000, 8);
  ledcWrite(hw.pinBacklight, value);
#else
  ledcSetup(0, 5000, 8);
  ledcAttachPin(hw.pinBacklight, 0);
  ledcWrite(0, value);
#endif
}

void setRgb(bool enabled) {
  if (hw.pinRgbRed < 0 || hw.pinRgbGreen < 0 || hw.pinRgbBlue < 0) return;
  pinMode(hw.pinRgbRed, OUTPUT);
  pinMode(hw.pinRgbGreen, OUTPUT);
  pinMode(hw.pinRgbBlue, OUTPUT);
  digitalWrite(hw.pinRgbRed, enabled ? HIGH : LOW);
  digitalWrite(hw.pinRgbGreen, LOW);
  digitalWrite(hw.pinRgbBlue, enabled ? HIGH : LOW);
}

void beep(uint16_t durationMs = 80) {
  if (hw.pinAudioAmp < 0) return;
  pinMode(hw.pinAudioAmp, OUTPUT);
  digitalWrite(hw.pinAudioAmp, HIGH);
  delay(durationMs);
  digitalWrite(hw.pinAudioAmp, LOW);
}

void loadConfig() {
  prefs.begin(kPrefsNamespace, false);
  wifiSsid = prefs.getString("ssid", "");
  wifiPass = prefs.getString("pass", "");
  deviceSummaryUrl = prefs.getString("summaryUrl", DEVICE_SUMMARY_URL);
  refreshMs = prefs.getUInt("refreshMs", kDefaultRefreshMs);
}

void saveConfigFromRequest() {
  if (server.hasArg("ssid")) {
    wifiSsid = server.arg("ssid");
    prefs.putString("ssid", wifiSsid);
  }
  if (server.hasArg("pass")) {
    wifiPass = server.arg("pass");
    prefs.putString("pass", wifiPass);
  }
  if (server.hasArg("summaryUrl")) {
    deviceSummaryUrl = server.arg("summaryUrl");
    prefs.putString("summaryUrl", deviceSummaryUrl);
  }
  if (server.hasArg("refreshSeconds")) {
    uint32_t seconds = static_cast<uint32_t>(server.arg("refreshSeconds").toInt());
    if (seconds < 30) seconds = 30;
    refreshMs = seconds * 1000UL;
    prefs.putUInt("refreshMs", refreshMs);
  }
}

String currentTimeLabel() {
  struct tm timeinfo;
  if (!getLocalTime(&timeinfo, 100)) return "--:--";
  char buffer[32];
  strftime(buffer, sizeof(buffer), "%H:%M:%S", &timeinfo);
  return String(buffer);
}

void renderSerialSummary() {
  Serial.println();
  Serial.println(F("===== TanPlanet Smart Astro Calendar ====="));
  Serial.print(F("Profile: "));
  Serial.print(hw.name);
  Serial.print(F(" / "));
  Serial.print(hw.width);
  Serial.print(F("x"));
  Serial.println(hw.height);
  Serial.print(F("Wi-Fi: "));
  Serial.println(WiFi.status() == WL_CONNECTED ? WiFi.localIP().toString() : String("offline"));
  Serial.print(F("Time: "));
  Serial.println(currentTimeLabel());
  Serial.print(F("Summary URL: "));
  Serial.println(deviceSummaryUrl);

  if (lastError.length()) {
    Serial.print(F("Last error: "));
    Serial.println(lastError);
  }
  if (!lastPayload.length()) {
    Serial.println(F("No payload yet."));
    return;
  }

  JsonDocument doc;
  DeserializationError err = deserializeJson(doc, lastPayload);
  if (err) {
    Serial.print(F("JSON parse error: "));
    Serial.println(err.c_str());
    return;
  }

  Serial.print(F("Payload updatedAt: "));
  const char* updatedAt = doc["updatedAt"] | "-";
  Serial.println(updatedAt);
  JsonArray cards = doc["cards"].as<JsonArray>();
  for (JsonObject item : cards) {
    const char* tone = item["tone"] | "neutral";
    const char* title = item["title"] | "-";
    const char* value = item["value"] | "-";
    const char* detail = item["detail"] | "";
    Serial.print(F("- ["));
    Serial.print(tone);
    Serial.print(F("] "));
    Serial.print(title);
    Serial.print(F(": "));
    Serial.print(value);
    if (detail && detail[0]) {
      Serial.print(F(" — "));
      Serial.print(detail);
    }
    Serial.println();
  }
}

void handleRoot() {
  String body;
  body.reserve(2400);
  body += F("<!doctype html><meta name='viewport' content='width=device-width,initial-scale=1'>");
  body += F("<style>body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:720px;margin:32px auto;padding:0 16px;line-height:1.5}input{width:100%;padding:10px;margin:4px 0 12px}button{padding:10px 14px}.card{border:1px solid #ddd;border-radius:10px;padding:16px;margin:12px 0}</style>");
  body += F("<h1>TanPlanet Smart Astro Calendar</h1>");
  body += F("<div class='card'><b>Status</b><br>Profile: ");
  body += htmlEscape(hw.name);
  body += F("<br>Wi-Fi: ");
  body += htmlEscape(WiFi.status() == WL_CONNECTED ? WiFi.localIP().toString() : String("offline/setup"));
  body += F("<br>Time: ");
  body += htmlEscape(currentTimeLabel());
  body += F("</div>");
  body += F("<form method='post' action='/config'>");
  body += F("<label>Wi-Fi SSID</label><input name='ssid' value='");
  body += htmlEscape(wifiSsid);
  body += F("'>");
  body += F("<label>Wi-Fi Password</label><input name='pass' type='password' value='");
  body += htmlEscape(wifiPass);
  body += F("'>");
  body += F("<label>Device Summary URL</label><input name='summaryUrl' value='");
  body += htmlEscape(deviceSummaryUrl);
  body += F("'>");
  body += F("<label>Refresh Seconds</label><input name='refreshSeconds' type='number' min='30' value='");
  body += String(refreshMs / 1000UL);
  body += F("'><button type='submit'>Save & Restart</button></form>");
  body += F("<p><a href='/status'>/status</a> · <a href='/payload'>/payload</a> · <a href='/refresh'>refresh now</a></p>");
  server.send(200, "text/html; charset=utf-8", body);
}

void handleStatus() {
  JsonDocument doc;
  doc["profile"] = hw.name;
  doc["wifi"] = WiFi.status() == WL_CONNECTED ? "connected" : "offline";
  doc["ip"] = WiFi.status() == WL_CONNECTED ? WiFi.localIP().toString() : "";
  doc["summaryUrl"] = deviceSummaryUrl;
  doc["time"] = currentTimeLabel();
  doc["lastError"] = lastError;
  String body;
  serializeJsonPretty(doc, body);
  server.send(200, "application/json; charset=utf-8", body);
}

bool fetchDeviceSummary() {
  if (WiFi.status() != WL_CONNECTED) {
    lastError = "Wi-Fi not connected";
    return false;
  }
  HTTPClient http;
  http.setTimeout(8000);
  if (!http.begin(deviceSummaryUrl)) {
    lastError = "HTTP begin failed";
    return false;
  }
  const int code = http.GET();
  if (code != 200) {
    lastError = "HTTP status " + String(code);
    http.end();
    return false;
  }
  lastPayload = http.getString();
  lastError = "";
  lastFetchMs = millis();
  http.end();
  return true;
}

void setupRoutes() {
  server.on("/", HTTP_GET, handleRoot);
  server.on("/status", HTTP_GET, handleStatus);
  server.on("/payload", HTTP_GET, [] {
    server.send(200, "application/json; charset=utf-8", lastPayload.length() ? lastPayload : "{}");
  });
  server.on("/refresh", HTTP_GET, [] {
    bool ok = fetchDeviceSummary();
    renderSerialSummary();
    server.send(200, "text/plain; charset=utf-8", ok ? "refreshed" : lastError);
  });
  server.on("/config", HTTP_POST, [] {
    saveConfigFromRequest();
    server.send(200, "text/plain; charset=utf-8", "saved; restarting");
    delay(500);
    ESP.restart();
  });
  server.begin();
}

void connectWiFiOrSetupMode() {
  if (!wifiSsid.length()) {
    setupMode = true;
    WiFi.mode(WIFI_AP);
    WiFi.softAP(kSetupApName);
    Serial.print(F("Setup AP started: "));
    Serial.println(kSetupApName);
    Serial.print(F("Open http://"));
    Serial.println(WiFi.softAPIP());
    return;
  }

  WiFi.mode(WIFI_STA);
  WiFi.begin(wifiSsid.c_str(), wifiPass.c_str());
  Serial.print(F("Connecting Wi-Fi"));
  const uint32_t start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < 15000) {
    delay(300);
    Serial.print(F("."));
  }
  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    Serial.print(F("Wi-Fi connected: "));
    Serial.println(WiFi.localIP());
    configTime(7 * 3600, 0, "th.pool.ntp.org", "pool.ntp.org");
  } else {
    setupMode = true;
    WiFi.mode(WIFI_AP);
    WiFi.softAP(kSetupApName);
    Serial.print(F("Wi-Fi failed. Setup AP: "));
    Serial.println(WiFi.softAPIP());
  }
}

}  // namespace

void setup() {
  Serial.begin(115200);
  delay(300);
  Serial.println();
  Serial.println(F("Booting TanPlanet Smart Astro Calendar"));
  Serial.print(F("Hardware profile: "));
  Serial.println(hw.name);
  Serial.print(F("Display driver placeholder: "));
  Serial.println(hw.displayDriver);
  Serial.print(F("Touch driver placeholder: "));
  Serial.println(hw.touchDriver);

  setBacklight(180);
  setRgb(false);
  loadConfig();
  connectWiFiOrSetupMode();
  setupRoutes();
  fetchDeviceSummary();
  renderSerialSummary();
  if (!setupMode) beep(40);
}

void loop() {
  server.handleClient();
  if (WiFi.status() == WL_CONNECTED && millis() - lastFetchMs > refreshMs) {
    fetchDeviceSummary();
    renderSerialSummary();
  }
  delay(10);
}
