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

// ตัวหนังสือเทาอ่อน (#94A3B8 ฯลฯ) = หมายเหตุ/disclaimer → ย้ายไปท้ายเป็นตัวเอียง ไม่ปนเนื้อหาหลัก
const muted = c => { const m = /^#([0-9a-f]{6})/i.exec(c || ""); if (!m) return false;
  const [r, g, b] = [0, 2, 4].map(i => parseInt(m[1].slice(i, i + 2), 16)); return Math.min(r, g, b) >= 0x90 && Math.max(r, g, b) < 0xE0; };
const spaced = n => ["md", "lg", "xl", "xxl"].includes(n.margin);
// ปุ่มเว็บ https → Mini App (เปิดในแอป Telegram ไม่เด้งออก browser) · ใช้ได้เฉพาะแชตส่วนตัว ซึ่งบอทนี้ส่งแชตเดียว
const btn = (label, uri) => { const u = fixUrl(uri); return [u.startsWith("https://") ? { text: label, web_app: { url: u } } : { text: label, url: u }]; };
// ปุ่ม "…ถาม AI" ของการ์ดคัดหุ้น → แยกเป็นเปิดเว็บ + ถาม Claude บน box (tg-claude.mjs รับ callback "ask:screen" แล้วตอบในแชต)
const btnRow = (label, uri) => /ถาม AI/.test(label)
  ? [btn(label.replace(/\s*\+?\s*ถาม AI/, "") || "เปิด", uri)[0], { text: "🤖 ถาม Claude บน box", callback_data: "ask:screen" }]
  : btn(label, uri);

// เดิน Flex tree → out = {lines, notes, buttons}
// ไอคอน Lucide (PNG) ใน Flex → อีโมจิใน Telegram · ไม่อยู่ในแมพ = ข้าม (ไอคอนประดับ)
const ICON_EMOJI = { "circle-check": "🟢", clock: "🟡", ban: "🔴", calendar: "📅", flame: "🔥", activity: "📈", star: "⭐" };
// ticker US (VOO) + ไทย (GULF.BK) → ใช้จับว่าแถวไหนคือหัวหุ้นหนึ่งตัว
const TICKER = /^[A-Z][A-Z\-]{0,5}(\.[A-Z]{1,3})?$/;

function walk(node, out, inRow = false) {
  if (!node || typeof node !== "object") return;
  if (node.type === "icon") {
    const e = ICON_EMOJI[/\/([\w-]+)\.png$/.exec(node.url || "")?.[1]];
    if (e) out.lines.push(e);
    return;
  }
  if (node.type === "text") {
    const t = node.text ?? (node.contents || []).map(s => s.text || "").join("");
    if (!t.trim()) return;
    const m = !inRow && muted(node.color), bold = node.weight === "bold";
    if (m && node.size === "xxs") return out.notes.push(`<i>${esc(t)}</i>`);   // ตัวเล็กสุดสีเทา = fine print → ท้ายข้อความ
    if (!inRow && (spaced(node) || (m && bold)) && out.lines.length && out.lines.at(-1) !== "") out.lines.push("");  // หัวข้อหมวด → เว้นบรรทัดก่อน
    const big = ["xl", "xxl", "3xl", "4xl", "5xl"].includes(node.size) ? "\u0001" : "";   // ตัวใหญ่สุด = หัวเรื่องจริง
    out.lines.push(big + (bold ? `<b>${esc(t)}</b>` : m ? `<i>${esc(t)}</i>` : esc(t)));
  } else if (node.type === "button" && node.action?.uri) {
    out.buttons.push(btnRow(node.action.label || "เปิด", node.action.uri));
  } else if (node.type === "separator") {
    if (out.lines.length && out.lines.at(-1) !== "") out.lines.push("");
  } else if (node.type === "box") {
    // แถวแนวนอน (ticker | ราคา | สถานะ) → ต่อเป็นบรรทัดเดียว
    if (node.layout === "horizontal" || node.layout === "baseline") {
      const sub = { lines: [], notes: [], buttons: out.buttons }; for (const c of node.contents || []) walk(c, sub, true);
      if (sub.lines.length) out.lines.push(sub.lines.join(" · ").replace(/^(\p{Extended_Pictographic}\uFE0F?) · /u, "$1 "));   // 🟢 VOO ไม่ใช่ 🟢 · VOO
    } else {
      // หุ้นหนึ่งตัว = แถวที่มีชื่อ ticker + แถวรายละเอียด (ข้อความเดียว) ที่ตามมา → รวมเป็นกรอบ quote กรอบเดียว (แทนขอให้ดูเป็นบล็อก)
      let blk = null;
      const flush = () => { if (blk) out.lines.push(`<blockquote>${blk.join("\n")}</blockquote>`); blk = null; };
      for (const c of node.contents || []) {
        const isRow = c?.type === "box" && (c.layout === "horizontal" || c.layout === "baseline");
        const texts = isRow ? (c.contents || []).filter(x => x.type === "text") : [];
        if (isRow && texts.some(x => TICKER.test((x.text || "").trim()))) {
          flush(); const sub = { lines: [], notes: [], buttons: out.buttons }; walk(c, sub, inRow); blk = sub.lines;
        } else if (blk && isRow && texts.length === 1) {
          const sub = { lines: [], notes: [], buttons: out.buttons }; walk(c, sub, inRow); blk.push(...sub.lines);
        } else { flush(); walk(c, out, inRow); }
      }
      flush();
    }
  }
}

