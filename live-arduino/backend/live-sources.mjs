// แหล่งข้อมูลจริงของการ์ดบนจอ — ไม่มี mock, ไม่ต้องใช้ API key
//   อากาศ    → Open-Meteo
//   วันหยุด  → Google Calendar ปฏิทินวันหยุดไทย (ical สาธารณะ)
//   AI usage → นับ token จาก JSONL ของ Claude Code / Codex ในเครื่อง
//
// ทุกตัว cache ไว้ในหน่วยความจำ เพราะ ESP32 ยิงมาทุก 5 นาที

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import readline from "node:readline";

const BANGKOK = { lat: 13.7563, lon: 100.5018 };
const HOLIDAY_ICS =
  "https://calendar.google.com/calendar/ical/th.th%23holiday%40group.v.calendar.google.com/public/basic.ics";

const cache = new Map();

async function cached(key, ttlMs, loader) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.value;
  try {
    const value = await loader();
    cache.set(key, { at: Date.now(), value });
    return value;
  } catch (error) {
    // ponytail: ยอมคืนของเก่าดีกว่าจอว่าง — เน็ตล่มชั่วคราวไม่ควรทำให้การ์ดหาย
    if (hit) return { ...hit.value, stale: true, error: error.message };
    throw error;
  }
}

// ---------------------------------------------------------------- อากาศ

// WMO weather code → คำไทย (ย่อจากตาราง WMO 4677 เฉพาะที่เจอในไทย)
const WMO = {
  0: "ฟ้าโปร่ง", 1: "แดดจัด", 2: "มีเมฆบางส่วน", 3: "เมฆมาก",
  45: "หมอก", 48: "หมอกน้ำแข็ง",
  51: "ฝนละออง", 53: "ฝนละออง", 55: "ฝนละอองหนัก",
  61: "ฝนเล็กน้อย", 63: "ฝนปานกลาง", 65: "ฝนหนัก",
  80: "ฝนซู่", 81: "ฝนซู่", 82: "ฝนซู่หนัก",
  95: "พายุฝนฟ้าคะนอง", 96: "พายุฝนฟ้าคะนอง", 99: "พายุฝนฟ้าคะนองรุนแรง",
};

export function getWeather() {
  return cached("weather", 15 * 60 * 1000, async () => {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${BANGKOK.lat}&longitude=${BANGKOK.lon}` +
      "&current=temperature_2m,relative_humidity_2m,weather_code,apparent_temperature" +
      "&hourly=temperature_2m&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code" +
      "&timezone=Asia%2FBangkok&forecast_days=4";
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`open-meteo ${res.status}`);
    const d = await res.json();

    const nowHour = new Date().getHours();
    const hourly = [];
    for (let h = 0; h < 24; h += 3) {
      hourly.push({ t: String(h).padStart(2, "0"), v: Math.round(d.hourly.temperature_2m[h]) });
    }

    const days = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];
    const forecast = d.daily.time.map((iso, i) => ({
      d: days[new Date(iso).getDay()],
      label: WMO[d.daily.weather_code[i]] ?? "-",
      hi: Math.round(d.daily.temperature_2m_max[i]),
      lo: Math.round(d.daily.temperature_2m_min[i]),
      rain: d.daily.precipitation_probability_max[i],
    }));

    return {
      temp: Math.round(d.current.temperature_2m),
      feels: Math.round(d.current.apparent_temperature),
      humidity: d.current.relative_humidity_2m,
      condition: WMO[d.current.weather_code] ?? "-",
      hi: forecast[0].hi,
      lo: forecast[0].lo,
      rain: forecast[0].rain,
      nowHour,
      hourly,
      forecast,
    };
  });
}

// ---------------------------------------------------------------- วันหยุด

function parseIcs(text) {
  const events = [];
  for (const block of text.split("BEGIN:VEVENT").slice(1)) {
    const date = block.match(/DTSTART;VALUE=DATE:(\d{4})(\d{2})(\d{2})/);
    const summary = block.match(/SUMMARY:(.*)/);
    if (!date || !summary) continue;
    events.push({
      iso: `${date[1]}-${date[2]}-${date[3]}`,
      name: summary[1].trim().replace(/\\,/g, ","),
    });
  }
  return events.sort((a, b) => a.iso.localeCompare(b.iso));
}

export function getHolidays() {
  return cached("holidays", 24 * 60 * 60 * 1000, async () => {
    const res = await fetch(HOLIDAY_ICS, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error(`google ical ${res.status}`);
    return { events: parseIcs(await res.text()) };
  });
}

export async function nextHoliday(fromIso) {
  const { events } = await getHolidays();
  return events.find((e) => e.iso >= fromIso) ?? null;
}

export async function holidaysInMonth(year, month) {
  const { events } = await getHolidays();
  const prefix = `${year}-${String(month).padStart(2, "0")}-`;
  return events.filter((e) => e.iso.startsWith(prefix)).map((e) => ({
    d: Number(e.iso.slice(8)),
    label: e.name,
  }));
}

// ---------------------------------------------------------------- หุ้น

const LOGO_DIR = path.join(process.cwd(), "data", "logos");
const LOGO_TOOL = path.join(process.cwd(), "backend", "tools", "logo2rgb565.py");

// โลโก้แปลงครั้งเดียวแล้วเก็บลงดิสก์ — ESP32 decode PNG เองไม่ไหว จึงส่ง RGB565 ดิบ
async function logoBase64(ticker) {
  const file = path.join(LOGO_DIR, `${ticker}.bin`);
  if (!fs.existsSync(file)) {
    fs.mkdirSync(LOGO_DIR, { recursive: true });
    const { execFile } = await import("node:child_process");
    await new Promise((resolve) => {
      execFile("python3", [LOGO_TOOL, ticker, file], { timeout: 20000 }, (err) => resolve(err));
    });
  }
  if (!fs.existsSync(file)) return null;
  return fs.readFileSync(file).toString("base64");
}

/** ราคาปิดย้อนหลัง 1 เดือน + เปอร์เซ็นต์เปลี่ยนแปลง + โลโก้ */
export function getStockViz(ticker) {
  return cached(`stock:${ticker}`, 10 * 60 * 1000, async () => {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?range=1mo&interval=1d`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`yahoo ${res.status}`);
    const result = (await res.json()).chart?.result?.[0];
    if (!result) throw new Error("yahoo: ไม่มีข้อมูล");

    const closes = result.indicators.quote[0].close.filter((v) => v != null).map((v) => Math.round(v * 100) / 100);
    const first = closes[0];
    const last = closes[closes.length - 1];

    return {
      ticker,
      closes,
      last,
      changePct: Math.round(((last - first) / first) * 1000) / 10,
      currency: result.meta?.currency ?? "USD",
      logo: await logoBase64(ticker).catch(() => null),
    };
  });
}

