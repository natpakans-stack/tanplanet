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
const DEFAULT_RUNTIME_CONFIG = { tickers: [], hiddenCards: [], cardOrder: [] };

async function loadRuntimeConfig() {
  const saved = await readJsonMaybe(RUNTIME_CONFIG_PATH);
  return { ...DEFAULT_RUNTIME_CONFIG, ...(saved || {}) };
}

async function saveRuntimeConfig(config) {
  const clean = {
    tickers: Array.isArray(config.tickers) ? config.tickers.map(String) : [],
    hiddenCards: Array.isArray(config.hiddenCards) ? config.hiddenCards.map(String) : [],
    cardOrder: Array.isArray(config.cardOrder) ? config.cardOrder.map(String) : [],
  };
  await writeFile(RUNTIME_CONFIG_PATH, JSON.stringify(clean, null, 2));
  return clean;
}

function card(id, type, title, value, detail, tone = "neutral", priority = 50) {
  return { id, type, title, value, detail: truncate(detail, 120), tone, priority };
}

import { thaiLunar, nextUposatha } from "./thai-lunar.mjs";
import { getWeather, nextHoliday, holidaysInMonth, getAiUsage, getStockViz, getClaudeQuota } from "./live-sources.mjs";

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

async function buildCalendarCards() {
  const now = bangkokNow();
  const be = now.y + 543;
  const today = new Date(now.y, now.m - 1, now.d);
  const todayIso = `${now.y}-${String(now.m).padStart(2, "0")}-${String(now.d).padStart(2, "0")}`;

  const [holiday, monthHolidays] = await Promise.all([
    nextHoliday(todayIso).catch(() => null),
    holidaysInMonth(now.y, now.m).catch(() => []),
  ]);

  const holidayText = holiday
    ? `วันหยุดถัดไป: ${Number(holiday.iso.slice(8))} ${THAI_MONTHS[Number(holiday.iso.slice(5, 7)) - 1]} ${holiday.name}`
    : "ไม่พบวันหยุดถัดไป";

  const lunar = thaiLunar(today);
  const nextPhra = nextUposatha(today);
  const buddhaDays = [];
  for (let d = 1; d <= 31; d++) {
    const probe = new Date(now.y, now.m - 1, d);
    if (probe.getMonth() !== now.m - 1) break;
    if (thaiLunar(probe).isUposatha) buddhaDays.push(d);
  }

  const calendarCard = {
    ...card(
      "calendar_today", "calendar", "Today",
      `${now.d} ${THAI_MONTHS[now.m - 1]} ${be}`,
      `วัน${THAI_DAYS[now.wd]} · ${holidayText}`,
      holiday?.iso === todayIso ? "ok" : "neutral", 20,
    ),
    extra: { calendar: { y: now.y, m: now.m, today: now.d, buddhaDays, holidays: monthHolidays } },
  };

  const lunarCard = {
    ...card(
      "lunar_today", "lunar", "Lunar",
      lunar.label,
      lunar.isUposatha
        ? "วันพระ"
        : nextPhra
          ? `วันพระถัดไป: วัน${THAI_DAYS[nextPhra.date.getDay()]} ${nextPhra.date.getDate()} ${THAI_MONTHS[nextPhra.date.getMonth()]} (${nextPhra.label})`
          : "",
      lunar.isUposatha ? "ok" : "neutral", 30,
    ),
    extra: { lunar: { phase: lunar.phase, day: lunar.day, month: lunar.monthLabel, isUposatha: lunar.isUposatha } },
  };
  return { calendarCard, lunarCard };
}

