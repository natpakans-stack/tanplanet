// /api/astro-summary — AI สรุป "ดวงลงทุนวันนี้" เป็นภาษาคน จากสัญญาณดวง (score/ดาวจร/เกณฑ์)
// reuse OpenAI Responses API (สไตล์เดียวกับ ask.js) · ต้องตั้ง env OPENAI_API_KEY
const KEY   = process.env.OPENAI_API_KEY;
const MODEL = process.env.ASTRO_MODEL || "gpt-4o-mini";  // สั้น ถูก เร็ว

const SYSTEM = `คุณคือ "หมอดู AI" ของแอป MegaCoach สรุป "ดวงลงทุนวันนี้" ให้เจ้าของดวง (ชื่อแทน) ฟังแบบสนุกๆ เป็นกันเอง
- ตอบภาษาไทย 2-3 ประโยค กระชับ อ่านเพลิน ไม่ต้องมีหัวข้อ
- ร้อยเรียงจากสัญญาณที่ให้มา (คะแนน/โทน/ดาวจร/เกณฑ์ดวง) เป็นเรื่องเดียวกัน
- ⚠️ เป็นความบันเทิงล้วน ห้ามฟันธงให้ซื้อ/ขายหุ้นตัวไหน ห้ามให้คำแนะนำการลงทุนจริง — พูดเชิงอารมณ์/จังหวะ/กำลังใจเท่านั้น
- โทนตามคะแนน: สูง=ให้กำลังใจลุยตามแผน · กลาง=ทำปกติไม่ต้องเร่ง · ต่ำ=ชวนตั้งสติ ใจเย็น
- อย่าแต่งข้อมูลเกินจากที่ให้มา`;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method" });
  if (!KEY) return res.status(503).json({ error: "no-key" });   // LIFF จะ fallback เอง

  const d = req.body || {};
  const lines = [
    `คะแนนดวงลงทุนวันนี้: ${d.score ?? "—"}/100 (${d.verdict || "—"})`,
    d.advice ? `คำแนะนำระบบ: ${d.advice}` : "",
    d.moonRasi ? `จันทร์จรวันนี้อยู่ราศี: ${d.moonRasi}` : "",
    (d.reasons || []).length ? `เหตุผล:\n${(d.reasons || []).map(r => "• " + r).join("\n")}` : "",
    (d.forecast || []).length ? `ดาวจรเด่นช่วงนี้:\n${(d.forecast || []).map(f => "• " + f).join("\n")}` : "",
    (d.yogas || []).length ? `เกณฑ์ดวง: ${(d.yogas || []).join(", ")}` : "",
  ].filter(Boolean).join("\n");

  try {
    const r = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "content-type": "application/json", "authorization": `Bearer ${KEY}` },
      body: JSON.stringify({
        model: MODEL,
        instructions: SYSTEM,
        input: `[สัญญาณดวงวันนี้]\n${lines}\n\nช่วยสรุปให้แทนฟังหน่อย`,
        max_output_tokens: 400,
      }),
    });
    if (!r.ok) return res.status(502).json({ error: "openai " + r.status });
    const data = await r.json();
    const summary = (data.output || [])
      .filter(o => o.type === "message")
      .flatMap(o => (o.content || []).filter(c => c.type === "output_text").map(c => c.text))
      .join("\n").trim();
    return res.status(200).json({ summary: summary || null });
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
}
