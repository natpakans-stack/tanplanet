const wrap = document.getElementById("wrap");

// สร้างคำสั่ง yt-dlp พร้อม header จริง — referer ใช้ flag, ที่เหลือ --add-header
function buildCmd({ url, headers = {} }) {
  const parts = ["yt-dlp"];
  if (mp3.checked) parts.push("-x --audio-format mp3");
  for (const [k, v] of Object.entries(headers)) {
    if (!v) continue;
    if (k.toLowerCase() === "referer") parts.push(`--referer ${q(v)}`);
    else parts.push(`--add-header ${q(k + ":" + v)}`);
  }
  parts.push(q(url), mp3.checked ? "-o audio.mp3" : "-o video.mp4");
  return parts.join(" ");
}
const q = (s) => `'${String(s).replace(/'/g, `'\\''`)}'`; // single-quote ปลอดภัยกับ ; space ใน cookie

// ---- สั่ง yt-dlp ในเครื่องผ่าน native host (ติดตั้ง: ./host/install.sh <EXT_ID>) ----
const HOST = "com.tanplanet.idm";
const statusEl = document.getElementById("status");
let statusTimer;

function setStatus(msg, kind = "") {
  statusEl.textContent = msg;
  statusEl.className = "status show " + kind;
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => (statusEl.className = "status"), 6000);
}

function dlBtn(job, label = "Download", cls = "btn primary") {
  const b = document.createElement("button");
  b.className = cls;
  b.append(icon("download"), label);
  // audio = เอาเสียงอย่างเดียวเป็น mp3 — ใน ShotDeck จะเข้าช่อง sfx ของซีนแทน footage
  b.onclick = () => { job = { ...job, audio: mp3.checked }; target.pid ? toShotDeck(job, b) : toHost(job); };
  return b;
}

function toHost(job) {
  setStatus("กำลังสั่งโหลด…");
  chrome.runtime.sendNativeMessage(HOST, job, (res) => {
    const err = chrome.runtime.lastError;
    // โชว์ข้อความจริงจาก Chrome — "not found" = ยังไม่ install, "forbidden/undefined" = ยังไม่ reload
    if (err)
      return setStatus(
        `เรียก helper ไม่ได้: ${err.message}\nถ้าเพิ่งติดตั้ง ให้กด Reload ที่ chrome://extensions ก่อน`,
        "err"
      );
    if (!res?.ok) return setStatus(res?.error || "ล้มเหลว", "err");
    setStatus("เริ่มโหลดแล้ว → ~/Downloads (pid " + res.pid + ")", "ok");
  });
}

// ---- เป้าหมาย = โปรเจกต์/ซีนใน ShotDeck (localhost:4400) — เลือกไว้แล้วปุ่มโหลดทุกปุ่มยิงเข้าซีนนั้น ----
const SD = "http://localhost:4400";
const projSel = document.getElementById("proj"), shotSel = document.getElementById("shot");
let target = { pid: "", shot: 0 };
const mp3 = document.getElementById("mp3");
mp3.onchange = () => chrome.storage.local.set({ mp3: mp3.checked });
chrome.storage.local.get("mp3").then((r) => (mp3.checked = !!r.mp3));

function toShotDeck(job, b) {
  const { pid, shot } = target;
  b.disabled = true;
  setStatus(`กำลังโหลดเข้าซีน ${shot + 1}… ปิดป๊อปอัปได้ งานไม่ตาย`);
  chrome.runtime.sendMessage({ type: "shotdeck", pid, body: { ...job, shot } }, (res) => {
    b.disabled = false;
    if (!res?.ok) return setStatus(res?.error || "ShotDeck ไม่ตอบ", "err");
    setStatus(`ซีน ${shot + 1} ${job.audio ? "🔊" : "←"} ${res.file}`, "ok");
    loadShots(pid, shot + 1); // เลื่อนไปซีนถัดไปที่ยังว่างให้เอง — โหลดต่อได้เลยไม่ต้องเลือกใหม่
  });
}

