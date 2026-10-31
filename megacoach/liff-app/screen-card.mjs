// เสียบการ์ด "คัดหุ้นวันนี้" ต่อท้าย carousel บรีฟเช้า → [brief, ดวง, คัดหุ้น]
// รันใน GitHub Action (megacoach-line.yml) หลังต่อการ์ดดวง · แก้ line-outbox.json ในที่ (ไม่ commit)
// ข้อมูลจาก screen-data.json (box เขียนทุก อ-ส 05:30) · เก่าเกิน 4 วันหรือพัง → ข้าม ส่งเท่าเดิม
// ไอคอน = Lucide แปลงเป็น PNG ใน icons/ (Flex ไม่รับ SVG)
// ทดสอบ: node screen-card.mjs --print   (พิมพ์ bubble ไม่แตะ outbox)
import { readFileSync, writeFileSync } from "node:fs";

const DIR = decodeURIComponent(new URL(".", import.meta.url).pathname);
const OUTBOX = process.env.OUTBOX || DIR + "line-outbox.json";
const ICON = n => `https://liff-app-lilac.vercel.app/icons/${n}.png`;
const DASH = "https://liff.line.me/2010317620-52h5kCM1";
const LV = { // ระดับ → [ไอคอน, สี] โทนเดียวกับบรีฟเช้า
  "Strong Buy": ["chevrons-up", "#15803D"], Buy: ["arrow-up", "#15803D"], Neutral: ["minus", "#B45309"],
  Sell: ["arrow-down", "#B91C1C"], "Strong Sell": ["chevrons-down", "#B91C1C"],
};
const pct = x => (x >= 0 ? "+" : "−") + Math.abs(x).toFixed(1) + "%";
const MONTH = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const thDate = d => { const [y, m, dd] = d.split("-"); return `${+dd} ${MONTH[m - 1]} ${y}`; };
const label = t => ({ type: "text", text: t, size: "xs", color: "#94A3B8", weight: "bold", margin: "lg" });
const sep = { type: "separator", margin: "lg", color: "#E2E8F0" };

