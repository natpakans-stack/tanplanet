import http from "node:http";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "..");
const DEFAULT_PORT = Number(process.env.PORT || 8787);
const MEGACOACH_ROOT = process.env.MEGACOACH_ROOT || path.resolve(PROJECT_ROOT, "..", "megacoach");
const ASTRO_API_BASE = process.env.ASTRO_API_BASE || "https://thai-astrology-flame.vercel.app";

const TONE_BY_SIGNAL = {
  go: "ok",
  wait: "caution",
  avoid: "danger",
  hold: "neutral",
};

function truncate(value, max = 96) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

async function readJsonMaybe(filePath) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch {
    return null;
  }
}

async function readSampleSummary() {
  return readJsonMaybe(path.join(PROJECT_ROOT, "data", "device-summary.sample.json"));
}

// จำลอง web config ของ ESP32 (บนเครื่องจริงหน้านี้ serve จากตัวบอร์ดผ่าน IP ในวง Wi-Fi)
const RUNTIME_CONFIG_PATH = path.join(PROJECT_ROOT, "data", "device-runtime-config.json");
const DEFAULT_RUNTIME_CONFIG = { tickers: [], hiddenCards: [] };

async function loadRuntimeConfig() {
  const saved = await readJsonMaybe(RUNTIME_CONFIG_PATH);
  return { ...DEFAULT_RUNTIME_CONFIG, ...(saved || {}) };
}

async function saveRuntimeConfig(config) {
  const clean = {
    tickers: Array.isArray(config.tickers) ? config.tickers.map(String) : [],
    hiddenCards: Array.isArray(config.hiddenCards) ? config.hiddenCards.map(String) : [],
  };
  await writeFile(RUNTIME_CONFIG_PATH, JSON.stringify(clean, null, 2));
  return clean;
}

function card(id, type, title, value, detail, tone = "neutral", priority = 50) {
  return { id, type, title, value, detail: truncate(detail, 120), tone, priority };
}

const THAI_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const THAI_DAYS = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสฯ", "ศุกร์", "เสาร์"];

function bangkokNow() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric", month: "numeric", day: "numeric", weekday: "short", hour: "numeric",
  }).formatToParts(new Date());
  const get = (type) => parts.find((p) => p.type === type)?.value;
  const weekdayIndex = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
  return { y: Number(get("year")), m: Number(get("month")), d: Number(get("day")), wd: weekdayIndex };
}

// ponytail: จันทรคติ/วันพระ/weather เป็น mock ล้วน — แทนด้วยข้อมูลจริงใน Sprint 6
function buildCalendarCards() {
  const now = bangkokNow();
  const be = now.y + 543;
  const buddhaDays = [3, 10, 18, 25];
  const holidays = [{ d: 28, label: "วันเฉลิมฯ ร.10" }];
  const calendarCard = {
    ...card(
      "calendar_today", "calendar", "Today",
      `${now.d} ${THAI_MONTHS[now.m - 1]} ${be}`,
      `วัน${THAI_DAYS[now.wd]} · วันหยุดถัดไป: ${holidays[0].d} ${THAI_MONTHS[now.m - 1]} ${holidays[0].label} (mock)`,
      "neutral", 20,
    ),
    extra: { calendar: { y: now.y, m: now.m, today: now.d, buddhaDays, holidays } },
  };
  const lunarCard = card(
    "lunar_today", "lunar", "Lunar",
    "แรม 4 ค่ำ เดือน 8 🌘",
    `วันพระถัดไป: ${THAI_DAYS[new Date(now.y, now.m - 1, buddhaDays.find((d) => d > now.d) ?? buddhaDays[0]).getDay()]} ${buddhaDays.find((d) => d > now.d) ?? buddhaDays[0]} ${THAI_MONTHS[now.m - 1]} (mock)`,
    "neutral", 30,
  );
  return { calendarCard, lunarCard };
}

function buildWeatherCard() {
  return {
    ...card(
      "weather_now", "weather", "Weather",
      "32° ☀️ แดดจัด",
      "กรุงเทพฯ · สูงสุด 33° ต่ำสุด 26° · โอกาสฝน 20% (mock)",
      "ok", 40,
    ),
    extra: {
      hourly: [
        { t: "06", v: 27 }, { t: "09", v: 30 }, { t: "12", v: 33 }, { t: "15", v: 32 },
        { t: "18", v: 30 }, { t: "21", v: 28 }, { t: "00", v: 27 }, { t: "03", v: 26 },
      ],
      forecast: [
        { d: "ศ.", e: "☀️", hi: 33, lo: 26 },
        { d: "ส.", e: "⛅", hi: 32, lo: 26 },
        { d: "อา.", e: "🌧️", hi: 30, lo: 25 },
        { d: "จ.", e: "⛅", hi: 32, lo: 26 },
      ],
    },
  };
}

