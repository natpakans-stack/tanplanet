// จับ media + เก็บ header จริงที่ browser ส่ง (referer/origin/cookie/user-agent) เพื่อเอาไปทำคำสั่ง yt-dlp
// ผูกทุก item กับ tabId + ล้างเมื่อ tab นั้นเริ่มโหลดหน้าใหม่ (main_frame) — กัน asset ของหน้าเก่า carry มา
const RE = /\.(m3u8|mpd|mp4|ts|m4s)([?#/]|$)/i;
const KEEP = ["referer", "origin", "cookie", "user-agent"];

const setBadge = (tabId, n) =>
  chrome.action.setBadgeText({ tabId, text: n ? String(n) : "" });
const countFor = (items, tabId) => items.filter((i) => i.tabId === tabId).length;

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

chrome.webRequest.onSendHeaders.addListener(
  async (d) => {
    if (d.tabId < 0) return; // ทิ้ง request ที่ไม่ผูกกับ tab (prefetch/service worker)
    if (!(RE.test(d.url) || d.type === "media")) return;
    const { items = [] } = await chrome.storage.session.get("items");
    if (items.some((i) => i.url === d.url && i.tabId === d.tabId)) return; // dedupe ต่อ tab
    const headers = {};
    for (const h of d.requestHeaders || [])
      if (KEEP.includes(h.name.toLowerCase())) headers[h.name] = h.value;
    items.unshift({ url: d.url, type: d.type, headers, tabId: d.tabId });
    await chrome.storage.session.set({ items });
    setBadge(d.tabId, countFor(items, d.tabId));
  },
  { urls: ["<all_urls>"] },
  ["requestHeaders", "extraHeaders"] // extraHeaders = เห็น Cookie/Referer/Origin ที่ปกติถูกซ่อน
);

// ปิด tab → เก็บกวาด item ที่ค้าง
chrome.tabs.onRemoved.addListener(async (tabId) => {
  const { items = [] } = await chrome.storage.session.get("items");
  const kept = items.filter((i) => i.tabId !== tabId);
  if (kept.length !== items.length) await chrome.storage.session.set({ items: kept });
});
