// /api/line-webhook — พิมพ์ keyword ใน LINE → บอทตอบ Flex bubble (ปุ่มเปิด LIFF form)
// ความปลอดภัย: verify x-line-signature (กัน webhook ปลอม) · bubble ส่งแค่ปุ่ม ไม่มีข้อมูลส่วนตัว
import crypto from "node:crypto";

const SECRET = process.env.LINE_CHANNEL_SECRET;
const TOKEN  = process.env.LINE_CHANNEL_ACCESS_TOKEN;
const FORM_LIFF = process.env.FORM_LIFF_URL || "https://liff.line.me/2010317620-52h5kCM1";  // LIFF endpoint → /form.html
const KEYWORDS = /กรอก|พอร์ต|form|อัปเดต|rmf/i;

export const config = { api: { bodyParser: false } };   // ต้องใช้ raw body verify signature
const readRaw = req => new Promise(r => { let d = ""; req.on("data", c => d += c); req.on("end", () => r(d)); });

const bubble = () => ({
  type: "flex", altText: "📝 กรอกพอร์ต MegaCoach",
  contents: {
    type: "bubble",
    body: { type: "box", layout: "vertical", spacing: "md", paddingAll: "18px", contents: [
      { type: "text", text: "📝 กรอกพอร์ต", weight: "bold", size: "lg", color: "#1E293B" },
      { type: "text", text: "อัปเดต RMF / Krungsri SAM / Dime · ตัวเลขเข้ารหัสในเครื่องก่อนส่ง — ไม่มีใครเห็น", size: "xs", color: "#64748B", wrap: true },
    ]},
    footer: { type: "box", layout: "vertical", contents: [
      { type: "button", style: "primary", color: "#3B4EE0",
        action: { type: "uri", label: "เปิดฟอร์ม", uri: FORM_LIFF } },
    ]},
  },
});

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  if (!SECRET || !TOKEN) return res.status(500).end();
  const raw = await readRaw(req);
  const sig = crypto.createHmac("sha256", SECRET).update(raw).digest("base64");
  if (sig !== req.headers["x-line-signature"]) return res.status(401).end();   // กันยิงปลอม
  let body; try { body = JSON.parse(raw); } catch { return res.status(400).end(); }
  for (const ev of body.events || []) {
    if (ev.type === "message" && ev.message?.type === "text" && KEYWORDS.test(ev.message.text)) {
      await fetch("https://api.line.me/v2/bot/message/reply", {
        method: "POST",
        headers: { "content-type": "application/json", Authorization: `Bearer ${TOKEN}` },
        body: JSON.stringify({ replyToken: ev.replyToken, messages: [bubble()] }),
      });
    }
  }
  res.status(200).end();
}
