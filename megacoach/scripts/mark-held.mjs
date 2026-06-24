#!/usr/bin/env node
// mark-held.mjs — ติดธง held + shares ลงการ์ดใน entry-signal-data.json จาก holdings.json
// แหล่งความจริงของ "ถืออยู่" = holdings.json (positions) เท่านั้น — coach ไม่ต้องจำเอง
// enrich-cache เรียก markHeld() ให้อัตโนมัติทุกรอบ morning brief · หรือสั่งเอง:
//   node scripts/mark-held.mjs            # stamp + เซฟ
//   node scripts/mark-held.mjs --commit   # stamp + git add/commit/push
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

// ติดธง held/shares ลงทุกการ์ดที่ ticker อยู่ใน holdings.positions · คืน true ถ้ามีอะไรเปลี่ยน
export function markHeld(esd, holdings) {
  const owned = new Map((holdings.positions || []).map(p => [p.ticker, p.shares]));
  let changed = false;
  for (const g of esd.groups || []) {
    for (const s of g.stocks || []) {
      const has = owned.has(s.ticker);
      if (s.held !== has) { s.held = has; changed = true; }
      if (has) {
        const shares = owned.get(s.ticker);
        if (s.shares !== shares) { s.shares = shares; changed = true; }
      } else if ("shares" in s) { delete s.shares; changed = true; }
    }
  }
  return changed;
}

function demo() {
  const esd = { groups: [{ stocks: [{ ticker: "QQQ" }, { ticker: "MU", held: true, shares: 9 }] }] };
  markHeld(esd, { positions: [{ ticker: "QQQ", shares: 0.1 }] });
  const [qqq, mu] = esd.groups[0].stocks;
  if (qqq.held !== true || qqq.shares !== 0.1) throw new Error("held ticker not stamped");
  if (mu.held !== false || "shares" in mu) throw new Error("non-held not cleared");
  console.log("✓ demo ok");
}

async function main() {
  const esd = JSON.parse(await read(DATA, "utf8"));
  const holdings = JSON.parse(await read(HOLD, "utf8"));
  const changed = markHeld(esd, holdings);
  const held = (esd.groups || []).flatMap(g => g.stocks || []).filter(s => s.held).map(s => s.ticker);
  if (changed) {
    await write(DATA, JSON.stringify(esd, null, 2) + "\n");
    console.log(`✓ ติดธงถืออยู่: ${held.join(", ") || "(ไม่มี)"} · เซฟแล้ว`);
  } else {
    console.log(`= ไม่มีอะไรเปลี่ยน · ถืออยู่: ${held.join(", ") || "(ไม่มี)"}`);
  }
  if (process.argv.includes("--commit") && changed) {
    const today = new Date().toISOString().slice(0, 10);
    execSync(`git add liff-app/entry-signal-data.json && git commit -q -m "Mark held positions ${today}" && git push`, { cwd: REPO, stdio: "inherit" });
    console.log("✓ commit + push แล้ว");
  }
}

// รันเฉพาะตอนเรียกตรงๆ — ตอน import (จาก enrich-cache) จะไม่ทำ file IO
const invoked = process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) {
  if (process.argv.includes("--demo")) demo();
  else await main();
}
