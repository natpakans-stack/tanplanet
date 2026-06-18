// /api/coach — โค้ชพอร์ตกลาง: เห็นพอร์ตทั้งหมด (สกรีน + North Star) + รู้ strategy
// อ่านข้อมูลพอร์ตเองจาก static JSON (same-origin) — frontend แค่ส่งคำถาม
const KEY   = process.env.OPENAI_API_KEY;
const MODEL = process.env.ASK_MODEL || "gpt-4o";

export const config = { maxDuration: 60 };

const SYSTEM = `คุณคือ "MegaCoach" ที่ปรึกษาวางแผนการลงทุนส่วนตัวของผู้ใช้ รู้จักพอร์ตและ strategy ทั้งหมด มองภาพรวมพอร์ต ไม่ใช่แค่หุ้นตัวเดียว

เป้าหมาย/แผน (North Star):
- อิสรภาพการเงิน ~15 ล้านบาท ตอนอายุ 60 (เริ่มอายุ 26) · required CAGR ~7%/ปี · เติมเงิน ~10k/เดือน
- 2 เฟส: เฟส 1 (อายุ 26-40) ลุยเต็มที่ aggressive 10-14%/ปี · เฟส 2 (40-60) ค่อยลดเสี่ยงเป็น passive
- โปรไฟล์ aggressive · เทรดหุ้นสหรัฐผ่าน Dime (KKP) + DCA กองทุน (RMF / Krungsri SAM)
- กติกา Dime: เศษหุ้น (fractional) ใช้ market order เท่านั้น · limit order ต้องเป็นจำนวนหุ้นเต็ม

หน้าที่: แนะนำเชิงกลยุทธ์ที่สอดคล้องกับเป้าหมาย ความเสี่ยง และพอร์ตจริง — เช่น จัด allocation, จังหวะ DCA, บาลานซ์ความเสี่ยง, มองทั้งพอร์ต
- ตอบเป็นภาษาไทย กระชับ ตรงประเด็น · ใช้ข้อมูลพอร์ตที่ให้มาเป็นฐาน ถ้าต้องลึก/สดกว่าให้ค้นเว็บ
- เป็นข้อมูลเชิงการศึกษา ไม่ใช่คำแนะนำที่มีใบอนุญาต — เตือน DYOR เมื่อเหมาะสม · อย่าแต่งตัวเลขเอง`;

const PUA = new RegExp("[\\uE000-\\uF8FF]", "g");
const stripCitations = s => s
  .replace(PUA, "").replace(/cite\w*turn\d+\w+/gi, "")
  .replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();

// ประกอบ context พอร์ตจาก entry-signal-data + northstar
function buildPortfolioContext(esd, ns) {
  const lines = [];
  if (esd?.updated) lines.push(`[พอร์ต ณ ${esd.updated}]`);
  if (esd?.note) lines.push(`ภาพรวมตลาด: ${esd.note}`);
  for (const g of esd?.groups || []) {
    const stocks = g.stocks || [];
    if (!stocks.length) continue;
    lines.push(`\n# ${g.title}${g.meta ? ` (${g.meta})` : ""}`);
    for (const s of stocks) {
      lines.push(`- ${s.ticker} ${s.price || ""}${s.change ? ` (${s.change})` : ""} · ${s.signalLabel || s.signal || ""}`);
      if (s.signalDesc) lines.push(`  ${s.signalDesc}`);
    }
  }
  if (ns) {
    lines.push(`\n# North Star`);
    lines.push(`- เป้า ${ns.goalLabel || "อิสรภาพการเงิน"} · อายุปัจจุบัน ${ns.currentAge ?? "—"} → เป้า ${ns.targetAge ?? 60}`);
    if (ns.phaseLabel) lines.push(`- ${ns.phaseLabel} · เป้าผลตอบแทน ${ns.phaseTarget || "—"} · required CAGR ${ns.requiredCagr || "—"}`);
  }
  return lines.join("\n");
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method" });
  if (!KEY) return res.status(500).json({ error: "ยังไม่ได้ตั้ง OPENAI_API_KEY" });

  const { question } = req.body || {};
  if (typeof question !== "string" || !question.trim())
    return res.status(400).json({ error: "ไม่มีคำถาม" });
  if (question.length > 1000)
    return res.status(400).json({ error: "คำถามยาวเกินไป" });

  // อ่านพอร์ตเองจาก static files (same-origin)
  const host = req.headers.host || "";
  const base = `${host.includes("localhost") ? "http" : "https"}://${host}`;
  const get = p => fetch(`${base}/${p}`).then(r => (r.ok ? r.json() : null)).catch(() => null);
  const [esd, ns] = await Promise.all([get("entry-signal-data.json"), get("northstar.json")]);

  const ctx = buildPortfolioContext(esd, ns);
  const userText = ctx
    ? `[ข้อมูลพอร์ตของผู้ใช้]\n${ctx}\n\n[คำถาม]\n${question.trim()}`
    : question.trim();

  try {
    const r = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "content-type": "application/json", "authorization": `Bearer ${KEY}` },
      body: JSON.stringify({
        model: MODEL, instructions: SYSTEM, input: userText,
        tools: [{ type: "web_search" }], max_output_tokens: 2000,
      }),
    });
    if (!r.ok) return res.status(502).json({ error: "OpenAI " + r.status, detail: await r.text() });
    const data = await r.json();
    const answer = stripCitations((data.output || [])
      .filter(o => o.type === "message")
      .flatMap(o => (o.content || []).filter(c => c.type === "output_text").map(c => c.text))
      .join("\n").trim());
    return res.status(200).json({ answer: answer || "(ไม่มีคำตอบ)" });
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
}
