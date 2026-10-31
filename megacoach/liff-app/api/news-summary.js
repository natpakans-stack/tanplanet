// /api/news-summary — AI สรุปหัวข่าว 3 วันของหุ้นที่คัดแล้ว เป็นภาษาคน (LIFF เรียกตอนแตะเปิดดูหุ้นตัวนั้น)
// สไตล์เดียวกับ astro-summary.js · OpenAI Responses API · env OPENAI_API_KEY
// ไฟจราจรยังใช้ tone นับคำใน news-check.mjs (คงที่ ตรวจได้) — AI แค่ช่วยอ่าน ไม่เปลี่ยนไฟ
const KEY   = process.env.OPENAI_API_KEY;
const MODEL = process.env.NEWS_MODEL || "gpt-4o-mini";
const cache = new Map(); // ponytail: cache ต่อ instance (หายเมื่อ cold start) · พอสำหรับคนใช้คนเดียว

const SYSTEM = `คุณคือผู้ช่วยอ่านข่าวหุ้นให้มือใหม่ สรุปจาก "หัวข่าว" ที่ให้มาเท่านั้น
- ภาษาไทยง่ายๆ 2-3 ประโยค ไม่มีหัวข้อ ไม่ใช้ emoji
- บอกว่าช่วงนี้มีเรื่องอะไรเกิดขึ้นกับบริษัท และมีข่าวไหนที่เป็นความเสี่ยงต้องระวัง
- ถ้าหัวข่าวไม่มีสาระ (ข่าวราคาขึ้นลงทั่วไป) ให้บอกตรงๆ ว่ายังไม่มีข่าวสำคัญ
- ห้ามแนะนำให้ซื้อหรือขาย ห้ามเดาตัวเลขหรือข้อมูลที่ไม่มีในหัวข่าว`;

const clip = (s, n) => String(s ?? "").slice(0, n);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method" });
  if (!KEY) return res.status(503).json({ error: "no-key" });
  const d = req.body || {};
  const t = clip(d.t, 12).toUpperCase(), heads = (Array.isArray(d.heads) ? d.heads : []).slice(0, 10).map(h => clip(h, 200)).filter(Boolean);
  if (!/^[A-Z0-9.\-]+$/.test(t) || !heads.length) return res.status(400).json({ error: "input" });
  const key = t + "|" + heads.join("|");
  if (cache.has(key)) return res.status(200).json({ summary: cache.get(key) });

  const input = [`หุ้น ${t}${d.earn ? ` · ${clip(d.earn, 40)}` : ""}`, "หัวข่าว 3 วันล่าสุด:", ...heads.map(h => "• " + h)].join("\n");
  try {
    const r = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${KEY}` },
      body: JSON.stringify({ model: MODEL, instructions: SYSTEM, input, max_output_tokens: 300 }),
    });
    if (!r.ok) return res.status(502).json({ error: "openai " + r.status });
    const data = await r.json();
    const summary = (data.output || []).filter(o => o.type === "message")
      .flatMap(o => (o.content || []).filter(c => c.type === "output_text").map(c => c.text)).join("\n").trim() || null;
    if (summary) cache.set(key, summary);
    return res.status(200).json({ summary });
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
}
