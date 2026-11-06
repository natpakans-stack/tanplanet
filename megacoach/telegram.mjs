#!/usr/bin/env node
// telegram.mjs — ส่งแจ้งเตือน MegaCoach เข้า Telegram (แทน LINE broadcast)
// รับ message รูปแบบ LINE เดิม (text / flex bubble / carousel) แล้วแปลงเป็นข้อความ HTML + ปุ่มลิงก์
// ponytail: แปลง Flex → ข้อความตามลำดับ ไม่เลียนสี/layout · ถ้าอยากได้การ์ดสวยค่อยเปลี่ยนเป็นส่งรูป
//   node telegram.mjs outbox.json   ส่งทุก message ใน {messages:[...]}
//   node telegram.mjs "ข้อความ"      ส่งข้อความล้วน
//   node telegram.mjs --test         ทดสอบตัวแปลง (ไม่ส่งจริง)
//   node telegram.mjs --chatid       หา chat id (ทักบอทก่อน 1 ครั้ง)
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const env = k => {
  if (process.env[k]) return process.env[k];
  try { return readFileSync(HERE + ".env", "utf8").match(new RegExp(`^${k}=(.+)$`, "m"))?.[1].trim(); } catch {}
};
// LIFF เปิดได้แค่ในแอป LINE → ชี้ไปเว็บตรงแทน
const fixUrl = u => u.replace(/^https:\/\/liff\.line\.me\/2010317620-52h5kCM1/, "https://liff-app-lilac.vercel.app");
const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// เดิน Flex tree → บรรทัดข้อความ + ปุ่มลิงก์
function walk(node, lines, buttons, bold = false) {
  if (!node || typeof node !== "object") return;
  if (node.type === "text") {
    const t = node.text ?? (node.contents || []).map(s => s.text || "").join("");
    if (t.trim()) lines.push(bold || node.weight === "bold" ? `<b>${esc(t)}</b>` : esc(t));
  } else if (node.type === "button" && node.action?.uri) {
    buttons.push([{ text: node.action.label || "เปิด", url: fixUrl(node.action.uri) }]);
  } else if (node.type === "separator") {
    if (lines.length && lines.at(-1) !== "") lines.push("");
  } else if (node.type === "box") {
    // แถวแนวนอน (ticker | ราคา | สถานะ) → ต่อเป็นบรรทัดเดียว
    if (node.layout === "horizontal" || node.layout === "baseline") {
      const sub = []; for (const c of node.contents || []) walk(c, sub, buttons, bold);
      if (sub.length) lines.push(sub.join(" · "));
    } else for (const c of node.contents || []) walk(c, lines, buttons, bold);
  }
}

export function toTelegram(msg) {
  if (msg.type === "text") return [{ text: esc(msg.text), buttons: [] }];
  if (msg.type !== "flex") return [];
  const bubbles = msg.contents.type === "carousel" ? msg.contents.contents : [msg.contents];
  return bubbles.map(b => {
    const lines = [], buttons = [];
    walk(b.header, lines, buttons, true);
    if (lines.length) lines.push("");
    walk(b.hero, lines, buttons); walk(b.body, lines, buttons); walk(b.footer, lines, buttons);
    let text = lines.join("\n").replace(/\n{3,}/g, "\n\n").trim() || esc(msg.altText || "");
    if (text.length > 4000) text = text.slice(0, 4000) + "…";
    return { text, buttons };
  });
}

export async function sendTelegram(messages) {
  const tk = env("TELEGRAM_BOT_TOKEN"), chat = env("TELEGRAM_CHAT_ID");
  if (!tk || !chat) throw new Error("ไม่มี TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID (.env หรือ env)");
  for (const m of messages) for (const { text, buttons } of toTelegram(m)) {
    const r = await fetch(`https://api.telegram.org/bot${tk}/sendMessage`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chat, text, parse_mode: "HTML", disable_web_page_preview: true,
        ...(buttons.length && { reply_markup: { inline_keyboard: buttons } }) }),
    });
    if (!r.ok) throw new Error(`Telegram ${r.status}: ${await r.text()}`);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const a = process.argv[2];
  if (a === "--test") {
    const out = toTelegram({ type: "flex", altText: "x", contents: { type: "carousel", contents: [{ type: "bubble",
      header: { type: "box", layout: "vertical", contents: [{ type: "text", text: "CACI <แตะ> โซน" }] },
      body: { type: "box", layout: "vertical", contents: [{ type: "box", layout: "baseline", contents: [{ type: "text", text: "A" }, { type: "text", text: "B" }] }] },
      footer: { type: "box", layout: "vertical", contents: [{ type: "button", action: { type: "uri", label: "Dash", uri: "https://liff.line.me/2010317620-52h5kCM1/x" } }] } }] } });
    console.assert(out.length === 1 && out[0].text === "<b>CACI &lt;แตะ&gt; โซน</b>\n\nA · B", out[0].text);
    console.assert(out[0].buttons[0][0].url === "https://liff-app-lilac.vercel.app/x");
    console.log("ok");
  } else if (a === "--chatid") {
    const r = await (await fetch(`https://api.telegram.org/bot${env("TELEGRAM_BOT_TOKEN")}/getUpdates`)).json();
    for (const u of r.result || []) { const c = (u.message || u.my_chat_member)?.chat; if (c) console.log(c.id, c.first_name || c.title); }
  } else if (a) {
    await sendTelegram(existsSync(a) ? JSON.parse(readFileSync(a, "utf8")).messages : [{ type: "text", text: a }]);
    console.log("✅ ส่ง Telegram แล้ว");
  }
}
