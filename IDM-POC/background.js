// จับ media + เก็บ header จริงที่ browser ส่ง (referer/origin/cookie/user-agent) เพื่อเอาไปทำคำสั่ง yt-dlp
// ผูกทุก item กับ tabId + ล้างเมื่อ tab นั้นเริ่มโหลดหน้าใหม่ (main_frame) — กัน asset ของหน้าเก่า carry มา
// ไม่เก็บ .ts/.m4s — segment ของ HLS ทีละร้อยแถวคือเหตุที่ป๊อปอัปรกจนเลือกอะไรไม่ได้ (ตัว .m3u8 พอแล้ว yt-dlp ต่อเอง)
const RE = /\.(m3u8|mpd|mp4)([?#/]|$)/i;
const KEEP = ["referer", "origin", "cookie", "user-agent"];

const setBadge = (tabId, n) =>
  chrome.action.setBadgeText({ tabId, text: n ? String(n) : "" });

// เปลี่ยนหน้า = ล้าง media ของ tab นั้นทิ้ง (engine auto-detect หน้าใหม่)
chrome.webRequest.onBeforeRequest.addListener(
  async (d) => {
    if (d.type !== "main_frame" || d.tabId < 0) return;
    const { items = [] } = await chrome.storage.session.get("items");
    const kept = items.filter((i) => i.tabId !== d.tabId);
    if (kept.length !== items.length) await chrome.storage.session.set({ items: kept });
    setBadge(d.tabId, 0);
  },
  { urls: ["<all_urls>"], types: ["main_frame"] }
);

// URL ของหน้าที่กำลังดู (ตัด hash) — ใช้จับคู่ media กับหน้า ไม่ใช่แค่ tab
const pageOf = async (tabId) => {
  try {
    const t = await chrome.tabs.get(tabId);
    return (t.url || "").split("#")[0];
  } catch {
    return "";
  }
};

chrome.webRequest.onSendHeaders.addListener(
  async (d) => {
    if (d.tabId < 0) return; // ทิ้ง request ที่ไม่ผูกกับ tab (prefetch/service worker)
    // request ของตัวเอง (รูปย่อ <video> ในป๊อปอัป) ห้ามนับ — ไม่งั้นวนลูป: sniff เจอ → วาดรูปย่อ → sniff เจอ …
    if (d.initiator?.startsWith("chrome-extension://")) return;
    if (!(RE.test(d.url) || d.type === "media")) return;
    // ผูกกับ URL หน้าด้วย เพราะ SPA (YouTube/Netflix) เปลี่ยนคลิปโดยไม่ยิง main_frame
    // = ของเก่าไม่ถูกล้าง ป๊อปอัปจะโชว์ลิงก์คลิปก่อนหน้าให้โหลดผิดตัว
    const page = await pageOf(d.tabId);
    const { items = [] } = await chrome.storage.session.get("items");
    if (items.some((i) => i.url === d.url && i.tabId === d.tabId)) return; // dedupe ต่อ tab
    const headers = {};
    for (const h of d.requestHeaders || [])
      if (KEEP.includes(h.name.toLowerCase())) headers[h.name] = h.value;
    items.unshift({ url: d.url, type: d.type, headers, tabId: d.tabId, page });
    await chrome.storage.session.set({ items });
    setBadge(d.tabId, items.filter((i) => i.tabId === d.tabId && i.page === page).length);
  },
  { urls: ["<all_urls>"] },
  ["requestHeaders", "extraHeaders"] // extraHeaders = เห็น Cookie/Referer/Origin ที่ปกติถูกซ่อน
);

// SPA เปลี่ยน URL (กดคลิปถัดไปใน YouTube) → badge ต้องนับเฉพาะของหน้าใหม่ ไม่งั้นค้างเลขเก่า
chrome.tabs.onUpdated.addListener(async (tabId, info) => {
  if (!info.url) return;
  const page = info.url.split("#")[0];
  const { items = [] } = await chrome.storage.session.get("items");
  setBadge(tabId, items.filter((i) => i.tabId === tabId && i.page === page).length);
});

// ปิด tab → เก็บกวาด item ที่ค้าง
chrome.tabs.onRemoved.addListener(async (tabId) => {
  const { items = [] } = await chrome.storage.session.get("items");
  const kept = items.filter((i) => i.tabId !== tabId);
  if (kept.length !== items.length) await chrome.storage.session.set({ items: kept });
});

// คิวโหลดอยู่ที่ server ShotDeck (POST /api/jobs คืนทันที) — ที่นี่แค่ poll สถานะทุก 2 วิ ระหว่างมีงานวิ่ง เพื่อ badge ↓N + notification ของ macOS ตอนเสร็จ/ล้ม
// ponytail: poll ทำให้ service worker ตื่นตลอดที่มีงาน · ถ้า Chrome ฆ่า SW ไปจริง ๆ notification หาย แต่ป๊อปอัปเปิดมาก็ยังเห็นสถานะจาก server
const SD = "http://shotdeck-box:4400";   // 29 ก.ย. ShotDeck ย้ายไปเครื่อง Box (ผ่าน Tailscale) — เดิม localhost:4400
const notify = (title, message) =>
  chrome.notifications.create({ type: "basic", iconUrl: "icons/icon128.png", title, message: String(message).slice(0, 200) });
const where = (j) => (j.shot != null ? `ซีน ${j.shot + 1} ${j.audio ? "🔊" : "←"} ` : "~/Downloads ← ") + (j.file || j.label);
const seen = new Map(); // id -> state ล่าสุดที่เห็น
let poll;
async function tickJobs() {
  const list = await fetch(`${SD}/api/jobs`).then((r) => r.json()).catch(() => null);
  if (!list) { clearInterval(poll); poll = null; chrome.action.setBadgeText({ text: "" }); return; }
  for (const j of list) {
    const prev = seen.get(j.id);
    if (prev && prev !== j.state && (j.state === "done" || j.state === "error"))
      notify(j.state === "done" ? "โหลดเสร็จแล้ว" : "โหลดไม่สำเร็จ", j.state === "done" ? where(j) : `${j.label}\n${j.error || ""}`);
    seen.set(j.id, j.state);
  }
  const running = list.filter((j) => j.state === "running").length;
  chrome.action.setBadgeBackgroundColor({ color: "#c0102a" });
  chrome.action.setBadgeText({ text: running ? `↓${running}` : "" });
  if (!running) { clearInterval(poll); poll = null; }
}
const watchJobs = () => { if (!poll) poll = setInterval(tickJobs, 2000); tickJobs(); };
chrome.runtime.onMessage.addListener((m, _s, reply) => {
  if (m?.type === "watch") return void watchJobs();
  if (m?.type !== "shotdeck") return;
  fetch(`${SD}/api/jobs`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...m.body, pid: m.pid, label: m.label }) })
    .then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.error || "ShotDeck ไม่ตอบ");
      seen.set(j.id, "running"); watchJobs();
      // บอกตั้งแต่เริ่มว่าต้องรอ — คลิป YouTube ยาว ๆ ใช้เวลาเป็นนาที คนกดแล้วไม่เห็นอะไรจะนึกว่าพัง
      notify("เริ่มโหลดแล้ว รอสักครู่", `${where(j)}\nดู % ในป๊อปอัป · เสร็จแล้วเด้งบอกอีกที`);
      reply({ ok: true, id: j.id }); })
    .catch((e) => reply({ ok: false, error: e.message }));
  return true;
});
// ── เสียงที่ฝังในโค้ดหน้า (MyInstants ฯลฯ: <button onclick="play('/media/sounds/x.mp3')">) ──
// webRequest เห็นเฉพาะไฟล์ที่เล่นแล้ว → อ่าน DOM หา .mp3/.wav/.ogg/.m4a จาก attribute + <script> แทน (ผู้ใช้ 29 ก.ย.)
// ponytail: regex ทั้งหน้า ไม่ parse JS · หน้าที่ต่อ URL เสียงด้วยโค้ด runtime จะไม่เจอ ต้องกดเล่นให้ webRequest จับแทน
function scanAudioInPage() {
  const re = /[^\s'"()<>,]+\.(?:mp3|wav|ogg|m4a)(?:\?[^\s'"()<>,]*)?/gi, out = new Map();
  const add = (u, el) => { try { const abs = new URL(u, location.href).href; if (!/^https?:/.test(abs) || out.has(abs)) return;
    const box = el?.closest?.("[class*=instant],li,article,.item,.card") || el?.parentElement;
    const t = el?.getAttribute?.("title") || el?.getAttribute?.("aria-label") || box?.textContent || "";
    out.set(abs, t.replace(/\s+/g, " ").replace(/^Play\s+|\s+sound$/gi, "").trim().slice(0, 70)); } catch {} };
  // กันหน้าค้าง (ผู้ใช้ 1 ต.ค.: YouTube เด้ง Page Unresponsive) — regex นี้ช้ามากกับข้อความยาวที่ไม่มีช่องว่าง (ytInitialData หลาย MB)
  // → เช็กนามสกุลแบบเส้นตรงก่อน · ข้ามสคริปต์ใหญ่เกิน 200KB · ข้ามค่า attribute ยาวเกิน 2KB
  const has = /\.(mp3|wav|ogg|m4a)/i;
  for (const el of document.querySelectorAll("*")) for (const a of el.attributes) if (a.value.length < 2000 && has.test(a.value)) for (const u of a.value.match(re) || []) add(u, el);
  for (const s of document.scripts) { const t = s.textContent; if (t.length < 200000 && has.test(t)) for (const u of t.match(re) || []) add(u, null); }
  return [...out].map(([url, title]) => ({ url, title }));
}
async function scanAudio(tabId) {
  const res = await chrome.scripting.executeScript({ target: { tabId }, func: scanAudioInPage }).catch(() => null);
  const found = res?.[0]?.result || []; if (!found.length) return 0;
  const page = await pageOf(tabId);
  const { items = [] } = await chrome.storage.session.get("items");
  let n = 0;
  for (const f of found) if (!items.some((i) => i.url === f.url && i.tabId === tabId)) { items.push({ url: f.url, type: "audio", title: f.title, headers: { Referer: page }, tabId, page }); n++; }
  if (n) { await chrome.storage.session.set({ items }); setBadge(tabId, items.filter((i) => i.tabId === tabId && i.page === page).length); }
  return n;
}
// สแกนเองทุกครั้งที่หน้าโหลดเสร็จ = เปิด/ปิดได้ในป๊อปอัป (ค่าเริ่มต้นปิด) · เปิดป๊อปอัปยังสแกนให้เสมอ
chrome.tabs.onUpdated.addListener(async (tabId, info) => {
  if (info.status !== "complete") return;
  if ((await chrome.storage.local.get("autoScan")).autoScan) scanAudio(tabId);
});
chrome.runtime.onMessage.addListener((m, _s, reply) => { if (m?.type !== "scanAudio") return; scanAudio(m.tabId).then((n) => reply({ n })); return true; });

// ── โหลดเสียงหลายไฟล์: วนใน service worker ไม่ใช่ในป๊อปอัป — ป๊อปอัปปิดแล้ว JS ของมันตาย งานหยุดที่ 6/72 (ผู้ใช้ 29 ก.ย.)
// ไฟล์อยู่หลัง Cloudflare → ให้หน้าเว็บ fetch เอง (ตัวตนเบราว์เซอร์จริง) แล้วส่ง base64 ให้ ShotDeck เขียนลงปลายทางที่เลือก
async function fetchInPage(tabId, url) {
  const [r] = await chrome.scripting.executeScript({ target: { tabId }, args: [url], func: async (u) => {
    try { const res = await fetch(u); if (!res.ok) return { err: "HTTP " + res.status };
      const b = new Uint8Array(await res.arrayBuffer()); let s = "";
      for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
      return { b64: btoa(s) }; } catch (e) { return { err: String(e) }; } } }).catch((e) => [{ result: { err: e.message } }]);
  const got = r?.result || {}; if (got.b64) return got.b64;
  // แท็บเปลี่ยนหน้า/ปิดไปแล้ว ไฟล์ชุดใหญ่จะหยุดกลางทาง (ผู้ใช้ 1 ต.ค.) → ดึงจาก service worker เองแทน (ส่วนขยายมีสิทธิ์ทุกโดเมน)
  // ponytail: ไฟล์ที่อยู่หลัง Cloudflare อาจโดนบล็อกในทางนี้ ทางในหน้ายังเป็นทางหลัก
  const res = await fetch(url, { credentials: "include" }).catch(() => null);
  if (!res?.ok) throw new Error(got.err || (res ? "HTTP " + res.status : "ดึงไฟล์ไม่ได้"));
  const b = new Uint8Array(await res.arrayBuffer()); let s = "";
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(s);
}
async function saveAudio(tabId, item, pid, page) {
  const b64 = await fetchInPage(tabId, item.url);
  const name = decodeURIComponent(item.url.split("?")[0].split("/").pop() || "sound.mp3");
  const res = await fetch(`${SD}/api/sfx/upload`, { method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ pid: pid || null, name, title: item.title || "", source: item.url, page, b64 }) });
  const j = await res.json().catch(() => ({})); if (!res.ok) throw new Error(j.error || "ShotDeck ไม่ตอบ");
  return j.file;
}
let audioBusy = false;
async function runAudio({ tabId, items, pid, page }) {
  audioBusy = true;
  const st = { total: items.length, done: 0, bad: 0, running: true, last: "", err: "" };
  const put = () => chrome.storage.session.set({ audioJob: { ...st } });
  await put();
  for (const it of items) {
    try { st.last = await saveAudio(tabId, it, pid, page); st.done++; } catch (e) { st.bad++; st.err = e.message; }
    await put();
    chrome.action.setBadgeBackgroundColor({ color: "#c0102a" }); chrome.action.setBadgeText({ text: `♪${st.done + st.bad}` });
    if (items.length > 1) await new Promise((r) => setTimeout(r, 700));   // ไม่ยิงรัว — เว็บต้นทางเป็นของคนอื่น
  }
  st.running = false; await put(); audioBusy = false;
  chrome.action.setBadgeText({ text: "" });
  if (items.length > 1) notify("โหลดเสียงเสร็จแล้ว", `${st.done} ไฟล์` + (st.bad ? ` · พลาด ${st.bad} (${st.err})` : ""));
  return st;
}
chrome.runtime.onMessage.addListener((m, _s, reply) => {
  if (m?.type !== "grabAudio") return;
  if (audioBusy) return void reply({ ok: false, error: "กำลังโหลดเสียงชุดก่อนอยู่" });
  const p = runAudio(m);
  if (m.items.length === 1) { p.then((st) => reply(st.done ? { ok: true, file: st.last } : { ok: false, error: st.err })); return true; }
  reply({ ok: true });   // ชุดใหญ่ตอบทันที ป๊อปอัปอ่านความคืบหน้าจาก storage.session.audioJob
});

watchJobs(); // SW ตื่นมา (เช่น Chrome เปิดใหม่) มีงานค้างที่ server ก็ตามต่อ