// custom dropdown: ปุ่ม + listbox — Esc/คลิกนอกปิด · Enter/Space บนรายการเลือก (เป็น <button> อยู่แล้ว)
function setDD(el, items, value, onChange) {
  const cur = items.find((it) => it.value === value) || items[0];
  el.value = cur?.value ?? "";
  const btn = document.createElement("button");
  btn.type = "button"; btn.setAttribute("aria-haspopup", "listbox"); btn.setAttribute("aria-label", el.dataset.label);
  const val = document.createElement("span"); val.className = "val"; val.textContent = cur?.label ?? "";
  btn.append(val, icon("chevron"));
  const ul = document.createElement("ul"); ul.setAttribute("role", "listbox");
  for (const it of items) {
    const li = document.createElement("li"), b = document.createElement("button");
    b.type = "button"; b.setAttribute("role", "option"); b.setAttribute("aria-selected", String(it.value === el.value));
    const lb = document.createElement("span"); lb.textContent = it.label;
    b.append(lb);
    if (it.note) { const sm = document.createElement("small"); sm.textContent = it.note; b.append(sm); }
    b.append(icon("check"));
    b.onclick = () => { delete el.dataset.open; if (it.value !== el.value) onChange(it.value); else btn.focus(); };
    li.append(b); ul.append(li);
  }
  btn.onclick = () => { if (el.dataset.open) delete el.dataset.open; else { el.dataset.open = 1; ul.querySelector('[aria-selected="true"]')?.focus(); } };
  el.replaceChildren(btn, ul);
}
document.addEventListener("click", (e) => { for (const d of document.querySelectorAll(".dd[data-open]")) if (!d.contains(e.target)) delete d.dataset.open; });
document.addEventListener("keydown", (e) => { if (e.key === "Escape") for (const d of document.querySelectorAll(".dd[data-open]")) { delete d.dataset.open; d.querySelector("button").focus(); } });

// ซีน = "ซีน N ✓ · ภาพที่ต้องใช้" — ✓ คือมีฟุตแล้ว · ค่าเริ่มต้นเลือกซีนว่างตัวแรกตั้งแต่ from ขึ้นไป
async function loadShots(pid, from = 0) {
  shotSel.hidden = !pid;
  if (!pid) return shotSel.replaceChildren();
  const doc = await fetch(`${SD}/api/projects/${pid}`).then((r) => r.json()).catch(() => null);
  const shots = doc?.shots || [];
  const empty = shots.findIndex((s, i) => i >= from && !s.footage);
  target.shot = Math.max(0, empty >= 0 ? empty : Math.min(from, shots.length - 1));
  const items = shots.map((s, i) => ({ value: i, label: `ซีน ${i + 1}${s.footage ? " ✓" : ""} · ${s.visual || s.line || ""}` }));
  const pick = (v) => { target.shot = v; chrome.storage.local.set({ target }); setDD(shotSel, items, v, pick); };
  setDD(shotSel, items, target.shot, pick);
  chrome.storage.local.set({ target });
}

async function loadTargets() {
  const saved = (await chrome.storage.local.get("target")).target || {};
  const list = await fetch(`${SD}/api/projects`).then((r) => r.json()).catch(() => null);
  const items = [{ value: "", label: list ? "ไม่ส่ง ShotDeck → ~/Downloads" : "ShotDeck ไม่ได้เปิด (bun server.ts)" }];
  // ponytail: เรียงตาม id ถอยหลัง (id มีวันที่) — ไม่ได้เรียงข้ามรูปแบบ พอไว้ก่อน
  for (const p of (list || []).filter((p) => p.shots).sort((a, b) => b.id.localeCompare(a.id)))
    items.push({ value: p.id, label: p.title || p.id, note: `${p.shots} ซีน` });
  target.pid = (list || []).some((p) => p.id === saved.pid) ? saved.pid : "";
  const pick = (v) => { target.pid = v; setDD(projSel, items, v, pick); loadShots(v, 0); };
  setDD(projSel, items, target.pid, pick);
  await loadShots(target.pid, saved.shot || 0);
}
loadTargets();

// ico=null สำหรับปุ่มที่อยู่ติดกันหลายตัว — ไอคอน copy ซ้ำๆ ในแถวเดียวคืออาการรก ไม่ใช่ข้อมูล
function copyBtn(label, text, cls = "btn", ico = "copy") {
  const b = document.createElement("button");
  b.className = cls;
  const fill = () => { b.replaceChildren(...(ico ? [icon(ico)] : []), label); };
  fill();
  b.onclick = () => {
    navigator.clipboard.writeText(text);
    b.style.minWidth = b.offsetWidth + "px"; // ล็อกความกว้างก่อนสลับ icon กันปุ่มกระตุก
    b.classList.add("ok");
    b.replaceChildren(icon("check"), "คัดลอกแล้ว");
    setTimeout(() => {
      b.classList.remove("ok");
      fill();
    }, 1200);
  };
  return b;
}