const parseNum = (value) => Number(String(value ?? "").replace(/[^0-9.\-]/g, "")) || 0;

function buildMarketCard(entrySignal, allowedTickers = []) {
  const groups = entrySignal?.groups || [];
  let stocks = groups.flatMap((group) =>
    (group.stocks || []).map((stock) => ({
      ...stock,
      groupTitle: group.title,
    })),
  );
  if (allowedTickers.length) stocks = stocks.filter((stock) => allowedTickers.includes(stock.ticker));
  if (!stocks.length) {
    return card("market_focus", "market", "Market Focus", "No data", "MegaCoach entry signal not found", "neutral", 60);
  }

  const priorityStock =
    stocks.find((stock) => stock.signal === "go") ||
    stocks.find((stock) => stock.signal === "wait") ||
    stocks[0];
  const tickers = stocks.slice(0, 4).map((stock) => stock.ticker).filter(Boolean).join(" / ");
  const tone = TONE_BY_SIGNAL[priorityStock.signal] || "neutral";
  return {
    ...card(
      "market_focus",
      "market",
      "Market Focus",
      tickers || priorityStock.ticker || "Watchlist",
      priorityStock.signalLabel || priorityStock.signalDesc || entrySignal.note || "Review MegaCoach signals",
      tone,
      60,
    ),
    extra: {
      stocks: stocks.slice(0, 5).map((stock) => ({
        ticker: stock.ticker,
        price: stock.price,
        change: parseNum(stock.change),
        signal: stock.signal,
      })),
      note: truncate(entrySignal.note, 220),
    },
  };
}

function buildIdeaRadarCard(ideaRadar) {
  const topPick = ideaRadar?.topPick || ideaRadar?.items?.topPick;
  if (!topPick) return null;
  const themes = (ideaRadar?.themes || []).slice(0, 5).map((theme) => ({
    name: theme.name,
    score: theme.score,
    stage: theme.stageLabel || theme.stage,
  }));
  return {
    ...card(
      "idea_radar",
      "market",
      "Idea Radar",
      (topPick.tickers || []).slice(0, 3).join(" / ") || topPick.theme || "Radar",
      topPick.note || topPick.theme,
      "ok",
      62,
    ),
    extra: { themes, note: truncate(topPick.note, 220) },
  };
}

function buildNorthStarCard(northstar) {
  if (!northstar) {
    return card("northstar", "northstar", "North Star", "Phase 1", "Growth mode · Fear of Ruin > FOMO", "ok", 70);
  }
  return {
    ...card(
      "northstar",
      "northstar",
      "North Star",
      northstar.phaseLabel || northstar.goalLabel || "Phase 1",
      `${northstar.goalLabel || "อิสรภาพการเงิน"} · target ${northstar.targetAge ?? 60} · required ${northstar.requiredCagr || "~7%/ปี"}`,
      "ok",
      70,
    ),
    extra: {
      glide: {
        startAge: northstar.startAge,
        switchAge: northstar.switchAge,
        targetAge: northstar.targetAge,
        currentAge: northstar.currentAge,
        phaseLabel: northstar.phaseLabel,
        phaseTarget: northstar.phaseTarget,
        requiredCagr: northstar.requiredCagr,
        note: northstar.note,
      },
    },
  };
}

async function buildAstroCard() {
  if (!ASTRO_API_BASE) {
    return card("astro_today", "astro", "ดวงลงทุนวันนี้", "รอข้อมูล", "ASTRO_API_BASE not configured", "neutral", 50);
  }
  try {
    const response = await fetch(`${ASTRO_API_BASE.replace(/\/$/, "")}/daily-invest`, {
      headers: { "user-agent": "tanplanet-smart-astro-calendar/0.1" },
      signal: AbortSignal.timeout(6000),
    });
    if (!response.ok) throw new Error(`astro ${response.status}`);
    const data = await response.json();
    const tone = data["สรุป"] === "จังหวะดี" ? "ok" : data["สรุป"] === "ตั้งรับ" ? "danger" : "neutral";
    const score = data["คะแนน"] == null ? "" : `${data["คะแนน"]}/100`;
    return {
      ...card(
        "astro_today",
        "astro",
        "ดวงลงทุนวันนี้",
        [data["สรุป"], score].filter(Boolean).join(" · ") || "พร้อมใช้งาน",
        data["คำแนะนำ"] || (data["เหตุผล"] || [])[0] || "Thai Astrology API connected",
        tone,
        50,
      ),
      extra: data["คะแนน"] == null ? undefined : {
        gauge: { score: Number(data["คะแนน"]), verdict: data["สรุป"] || "", advice: truncate(data["คำแนะนำ"], 160) },
      },
    };
  } catch (error) {
    return card("astro_today", "astro", "ดวงลงทุนวันนี้", "ใช้ cache/mock", `Astro API unavailable: ${error.message}`, "caution", 50);
  }
}

