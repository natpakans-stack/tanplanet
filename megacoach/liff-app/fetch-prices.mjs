#!/usr/bin/env node
// fetch-prices.mjs — ดึงราคาหุ้นสดจาก SerpApi Google Finance เป็น JSON ตัวเลขเป๊ะ ๆ
// ใช้แทนการให้ AI เดาราคาจาก WebSearch (ต้นเหตุราคาเพี้ยน/รอบบรีฟล่มเงียบ)
//
// ใช้:   SERPAPI_KEY=xxx SERPAPI_KEY_2=yyy node fetch-prices.mjs
//        ถ้าคีย์แรกหมดโควตา/ใช้ไม่ได้ จะสลับไปคีย์ที่สองอัตโนมัติ
//        SERPAPI_KEY=xxx node fetch-prices.mjs NVDA:NASDAQ VST:NYSE
//        node fetch-prices.mjs --selftest                 # เช็ก parser ไม่ต้องต่อเน็ต
//
// output (stdout): {"NVDA":{"price":192.53,"changePct":-1.2,"dir":"down","currency":"USD"}, ...}
// ถ้าตัวไหนดึงไม่ได้ → ค่าเป็น null + เขียน warning ลง stderr (ผู้เรียกถอยไป WebSearch ต่อได้)

const DEFAULT = ["VOO:NYSEARCA", "QQQ:NASDAQ", "NVDA:NASDAQ", "VST:NYSE", "MU:NASDAQ", "INTC:NASDAQ"];

// แกะ summary ของ SerpApi → {price, changePct, dir, currency}
function parseQuote(j) {
  const s = j?.summary;
  if (!s || s.price == null) return null;
  const price = typeof s.price === "number" ? s.price : parseFloat(String(s.price).replace(/[^0-9.\-]/g, ""));
  const m = s.price_movement || {};
  // SerpApi: percentage = ขนาด (ไม่มีเครื่องหมาย), ทิศมาจาก movement ("Up"/"Down") → ต้องใส่ลบเองตอนขาลง
  const dir = (m.movement || "").toLowerCase().startsWith("down") ? "down"
            : (m.movement || "").toLowerCase().startsWith("up") ? "up" : null;
  let changePct = m.percentage != null ? Math.abs(Number(m.percentage)) : null;
  if (changePct != null && dir === "down") changePct = -changePct;
  if (changePct != null) changePct = Math.round(changePct * 100) / 100;
  return { price: Math.round(price * 100) / 100, changePct, dir, currency: s.currency || "USD" };
}

class KeyUnavailableError extends Error {}

function isKeyUnavailable(status, body) {
  if ([401, 403, 429].includes(status)) return true;
  const message = String(body?.error || "").toLowerCase();
  return /quota|limit|exhaust|run out|searches|api key|account/.test(message);
}

async function fetchOne(q, key) {
  const url = `https://serpapi.com/search?engine=google_finance&q=${encodeURIComponent(q)}&api_key=${key}`;
  const r = await fetch(url);
  const body = await r.json().catch(() => null);
  if (isKeyUnavailable(r.status, body)) {
    throw new KeyUnavailableError(body?.error || `HTTP ${r.status}`);
  }
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  if (body?.error) throw new Error(body.error);
  return parseQuote(body);
}

function getKeys() {
  // รองรับทั้งแบบแยกสองบรรทัด และแบบ SERPAPI_KEYS=key1,key2
  const keys = [
    process.env.SERPAPI_KEY,
    process.env.SERPAPI_KEY_2,
    ...(process.env.SERPAPI_KEYS || "").split(/[\s,]+/),
  ].map(k => k?.trim()).filter(Boolean);
  return rotate([...new Set(keys)], Math.floor(Date.now() / 864e5));
}

// สลับคีย์แรกวันละตัว → โควตาเฉลี่ยทุกคีย์ (ตัวที่เหลือยังเป็น failover ตามลำดับ)
const rotate = (a, n) => a.length ? [...a.slice(n % a.length), ...a.slice(0, n % a.length)] : a;

function selftest() {
  const sample = { summary: { price: 192.53, currency: "USD", price_movement: { percentage: 1.23, movement: "Down" } } };
  const out = parseQuote(sample);
  console.assert(out.price === 192.53, "price");
  console.assert(out.changePct === -1.23, "changePct signed negative on Down");
  console.assert(out.dir === "down", "dir from movement word");
  console.assert(parseQuote({}) === null, "empty → null");
  console.assert(isKeyUnavailable(429, null), "HTTP 429 switches key");
  console.assert(isKeyUnavailable(200, { error: "Your account has run out of searches." }), "quota response switches key");
  console.assert(!isKeyUnavailable(500, null), "server error does not disable key");
  console.assert(rotate(["a", "b"], 0).join() === "a,b" && rotate(["a", "b"], 1).join() === "b,a", "rotate by day");
  console.log("selftest ok");
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--selftest")) return selftest();

  const keys = getKeys();
  if (!keys.length) { console.error("ERROR: ตั้ง SERPAPI_KEY ก่อน"); process.exit(1); }

  const tickers = args.length ? args : DEFAULT;
  const out = {};
  let activeKey = 0;
  for (const q of tickers) {
    const sym = q.split(":")[0];
    out[sym] = null;
    while (activeKey < keys.length) {
      try {
        out[sym] = await fetchOne(q, keys[activeKey]);
        if (!out[sym]) console.error(`WARN ${sym}: ไม่มี summary.price`);
        break;
      } catch (e) {
        if (e instanceof KeyUnavailableError) {
          console.error(`WARN ${sym}: คีย์ ${activeKey + 1} ใช้ไม่ได้หรือโควตาหมด — สลับคีย์`);
          activeKey += 1;
          continue;
        }
        console.error(`WARN ${sym}: ${e.message}`);
        break;
      }
    }
    if (activeKey >= keys.length && out[sym] === null) {
      console.error(`WARN ${sym}: ไม่มี SerpApi key ที่ใช้งานได้เหลืออยู่`);
    }
  }
  console.log(JSON.stringify(out, null, 2));
}

main();