// ---- HLS classifier: fetch ตัว .m3u8 มาแกะจริง (host_permissions=<all_urls> เลยข้าม CORS ได้) ----
const cache = new Map(); // url -> analysis (กัน fetch ซ้ำทุก render)
const variantRes = new Map(); // absolute variant url -> "1080p" (เติมจาก master ที่แกะแล้ว)

const fmt = (s) => {
  s = Math.round(s);
  const h = ~~(s / 3600), m = ~~((s % 3600) / 60), ss = s % 60;
  return (h ? h + ":" : "") + String(m).padStart(h ? 2 : 1, "0") + ":" + String(ss).padStart(2, "0");
};

function parseM3u8(url, text) {
  const lines = text.split(/\r?\n/);
  if (/#EXT-X-STREAM-INF/i.test(text)) {
    const variants = [], audio = [], subs = [];
    for (let i = 0; i < lines.length; i++) {
      const L = lines[i];
      if (/^#EXT-X-STREAM-INF/i.test(L)) {
        const res = L.match(/RESOLUTION=(\d+)x(\d+)/i);
        const bw = L.match(/BANDWIDTH=(\d+)/i);
        let j = i + 1;
        while (j < lines.length && (lines[j].startsWith("#") || !lines[j].trim())) j++;
        const uri = lines[j] ? new URL(lines[j].trim(), url).href : null;
        const label = res ? `${res[2]}p` : bw ? `${(bw[1] / 1e6).toFixed(1)}Mbps` : "?";
        variants.push({ label, h: res ? +res[2] : 0 });
        if (uri) variantRes.set(uri, label);
      }
      if (/^#EXT-X-MEDIA/i.test(L)) {
        const type = (L.match(/TYPE=([A-Z]+)/i) || [])[1] || "";
        const tag = (L.match(/LANGUAGE="([^"]*)"/i) || [])[1] || (L.match(/NAME="([^"]*)"/i) || [])[1] || "?";
        if (/AUDIO/i.test(type)) audio.push(tag);
        if (/SUB/i.test(type)) subs.push(tag);
      }
    }
    variants.sort((a, b) => b.h - a.h);
    return { kind: "master", variants, audio, subs };
  }
  if (/#EXTINF/i.test(text)) {
    let dur = 0, segs = 0;
    for (const L of lines) {
      const m = L.match(/#EXTINF:([\d.]+)/i);
      if (m) { dur += +m[1]; segs++; }
    }
    const key = lines.find((L) => /^#EXT-X-KEY/i.test(L));
    const meth = key && (key.match(/METHOD=([A-Z0-9-]+)/i) || [])[1];
    const enc = meth && !/NONE/i.test(meth) ? meth : null; // AES-128 / SAMPLE-AES
    return { kind: "variant", dur, segs, enc };
  }
  return { kind: "m3u8" };
}

async function analyze(url) {
  if (cache.has(url)) return cache.get(url);
  let a;
  if (/\.mpd(\?|#|$)/i.test(url)) a = { kind: "dash" };
  else if (!/\.m3u8(\?|#|$)/i.test(url)) a = { kind: "file" };
  else {
    try { a = parseM3u8(url, await (await fetch(url)).text()); }
    catch { a = { kind: "m3u8", err: true }; }
  }
  cache.set(url, a);
  return a;
}

// อธิบายแถว: chip + quality + info (info = ลิสต์ segment คั่นด้วย · แต่ละอันมีไอคอนได้)
function describe(url, a) {
  if (a.kind === "master") {
    const q = a.variants.map((v) => v.label).join(" / ") || "?";
    return {
      kind: "Master", cls: "master", q,
      info: [
        { icon: "audio", text: a.audio.length ? a.audio.join(", ") : "muxed" },
        { icon: "subs", text: a.subs.length ? a.subs.join(", ") : "ไม่มี" },
      ],
    };
  }
  if (a.kind === "variant") {
    const info = [{ text: `${a.segs} segs` }, { text: fmt(a.dur) }];
    if (a.enc) info.push({ icon: "lock", text: a.enc });
    return { kind: "Variant", cls: "variant", q: variantRes.get(url) || "?", info };
  }
  if (a.kind === "dash")
    return { kind: "DASH", cls: "file", q: "", info: [{ text: "ลอง yt-dlp / N_m3u8DL-RE" }] };
  if (a.kind === "file") {
    // ชื่อไฟล์ + host — ไม่งั้นหลายแถวหน้าตาเหมือนกันหมด แยกไม่ออกว่าอันไหนอันไหน
    let name = "direct", host = "";
    try {
      const u = new URL(url);
      name = decodeURIComponent(u.pathname.split("/").pop()) || "direct";
      host = u.hostname.replace(/^www\./, "");
    } catch {}
    return { kind: "File", cls: "file", q: "", info: host ? [{ text: name }, { text: host }] : [{ text: name }] };
  }
  return { kind: "m3u8", cls: "variant", q: "", info: a.err ? [{ text: "อ่านไม่ได้" }] : [] };
}

// ---- YouTube: อยู่หน้า watch/shorts → เสนอ yt-dlp จากลิงก์หน้าเว็บ (ไม่ sniff googlevideo) ----
function cleanYt(u) {
  const h = u.hostname.replace(/^www\./, "");
  if (h === "youtu.be" && u.pathname.length > 1) return `https://youtu.be${u.pathname}`;
  if (u.pathname === "/watch") {
    const v = u.searchParams.get("v"); // ตัด &list= ทิ้ง กันโหลดทั้ง playlist
    return v ? `https://www.youtube.com/watch?v=${v}` : null;
  }
  if (/^\/(shorts|live)\/[\w-]+/.test(u.pathname)) return `https://www.youtube.com${u.pathname}`;
  return null;
}

// ไซต์ที่ yt-dlp โหลดจาก URL หน้าเว็บได้ตรง ๆ (สตรีมเข้ารหัส/แยกท่อน sniff แล้วก็โหลดไม่ได้อยู่ดี)
const SITES = { "youtube.com": "YouTube", "youtu.be": "YouTube", "tiktok.com": "TikTok", "instagram.com": "Instagram", "facebook.com": "Facebook", "x.com": "X", "vimeo.com": "Vimeo" };
function pageTarget(u) {
  const h = u.hostname.replace(/^(www|m|mobile)\./, "");
  // Pinterest: ทุก subdomain/ประเทศ (in./th./pinterest.co.uk) แต่ต้องเป็นหน้าพินเดี่ยว — ฟีดไม่มี URL ต่อคลิป
  // ponytail: ฟีด/related pins ไม่แกะ DOM หา link ต่อวิดีโอ (Pinterest ซ่อนลิงก์จนกว่าจะ hover) — คลิกเปิดพินก่อนแล้วค่อยกดโหลด
  if (/(^|\.)pinterest\.[a-z.]+$/.test(h)) { const m = u.pathname.match(/^\/pin\/\d+\//); return m && { url: u.origin + m[0], site: "Pinterest" }; }
  const site = SITES[h];
  if (!site || u.pathname.length < 2) return null;
  if (site === "YouTube") { const c = cleanYt(u); return c && { url: c, site }; }
  return { url: u.origin + u.pathname, site }; // ตัด query ทิ้ง — tracking param ยาวเป็นกิโลและทำให้ dedupe พัง
}

async function ytCard() {
  let tab;
  try { [tab] = await chrome.tabs.query({ active: true, currentWindow: true }); } catch { return null; }
  if (!tab?.url) return null;
  let u; try { u = new URL(tab.url); } catch { return null; }
  const pt = pageTarget(u);
  if (!pt) return null;
  const clean = pt.url;

  const best = `yt-dlp -f 'bv*+ba/b' --merge-output-format mp4 ${q(clean)} -o '%(title)s.%(ext)s'`;

  const div = document.createElement("div");
  div.className = "yt";
  const head = document.createElement("div");
  head.className = "yt-head";
  const mark = icon("play", "i yt-mark");
  mark.setAttribute("fill", "currentColor");
  const sub = document.createElement("span");
  sub.className = "yt-sub";
  sub.textContent = "โหลดจากหน้าเว็บ";
  head.append(mark, pt.site, sub);
  // ชื่อคลิปคือคำตอบว่า "นี่คลิปอะไร" — URL ดูเอาที่ tooltip
  const urlDiv = document.createElement("div");
  urlDiv.className = "u";
  urlDiv.textContent = (tab.title || "").replace(/\s*[-|·]\s*(YouTube|TikTok|Instagram|Facebook|X|Vimeo|Pinterest)\s*$/, "") || clean;
  urlDiv.title = clean;
  const acts = document.createElement("div");
  acts.className = "acts";
  acts.append(
    dlBtn({ url: clean, format: "bv*+ba/b" }),
    dlBtn({ url: clean, format: "bv*[height<=1080]+ba/b" }, "1080p", "btn dl"),
    copyBtn("คัดลอกคำสั่ง", best)
  );
  div.append(head, urlDiv, acts);
  return div;
}

// หน้าที่ user ดูอยู่จริง ณ วินาทีที่เปิดป๊อปอัป — ทั้ง id และ URL (ตัด hash)
async function activeTab() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return { id: tab?.id ?? -1, page: (tab?.url || "").split("#")[0] };
  } catch { return { id: -1, page: "" }; }
}

// media ของหน้านี้เท่านั้น — item เก่าที่ page ไม่ตรง (SPA เปลี่ยนคลิป) ต้องไม่โผล่
const forPage = (items, t) =>
  items.filter((i) => i.tabId === t.id && (!i.page || i.page === t.page));

async function render() {
  const tab = await activeTab();
  const { items: all = [] } = await chrome.storage.session.get("items");
  const items = forPage(all, tab);
  wrap.innerHTML = "";
  const yt = await ytCard();
  if (yt) wrap.append(yt);
  if (!items.length) {
    if (!yt)
      wrap.innerHTML =
        '<div class="empty"><b>ยังไม่เจอวิดีโอในหน้านี้</b>กด Rescan แล้วเล่นวิดีโอสักครู่</div>';
    return;
  }
  // แกะทุกตัวก่อน (master เติม variantRes ให้ variant ก่อนวาดตาราง)
  const analyzed = await Promise.all(items.map((i) => analyze(i.url)));

  items.forEach((item, idx) => {
    const d = describe(item.url, analyzed[idx]);
    const row = document.createElement("div");
    row.className = "row";

    const top = document.createElement("div");
    top.className = "row-top";
    const chip = document.createElement("span");
    chip.className = "chip " + d.cls;
    chip.textContent = d.kind;
    top.append(chip);
    if (d.q) {
      const qEl = document.createElement("span"); // ไม่ตั้งชื่อ q — ชนกับ q() ที่ใช้ quote shell
      qEl.className = "q";
      qEl.textContent = d.q;
      top.append(qEl);
    }
    const info = document.createElement("div");
    info.className = "info";
    info.title = item.url;
    d.info.forEach((seg, i) => {
      if (i) info.append(document.createTextNode(" · "));
      if (seg.icon) info.append(icon(seg.icon));
      info.append(document.createTextNode(seg.text));
    });

    const main = document.createElement("div");
    main.className = "row-main";
    main.append(top, info);

    const acts = document.createElement("div");
    acts.className = "acts";
    acts.append(
      copyBtn("URL", item.url, "btn", null),
      copyBtn("cmd", buildCmd(item), "btn", null),
      dlBtn({ url: item.url, headers: item.headers }, "โหลด", "btn dl")
    );

    // ไฟล์ mp4 ตรง ๆ: ให้เบราว์เซอร์โชว์เฟรมที่วินาที 1 + ความยาว/ขนาดจริง — นี่คือวิธีเดียวที่รู้ว่าแถวไหนคือคลิปไหน
    // ponytail: HLS/DASH ไม่มีรูปย่อ (ต้อง hls.js) — สตรีมพวกนี้มักมีไฟล์เดียวต่อหน้าอยู่แล้ว
    if (analyzed[idx].kind === "file") {
      const v = document.createElement("video");
      v.className = "thumb"; v.muted = true; v.preload = "metadata"; v.src = item.url + "#t=1";
      v.onloadedmetadata = () => info.prepend(document.createTextNode(`${fmt(v.duration)} · ${v.videoWidth}×${v.videoHeight} · `));
      v.onerror = () => v.remove();
      row.prepend(v);
    }
    row.append(main, acts);
    wrap.append(row);
  });
}

// ไอคอนปุ่ม header
for (const [id, name] of [["rescan", "rescan"], ["copyAll", "copy"], ["clear", "clear"]])
  document.getElementById(id).prepend(icon(name));

// Rescan = reload tab → main_frame ล้างของเก่า + จับ media ใหม่รอบสด
document.getElementById("rescan").onclick = async () => {
  const { id } = await activeTab();
  if (id >= 0) chrome.tabs.reload(id);
};
document.getElementById("copyAll").onclick = async () => {
  const tab = await activeTab();
  const { items = [] } = await chrome.storage.session.get("items");
  const urls = forPage(items, tab).map((i) => i.url);
  if (urls.length) navigator.clipboard.writeText(urls.join("\n"));
};
document.getElementById("clear").onclick = async () => {
  const tab = await activeTab();
  const { items = [] } = await chrome.storage.session.get("items");
  await chrome.storage.session.set({ items: items.filter((i) => i.tabId !== tab.id) });
};

chrome.storage.session.onChanged.addListener(render);
render();
