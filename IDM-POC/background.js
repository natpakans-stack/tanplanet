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
const SD = "http://localhost:4400";
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
watchJobs(); // SW ตื่นมา (เช่น Chrome เปิดใหม่) มีงานค้างที่ server ก็ตามต่อ