async function buildDeviceSummary() {
  const sample = await readSampleSummary();
  const runtimeConfig = await loadRuntimeConfig();
  const now = new Date().toISOString();
  const entrySignal = await readJsonMaybe(path.join(MEGACOACH_ROOT, "liff-app", "entry-signal-data.json"));
  const ideaRadar = await readJsonMaybe(path.join(MEGACOACH_ROOT, "liff-app", "idea-radar.json"));
  const northstar = await readJsonMaybe(path.join(MEGACOACH_ROOT, "liff-app", "northstar.json"));
  const monthlyPlan = await readJsonMaybe(path.join(MEGACOACH_ROOT, "liff-app", "monthly-plan.json"));

  const baseCards = sample?.cards || [];
  const clockCard = card("home_clock", "clock", "TanPlanet", "--:--", "Device clock is rendered locally on ESP32", "ok", 10);
  const { calendarCard, lunarCard } = buildCalendarCards();
  const weatherCard = buildWeatherCard();
  const astroCard = await buildAstroCard();
  const marketCard = buildMarketCard(entrySignal, runtimeConfig.tickers);
  const ideaCard = buildIdeaRadarCard(ideaRadar);
  const northStarCard = buildNorthStarCard(northstar);
  // ponytail: usage เป็น mock — ของจริง Claude อ่านจาก ccusage (JSONL ~/.claude), Codex จาก ~/.codex หรือ usage API
  const tokenCard = {
    ...card("ai_status", "token", "AI Status", "Claude 62% · Codex 35%", "โควตาที่ใช้ไปของรอบปัจจุบัน (mock)", "caution", 80),
    extra: {
      usage: [
        { name: "Claude", used: 62, cap: "Max 5h block", reset: "รีเซ็ต 23:00" },
        { name: "Codex", used: 35, cap: "Weekly limit", reset: "รีเซ็ต จ. 07:00" },
      ],
      note: "mock — แหล่งจริง: ccusage (Claude Code) + OpenAI usage API (Codex) ผ่าน local bridge",
    },
  };
  const swing = monthlyPlan?.swing;
  const swingCurrent = parseNum(
    (entrySignal?.groups || [])
      .flatMap((group) => group.stocks || [])
      .find((stock) => stock.ticker === swing?.ticker)?.price,
  );
  const entryRange = String(swing?.entry || "").match(/([0-9.]+)\D+([0-9.]+)/);
  const planCard = monthlyPlan
    ? {
        ...card(
          "monthly_plan",
          "market",
          "Monthly Plan",
          [monthlyPlan.alpha?.ticker, monthlyPlan.swing?.ticker].filter(Boolean).join(" / ") || monthlyPlan.monthLabel,
          monthlyPlan.swing?.exec || monthlyPlan.alpha?.note || "Monthly plan loaded",
          "caution",
          65,
        ),
        extra: swing?.hasSetup
          ? {
              ladder: {
                ticker: swing.ticker,
                stop: parseNum(swing.stop),
                entryLo: entryRange ? Number(entryRange[1]) : parseNum(swing.limitPrice),
                entryHi: entryRange ? Number(entryRange[2]) : parseNum(swing.limitPrice),
                limit: parseNum(swing.limitPrice),
                target: parseNum(swing.target),
                current: swingCurrent || null,
                alpha: monthlyPlan.alpha ? `${monthlyPlan.alpha.ticker} ${monthlyPlan.alpha.amount} · ${monthlyPlan.alpha.how}` : "",
              },
            }
          : undefined,
      }
    : null;

  const cards = [
    clockCard,
    calendarCard,
    lunarCard,
    weatherCard,
    astroCard,
    marketCard,
    ideaCard,
    planCard,
    northStarCard,
    tokenCard,
  ].filter(Boolean);

  return {
    schemaVersion: "1.0.0",
    deviceProfile: "tanplanet-smart-astro-calendar",
    updatedAt: now,
    expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    status: {
      overall: entrySignal ? "ok" : "degraded",
      source: entrySignal ? "megacoach+mock" : "mock",
      message: entrySignal ? "MegaCoach local files detected" : "MegaCoach local files not found; using mock cards",
      megacoachRoot: MEGACOACH_ROOT,
    },
    cards: cards
      .filter((c) => !runtimeConfig.hiddenCards.includes(c.id))
      .sort((a, b) => (a.priority || 50) - (b.priority || 50)),
    fallbackCards: baseCards,
  };
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload, null, 2);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "access-control-allow-origin": "*",
  });
  res.end(body);
}

