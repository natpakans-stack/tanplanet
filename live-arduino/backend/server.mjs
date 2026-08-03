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
const DEFAULT_RUNTIME_CONFIG = {
  tickers: [], hiddenCards: [], cardOrder: [],
  weather: { label: "ย่านตาขาว", lat: 7.38622, lon: 99.66692 },
  ideaRadar: { themes: 5, tickers: 3 },
  monthlyPlan: { focus: "swing" },  // ticker ไหนได้กราฟ/ladder: swing | alpha
  marketFocus: { chart: "" },       // ticker ที่ขึ้นกราฟ, "" = อัตโนมัติตามสัญญาณ
  aiStatus: { showWeek: true },
  calendar: {
    showBuddha: true,
    showHolidays: true,
    // ปฏิทินภายนอกใส่ได้หลายชุด (ecal, Google Calendar สาธารณะ ฯลฯ) — สีจุดแยกตามลำดับ
    feeds: [{
      label: "Liverpool FC",
      url: "webcal://ics.ecal.com/ecal-sub/6a6d7a6079e9cc0002a1f977/Liverpool%20FC.ics",
      on: true,
    }],
  },
  saju: { birthDate: "" },  // ว่าง = ปิดการ์ด เพราะพลังงานรายยามต้องรู้เจ้าเรือนก่อน
  device: { refreshSeconds: 300 },
  display: { brightnessDay: 255, brightnessNight: 40, nightStart: "22:00", nightEnd: "06:30" },
  // โพโมโดโร + เตือนกิจวัตร — จอจับเวลาเองในเครื่อง หลังบ้านแค่บอกความยาว/เวลาเตือน
  focus: {
    workMin: 25, breakMin: 5,
    waterEveryMin: 60, waterFrom: "09:00", waterTo: "18:00",
    lunch: "12:00", offWork: "18:00",
  },
};

async function loadRuntimeConfig() {
  const saved = await readJsonMaybe(RUNTIME_CONFIG_PATH);
  return { ...DEFAULT_RUNTIME_CONFIG, ...(saved || {}) };
}

async function saveRuntimeConfig(config) {
  const d = DEFAULT_RUNTIME_CONFIG;
  const num = (v, fallback) => (Number.isFinite(Number(v)) ? Number(v) : fallback);
  const hhmm = (v, fallback) => (/^\d{2}:\d{2}$/.test(v || "") ? v : fallback);
  const saved = {
    tickers: Array.isArray(config.tickers) ? config.tickers.map(String) : [],
    hiddenCards: Array.isArray(config.hiddenCards) ? config.hiddenCards.map(String) : [],
    cardOrder: Array.isArray(config.cardOrder) ? config.cardOrder.map(String) : [],
    weather: {
      label: String(config.weather?.label ?? d.weather.label).slice(0, 40),
      // พิกัดนอกช่วงจริงทำให้ Open-Meteo ตอบ error ทั้งการ์ด — กันไว้ที่นี่ที่เดียว
      lat: Math.min(90, Math.max(-90, num(config.weather?.lat, d.weather.lat))),
      lon: Math.min(180, Math.max(-180, num(config.weather?.lon, d.weather.lon))),
    },
    ideaRadar: {
      themes: Math.min(6, Math.max(1, Math.round(num(config.ideaRadar?.themes, d.ideaRadar.themes)))),
      tickers: Math.min(5, Math.max(1, Math.round(num(config.ideaRadar?.tickers, d.ideaRadar.tickers)))),
    },
    monthlyPlan: {
      focus: config.monthlyPlan?.focus === "alpha" ? "alpha" : "swing",
    },
    marketFocus: { chart: String(config.marketFocus?.chart ?? "").toUpperCase().replace(/[^A-Z.\-]/g, "") },
    aiStatus: { showWeek: config.aiStatus?.showWeek !== false },
    calendar: {
      showBuddha: config.calendar?.showBuddha !== false,
      showHolidays: config.calendar?.showHolidays !== false,
      // จอมีสีจุดให้ 4 แบบ เกินนั้นแยกไม่ออกด้วยตาอยู่ดี
      feeds: (Array.isArray(config.calendar?.feeds) ? config.calendar.feeds : [])
        .filter((f) => String(f?.url || "").trim())
        .slice(0, 4)
        .map((f) => ({
          label: String(f.label || "ปฏิทิน").slice(0, 24),
          url: String(f.url).trim().slice(0, 400),
          on: f.on !== false,
        })),
    },
    saju: { birthDate: /^\d{4}-\d{2}-\d{2}$/.test(config.saju?.birthDate || "") ? config.saju.birthDate : "" },
    // จอยิงมาทุก refreshSeconds — ต่ำกว่า 60 วิ ไม่มีประโยชน์ ข้อมูลต้นทางไม่ได้ขยับเร็วขนาดนั้น
    device: { refreshSeconds: Math.min(3600, Math.max(60, Math.round(num(config.device?.refreshSeconds, d.device.refreshSeconds)))) },
    display: {
      brightnessDay: Math.min(255, Math.max(10, Math.round(num(config.display?.brightnessDay, d.display.brightnessDay)))),
      brightnessNight: Math.min(255, Math.max(0, Math.round(num(config.display?.brightnessNight, d.display.brightnessNight)))),
      nightStart: /^\d{2}:\d{2}$/.test(config.display?.nightStart || "") ? config.display.nightStart : d.display.nightStart,
      nightEnd: /^\d{2}:\d{2}$/.test(config.display?.nightEnd || "") ? config.display.nightEnd : d.display.nightEnd,
    },
    focus: {
      workMin: Math.min(180, Math.max(1, Math.round(num(config.focus?.workMin, d.focus.workMin)))),
      breakMin: Math.min(60, Math.max(1, Math.round(num(config.focus?.breakMin, d.focus.breakMin)))),
      waterEveryMin: Math.min(240, Math.max(5, Math.round(num(config.focus?.waterEveryMin, d.focus.waterEveryMin)))),
      waterFrom: hhmm(config.focus?.waterFrom, d.focus.waterFrom),
      waterTo: hhmm(config.focus?.waterTo, d.focus.waterTo),
      lunch: hhmm(config.focus?.lunch, d.focus.lunch),
      offWork: hhmm(config.focus?.offWork, d.focus.offWork),
    },
  };
  await writeFile(RUNTIME_CONFIG_PATH, JSON.stringify(saved, null, 2), "utf8");
  return saved;
}