export function screenBubble(sc) {
  const sectors = sc.sectors.slice(0, 3).map(s => ({
    type: "box", layout: "horizontal", margin: "sm", contents: [
      { type: "text", text: s.name, size: "sm", color: "#0F172A", flex: 4 },
      { type: "text", text: `1M ${pct(s.rs1)}`, size: "xs", color: s.rs1 >= 0 ? "#15803D" : "#B91C1C", align: "end", flex: 3 },
      { type: "text", text: `1Y ${pct(s.rs12)}`, size: "xs", color: s.rs12 >= 0 ? "#15803D" : "#B91C1C", align: "end", flex: 3 },
    ],
  }));
  // ตัวที่ยังไม่ร้อนขึ้นก่อน (เข้าได้จริง) แล้วค่อยตัวร้อน · สูงสุด 5 ตัว
  const picks = sc.groups.flatMap(g => g.stocks.filter(x => x.pick).map(x => ({ ...x, group: g.name })))
    .sort((a, b) => a.hot - b.hot || b.score - a.score || b.relVol - a.relVol).slice(0, 5);
  const rows = picks.flatMap(x => {
    const [ic, color] = LV[x.label] || LV.Neutral, p = x.pattern;
    const note = x.hot ? ["flame", "ร้อนเกิน รอย่อ"] : p ? ["activity", `${p.th.replace(/ \(.*\)/, "")} · ${p.status.split(" · ")[0]}`] : null;
    return [{
      type: "box", layout: "baseline", margin: "md", contents: [
        { type: "icon", url: ICON(ic), size: "sm" },
        { type: "text", text: x.t, size: "sm", weight: "bold", color: "#0F172A", flex: 2, margin: "sm" },
        { type: "text", text: x.th, size: "xs", weight: "bold", color, flex: 3 },
        { type: "text", text: `Vol ${x.relVol}x`, size: "xs", color: "#475569", align: "end", flex: 2 },
      ],
    }, ...(note ? [{
      type: "box", layout: "baseline", contents: [
        { type: "icon", url: ICON(note[0]), size: "xxs" },
        { type: "text", text: `${x.group} · ${note[1]}`, size: "xxs", color: "#64748B", margin: "sm", flex: 1 },
      ],
    }] : [])];
  });
  return {
    type: "bubble", size: "mega",
    header: { type: "box", layout: "vertical", backgroundColor: "#14532D", paddingAll: "16px", contents: [
      { type: "text", text: "STOCK SCREEN", color: "#BBF7D0", size: "xs", weight: "bold" },
      { type: "text", text: "คัดหุ้นวันนี้", color: "#FFFFFF", size: "xl", weight: "bold", margin: "xs" },
      { type: "text", text: `ราคาปิด ${thDate(sc.updated)} · หุ้น US`, color: "#86EFAC", size: "xxs", margin: "sm" },
    ] },
    body: { type: "box", layout: "vertical", paddingAll: "16px", contents: [
      { ...label("กลุ่มที่แรงสุด (เทียบ S&P 500)"), margin: "none" }, ...sectors, sep,
      label(`ผ่านเกณฑ์คัด ${picks.length} ตัว`),
      ...(rows.length ? rows : [{ type: "text", text: "วันนี้ยังไม่มีตัวผ่านเกณฑ์ — รอ", size: "sm", color: "#64748B", margin: "md" }]),
      sep,
      { type: "text", text: "คัดแล้ว = เทคนิคน่าซื้อ + volume ≥1.5 เท่า + 1 ปีชนะกลุ่ม · ร้อนเกิน = RSI ≥70", size: "xxs", color: "#94A3B8", wrap: true, margin: "lg" },
    ] },
    footer: { type: "box", layout: "vertical", spacing: "sm", paddingAll: "16px", contents: [
      { type: "button", style: "primary", color: "#15803D", height: "sm", action: { type: "uri", label: "ดูทุกตัว + ถาม AI", uri: DASH } },
      { type: "text", text: "เครื่องมือคัดกรอง ไม่ใช่คำสั่งซื้อขาย", size: "xxs", color: "#94A3B8", align: "center", wrap: true },
    ] },
  };
}

if (process.argv[1]?.endsWith("screen-card.mjs")) {
  const sc = JSON.parse(readFileSync(DIR + "screen-data.json", "utf8"));
  if (process.argv.includes("--print")) { console.log(JSON.stringify(screenBubble(sc), null, 1)); process.exit(0); }
  const ageDays = (Date.now() - Date.parse(sc.updated)) / 864e5;
  if (ageDays > 4) { console.log(`⚠️ screen-data เก่า ${ageDays.toFixed(0)} วัน — ไม่ต่อการ์ดคัดหุ้น`); process.exit(0); }
  const outbox = JSON.parse(readFileSync(OUTBOX, "utf8"));
  const isBrief = c => /ENTRY SIGNAL|บรีฟเช้า/.test(JSON.stringify(c?.header || {}));
  let changed = false;
  for (const m of outbox.messages || []) {
    if (m?.type !== "flex") continue;
    const c = m.contents;
    if (c?.type === "bubble" && isBrief(c)) m.contents = { type: "carousel", contents: [c, screenBubble(sc)] };
    else if (c?.type === "carousel" && isBrief(c.contents[0])) c.contents.push(screenBubble(sc));
    else continue;
    m.altText = (m.altText || "บรีฟเช้า MegaCoach") + " + คัดหุ้นวันนี้";
    changed = true;
    console.log("✅ ต่อการ์ดคัดหุ้น → carousel");
  }
  if (changed) writeFileSync(OUTBOX, JSON.stringify(outbox, null, 2) + "\n");
  else console.log("ไม่พบก้อนบรีฟเช้า — outbox คงเดิม");
}