// ---------------------------------------------------------------- AI usage

// อ่านบรรทัดสุดท้าย ๆ ของ JSONL แล้วรวม token ของวันนี้
async function sumClaudeTokens(sinceMs) {
  const root = path.join(os.homedir(), ".claude", "projects");
  if (!fs.existsSync(root)) return null;

  const files = [];
  for (const dir of fs.readdirSync(root)) {
    const full = path.join(root, dir);
    if (!fs.statSync(full).isDirectory()) continue;
    for (const f of fs.readdirSync(full)) {
      if (!f.endsWith(".jsonl")) continue;
      const p = path.join(full, f);
      if (fs.statSync(p).mtimeMs >= sinceMs) files.push(p);
    }
  }

  const total = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, messages: 0 };
  const stamps = [];   // เวลาของทุกข้อความ ใช้หาขอบหน้าต่าง 5 ชม.
  const hourly = new Array(24).fill(0);
  const nowMs = Date.now();
  for (const file of files) {
    const rl = readline.createInterface({ input: fs.createReadStream(file), crlfDelay: Infinity });
    for await (const line of rl) {
      if (!line.includes('"usage"')) continue;
      let entry;
      try {
        entry = JSON.parse(line);
      } catch {
        continue;
      }
      const ts = Date.parse(entry.timestamp ?? "");
      if (!Number.isFinite(ts) || ts < sinceMs) continue;
      const u = entry.message?.usage ?? entry.usage;
      if (!u) continue;
      total.input += u.input_tokens ?? 0;
      total.output += u.output_tokens ?? 0;
      total.cacheRead += u.cache_read_input_tokens ?? 0;
      total.cacheWrite += u.cache_creation_input_tokens ?? 0;
      total.messages += 1;
      stamps.push(ts);
      const hoursAgo = Math.floor((nowMs - ts) / 3600000);
      if (hoursAgo >= 0 && hoursAgo < 24) hourly[23 - hoursAgo] += u.output_tokens ?? 0;
    }
  }

  // หน้าต่างการใช้งานของ Claude ยาว 5 ชม. เริ่มนับจากข้อความแรกหลังเว้นช่วงเกิน 5 ชม.
  // (เพดานโควตาจริงอยู่ฝั่งเซิร์ฟเวอร์ อ่านจากไฟล์ในเครื่องไม่ได้ จึงบอกได้แค่ยอดใช้กับเวลารีเซ็ต)
  stamps.sort((a, b) => a - b);
  const WINDOW = 5 * 3600 * 1000;
  let anchor = stamps[0] ?? nowMs;
  for (let i = 1; i < stamps.length; i++) {
    if (stamps[i] - stamps[i - 1] > WINDOW) anchor = stamps[i];  // เว้นช่วงนาน = เริ่มนับใหม่
  }
  // ใช้ต่อเนื่องยาวกว่า 5 ชม. หน้าต่างจะหมุนไปเรื่อย ๆ ต้องเลื่อนไปรอบปัจจุบัน
  const windowStart = anchor + Math.floor((nowMs - anchor) / WINDOW) * WINDOW;
  const windowOutput = stamps.reduce((sum, ts, i) => sum + (ts >= windowStart ? 0 : 0), 0);

  return {
    ...total,
    hourly,
    windowStart,
    windowResetsAt: windowStart + WINDOW,
    windowMinutesLeft: Math.max(0, Math.round((windowStart + WINDOW - nowMs) / 60000)),
    windowOutput,
  };
}

