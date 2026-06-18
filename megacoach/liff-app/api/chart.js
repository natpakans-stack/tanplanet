// /api/chart — vision อ่านกราฟแท่งเทียน (finviz) แล้วประสานกับปัจจัยที่ระบบสกรีนมา
// ดึงรูปกราฟ → ส่งให้ gpt-4o vision → สรุป technical + verdict รวม
const KEY   = process.env.OPENAI_API_KEY;
const MODEL = process.env.ASK_MODEL || "gpt-4o";   // ต้องเป็นโมเดลที่อ่านภาพได้ (gpt-4o / gpt-4o-mini)

export const config = { maxDuration: 60 };

// โหมดเต็ม (ปุ่มเจาะลึก) — ประสาน technical กับปัจจัยที่สกรีนมา
const SYSTEM_FULL = `คุณคือนักวิเคราะห์เทคนิคของ MegaCoach อ่านกราฟแท่งเทียนรายวัน (มีเส้น SMA 20/50/200 + volume) แล้ว "ประสาน" กับปัจจัยพื้นฐาน/มหภาคที่ให้มา
อ่านจากกราฟจริงเท่านั้น อย่าเดาราคา/ตัวเลขที่มองไม่เห็น

ให้สรุปเป็น bullet สั้นๆ:
1. แนวโน้ม (ขาขึ้น/ลง/sideways) + ราคาอยู่เหนือ/ใต้ SMA20/50/200
2. รูปแบบกราฟ (ถ้าชัด): Cup & Handle, Bull/Bear Flag, Double Top/Bottom, Head & Shoulders / Inverse H&S, Breakout/Breakdown ฯลฯ — ถ้าไม่มีรูปแบบชัด ให้บอกตรงๆ ว่า "ยังไม่มีรูปแบบชัด" อย่าแต่ง
3. แนวรับ/แนวต้านที่เห็นจากกราฟ + โซนเข้า / จุด stop คร่าวๆ
4. **สรุปรวม:** technical สอดคล้องหรือขัดกับสัญญาณระบบ/ปัจจัยพื้นฐานที่ให้มาไหม → verdict รวม (น่าเข้า / รอ / เลี่ยง) + เหตุผล 1 บรรทัด

ตอบไทย กระชับ · เป็นข้อมูลเชิงการศึกษา ไม่ใช่คำแนะนำที่มีใบอนุญาต`;

// โหมด cache (เติม chartTA ลงพอร์ต) — บังคับ format สั้นเพื่อ parse verdict ได้แม่น
const SYSTEM_CACHE = `คุณคือนักวิเคราะห์เทคนิค อ่านกราฟแท่งเทียนรายวัน (เส้น SMA 20/50/200 + volume) สรุปสั้นมากเพื่อโชว์บนการ์ด
อ่านจากกราฟจริงเท่านั้น อย่าเดา ตอบเป๊ะ 2 บรรทัด (ห้ามใส่คำว่า "บรรทัด" หรือ label อื่น):
VERDICT: bullish | neutral | bearish
<สรุป technical ภาษาไทย ≤90 ตัวอักษร: แนวโน้ม + รูปแบบถ้ามีชัด + แนวรับ/ต้านสำคัญ>`;

// finviz candlestick + SMA20/50/200 (ตาม redirect ไป charts2-node อัตโนมัติ)
const chartUrl = t =>
  `https://charts2-node.finviz.com/chart?w=820&h=440&bw=2&bm=1&bb=1&t=${encodeURIComponent(t)}` +
  `&tf=d&s=linear&pm=0&am=0&ct=candle_stick` +
  `&o[0][ot]=sma&o[0][op]=20&o[0][oc]=DC32B363` +
  `&o[1][ot]=sma&o[1][op]=50&o[1][oc]=FF8F33C6` +
  `&o[2][ot]=sma&o[2][op]=200&o[2][oc]=DCB3326D`;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method" });
  if (!KEY) return res.status(500).json({ error: "ยังไม่ได้ตั้ง OPENAI_API_KEY" });

  const { stock, mode } = req.body || {};
  const cache = mode === "cache";
  const ticker = stock?.ticker;
  if (!ticker || !/^[A-Za-z.\-]{1,8}$/.test(ticker))
    return res.status(400).json({ error: "ticker ไม่ถูกต้อง" });

  const url = chartUrl(ticker);

  // ดึงรูปกราฟเอง (คุม UA + redirect) → base64 ส่งให้ vision
  let dataUrl;
  try {
    const img = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 Chrome/120 Safari/537.36" } });
    if (!img.ok) return res.status(502).json({ error: "ดึงกราฟไม่ได้ (finviz " + img.status + ")" });
    const buf = Buffer.from(await img.arrayBuffer());
    if (buf.length < 1000) return res.status(502).json({ error: "กราฟว่าง (ticker อาจไม่มีในระบบ)" });
    dataUrl = "data:image/png;base64," + buf.toString("base64");
  } catch (e) {
    return res.status(502).json({ error: "ดึงกราฟไม่ได้: " + String(e) });
  }

  // ปัจจัยที่สกรีนมา (ให้ vision ประสาน)
  const ctx = [
    `หุ้น: ${ticker} (${stock.name || ""})`,
    stock.price ? `ราคาล่าสุด: ${stock.price} (${stock.change || ""})` : "",
    `สัญญาณระบบ: ${stock.signalLabel || stock.signal || "—"}`,
    stock.signalDesc ? `เหตุผล: ${stock.signalDesc}` : "",
    (stock.factors || []).map(f => `• ${f.label}: ${f.value}`).join("\n"),
  ].filter(Boolean).join("\n");

  const promptText = cache
    ? `หุ้น ${ticker} · สัญญาณระบบ: ${stock.signalLabel || stock.signal || "—"} · อ่านกราฟด้านล่าง`
    : `[ปัจจัยที่ระบบสกรีนมา]\n${ctx}\n\nอ่านกราฟด้านล่างแล้ววิเคราะห์ตามหัวข้อ`;

  try {
    const r = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "content-type": "application/json", "authorization": `Bearer ${KEY}` },
      body: JSON.stringify({
        model: MODEL,
        instructions: cache ? SYSTEM_CACHE : SYSTEM_FULL,
        input: [{
          role: "user",
          content: [
            { type: "input_text", text: promptText },
            { type: "input_image", image_url: dataUrl },
          ],
        }],
        max_output_tokens: cache ? 200 : 1500,
      }),
    });
    if (!r.ok) return res.status(502).json({ error: "OpenAI " + r.status, detail: await r.text() });
    const data = await r.json();
    const answer = (data.output || [])
      .filter(o => o.type === "message")
      .flatMap(o => (o.content || []).filter(c => c.type === "output_text").map(c => c.text))
      .join("\n").trim();

    if (cache) {
      // parse VERDICT + summary ฝั่ง server → ได้ structured สะอาด
      const m = answer.match(/VERDICT:\s*(bullish|neutral|bearish)/i);
      const verdict = m ? m[1].toLowerCase() : "neutral";
      let summary = answer
        .replace(/VERDICT:.*\n?/i, "")
        .replace(/บรรทัด\s*\d+\s*[:：]/g, "")
        .replace(/^[\s*:：\-–—]+/, "").trim();
      if (summary.length > 110) summary = summary.slice(0, 108) + "…";
      return res.status(200).json({ verdict, summary: summary || answer, chartUrl: url });
    }
    return res.status(200).json({ answer: answer || "(อ่านกราฟไม่ได้)", chartUrl: url });
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
}
