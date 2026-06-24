#!/usr/bin/env node
// mark-held.mjs — ยกหุ้นที่ถืออยู่ทั้งหมดเข้ากลุ่ม "หุ้นที่ถืออยู่ (Holdings)" จาก holdings.json
// แหล่งความจริงของ "ถืออยู่" = holdings.json (positions) เท่านั้น — coach ไม่ต้องจำเอง
// enrich-cache เรียก consolidateHeld() ให้อัตโนมัติทุกรอบ morning brief · หรือสั่งเอง:
//   node scripts/mark-held.mjs            # ย้าย + เซฟ
//   node scripts/mark-held.mjs --commit   # ย้าย + git add/commit/push
//   node scripts/mark-held.mjs --demo     # self-check
import { realpathSync } from "node:fs";
import { readFile as read, writeFile as write } from "node:fs/promises";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..");
const HOLD = resolve(REPO, "holdings.json");
const DATA = resolve(REPO, "liff-app/entry-signal-data.json");

// ยกการ์ดที่ ticker อยู่ใน holdings.positions มารวมในกลุ่ม holdings (เรียงตาม holdings.json)
// + ถอดออกจากกลุ่มอื่น + ติด shares + ทิ้งกลุ่มที่ว่างลง · แก้ esd ในที่ คืน esd
export function consolidateHeld(esd, holdings) {
  const positions = holdings.positions || [];
  const owned = new Map(positions.map(p => [p.ticker, p.shares]));
  const groups = esd.groups || [];

  let hg = groups.find(g => g.id === "holdings");
  if (!hg) { hg = { id: "holdings", icon: "📁", title: "หุ้นที่ถืออยู่ (Holdings)", stocks: [] }; groups.unshift(hg); }

  // เลือกการ์ดของแต่ละ ticker — กลุ่ม holdings เดิมมาก่อน (กรอบ "ถือยาว" เขียนไว้แล้ว)
  const cardFor = new Map();
  for (const g of [hg, ...groups.filter(g => g !== hg)]) {
    for (const s of g.stocks || []) {
      if (owned.has(s.ticker) && !cardFor.has(s.ticker)) cardFor.set(s.ticker, s);
    }
  }
  // ถอดการ์ดที่ถืออยู่ออกจากทุกกลุ่ม
  for (const g of groups) g.stocks = (g.stocks || []).filter(s => !owned.has(s.ticker));

  // เรียงตาม holdings.json + ติด held/shares · ถ้าไม่มีการ์ด สร้าง stub กันหุ้นหาย
  hg.stocks = positions.map(p => {
    const s = cardFor.get(p.ticker) || { ticker: p.ticker, name: p.ticker, signal: "wait",
      signalLabel: "ถืออยู่ — ยังไม่มีบทวิเคราะห์รอบนี้" };
    s.held = true; s.shares = owned.get(p.ticker);
    return s;
  });
  hg.meta = `${hg.stocks.length} ตัว`;

  // ทิ้งกลุ่มที่ว่างและไม่มี empty-state (กลุ่ม holdings เก็บไว้เสมอ)
  esd.groups = groups.filter(g => g === hg || (g.stocks && g.stocks.length) || g.empty);
  return esd;
}

function demo() {
  const esd = { groups: [
    { id: "holdings", title: "H", meta: "1 ตัว", stocks: [{ ticker: "NVDA", signalLabel: "ถือ" }] },
    { id: "core", title: "Core", stocks: [{ ticker: "QQQ" }, { ticker: "VOO" }] },
    { id: "satellite", title: "Sat", stocks: [{ ticker: "NVDA" }, { ticker: "VST" }] },
    { id: "watch", title: "W", stocks: [{ ticker: "MU" }] },
  ] };
  consolidateHeld(esd, { positions: [
    { ticker: "QQQ", shares: 0.1 }, { ticker: "VOO", shares: 0.2 },
    { ticker: "NVDA", shares: 0.01 }, { ticker: "ZM", shares: 5 } ] });
  const hg = esd.groups.find(g => g.id === "holdings");
  const ids = esd.groups.map(g => g.id);
  if (hg.stocks.map(s => s.ticker).join(",") !== "QQQ,VOO,NVDA,ZM") throw new Error("holdings order wrong: " + hg.stocks.map(s => s.ticker));
  if (hg.meta !== "4 ตัว") throw new Error("meta wrong: " + hg.meta);
  if (ids.includes("core")) throw new Error("emptied core not dropped");
  if (!ids.includes("satellite")) throw new Error("satellite (VST left) wrongly dropped");
  if (hg.stocks[0].shares !== 0.1) throw new Error("shares not stamped");
  if (hg.stocks.find(s => s.ticker === "NVDA").signalLabel !== "ถือ") throw new Error("preferred holdings card not kept");
  console.log("✓ demo ok");
}

async function main() {
  const esd = JSON.parse(await read(DATA, "utf8"));
  consolidateHeld(esd, JSON.parse(await read(HOLD, "utf8")));
  await write(DATA, JSON.stringify(esd, null, 2) + "\n");
  const hg = esd.groups.find(g => g.id === "holdings");
  console.log(`✓ Holdings = ${hg.stocks.map(s => s.ticker).join(", ")} (${hg.meta}) · เซฟแล้ว`);
  if (process.argv.includes("--commit")) {
    const today = new Date().toISOString().slice(0, 10);
    execSync(`git add liff-app/entry-signal-data.json && git commit -q -m "Consolidate held positions ${today}" && git push`, { cwd: REPO, stdio: "inherit" });
    console.log("✓ commit + push แล้ว");
  }
}

// รันเฉพาะตอนเรียกตรงๆ — ตอน import (จาก enrich-cache) จะไม่ทำ file IO
const invoked = process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) {
  if (process.argv.includes("--demo")) demo();
  else await main();
}