export function toTelegram(msg) {
  if (msg.type === "text") return [{ text: esc(msg.text), buttons: [] }];
  if (msg.type !== "flex") return [];
  const bubbles = msg.contents.type === "carousel" ? msg.contents.contents : [msg.contents];
  return bubbles.map(b => {
    const head = { lines: [], notes: [], buttons: [] }; walk(b.header, head);
    const out = { lines: [], notes: [], buttons: head.buttons };
    walk(b.hero, out); walk(b.body, out); walk(b.footer, out);
    out.lines = out.lines.map(l => l.replace("\u0001", ""));
    // หัว: บรรทัดสุดท้ายของ header = หัวเรื่อง → ตัวหนา · บรรทัดแรกของเนื้อหา = ตัวเลขหลัก → ตัวหนา
    const h = head.lines.map(s => s.replace(/<\/?b>/g, "")).filter(Boolean);
    const ti = h.findIndex(s => s.startsWith("\u0001")), t = ti >= 0 ? ti : h.length - 1;
    if (h.length) h[t] = `<b>${h[t]}</b>`;
    for (let i = 0; i < h.length; i++) h[i] = h[i].replace("\u0001", "");
    const body = out.lines.slice(); while (body[0] === "") body.shift();
    if (body[0] && !body[0].includes("<")) body[0] = `<b>${body[0]}</b>`;
    const parts = [h.join("\n"), body.join("\n"), out.notes.join("\n")].filter(Boolean);
    const buttons = out.buttons;
    let text = parts.join("\n\n").replace(/\n{3,}/g, "\n\n").trim() || esc(msg.altText || "");
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
      body: { type: "box", layout: "vertical", contents: [{ type: "box", layout: "baseline", contents: [{ type: "text", text: "A" }, { type: "text", text: "B" }] }, { type: "text", text: "note", color: "#94A3B8", size: "xxs" }] },
      footer: { type: "box", layout: "vertical", contents: [{ type: "button", action: { type: "uri", label: "Dash", uri: "https://liff.line.me/2010317620-52h5kCM1/x" } }] } }] } });
    console.assert(out.length === 1 && out[0].text === "<b>CACI &lt;แตะ&gt; โซน</b>\n\n<blockquote>A · B</blockquote>\n\n<i>note</i>", out[0].text);
    console.assert(out[0].buttons[0][0].web_app.url === "https://liff-app-lilac.vercel.app/x");
    console.assert(toTelegram({ type: "flex", contents: { type: "bubble", footer: { type: "box", layout: "vertical", contents: [{ type: "button", action: { type: "uri", label: "ดูทุกตัว + ถาม AI", uri: "https://x.y" } }] } } })[0].buttons[0][1].callback_data === "ask:screen");
    console.log("ok");
  } else if (a === "--chatid") {
    const r = await (await fetch(`https://api.telegram.org/bot${env("TELEGRAM_BOT_TOKEN")}/getUpdates`)).json();
    for (const u of r.result || []) { const c = (u.message || u.my_chat_member)?.chat; if (c) console.log(c.id, c.first_name || c.title); }
  } else if (a) {
    await sendTelegram(existsSync(a) ? JSON.parse(readFileSync(a, "utf8")).messages : [{ type: "text", text: a }]);
    console.log("✅ ส่ง Telegram แล้ว");
  }
}
