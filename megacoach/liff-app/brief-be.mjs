// รวม "คุ้มทุน" เข้าแถวหุ้นที่ถือในบรีฟเช้า → 1 หุ้น = 1 บรรทัด (CACI · $645.88 · ถือ · คุ้มทุน $589.60 (+9.5%))
// ponytail: routine บน cloud เขียนบรีฟเอง (แก้ prompt ไม่ได้จากที่นี่) → ปรับหลังเขียน ก่อนส่ง · be จาก coach-data.json (ราคา/หุ้น)
// แถวที่ไม่มีราคา/ไม่มี be → ไม่แตะ · หาไม่เจอ = ส่งเท่าเดิม · ทดสอบ: node brief-be.mjs --test
import { readFileSync, writeFileSync } from "node:fs";
const DIR = decodeURIComponent(new URL(".", import.meta.url).pathname);

export function foldBreakeven(bubble, be) {
  const body = bubble?.body?.contents; if (!body) return 0;
  let n = 0;
  for (const row of body) {
    if (row?.type !== "box" || row.layout !== "horizontal") continue;
    const T = (row.contents || []).filter(c => c.type === "text");
    const tk = T.find(c => be[c.text?.trim()]), px = T.find(c => /^\$[\d,.]+$/.test(c.text?.trim() || ""));
    if (!tk || !px) continue;
    const b = be[tk.text.trim()], p = +px.text.replace(/[$,]/g, ""), d = (p / b - 1) * 100;
    const st = T.at(-1);
    if (st === px || /คุ้มทุน/.test(st.text)) continue;
    st.text += ` · คุ้มทุน $${b.toFixed(2)} (${d >= 0 ? "+" : "−"}${Math.abs(d).toFixed(1)}%)`;
    st.wrap = true; n++;
  }
  // ลบบรรทัด "🎯 … คุ้มทุน …" ที่แยกไว้ท้าย เมื่อรวมเข้าแถวแล้ว
  if (n) bubble.body.contents = body.filter(c => !(c?.type === "text" && /คุ้มทุน/.test(c.text || "")));
  return n;
}

if (process.argv.includes("--test")) {
  const bub = { body: { contents: [
    { type: "box", layout: "horizontal", contents: [{ type: "text", text: "🟡" }, { type: "text", text: "CACI" }, { type: "text", text: "$645.88" }, { type: "text", text: "ถือ" }] },
    { type: "text", text: "🎯 CACI คุ้มทุน $59.89" }] } };
  const n = foldBreakeven(bub, { CACI: 589.6 });
  console.assert(n === 1 && bub.body.contents.length === 1, "ลบบรรทัดแยก");
  console.assert(bub.body.contents[0].contents[3].text === "ถือ · คุ้มทุน $589.60 (+9.5%)", bub.body.contents[0].contents[3].text);
  console.log("ok"); process.exit(0);
}

if (process.argv[1]?.endsWith("brief-be.mjs")) {
  const OUT = process.env.OUTBOX || DIR + "line-outbox.json";
  const be = Object.fromEntries(Object.entries(JSON.parse(readFileSync(DIR + "coach-data.json", "utf8")).tickers || {})
    .filter(([, z]) => z.held && z.be).map(([t, z]) => [t, z.be]));
  const ob = JSON.parse(readFileSync(OUT, "utf8"));
  let n = 0;
  for (const m of ob.messages || []) {
    if (m?.type !== "flex") continue;
    const bs = m.contents?.type === "carousel" ? m.contents.contents : [m.contents];
    for (const b of bs) if (/ENTRY SIGNAL|บรีฟเช้า/.test(JSON.stringify(b?.header || {}))) n += foldBreakeven(b, be);
  }
  if (n) { writeFileSync(OUT, JSON.stringify(ob, null, 2) + "\n"); console.log(`✅ รวมคุ้มทุนเข้าแถว ${n} ตัว`); }
  else console.log("ไม่มีแถวให้รวมคุ้มทุน — คงเดิม");
}
