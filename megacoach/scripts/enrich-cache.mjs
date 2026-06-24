#!/usr/bin/env node
// enrich-cache.mjs — เติม chartTA ลง entry-signal-data.json ผ่าน /api/chart mode=cache
// ใช้ OpenAI key ที่อยู่บน prod (ไม่ต้องมี key ในเครื่อง) · รันหลัง morning brief ทุกรอบ
//   node scripts/enrich-cache.mjs            # อ่านเฉพาะตัวที่ยังไม่อ่านวันนี้
//   node scripts/enrich-cache.mjs --force    # อ่านใหม่ทุกตัว
//   node scripts/enrich-cache.mjs --commit   # อ่านแล้ว git add+commit+push ไฟล์ข้อมูลให้เลย
import { readFile, writeFile } from "node:fs/promises";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { consolidateHeld } from "./mark-held.mjs";

const HERE  = dirname(fileURLToPath(import.meta.url));
const REPO  = resolve(HERE, "..");                       // .../megacoach
const DATA  = resolve(REPO, "liff-app/entry-signal-data.json");
const HOLD  = resolve(REPO, "holdings.json");
const BASE  = process.env.MEGACOACH_BASE || "https://liff-app-lilac.vercel.app";
const FORCE = process.argv.includes("--force");
const COMMIT = process.argv.includes("--commit");
const TODAY = new Date().toISOString().slice(0, 10);
const sleep = ms => new Promise(r => setTimeout(r, ms));

const esd = JSON.parse(await readFile(DATA, "utf8"));
consolidateHeld(esd, JSON.parse(await readFile(HOLD, "utf8")));   // ยกหุ้นถืออยู่เข้ากลุ่ม Holdings จาก holdings.json ทุกรอบ
const stocks = (esd.groups || []).flatMap(g => g.stocks || []).filter(s => s.ticker);
const todo = stocks.filter(s => FORCE || s.chartTA?.updated !== TODAY);
console.log(`พบ ${stocks.length} entry · ต้องอ่าน ${todo.length} (base ${BASE})`);

let ok = 0;
for (const s of todo) {
  try {
    const r = await fetch(`${BASE}/api/chart`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ stock: s, mode: "cache" }),
    });
    const j = await r.json();
    if (!r.ok) { console.log(`  ✗ ${s.ticker} — ${j.error}`); continue; }
    s.chartTA = { verdict: j.verdict, summary: j.summary, chartUrl: j.chartUrl, updated: TODAY };
    ok++;
    console.log(`  ✓ ${s.ticker} → ${j.verdict} · ${j.summary}`);
  } catch (e) { console.log(`  ✗ ${s.ticker} — ${e.message}`); }
  await sleep(1200);   // กัน finviz rate-limit
}

await writeFile(DATA, JSON.stringify(esd, null, 2) + "\n");
console.log(`เสร็จ ${ok}/${todo.length} · เซฟแล้ว · cost ~$${(ok * 0.006).toFixed(3)} (~${(ok * 0.21).toFixed(1)} บาท)`);

if (COMMIT && ok > 0) {
  try {
    execSync(`git add liff-app/entry-signal-data.json && git commit -q -m "Enrich chart TA ${TODAY}" && git push`, { cwd: REPO, stdio: "inherit" });
    console.log("✓ commit + push แล้ว");
  } catch (e) { console.log("✗ git ล้มเหลว — commit เองนะ"); }
}
