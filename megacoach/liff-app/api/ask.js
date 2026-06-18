// /api/ask — ถาม AI เรื่องหุ้นที่ระบบสกรีนมา + ให้ค้นข้อมูลเพิ่มสดจากเว็บ
// ยิง OpenAI Responses API ตรงด้วย fetch (สไตล์เดียวกับ line-webhook.js — ไม่ต้องลง SDK)
// ต้องตั้ง env OPENAI_API_KEY บน Vercel
const KEY   = process.env.OPENAI_API_KEY;
const MODEL = process.env.ASK_MODEL || "gpt-4o";  // อยากถูกลง → gpt-4o-mini

export const config = { maxDuration: 60 };  // web search อาจกินเวลา > 10s

const SYSTEM = `คุณคือ MegaCoach โค้ชหุ้นสหรัฐส่วนตัว ช่วย "ย่อย" ข้อมูลหุ้นที่ระบบสกรีนมาให้เข้าใจง่าย และตอบคำถามเพิ่มเติม
- ตอบเป็นภาษาไทย กระชับ ตรงประเด็น เหมือนคุยกับเพื่อนที่รู้เรื่องหุ้น
- ใช้ข้อมูลที่ระบบสกรีนมา (price/signal/factors) เป็นฐานก่อน ถ้าต้องการข้อมูลสดกว่า/ลึกกว่า ให้ค้นเว็บ
- เป็นข้อมูลเชิงการศึกษา ไม่ใช่คำแนะนำการลงทุนที่มีใบอนุญาต — เตือนให้ DYOR เมื่อเหมาะสม
- อย่าแต่งตัวเลขขึ้นเอง ถ้าไม่รู้ให้บอกว่าไม่รู้หรือค้นเพิ่ม`;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method" });
  if (!KEY) return res.status(500).json({ error: "ยังไม่ได้ตั้ง OPENAI_API_KEY" });

  const { question, stock } = req.body || {};
  if (typeof question !== "string" || !question.trim())
    return res.status(400).json({ error: "ไม่มีคำถาม" });
  if (question.length > 1000)
    return res.status(400).json({ error: "คำถามยาวเกินไป" });

  // เอาข้อมูลที่สกรีนมาใส่เป็น context (ถ้ามี) — เลือกเฉพาะ field ที่มีความหมาย
  const ctx = stock && typeof stock === "object" ? [
    `หุ้น: ${stock.ticker} (${stock.name || ""}) · ${stock.sector || ""}`,
    `ราคา: ${stock.price || "—"} (${stock.change || "—"})`,
    `สัญญาณระบบ: ${stock.signalLabel || stock.signal || "—"}`,
    stock.signalDesc ? `เหตุผล: ${stock.signalDesc}` : "",
    (stock.factors || []).map(f => `• ${f.label}: ${f.value}`).join("\n"),
  ].filter(Boolean).join("\n") : "";

  const userText = ctx
    ? `[ข้อมูลที่ระบบสกรีนมา]\n${ctx}\n\n[คำถาม]\n${question.trim()}`
    : question.trim();

  try {
    const r = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "authorization": `Bearer ${KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        instructions: SYSTEM,
        input: userText,
        tools: [{ type: "web_search" }],   // ค้นข้อมูลสดเพิ่มได้
        max_output_tokens: 2000,
      }),
    });
    if (!r.ok) {
      const detail = await r.text();
      return res.status(502).json({ error: "OpenAI " + r.status, detail });
    }
    const data = await r.json();
    // Responses API: ข้อความอยู่ใน output[] → message → content[] → output_text
    const answer = (data.output || [])
      .filter(o => o.type === "message")
      .flatMap(o => (o.content || []).filter(c => c.type === "output_text").map(c => c.text))
      .join("\n").trim();
    return res.status(200).json({ answer: answer || "(ไม่มีคำตอบ)" });
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
}
