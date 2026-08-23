// /api/quote?t=NVDA,MRK — ราคาสดจาก Yahoo v8 (keyless) ให้หน้าเว็บถามเองได้ ไม่ต้องรอ cron เช้า
// บทเรียน NVDA: ดู regularMarketPrice อย่างเดียวหลอกได้ (ค้างที่ close) — ราคาตัดสินใจต้องรวม pre/post
// → ใช้แท่ง 1 นาทีล่าสุดจาก series (includePrePost=true) เป็น price, แนบ sessionClose + อายุข้อมูลไว้ให้ UI
// ตอบ {at, quotes:{T:{price, priceAt, ageMin, sessionClose, prevClose, changePct}}} · cache CDN 60 วิ
export default async function handler(req, res) {
  const syms = String(req.query.t || "")
    .split(",").map(s => s.trim().toUpperCase())
    .filter(s => /^[A-Z][A-Z.\-]{0,9}$/.test(s)).slice(0, 12);
  if (!syms.length) return res.status(400).json({ error: "no tickers" });

  const quotes = {};
  await Promise.all(syms.map(async s => {
    try {
      const r = await fetch(
        `https://query1.finance.yahoo.com/v8/finance/chart/${s}?range=1d&interval=1m&includePrePost=true`,
        { headers: { "User-Agent": "Mozilla/5.0" } });
      const d = (await r.json())?.chart?.result?.[0];
      const m = d?.meta;
      if (!m) { quotes[s] = null; return; }
      // แท่ง 1 นาทีล่าสุดที่มีราคา (รวม pre/post) = ราคาตัดสินใจ
      let price = null, priceAt = null;
      const ts = d.timestamp || [], cl = d.indicators?.quote?.[0]?.close || [];
      for (let i = cl.length - 1; i >= 0; i--)
        if (cl[i] != null) { price = cl[i]; priceAt = ts[i]; break; }
      if (price == null) { price = m.regularMarketPrice; priceAt = m.regularMarketTime; }
      if (price == null) { quotes[s] = null; return; }
      const prev = m.chartPreviousClose ?? m.previousClose ?? null;
      quotes[s] = {
        price: Math.round(price * 100) / 100,
        priceAt: priceAt ? new Date(priceAt * 1000).toISOString() : null,
        ageMin: priceAt ? Math.round((Date.now() / 1000 - priceAt) / 60) : null,
        sessionClose: m.regularMarketPrice ?? null,
        prevClose: prev,
        changePct: prev ? Math.round((price / prev - 1) * 10000) / 100 : null,
      };
    } catch { quotes[s] = null; }
  }));
  res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");
  return res.status(200).json({ at: new Date().toISOString(), quotes });
}