function card(id, type, title, value, detail, tone = "neutral", priority = 50) {
  return { id, type, title, value, detail: truncate(detail, 120), tone, priority };
}

import { thaiLunar, nextUposatha } from "./thai-lunar.mjs";
import { sajuDay, sajuMonth } from "./saju.mjs";
import { getWeather, nextHoliday, holidaysInMonth, getAiUsage, getStockViz, getClaudeQuota, getClaudeSessions, icsEventsInMonth } from "./live-sources.mjs";

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

// สีจุดบนจอต่อฟีด — เรียงตามลำดับที่ตั้งไว้ในหน้า config
const FEED_COLORS = ["4ADE80", "F472B6", "A78BFA", "22D3EE"];

async function feedEventsInMonth(feeds, y, m) {
  const on = feeds.filter((f) => f.on);
  const lists = await Promise.all(on.map((f) => icsEventsInMonth(f.url, y, m).catch(() => [])));
  return lists.flatMap((list, i) => list.map((e) => ({ ...e, f: i }))).sort((a, b) => a.d - b.d);
}

async function buildCalendarCards(opts) {
  const now = bangkokNow();
  const be = now.y + 543;
  const today = new Date(now.y, now.m - 1, now.d);
  const todayIso = `${now.y}-${String(now.m).padStart(2, "0")}-${String(now.d).padStart(2, "0")}`;

  const [holiday, monthHolidays] = opts.showHolidays
    ? await Promise.all([nextHoliday(todayIso).catch(() => null), holidaysInMonth(now.y, now.m).catch(() => [])])
    : [null, []];

  const holidayText = holiday
    ? `วันหยุดถัดไป: ${Number(holiday.iso.slice(8))} ${THAI_MONTHS[Number(holiday.iso.slice(5, 7)) - 1]} ${holiday.name}`
    : "ไม่พบวันหยุดถัดไป";

  const lunar = thaiLunar(today);
  const nextPhra = nextUposatha(today);
  const buddhaDays = [];
  if (opts.showBuddha) {
    for (let d = 1; d <= 31; d++) {
      const probe = new Date(now.y, now.m - 1, d);
      if (probe.getMonth() !== now.m - 1) break;
      if (thaiLunar(probe).isUposatha) buddhaDays.push(d);
    }
  }

  const activeFeeds = opts.feeds.filter((f) => f.on);
  const events = await feedEventsInMonth(opts.feeds, now.y, now.m);
  const nextEvent = events.find((e) => e.d >= now.d);

  const calendarCard = {
    ...card(
      "calendar_today", "calendar", "Today",
      `${now.d} ${THAI_MONTHS[now.m - 1]} ${be}`,
      [`วัน${THAI_DAYS[now.wd]}`, holidayText,
       nextEvent && `${activeFeeds[nextEvent.f]?.label || "ปฏิทิน"}: ${nextEvent.d} ${THAI_MONTHS[now.m - 1]} ${nextEvent.time || ""}`,
      ].filter(Boolean).join(" · "),
      holiday?.iso === todayIso ? "ok" : "neutral", 20,
    ),
    extra: {
      calendar: {
        y: now.y, m: now.m, today: now.d, buddhaDays, holidays: monthHolidays,
        events,
        feeds: activeFeeds.map((f, i) => ({ label: f.label, color: FEED_COLORS[i] })),
        saju: sajuMonth(now.y, now.m, opts.birth),
      },
    },
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

async function buildWeatherCard(loc) {
  try {
    const w = await getWeather(loc);
    return {
      ...card(
        "weather_now", "weather", "Weather",
        `${w.temp}° ${w.condition}`,
        // สั้นพอให้จอ 480px จบในบรรทัดเดียว — ขึ้นบรรทัดสองแล้วแถวพยากรณ์จะโดนดันตกจอ
        `${loc.label} · รู้สึก ${w.feels}° · ชื้น ${w.humidity}% · ลม ${w.wind} · ฝน ${w.rain}%`,
        w.rain >= 60 ? "caution" : "ok", 40,
      ),
      extra: {
        hourly: w.hourly, forecast: w.forecast, humidity: w.humidity, wind: w.wind, nowHour: w.nowHour,
        // แยกฟิลด์ให้จอประกอบ header เอง — ส่งเป็นประโยคเดียวแล้วจอจัดเลย์เอาต์ไม่ได้
        now: { temp: w.temp, code: w.code, condition: w.condition, rain: w.rain, humidity: w.humidity, wind: w.wind },
      },
    };
  } catch (error) {
    return card("weather_now", "weather", "Weather", "ไม่มีข้อมูล", `Open-Meteo error: ${error.message}`, "caution", 40);
  }
}

function parseBirth(iso) {
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map(Number);
  return { y, m, d };
}

function buildSajuCard(birthIso) {
  const birth = parseBirth(birthIso);
  if (!birth) return null;
  const info = sajuDay(new Date(), birth);
  const tone = info.now.lv === 2 ? "ok" : info.now.lv === 1 ? "caution" : "neutral";
  return {
    ...card(
      "saju_today", "saju", "พลังวันนี้",
      // ไม่ใส่เสาวันเป็นอักษรจีน ฟอนต์บนจอมีแค่ไทย+ASCII จะกลายเป็นช่องว่างเปล่า
      `${info.now.lvLabel} · วันธาตุ${info.dayElem}`,
      `${info.now.note} · สีของวัน${info.color.name} · เจ้าเรือนธาตุ${info.dm.elem}`,
      tone, 45,
    ),
    extra: {
      saju: {
        blocks: info.blocks.map((b) => ({ h: b.h, lv: b.lv })),
        nowH: info.now.h,
        color: info.color.hex,
        colorName: info.color.name,
        dayElem: info.dayElem,
        dm: info.dm.elem,
      },
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

function buildIdeaRadarCard(ideaRadar, opts) {
  const topPick = ideaRadar?.topPick || ideaRadar?.items?.topPick;
  if (!topPick) return null;
  const themes = (ideaRadar?.themes || []).slice(0, opts.themes).map((theme) => ({
    name: theme.name,
    score: theme.score,
    stage: theme.stageLabel || theme.stage,
  }));
  return {
    ...card(
      "idea_radar",
      "market",
      "Idea Radar",
      (topPick.tickers || []).slice(0, opts.tickers).join(" / ") || topPick.theme || "Radar",
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

async function buildAiUsageCard(opts) {
  try {
    let [usage, quota] = await Promise.all([getAiUsage(), getClaudeQuota().catch(() => null)]);
    if (quota && !opts.showWeek) quota = { ...quota, week: null };
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

function fmtAgo(sec) {
  if (sec < 60) return `${sec} วินาทีที่แล้ว`;
  if (sec < 3600) return `${Math.round(sec / 60)} นาทีที่แล้ว`;
  return `${Math.round(sec / 3600)} ชม.ที่แล้ว`;
}

// "ตอนนี้ Claude ทำอะไรอยู่" — รอคำตอบต้องเด้งที่สุด เพราะเป็นสถานะเดียวที่ต้องลุกไปทำอะไร
async function buildClaudeCard() {
  try {
    const { sessions, pulse } = await getClaudeSessions();
    const live = sessions.filter((s) => s.state !== "idle");
    const top = live[0];

    const value = !top
      ? "ไม่มี session ที่ทำงานอยู่"
      : top.state === "waiting"
        ? `รอคำตอบ · ${top.project}`
        : `${top.tool || "กำลังคิด"} · ${top.project}`;

    const others = live.slice(1).map((s) => `${s.project} ${s.state === "waiting" ? "รอคำตอบ" : "ทำงานอยู่"}`);
    const detail = !top
      ? sessions.length ? `${sessions.length} session เงียบอยู่` : "วันนี้ยังไม่ได้เปิด Claude Code"
      : [top.branch, fmtAgo(top.idleSec), ...others].filter(Boolean).join(" · ");

    return {
      ...card(
        "claude_now", "claude", "Claude Code", value, detail,
        top?.state === "waiting" ? "alert" : top ? "ok" : "neutral", 82,
      ),
      viz: pulse.some((v) => v > 0) ? { kind: "spark", points: pulse } : undefined,
      // ส่งเท่าที่จอ/mock-ui จะโชว์ได้จริง — payload ก้อนนี้ต้องผ่าน JsonDocument บน ESP32
      // state/tool/project แบนไว้ให้เฟิร์มแวร์อ่านตรง ๆ ไม่ต้องวน array หาตัวที่ควรโชว์
      extra: {
        state: top?.state ?? "none",
        tool: top?.tool ?? "",
        project: top?.project ?? "",
        live: live.length,
        sessions: live.slice(0, 3).map((s) => ({ project: s.project, state: s.state, tool: s.tool })),
      },
    };
  } catch (error) {
    return card("claude_now", "claude", "Claude Code", "อ่านไม่ได้", `sessions error: ${error.message}`, "caution", 82);
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
    buildCalendarCards({ ...runtimeConfig.calendar, birth: parseBirth(runtimeConfig.saju.birthDate) }),
    buildWeatherCard(runtimeConfig.weather),
  ]);
  const astroCard = await buildAstroCard();
  const sajuCard = buildSajuCard(runtimeConfig.saju.birthDate);
  const marketCard = buildMarketCard(entrySignal, runtimeConfig.tickers);
  const ideaCard = buildIdeaRadarCard(ideaRadar, runtimeConfig.ideaRadar);
  const northStarCard = buildNorthStarCard(northstar);
  const tokenCard = await buildAiUsageCard(runtimeConfig.aiStatus);
  const claudeCard = await buildClaudeCard();
  // เลือกได้ว่าการ์ดนี้จะโฟกัสตัวไหน — alpha ไม่มีโซนเข้า/stop เลยได้แค่กราฟราคา
  const planFocus = runtimeConfig.monthlyPlan.focus;
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
          // ticker ตัวแรกใน value คือตัวที่ระบบไปดึงกราฟราคามาให้ — เรียงตาม focus ที่เลือก
          (planFocus === "alpha"
            ? [monthlyPlan.alpha?.ticker, monthlyPlan.swing?.ticker]
            : [monthlyPlan.swing?.ticker, monthlyPlan.alpha?.ticker]
          ).filter(Boolean).join(" / ") || monthlyPlan.monthLabel,
          (planFocus === "alpha"
            ? monthlyPlan.alpha?.note || monthlyPlan.swing?.exec
            : monthlyPlan.swing?.exec || monthlyPlan.alpha?.note) || "Monthly plan loaded",
          "caution",
          65,
        ),
        extra: planFocus === "swing" && swing?.hasSetup
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

  // เลือกเองได้ว่าจะดูกราฟตัวไหนใน Market Focus — ดันไปไว้หน้าสุดของ value
  const pick = runtimeConfig.marketFocus.chart;
  if (pick && marketCard?.extra?.stocks?.some((x) => x.ticker === pick)) {
    marketCard.value = [pick, ...String(marketCard.value).split(" / ").filter((t) => t !== pick)].join(" / ");
  }

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
    sajuCard,
    marketCard,
    ideaCard,
    planCard,
    northStarCard,
    tokenCard,
    claudeCard,
  ].filter(Boolean);

  return {
    schemaVersion: "1.0.0",
    deviceProfile: "tanplanet-smart-astro-calendar",
    // จอตั้งค่าตัวเองจากตรงนี้ — ปรับรอบรีเฟรช/ความสว่างได้โดยไม่ต้อง flash ใหม่
    device: {
      refreshSeconds: runtimeConfig.device.refreshSeconds,
      display: runtimeConfig.display,
      focus: runtimeConfig.focus,
    },
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
  const tickers = [...new Set((entrySignal?.groups || []).flatMap((g) => (g.stocks || []).map((s) => s.ticker)))];
  const cards = [
    ["calendar_today", "Calendar"], ["lunar_today", "Lunar"], ["weather_now", "Weather"],
    ["astro_today", "ดวงลงทุนวันนี้"], ["market_focus", "Market Focus"], ["idea_radar", "Idea Radar"],
    ["monthly_plan", "Monthly Plan"], ["northstar", "North Star"], ["ai_status", "AI Status"],
    ["claude_now", "Claude Code"],
    ["saju_today", "พลังวันนี้ (สาจู)"],
  ];
  // หน้าตาอยู่ในไฟล์จริง แก้ CSS/JS ได้โดยไม่ต้องแหย่ string ใน server.mjs
  const html = await readFile(path.join(__dirname, "manage.html"), "utf8");
  const boot = `<script>window.__CONFIG__=${JSON.stringify(await loadRuntimeConfig())};` +
               `window.__DATA__=${JSON.stringify({ tickers, cards })};</script>`;
  return html.replace("<script>", boot + "<script>");
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
  // ฟอนต์ Anuphan เก็บในเครื่อง — หน้า /manage เปิดจากมือถือตอนเน็ตนอกล่มก็ยังได้ฟอนต์ไทย
  if (url.pathname === "/assets/anuphan.woff2") {
    try {
      const font = await readFile(path.join(PROJECT_ROOT, "data", "fonts", "anuphan.woff2"));
      res.writeHead(200, { "content-type": "font/woff2", "cache-control": "max-age=31536000" });
      return res.end(font);
    } catch {
      return sendJson(res, 404, { error: "font not found" });
    }
  }
  // ค้นหาสถานที่ → พิกัด ให้หน้า config ไม่ต้องให้คนไปหา lat/lon เอง
  if (url.pathname === "/api/geocode") {
    const q = (url.searchParams.get("q") || "").trim();
    if (!q) return sendJson(res, 200, { results: [] });
    try {
      const r = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=6&language=th&format=json`,
        { signal: AbortSignal.timeout(8000) },
      );
      const data = await r.json();
      return sendJson(res, 200, {
        results: (data.results || []).map((x) => ({
          label: [x.name, x.admin1].filter(Boolean).join(" · "),
          lat: x.latitude,
          lon: x.longitude,
        })),
      });
    } catch (error) {
      return sendJson(res, 502, { error: String(error.message || error) });
    }
  }
  // ปฏิทินเดือนใดก็ได้ — จอเรียกตอนกดเลื่อนเดือน (device-summary ส่งมาแค่เดือนปัจจุบัน)
  if (url.pathname === "/api/month") {
    const y = Number(url.searchParams.get("y")) || new Date().getFullYear();
    const m = Math.min(12, Math.max(1, Number(url.searchParams.get("m")) || 1));
    const buddhaDays = [];
    if ((await loadRuntimeConfig()).calendar.showBuddha) {
      for (let d = 1; d <= 31; d++) {
        const probe = new Date(y, m - 1, d);
        if (probe.getMonth() !== m - 1) break;
        if (thaiLunar(probe).isUposatha) buddhaDays.push(d);
      }
    }
    const cfg = (await loadRuntimeConfig()).calendar;
    return sendJson(res, 200, {
      y, m, buddhaDays,
      holidays: cfg.showHolidays ? await holidaysInMonth(y, m) : [],
      events: await feedEventsInMonth(cfg.feeds, y, m),
      feeds: cfg.feeds.filter((f) => f.on).map((f, i) => ({ label: f.label, color: FEED_COLORS[i] })),
      saju: sajuMonth(y, m, parseBirth((await loadRuntimeConfig()).saju.birthDate)),
    });
  }
  // จอกดเลื่อนดูหุ้นตัวอื่นในหน้า detail — ดึงทีละตัว ไม่ต้องยัดทุกตัวมากับ device-summary
  if (url.pathname === "/api/stock") {
    const ticker = (url.searchParams.get("ticker") || "").toUpperCase().replace(/[^A-Z.\-]/g, "");
    if (!ticker) return sendJson(res, 400, { error: "ticker required" });
    try {
      return sendJson(res, 200, await getStockViz(ticker));
    } catch (error) {
      return sendJson(res, 502, { error: String(error.message || error) });
    }
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
