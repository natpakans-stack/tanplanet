const wrap = document.getElementById("wrap");

// สร้างคำสั่ง yt-dlp พร้อม header จริง — referer ใช้ flag, ที่เหลือ --add-header
function buildCmd({ url, headers = {} }) {
  const parts = ["yt-dlp"];
  for (const [k, v] of Object.entries(headers)) {
    if (!v) continue;
    if (k.toLowerCase() === "referer") parts.push(`--referer ${q(v)}`);
    else parts.push(`--add-header ${q(k + ":" + v)}`);
  }
  parts.push(q(url), "-o video.mp4");
  return parts.join(" ");
}
const q = (s) => `'${String(s).replace(/'/g, `'\\''`)}'`; // single-quote ปลอดภัยกับ ; space ใน cookie

function copyBtn(label, text) {
  const b = document.createElement("button");
  b.textContent = label;
  b.onclick = () => {
    navigator.clipboard.writeText(text);
    const t = b.textContent;
    b.textContent = "✓";
    setTimeout(() => (b.textContent = t), 1000);
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

// อธิบายคอลัมน์ Quality + Info จากผลแกะ
function describe(url, a) {
  if (a.kind === "master") {
    const q = a.variants.map((v) => v.label).join(" / ") || "?";
    const io = [];
    io.push(a.audio.length ? `🔊 ${a.audio.join(", ")}` : "muxed audio");
    io.push(a.subs.length ? `💬 ${a.subs.join(", ")}` : "no subs");
    return { kind: "Master", cls: "master", q, info: io.join(" · ") };
  }
  if (a.kind === "variant") {
    const info = `${a.segs} segs · ${fmt(a.dur)}` + (a.enc ? ` · 🔒 ${a.enc}` : "");
    return { kind: "Variant", cls: "variant", q: variantRes.get(url) || "?", info };
  }
  if (a.kind === "dash")
    return { kind: "DASH", cls: "file", q: "?", info: "DASH — ลอง yt-dlp / N_m3u8DL-RE" };
  if (a.kind === "file")
    return { kind: "File", cls: "file", q: "—", info: "direct" };
  return { kind: "m3u8", cls: "variant", q: "?", info: a.err ? "อ่านไม่ได้" : "" };
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

async function ytCard() {
  let tab;
  try { [tab] = await chrome.tabs.query({ active: true, currentWindow: true }); } catch { return null; }
  if (!tab?.url) return null;
  let u; try { u = new URL(tab.url); } catch { return null; }
  if (!/(^|\.)youtube\.com$|(^|\.)youtu\.be$/.test(u.hostname)) return null;
  const clean = cleanYt(u);
  if (!clean) return null;

  const best = `yt-dlp -f 'bv*+ba/b' --merge-output-format mp4 ${q(clean)} -o '%(title)s.%(ext)s'`;
  const p1080 = `yt-dlp -f 'bv*[height<=1080]+ba/b' --merge-output-format mp4 ${q(clean)} -o '%(title)s.%(ext)s'`;

  const div = document.createElement("div");
  div.className = "yt";
  const head = document.createElement("div");
  head.innerHTML = "<b>▶ YouTube</b> — โหลดจากหน้าเว็บ (เสถียรกว่า sniff)";
  const urlDiv = document.createElement("div");
  urlDiv.className = "u";
  urlDiv.textContent = clean;
  div.append(head, urlDiv, copyBtn("yt-dlp best", best), copyBtn("yt-dlp 1080p", p1080));
  return div;
}

function td(cls, node) {
  const c = document.createElement("td");
  if (cls) c.className = cls;
  c.append(node);
  return c;
}

async function activeTabId() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab?.id ?? -1;
  } catch { return -1; }
}

async function render() {
  const tabId = await activeTabId();
  const { items: all = [] } = await chrome.storage.session.get("items");
  const items = all.filter((i) => i.tabId === tabId); // โชว์เฉพาะ media ของหน้าที่ดูอยู่
  wrap.innerHTML = "";
  const yt = await ytCard();
  if (yt) wrap.append(yt);
  if (!items.length) {
    if (!yt) wrap.innerHTML = '<div class="empty">ยังไม่เจอ media URL</div>';
    return;
  }
  // แกะทุกตัวก่อน (master เติม variantRes ให้ variant ก่อนวาดตาราง)
  const analyzed = await Promise.all(items.map((i) => analyze(i.url)));

  const table = document.createElement("table");
  table.innerHTML =
    "<thead><tr><th>Type</th><th>Quality</th><th>Info</th><th></th></tr></thead>";
  const tbody = document.createElement("tbody");
  items.forEach((item, idx) => {
    const d = describe(item.url, analyzed[idx]);
    const kind = document.createElement("span");
    kind.className = "kind " + d.cls;
    kind.textContent = d.kind;
    const acts = document.createElement("span");
    acts.className = "acts";
    acts.append(copyBtn("URL", item.url), copyBtn("yt-dlp", buildCmd(item)));
    const tr = document.createElement("tr");
    tr.append(td("", kind), td("q", document.createTextNode(d.q)),
              td("info", document.createTextNode(d.info)), td("acts", acts));
    tbody.append(tr);
  });
  table.append(tbody);
  wrap.append(table);
}

// Rescan = reload tab → main_frame ล้างของเก่า + จับ media ใหม่รอบสด
document.getElementById("rescan").onclick = async () => {
  const tabId = await activeTabId();
  if (tabId >= 0) chrome.tabs.reload(tabId);
};
document.getElementById("copyAll").onclick = async () => {
  const tabId = await activeTabId();
  const { items = [] } = await chrome.storage.session.get("items");
  const urls = items.filter((i) => i.tabId === tabId).map((i) => i.url);
  if (urls.length) navigator.clipboard.writeText(urls.join("\n"));
};
document.getElementById("clear").onclick = async () => {
  const tabId = await activeTabId();
  const { items = [] } = await chrome.storage.session.get("items");
  await chrome.storage.session.set({ items: items.filter((i) => i.tabId !== tabId) });
};

chrome.storage.session.onChanged.addListener(render);
render();