function sendText(res, status, body) {
  res.writeHead(status, {
    "content-type": "text/plain; charset=utf-8",
    "cache-control": "no-store",
  });
  res.end(body);
}

async function sendHtmlFile(res, filePath) {
  try {
    const body = await readFile(filePath, "utf8");
    res.writeHead(200, {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    });
    res.end(body);
  } catch {
    sendJson(res, 404, { error: "ui_not_found" });
  }
}

// Live intraday price จาก Yahoo Finance — cache 60s กัน rate limit (ESP32 จะ poll ผ่าน endpoint นี้เท่านั้น)
const priceCache = new Map();

async function fetchIntraday(ticker) {
  const cached = priceCache.get(ticker);
  if (cached && Date.now() - cached.at < 60_000) return cached.data;
  const response = await fetch(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=5m&range=1d`,
    { headers: { "user-agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(6000) },
  );
  if (!response.ok) throw new Error(`yahoo ${response.status}`);
  const json = await response.json();
  const result = json.chart?.result?.[0];
  const timestamps = result?.timestamp || [];
  const closes = result?.indicators?.quote?.[0]?.close || [];
  const points = timestamps
    .map((t, i) => ({ t, v: closes[i] }))
    .filter((p) => p.v != null)
    .filter((_, i) => i % 2 === 0)
    .map((p) => ({ t: p.t, v: Math.round(p.v * 100) / 100 }));
  const meta = result?.meta || {};
  const data = {
    ticker,
    current: meta.regularMarketPrice,
    prevClose: meta.chartPreviousClose,
    updatedAt: new Date().toISOString(),
    points,
  };
  priceCache.set(ticker, { at: Date.now(), data });
  return data;
}

async function readBody(req) {
  let data = "";
  for await (const chunk of req) data += chunk;
  return data;
}

async function buildConfigPage() {
  const entrySignal = await readJsonMaybe(path.join(MEGACOACH_ROOT, "liff-app", "entry-signal-data.json"));
  const allTickers = [...new Set((entrySignal?.groups || []).flatMap((g) => (g.stocks || []).map((s) => s.ticker)))];
  const allCards = [
    ["calendar_today", "Calendar"], ["lunar_today", "Lunar"], ["weather_now", "Weather"],
    ["astro_today", "ดวงลงทุนวันนี้"], ["market_focus", "Market Focus"], ["idea_radar", "Idea Radar"],
    ["monthly_plan", "Monthly Plan"], ["northstar", "North Star"], ["ai_status", "AI Status"],
  ];
  const config = await loadRuntimeConfig();
  const tickerRows = allTickers.map((t) => {
    const checked = !config.tickers.length || config.tickers.includes(t) ? "checked" : "";
    return `<label><input type="checkbox" name="ticker" value="${t}" ${checked}> ${t}</label>`;
  }).join("\n");
  const cardRows = allCards.map(([id, label]) => {
    const checked = config.hiddenCards.includes(id) ? "" : "checked";
    return `<label><input type="checkbox" name="card" value="${id}" ${checked}> ${label}</label>`;
  }).join("\n");
  return `<!doctype html>
<html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>TanPlanet Device Config</title>
<style>
  body{font-family:-apple-system,"Segoe UI",sans-serif;background:#10121e;color:#f6f3ea;max-width:560px;margin:0 auto;padding:24px}
  h1{font-size:20px} h2{font-size:14px;color:#a7aec5;margin:20px 0 8px;text-transform:uppercase;letter-spacing:.5px}
  fieldset{border:1px solid rgba(255,255,255,.14);border-radius:10px;padding:12px;display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px}
  label{font-size:14px;display:flex;gap:8px;align-items:center;padding:6px 8px;background:#182039;border-radius:8px;cursor:pointer}
  button{margin-top:16px;width:100%;height:44px;border:0;border-radius:10px;background:#7aa2ff;color:#0b1020;font-weight:800;font-size:15px;cursor:pointer}
  .note{color:#a7aec5;font-size:12px;margin-top:12px;line-height:1.5}
  #saved{color:#20c997;font-weight:700;font-size:13px;margin-top:8px;visibility:hidden}
</style></head><body>
<h1>⚙️ TanPlanet Device Config</h1>
<h2>หุ้นที่แสดงใน Market Focus</h2>
<fieldset id="tickers">${tickerRows}</fieldset>
<h2>การ์ดที่แสดงบนจอ</h2>
<fieldset id="cards">${cardRows}</fieldset>
<button id="save" type="button">บันทึก</button>
<div id="saved">✓ บันทึกแล้ว — จอจะอัปเดตรอบ sync ถัดไป</div>
<div class="note">หน้านี้จำลอง Web Config ของอุปกรณ์จริง — บนเครื่องจริงจะเปิดจาก IP ของ ESP32 ในวง Wi-Fi เดียวกัน ค่า config เก็บใน device และอยู่รอดหลัง restart</div>
<script>
document.getElementById("save").addEventListener("click", async () => {
  const tickers = [...document.querySelectorAll('input[name="ticker"]:checked')].map((el) => el.value);
  const allTickers = [...document.querySelectorAll('input[name="ticker"]')].length;
  const shownCards = [...document.querySelectorAll('input[name="card"]:checked')].map((el) => el.value);
  const allCards = [...document.querySelectorAll('input[name="card"]')].map((el) => el.value);
  const body = {
    tickers: tickers.length === allTickers ? [] : tickers,
    hiddenCards: allCards.filter((id) => !shownCards.includes(id)),
  };
  await fetch("/api/config", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  document.getElementById("saved").style.visibility = "visible";
});
</script></body></html>`;
}

async function handleRequest(req, res) {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  if (req.method === "OPTIONS") return sendJson(res, 204, {});

  if (url.pathname === "/ui" || url.pathname === "/mock-ui") {
    return sendHtmlFile(res, path.join(PROJECT_ROOT, "mock-ui", "index.html"));
  }
  if (url.pathname === "/config") {
    const body = await buildConfigPage();
    res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
    return res.end(body);
  }
  if (url.pathname === "/api/config" && req.method === "GET") {
    return sendJson(res, 200, await loadRuntimeConfig());
  }
  if (url.pathname === "/api/config" && req.method === "POST") {
    try {
      const saved = await saveRuntimeConfig(JSON.parse(await readBody(req)));
      return sendJson(res, 200, saved);
    } catch (error) {
      return sendJson(res, 400, { error: String(error.message || error) });
    }
  }
  if (url.pathname === "/api/device-summary") {
    return sendJson(res, 200, await buildDeviceSummary());
  }
  if (url.pathname === "/api/price") {
    const ticker = (url.searchParams.get("ticker") || "VST").toUpperCase().replace(/[^A-Z.\-]/g, "");
    try {
      return sendJson(res, 200, await fetchIntraday(ticker));
    } catch (error) {
      return sendJson(res, 502, { error: String(error.message || error), ticker });
    }
  }
  if (url.pathname === "/api/status") {
    return sendJson(res, 200, {
      ok: true,
      service: "tanplanet-device-summary",
      megacoachRoot: MEGACOACH_ROOT,
      astroApiBase: ASTRO_API_BASE,
      now: new Date().toISOString(),
    });
  }
  if (url.pathname === "/api/mock") {
    return sendJson(res, 200, await readSampleSummary());
  }
  if (url.pathname === "/" || url.pathname === "/health") {
    return sendText(
      res,
      200,
      [
        "TanPlanet Smart Astro Calendar backend mock",
        "",
        "UI:",
        "  GET /ui",
        "",
        "Endpoints:",
        "  GET /api/status",
        "  GET /api/device-summary",
        "  GET /api/mock",
      ].join("\n"),
    );
  }
  return sendJson(res, 404, { error: "not_found" });
}

if (process.argv.includes("--print-summary")) {
  console.log(JSON.stringify(await buildDeviceSummary(), null, 2));
} else {
  http
    .createServer((req, res) => {
      handleRequest(req, res).catch((error) => sendJson(res, 500, { error: String(error?.stack || error) }));
    })
    .listen(DEFAULT_PORT, () => {
      console.log(`TanPlanet backend mock listening on http://localhost:${DEFAULT_PORT}`);
      console.log(`MegaCoach root: ${MEGACOACH_ROOT}`);
    });
}