async function buildWeatherCard() {
  try {
    const w = await getWeather();
    return {
      ...card(
        "weather_now", "weather", "Weather",
        `${w.temp}° ${w.condition}`,
        `ย่านตาขาว · รู้สึก ${w.feels}° · สูงสุด ${w.hi}° ต่ำสุด ${w.lo}° · โอกาสฝน ${w.rain}%`,
        w.rain >= 60 ? "caution" : "ok", 40,
      ),
      extra: { hourly: w.hourly, forecast: w.forecast, humidity: w.humidity, nowHour: w.nowHour },
    };
  } catch (error) {
    return card("weather_now", "weather", "Weather", "ไม่มีข้อมูล", `Open-Meteo error: ${error.message}`, "caution", 40);
  }
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

function fmtTokens(n) {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${Math.round(n / 1e3)}k`;
  return String(n);
}

async function buildAiUsageCard() {
  try {
    const [usage, quota] = await Promise.all([getAiUsage(), getClaudeQuota().catch(() => null)]);
    const c = usage.claude;
    const x = usage.codex;
    const q = quota?.session;

    // โควตาจริงจาก Anthropic มาก่อน ตัวเลข token เป็นรายละเอียดรอง
    const headline = q
      ? `ใช้ไป ${q.pct}% · รีเซ็ต ${Math.floor(q.minutesLeft / 60)}:${String(q.minutesLeft % 60).padStart(2, "0")} ชม.`
      : [c && `Claude ${fmtTokens(c.output)} out`, x?.output && `Codex ${fmtTokens(x.output)} out`]
          .filter(Boolean).join(" · ") || "ยังไม่มีการใช้งานวันนี้";

    return {
      ...card(
        "ai_status", "token", "AI Status",
        headline,
        [
          quota?.week && `รอบ 7 วัน ${quota.week.pct}%`,
          c && `วันนี้ ${fmtTokens(c.output)} out · อ่านแคช ${fmtTokens(c.cacheRead)} · ${c.messages} ข้อความ`,
        ].filter(Boolean).join(" · "),
        q && q.pct >= 80 ? "alert" : q && q.pct >= 50 ? "caution" : "ok", 80,
      ),
      extra: {
        usage: [
          c && {
            name: "Claude", input: c.input, output: c.output, cacheRead: c.cacheRead,
            cacheWrite: c.cacheWrite, messages: c.messages, hourly: c.hourly,
            windowMinutesLeft: c.windowMinutesLeft,
          },
          x && { name: "Codex", input: x.input, output: x.output, messages: x.messages },
        ].filter(Boolean),
        since: usage.since,
        quota,
      },
    };
  } catch (error) {
    return card("ai_status", "token", "AI Status", "อ่านไม่ได้", `usage error: ${error.message}`, "caution", 80);
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
  const [{ calendarCard, lunarCard }, weatherCard] = await Promise.all([
    buildCalendarCards(),
    buildWeatherCard(),
  ]);
  const astroCard = await buildAstroCard();
  const marketCard = buildMarketCard(entrySignal, runtimeConfig.tickers);
  const ideaCard = buildIdeaRadarCard(ideaRadar);
  const northStarCard = buildNorthStarCard(northstar);
  const tokenCard = await buildAiUsageCard();
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

  // เติมกราฟราคา + โลโก้ให้การ์ดหุ้น — ticker ตัวแรกที่โผล่ใน value
  const marketCards = [marketCard, ideaCard, planCard].filter(Boolean);
  await Promise.all(
    marketCards.map(async (c) => {
      const ticker = String(c.value || "").match(/\b[A-Z]{1,5}\b/)?.[0];
      if (!ticker) return;
      try {
        const viz = await getStockViz(ticker);
        c.extra = { ...(c.extra || {}), stock: viz };
      } catch (error) {
        c.extra = { ...(c.extra || {}), stockError: error.message };
      }
    }),
  );

  // ทุกการ์ดต้องมีอะไรให้มองเป็นภาพ — spark = เส้นแนวโน้ม, gauge = สัดส่วนเทียบเพดาน
  // ponytail: normalize ที่ backend ที่เดียว ฝั่งจอจะได้มี renderer แค่ 2 แบบ
  const withViz = (c, viz) => (c ? Object.assign(c, { viz }) : c);

  const lunarNow = thaiLunar(new Date());
  withViz(lunarCard, { kind: "gauge", value: lunarNow.day, max: 15, unit: "ค่ำ" });

  const nowParts = bangkokNow();
  const daysInMonth = new Date(nowParts.y, nowParts.m, 0).getDate();
  withViz(calendarCard, { kind: "gauge", value: nowParts.d, max: daysInMonth, unit: "วัน" });

  if (weatherCard.extra?.hourly) {
    withViz(weatherCard, { kind: "spark", points: weatherCard.extra.hourly.map((h) => h.v) });
  }

  const astroScore = Number(String(astroCard.value).match(/(\d+)\s*\/\s*100/)?.[1]);
  if (Number.isFinite(astroScore)) withViz(astroCard, { kind: "gauge", value: astroScore, max: 100, unit: "" });

  for (const c of marketCards) {
    if (c.extra?.stock?.closes) withViz(c, { kind: "spark", points: c.extra.stock.closes });
  }

  // มีเพดานจริงจาก Anthropic แล้ว แถบสัดส่วนจึงมีความหมาย ไม่ใช่เดาเพดานเอง
  const hourly = tokenCard.extra?.usage?.[0]?.hourly;
  if (hourly?.some((v) => v > 0)) withViz(tokenCard, { kind: "spark", points: hourly });

  const nsPct = Number(String(northStarCard.detail).match(/(\d+(?:\.\d+)?)\s*%/)?.[1]);
  if (Number.isFinite(nsPct)) withViz(northStarCard, { kind: "gauge", value: nsPct, max: 100, unit: "%" });

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
      source: entrySignal ? "megacoach+live" : "live",
      message: entrySignal ? "ข้อมูลสดครบทุกแหล่ง" : "ไม่พบไฟล์ MegaCoach ในเครื่อง",
      megacoachRoot: MEGACOACH_ROOT,
    },
    cards: cards
      .filter((c) => !runtimeConfig.hiddenCards.includes(c.id))
      .sort((a, b) => {
        // ลำดับที่จัดเองจากหน้า /config มาก่อนเสมอ ที่ไม่ได้จัดไว้ไปต่อท้ายตาม priority เดิม
        const ia = runtimeConfig.cardOrder.indexOf(a.id);
        const ib = runtimeConfig.cardOrder.indexOf(b.id);
        if (ia !== -1 || ib !== -1) {
          if (ia === -1) return 1;
          if (ib === -1) return -1;
          return ia - ib;
        }
        return (a.priority || 50) - (b.priority || 50);
      }),
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
  // เรียงรายการตาม cardOrder ที่บันทึกไว้ ที่เหลือต่อท้าย
  const ordered = [
    ...config.cardOrder.map((id) => allCards.find((c) => c[0] === id)).filter(Boolean),
    ...allCards.filter((c) => !config.cardOrder.includes(c[0])),
  ];
  const cardRows = ordered.map(([id, label], i) => {
    const hidden = config.hiddenCards.includes(id);
    return `<li class="row${hidden ? " off" : ""}" data-id="${id}">
      <span class="num">${i + 1}</span>
      <span class="name">${label}</span>
      <button class="mv" data-dir="-1" type="button" aria-label="เลื่อนขึ้น">▲</button>
      <button class="mv" data-dir="1" type="button" aria-label="เลื่อนลง">▼</button>
      <button class="eye" type="button" aria-label="แสดง/ซ่อน">${hidden ? "ซ่อน" : "แสดง"}</button>
    </li>`;
  }).join("\n");

  return `<!doctype html>
<html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>จัดการการ์ดบนจอ</title>
<style>
  *{box-sizing:border-box}
  body{font-family:-apple-system,"Segoe UI",sans-serif;background:#0A0F1F;color:#F2F5FF;max-width:520px;margin:0 auto;padding:20px 16px 96px}
  h1{font-size:19px;margin:0 0 4px}
  .sub{color:#8492BC;font-size:13px;margin-bottom:20px}
  h2{font-size:12px;color:#8492BC;margin:22px 0 8px;text-transform:uppercase;letter-spacing:.6px}
  ul{list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:8px}
  .row{display:flex;align-items:center;gap:8px;background:#161F3C;border-radius:12px;padding:10px 12px;
       user-select:none;transition:opacity .15s,background .15s}
  .row.off{opacity:.42}
  .row.moved{background:#22305A}
  .mv{border:0;background:#22305A;color:#B9C4E6;border-radius:8px;width:42px;height:38px;font-size:13px;cursor:pointer;flex:none}
  .mv:disabled{opacity:.25}
  .num{color:#8492BC;font-size:12px;width:18px;text-align:center;flex:none}
  .name{flex:1;font-size:15px;font-weight:600}
  .eye{border:0;background:#22305A;color:#B9C4E6;border-radius:8px;height:38px;width:56px;font-size:12px;font-weight:700;cursor:pointer;flex:none}
  .row.off .eye{background:#2A2036;color:#F87171}
  fieldset{border:1px solid rgba(255,255,255,.12);border-radius:12px;padding:12px;display:grid;
           grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:8px;margin:0}
  fieldset label{font-size:14px;display:flex;gap:8px;align-items:center;padding:8px;background:#161F3C;border-radius:8px}
  .bar{position:fixed;left:0;right:0;bottom:0;padding:12px 16px calc(12px + env(safe-area-inset-bottom));
       background:linear-gradient(transparent,#0A0F1F 24%);display:flex;gap:10px;max-width:520px;margin:0 auto}
  button.save{flex:1;height:48px;border:0;border-radius:12px;background:#4ADE80;color:#06210F;font-weight:800;font-size:16px}
  #saved{color:#4ADE80;font-size:13px;font-weight:700;text-align:center;height:18px;margin-top:10px}
</style></head><body>
<h1>จัดการการ์ดบนจอ</h1>
<div class="sub">▲▼ เลื่อนลำดับ · ปุ่มขวาสุดซ่อน/แสดง · ตัวบนสุดขึ้นจอก่อน</div>

<h2>ลำดับการ์ด</h2>
<ul id="cards">${cardRows}</ul>

<h2>หุ้นใน Market Focus</h2>
<fieldset id="tickers">${tickerRows}</fieldset>

<div id="saved"></div>
<div class="bar"><button class="save" id="save" type="button">บันทึก</button></div>

<script>
const list = document.getElementById("cards");

function renumber() {
  const rows = [...list.children];
  rows.forEach((r, i) => {
    r.querySelector(".num").textContent = i + 1;
    r.querySelector('[data-dir="-1"]').disabled = i === 0;
    r.querySelector('[data-dir="1"]').disabled = i === rows.length - 1;
  });
}
renumber();

list.addEventListener("click", (e) => {
  const btn = e.target.closest(".mv");
  if (!btn) return;
  const row = btn.closest(".row");
  const dir = Number(btn.dataset.dir);
  if (dir < 0 && row.previousElementSibling) list.insertBefore(row, row.previousElementSibling);
  if (dir > 0 && row.nextElementSibling) list.insertBefore(row.nextElementSibling, row);
  row.classList.add("moved");
  setTimeout(() => row.classList.remove("moved"), 300);
  renumber();
});

list.addEventListener("click", (e) => {
  const btn = e.target.closest(".eye");
  if (!btn) return;
  const row = btn.closest(".row");
  row.classList.toggle("off");
  btn.textContent = row.classList.contains("off") ? "ซ่อน" : "แสดง";
});

document.getElementById("save").addEventListener("click", async () => {
  const rows = [...list.children];
  const tickers = [...document.querySelectorAll('input[name="ticker"]:checked')].map((el) => el.value);
  const allTickers = document.querySelectorAll('input[name="ticker"]').length;
  const body = {
    tickers: tickers.length === allTickers ? [] : tickers,
    cardOrder: rows.map((r) => r.dataset.id),
    hiddenCards: rows.filter((r) => r.classList.contains("off")).map((r) => r.dataset.id),
  };
  const res = await fetch("/api/config", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
  });
  document.getElementById("saved").textContent = res.ok
    ? "✓ บันทึกแล้ว — จอจะอัปเดตภายใน 5 นาที"
    : "บันทึกไม่สำเร็จ";
});
</script></body></html>`;
}

async function handleRequest(req, res) {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  if (req.method === "OPTIONS") return sendJson(res, 204, {});

  if (url.pathname === "/ui" || url.pathname === "/mock-ui") {
    return sendHtmlFile(res, path.join(PROJECT_ROOT, "mock-ui", "index.html"));
  }
  if (url.pathname === "/config" || url.pathname === "/manage") {
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
