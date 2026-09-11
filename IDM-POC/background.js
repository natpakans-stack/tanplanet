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

// ยิงเข้า server ShotDeck จากที่นี่ ไม่ใช่ใน popup — ปิดป๊อปอัปแล้ว fetch ไม่ตาย
// งานที่กำลังโหลด: badge ↓N บนไอคอน + notification ของ macOS ตอนเสร็จ/ล้ม (ปิดป๊อปอัปไปแล้วก็รู้) · ป๊อปอัปเปิดมาทีหลังถาม {type:"jobs"} ได้
// ponytail: badge นี้เป็นค่ากลาง แท็บที่ sniff เจอ media จะโชว์เลขของแท็บทับแทน · service worker ตายได้ราว 5 นาทีถ้าคลิปยาวมาก server ยังโหลดต่อจนจบ แค่ไม่มีแจ้งเตือน
const SD = "http://localhost:4400";
const jobs = new Map();
let seq = 0;
const jobBadge = () => {
  chrome.action.setBadgeBackgroundColor({ color: "#c0102a" });
  chrome.action.setBadgeText({ text: jobs.size ? `↓${jobs.size}` : "" });
};
const notify = (title, message) =>
  chrome.notifications.create({ type: "basic", iconUrl: "icons/icon128.png", title, message: String(message).slice(0, 200) });
chrome.runtime.onMessage.addListener((m, _s, reply) => {
  if (m?.type === "jobs") return void reply([...jobs.values()]);
  if (m?.type !== "shotdeck") return;
  const id = ++seq, label = m.label || m.body.url;
  jobs.set(id, { id, label, at: Date.now(), pid: m.pid, shot: m.body.shot });
  jobBadge();
  // บอกตั้งแต่เริ่มว่าต้องรอ — คลิป YouTube ยาว ๆ ใช้เวลาเป็นนาที คนกดแล้วไม่เห็นอะไรจะนึกว่าพัง
  notify("เริ่มโหลดแล้ว รอสักครู่", `${m.body.shot != null ? `ซีน ${m.body.shot + 1} ← ` : "~/Downloads ← "}${label}\nคลิปสั้นไม่กี่วิ · YouTube ยาว ๆ ราว 1–4 นาที · เสร็จแล้วเด้งบอกอีกที`);
  fetch(m.pid ? `${SD}/api/projects/${m.pid}/footage/url` : `${SD}/api/download`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(m.body),
  })
    .then(async (r) => ({ ok: r.ok, ...(await r.json().catch(() => ({ error: "ShotDeck ตอบไม่เป็น JSON" }))) }))
    .catch((e) => ({ ok: false, error: e.message }))
    .then((res) => {
      jobs.delete(id); jobBadge();
      res.where = !res.ok ? res.error || "ShotDeck ไม่ตอบ"
        : res.shot != null ? `ซีน ${res.shot + 1} ${m.body.audio ? "🔊" : "←"} ${res.file}` : `~/Downloads ← ${res.file}`;
      notify(res.ok ? "โหลดเสร็จแล้ว" : "โหลดไม่สำเร็จ", res.where);
      chrome.runtime.sendMessage({ type: "job-done", id, res }).catch(() => {}); // ป๊อปอัปถ้ายังเปิดอยู่
      try { reply(res); } catch {}
    });
  return true;
});