async function sumCodexTokens(sinceMs) {
  const root = path.join(os.homedir(), ".codex", "sessions");
  if (!fs.existsSync(root)) return null;

  const total = { input: 0, output: 0, messages: 0 };
  const walk = (dir) => {
    const out = [];
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      const st = fs.statSync(full);
      if (st.isDirectory()) out.push(...walk(full));
      else if (name.endsWith(".jsonl") && st.mtimeMs >= sinceMs) out.push(full);
    }
    return out;
  };

  for (const file of walk(root)) {
    const rl = readline.createInterface({ input: fs.createReadStream(file), crlfDelay: Infinity });
    for await (const line of rl) {
      if (!line.includes("token")) continue;
      let entry;
      try {
        entry = JSON.parse(line);
      } catch {
        continue;
      }
      const u = entry.payload?.info?.total_token_usage ?? entry.info?.total_token_usage;
      if (!u) continue;
      total.input = Math.max(total.input, u.input_tokens ?? 0);
      total.output = Math.max(total.output, u.output_tokens ?? 0);
      total.messages += 1;
      stamps.push(ts);
      const hoursAgo = Math.floor((nowMs - ts) / 3600000);
      if (hoursAgo >= 0 && hoursAgo < 24) hourly[23 - hoursAgo] += u.output_tokens ?? 0;
    }
  }

  // หน้าต่างการใช้งานของ Claude ยาว 5 ชม. เริ่มนับจากข้อความแรกหลังเว้นช่วงเกิน 5 ชม.
  // (เพดานโควตาจริงอยู่ฝั่งเซิร์ฟเวอร์ อ่านจากไฟล์ในเครื่องไม่ได้ จึงบอกได้แค่ยอดใช้กับเวลารีเซ็ต)
  stamps.sort((a, b) => a - b);
  const WINDOW = 5 * 3600 * 1000;
  let anchor = stamps[0] ?? nowMs;
  for (let i = 1; i < stamps.length; i++) {
    if (stamps[i] - stamps[i - 1] > WINDOW) anchor = stamps[i];  // เว้นช่วงนาน = เริ่มนับใหม่
  }
  // ใช้ต่อเนื่องยาวกว่า 5 ชม. หน้าต่างจะหมุนไปเรื่อย ๆ ต้องเลื่อนไปรอบปัจจุบัน
  const windowStart = anchor + Math.floor((nowMs - anchor) / WINDOW) * WINDOW;
  const windowOutput = stamps.reduce((sum, ts, i) => sum + (ts >= windowStart ? 0 : 0), 0);

  return {
    ...total,
    hourly,
    windowStart,
    windowResetsAt: windowStart + WINDOW,
    windowMinutesLeft: Math.max(0, Math.round((windowStart + WINDOW - nowMs) / 60000)),
    windowOutput,
  };
}

export function getAiUsage() {
  return cached("ai-usage", 5 * 60 * 1000, async () => {
    const midnight = new Date();
    midnight.setHours(0, 0, 0, 0);
    const since = midnight.getTime();

    const [claude, codex] = await Promise.all([
      sumClaudeTokens(since).catch(() => null),
      sumCodexTokens(since).catch(() => null),
    ]);

    return { since: midnight.toISOString(), claude, codex };
  });
}

// self-check: ยิงของจริงทั้ง 3 แหล่ง — `node backend/live-sources.mjs`
async function demo() {
  const w = await getWeather();
  console.log(`อากาศ: ${w.temp}° ${w.condition} (รู้สึก ${w.feels}°, ชื้น ${w.humidity}%)`);
  console.log(`  วันนี้ ${w.lo}-${w.hi}° ฝน ${w.rain}% · พยากรณ์ ${w.forecast.length} วัน`);

  const h = await nextHoliday(new Date().toISOString().slice(0, 10));
  console.log(`วันหยุดถัดไป: ${h.iso} ${h.name}`);

  const st = await getStockViz("NVDA");
  console.log(`หุ้น ${st.ticker}: $${st.last} (${st.changePct > 0 ? "+" : ""}${st.changePct}% 1 เดือน) · ${st.closes.length} จุด · โลโก้ ${st.logo ? `${st.logo.length} chars` : "ไม่มี"}`);

  const ai = await getAiUsage();
  const fmt = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : `${Math.round(n / 1000)}k`);
  if (ai.claude) {
    console.log(
      `Claude วันนี้: in ${fmt(ai.claude.input)} out ${fmt(ai.claude.output)} ` +
        `cache ${fmt(ai.claude.cacheRead)} · ${ai.claude.messages} ข้อความ`,
    );
  }
  if (ai.codex) console.log(`Codex วันนี้: in ${fmt(ai.codex.input)} out ${fmt(ai.codex.output)}`);
}

if (import.meta.url === `file://${process.argv[1]}`) demo();
