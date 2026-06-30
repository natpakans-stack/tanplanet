#!/usr/bin/env node
// fetch-prices.mjs — ดึงราคาหุ้นสดจาก SerpApi Google Finance เป็น JSON ตัวเลขเป๊ะ ๆ
// ใช้แทนการให้ AI เดาราคาจาก WebSearch (ต้นเหตุราคาเพี้ยน/รอบบรีฟล่มเงียบ)
//
// ใช้:   SERPAPI_KEY=xxx node fetch-prices.mjs            # ดึง 6 ตัวมาตรฐาน
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

async function fetchOne(q, key) {
  const url = `https://serpapi.com/search?engine=google_finance&q=${encodeURIComponent(q)}&api_key=${key}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return parseQuote(await r.json());
}

function selftest() {
  const sample = { summary: { price: 192.53, currency: "USD", price_movement: { percentage: 1.23, movement: "Down" } } };
  const out = parseQuote(sample);
  console.assert(out.price === 192.53, "price");
  console.assert(out.changePct === -1.23, "changePct signed negative on Down");
  console.assert(out.dir === "down", "dir from movement word");
  console.assert(parseQuote({}) === null, "empty → null");
  console.log("selftest ok");
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--selftest")) return selftest();

  const key = process.env.SERPAPI_KEY;
  if (!key) { console.error("ERROR: ตั้ง SERPAPI_KEY ก่อน"); process.exit(1); }

  const tickers = args.length ? args : DEFAULT;
  const out = {};
  for (const q of tickers) {
    const sym = q.split(":")[0];
    try {
      out[sym] = await fetchOne(q, key);
      if (!out[sym]) console.error(`WARN ${sym}: ไม่มี summary.price`);
    } catch (e) {
      out[sym] = null;
      console.error(`WARN ${sym}: ${e.message}`);
    }
  }
  console.log(JSON.stringify(out, null, 2));
}

main();
