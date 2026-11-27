/* หลังบ้าน tanplanet-cms (ใช้ทั้งไฟล์) — เว็บจริง = Vercel project tanplanet-cms · ย้ายที่รันเปลี่ยนบรรทัดนี้ที่เดียว */
window.TP_CMS = location.hostname === "localhost" ? "http://localhost:4100" : "https://tanplanet-cms.vercel.app";
// navbar sticky ของ Webflow เดิมบังหัวข้อเวลาเลื่อนบนมือถือ → จอ ≤991px: เลื่อนลงซ่อน เลื่อนขึ้นโผล่
(function () {
  var h = document.querySelector(".header.w-nav");
  if (!h) return;
  var mq = matchMedia("(max-width: 991px)");
  var reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  h.style.transition = reduce ? "none" : "transform .25s ease";
  var last = scrollY;
  addEventListener("scroll", function () {
    var y = scrollY, menuOpen = h.querySelector(".w--open");
    var hide = mq.matches && !menuOpen && y > last && y > h.offsetHeight;
    if (Math.abs(y - last) > 4 || y <= h.offsetHeight) {
      h.style.transform = hide ? "translateY(-100%)" : "";
      last = y;
    }
  }, { passive: true });
})();

// เลื่อนลง > 60px → navbar หดเป็นแคปซูลก้อนเดียว (โลโก้ · เมนู · Resume) · แทนบอก 27 พ.ย. ให้รวมเป็นก้อนเดียว · กลับบนสุด = แถบเต็มเดิม
(function () {
  var h = document.querySelector(".header.w-nav");
  if (!h) return;
  var css = document.createElement("style");
  css.textContent =
    ".header.w-nav{transition:background-color .3s ease}" +
    ".header .container-header,.header .header-left,.header .header-right{transition:padding .3s ease,margin .3s ease,background-color .3s ease,box-shadow .3s ease,border-radius .3s ease}" +
    ".header .header-left img{transition:height .3s ease,width .3s ease}" +
    ".header.is-pill{background-color:transparent}" +
    ".header.is-pill .container-default{display:none}" +
    ".header.is-pill .container-header{max-width:880px;margin-top:12px;padding:6px 6px 6px 24px!important;background:var(--tp-overlay,rgba(255,255,255,.9));-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);" +
    "border:1px solid var(--tp-border,#ececec);border-radius:999px;box-shadow:var(--tp-shadow-md,0 12px 32px rgba(0,0,0,.1));align-items:center}" +
    ".header.is-pill .header-left img{height:30px;width:auto}" +
    "@media (prefers-reduced-motion:reduce){.header.w-nav,.header *{transition:none!important}}";
  document.head.appendChild(css);
  function update() { h.classList.toggle("is-pill", scrollY > 60); }
  addEventListener("scroll", update, { passive: true });
  update();
})();

// ปุ่มสลับภาษา TH/EN (สร้างโดย tools/i18n-split.py) — แคปซูลเล็ก ภาษาที่อยู่ = พื้นทึบ
(function () {
  var css = document.createElement("style");
  css.textContent =
    /* ปุ่มขวาของ navbar ชุดเดียวกัน: แคปซูลสูง 36 · ตัว 13/600 · ภาษา = ขอบบาง · Resume = ปุ่มหลักพื้นเข้ม */
    ".lang-switch{box-sizing:border-box;display:inline-flex;align-items:center;gap:2px;height:36px;margin-right:8px;padding:3px;border:1px solid var(--tp-border,#ececec);border-radius:999px;text-decoration:none;font:600 13px/1 var(--tp-font,Inter,sans-serif)}" +
    ".lang-switch span{display:inline-flex;align-items:center;height:28px;padding:0 11px;border-radius:999px;color:var(--tp-text-3,#6b6b6b)}" +
    ".lang-switch span.on{background:var(--tp-text,#1f1f1f);color:var(--tp-on-brand,#fff)}" +
    ".lang-switch:hover span:not(.on){color:var(--tp-text,#1f1f1f)}" +
    ".lang-switch:focus-visible,.header .link-header-wrapper .link-primary:focus-visible{outline:2px solid var(--tp-brand,#db2777);outline-offset:2px}" +
    ".header .link-header-wrapper .link-primary{box-sizing:border-box;display:inline-flex;align-items:center;height:36px;padding:0 16px;border-radius:999px;background:var(--tp-text,#1f1f1f);color:var(--tp-on-brand,#fff);text-decoration:none}" +
    ".header .link-header-wrapper .link-primary:hover{background:var(--tp-text-2,#3f3f46)}" +
    ".header .link-header-wrapper .link-primary-wrapper{display:inline-flex;align-items:center;gap:6px}" +
    ".header .link-header-wrapper .link-primary-text{font:600 13px/1 var(--tp-font,Inter,sans-serif);color:inherit;margin:0}" +
    ".header .link-header-wrapper :is(.link-primary-text-arrow,.link-primary-arrow){color:inherit;font-size:12px;margin:0}" +
    ".header-right{display:flex;align-items:center}";
  document.head.appendChild(css);
})();

/* กันคลิกขวา/ลากเพื่อบันทึกรูป (แทนขอ 27 พ.ย.) — กันคนทั่วไปได้ แต่กัน DevTools/แคปจอไม่ได้ */
(function () {
  document.addEventListener("contextmenu", function (e) {
    if (e.target.closest("img, picture, video, svg, .ap-cover, .ap-blurbox, .bp-cover, .fh-card, .pp-thumb")) e.preventDefault();
  });
  document.addEventListener("dragstart", function (e) { if (e.target.tagName === "IMG") e.preventDefault(); });
  var s = document.createElement("style");
  s.textContent = "img{-webkit-user-drag:none;user-drag:none;-webkit-touch-callout:none}";
  document.head.appendChild(s);
})();

/* ดูในเครื่อง: ลิงก์ไป projects.tanplanet.work → localhost:3003 (เว็บจริงไม่โดน) */
if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) {
  document.querySelectorAll('a[href^="https://projects.tanplanet.work"]').forEach(function (a) {
    a.href = a.getAttribute("href").replace("https://projects.tanplanet.work", "http://localhost:3003");
  });
}

/* โหลดหน้า: skeleton + shimmer ระหว่างรอรูป · เนื้อหาเข้าแบบไล่ลำดับ — Motion (vanilla ของทีม Framer Motion)
   ไม่มี Motion (โหลด CDN ไม่ได้) = ข้ามแอนิเมชัน เนื้อหาแสดงตามปกติ */
(function () {
  var reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var IMG = ".bp-cover, .card-cover, .pp-thumb, .ap-cover img, .ap-rank-thumb img, .ap-more-thumb img, figure.shot img, .shot-pair > img, .fh-card img, .cs figure img, .pv-demo img, .ap-content figure img";
  var GROUPS = [".fh-head > *, .pj-head > *, .ap-head > *, .blog-title-wrapper > *, .contact-title-wrapper > *",
                ".pj .card, .blog-right .w-dyn-item, .portfolio-grid > .w-dyn-item, .ap-rank > li, .metrics > *, .pain-grid > *, .flow-step, .arch-layer"];
  function skeleton(img) {
    if (img.complete && img.naturalWidth) return;
    img.classList.add("tp-sk");
    var done = function () {
      img.classList.remove("tp-sk");
      if (!reduce && window.__tpMotion) window.__tpMotion.animate(img, { opacity: [0, 1] }, { duration: 0.45, ease: "easeOut" });
    };
    img.addEventListener("load", done, { once: true });
    img.addEventListener("error", function () { img.classList.remove("tp-sk"); }, { once: true });
  }
  function boot() {
    document.querySelectorAll(IMG).forEach(skeleton);
    if (reduce) return;
    import("https://cdn.jsdelivr.net/npm/motion@11/+esm").then(function (M) {
      window.__tpMotion = M;
      // หัวเพจ: ไล่ขึ้นทีละบรรทัดตอนเปิดหน้า
      var head = document.querySelectorAll(GROUPS[0]);
      if (head.length) M.animate(head, { opacity: [0, 1], y: [14, 0] }, { duration: 0.5, delay: M.stagger(0.07), ease: [0.22, 1, 0.36, 1] });
      // การ์ด/รายการ: เข้าเมื่อเลื่อนมาถึง (ไล่ทีละใบในกลุ่มเดียวกัน)
      var items = Array.prototype.slice.call(document.querySelectorAll(GROUPS[1])).filter(function (el) { return el.getBoundingClientRect().height; });
      items.forEach(function (el) { el.classList.add("tp-enter"); });
      M.inView(items, function (a) {
        var el = a && a.target ? a.target : a; // motion@11 ส่ง entry · @12 ส่ง element
        var sibs = Array.prototype.filter.call(el.parentElement.children, function (s) { return s.classList.contains("tp-enter"); });
        M.animate(el, { opacity: [0, 1], y: [18, 0] }, { duration: 0.55, delay: Math.min(sibs.indexOf(el) % 6, 5) * 0.06, ease: [0.22, 1, 0.36, 1] })
          .finished.then(function () { el.classList.remove("tp-enter"); el.style.transform = ""; });
      }, { amount: 0.15 });
    }).catch(function () { document.querySelectorAll(".tp-enter").forEach(function (el) { el.classList.remove("tp-enter"); }); });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();

/* ปิดหน้าโหลด (โลโก้) เมื่อรูปพร้อม: window load · หรือช้าสุด 4s */
(function () {
  var ready = function () {
    var h = document.documentElement;
    if (h.classList.contains("tp-ready")) return;
    h.classList.add("tp-fading");
    h.classList.add("tp-ready");
  };
  if (document.readyState === "complete") ready(); else window.addEventListener("load", ready, { once: true });
  setTimeout(ready, 4000);
})();

/* ดูรูปเต็มจอ: กดรูปในเนื้อหา → <dialog> · ←/→ เลื่อนรูป · Esc/กดพื้นหลัง ปิด · ไม่จับรูปที่เป็นลิงก์อยู่แล้วหรือรูปเล็ก (ไอคอน) */
(function () {
  var SEL = ".ap-content img, .cs article img, .pv-demo img";
  var TH = (document.documentElement.lang || "th").indexOf("th") === 0;
  var imgs = [], i = 0, dlg, pic, cap, count;
  function list() {
    return Array.prototype.filter.call(document.querySelectorAll(SEL), function (im) {
      return !im.closest("a") && !(im.naturalWidth && im.naturalWidth < 160); // รูป lazy ที่ยังไม่โหลด (กว้าง 0) ต้องนับด้วย
    });
  }
  function build() {
    dlg = document.createElement("dialog");
    dlg.className = "tp-lb";
    dlg.setAttribute("aria-label", TH ? "ดูรูปเต็มจอ" : "Image viewer");
    dlg.innerHTML = '<figure class="tp-lb-fig"><img alt=""><figcaption></figcaption><div class="tp-lb-thumbs" role="group" aria-label="' + (TH ? "รูปทั้งหมดในหน้านี้" : "All images on this page") + '"></div></figure>' +
      '<span class="tp-lb-count"></span>' +
      '<button type="button" class="tp-lb-btn tp-lb-close" autofocus aria-label="' + (TH ? "ปิด" : "Close") + '">×</button>' +
      '<button type="button" class="tp-lb-btn tp-lb-prev" aria-label="' + (TH ? "รูปก่อนหน้า" : "Previous image") + '">‹</button>' +
      '<button type="button" class="tp-lb-btn tp-lb-next" aria-label="' + (TH ? "รูปถัดไป" : "Next image") + '">›</button>';
    document.body.appendChild(dlg);
    pic = dlg.querySelector(".tp-lb-fig > img"); cap = dlg.querySelector("figcaption"); count = dlg.querySelector(".tp-lb-count");
    dlg.querySelector(".tp-lb-close").onclick = function () { dlg.close(); };
    dlg.querySelector(".tp-lb-prev").onclick = function () { show(i - 1); };
    dlg.querySelector(".tp-lb-next").onclick = function () { show(i + 1); };
    dlg.addEventListener("click", function (e) { if (e.target === dlg || e.target.classList.contains("tp-lb-fig") || e.target === pic) dlg.close(); });
    // แถบรูปย่อ: ทุกรูปในหน้า กดเพื่อไปรูปนั้น (ไม่ต้องปิดออกไปหา)
    dlg.querySelector(".tp-lb-thumbs").addEventListener("click", function (e) {
      var b = e.target.closest("button[data-i]"); if (b) show(+b.dataset.i);
    });
    dlg.addEventListener("keydown", function (e) {
      if (e.key === "ArrowRight") show(i + 1);
      else if (e.key === "ArrowLeft") show(i - 1);
    });
    dlg.addEventListener("close", function () { document.documentElement.style.overflow = ""; if (imgs[i]) imgs[i].focus({ preventScroll: true }); });
  }
  function show(n) {
    i = (n + imgs.length) % imgs.length;
    var im = imgs[i], fc = im.closest("figure") && im.closest("figure").querySelector("figcaption");
    pic.src = im.currentSrc || im.src; pic.alt = im.alt || "";
    cap.textContent = fc ? fc.textContent.trim() : "";
    count.textContent = imgs.length > 1 ? (i + 1) + " / " + imgs.length : "";
    dlg.querySelectorAll(".tp-lb-prev, .tp-lb-next").forEach(function (b) { b.hidden = imgs.length < 2; });
    var strip = dlg.querySelector(".tp-lb-thumbs");
    if (strip.childElementCount !== imgs.length) {
      strip.innerHTML = imgs.map(function (im, n) {
        return '<button type="button" data-i="' + n + '" aria-label="' + (TH ? "รูปที่ " : "Image ") + (n + 1) + '"><img src="' + (im.currentSrc || im.src) + '" alt="" loading="lazy"></button>';
      }).join("");
    }
    strip.hidden = imgs.length < 2;
    strip.querySelectorAll("button").forEach(function (b, n) { b.setAttribute("aria-current", n === i ? "true" : "false"); });
    var cur = strip.children[i]; if (cur) cur.scrollIntoView({ block: "nearest", inline: "center" });
  }
  function openAt(im) { if (!dlg) build(); imgs = list(); show(Math.max(imgs.indexOf(im), 0)); document.documentElement.style.overflow = "hidden"; dlg.showModal(); }
  // ปุ่ม "ดูภาพเต็ม" → รูปที่อยู่ก่อนปุ่มในหน้า
  document.addEventListener("click", function (e) {
    var b = e.target.closest(".tp-zoom-prev"); if (!b) return;
    var all = list(), prev = null;
    all.forEach(function (im) { if (im.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) prev = im; });
    if (prev) openAt(prev);
  });
  function boot() {
    imgs = list();
    if (!imgs.length || !window.HTMLDialogElement) return;
    imgs.forEach(function (im, n) {
      im.classList.add("tp-zoomable");
      im.tabIndex = 0;
      im.setAttribute("role", "button");
      im.setAttribute("aria-label", (TH ? "ขยายรูป" : "Enlarge image") + (im.alt ? ": " + im.alt : ""));
      var open = function () { openAt(im); };
      im.addEventListener("click", open);
      im.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } });
    });
  }
  if (document.readyState === "complete") boot(); else window.addEventListener("load", boot, { once: true });
})();

/* ลิงก์ "จัดการหลังบ้าน": เปิดบนเครื่อง = หลังบ้านที่รันอยู่ (tanplanet-cms · พอร์ต 5179) · เว็บจริง = /admin/ */
/* ลิงก์ "จัดการหลังบ้าน": เครื่อง dev → admin บน :5179 · เว็บจริงยังไม่มีที่รันหลังบ้าน (meta tp-cms ว่าง) → ซ่อนทั้งช่อง ไม่ให้กดแล้วเจอ 404 */
document.querySelectorAll(".footer-nav-admin").forEach(function (a) {
  if (location.hostname === "localhost") a.href = "http://localhost:5179/admin/";
  else a.href = "https://tanplanet.work/admin/";
});

/* หลังบ้าน tanplanet-cms — ponytail: ใส่ URL api จริงตรงนี้เมื่อเลือกที่รันแล้ว (ว่าง = เว็บจริงไม่ส่งอะไร) */

/* นับผู้เข้าชม: ส่งแค่ path + referrer ตอนเปิดหน้า · ไม่มีคุกกี้ ไม่เก็บ IP · เคารพ Do Not Track/GPC (ตัดที่ api) — /privacy */
(function () {
  if (!window.TP_CMS || !navigator.sendBeacon) return;
  var q = new URLSearchParams(location.search), b = { path: location.pathname, referrer: document.referrer || null };
  ["utm_source", "utm_medium", "utm_campaign"].forEach(function (k) { if (q.get(k)) b[k] = q.get(k); });
  navigator.sendBeacon(window.TP_CMS + "/api/track", JSON.stringify(b));
})();

/* ช่องทางติดต่อจากหลังบ้าน (tanplanet-cms · ตั้งค่า › ช่องทาง): ลิงก์ที่มี data-channel ได้ URL ล่าสุดจาก GET /api/site/links
   ใน HTML มีค่าเดิมเสมอ — api ล่มหรือยังไม่ตั้ง = ใช้ค่าเดิม ไม่มีอะไรพัง */
(function () {
  var cms = window.TP_CMS;
  if (!cms || !document.querySelector("a[data-channel]")) return;
  fetch(cms + "/api/site/links").then(function (r) { return r.ok ? r.json() : {}; }).then(function (ch) {
    document.querySelectorAll("a[data-channel]").forEach(function (a) { var u = ch[a.dataset.channel]; if (u) a.href = u; });
  }).catch(function () {});
})();

/* เหตุการณ์สำคัญ: กดลิงก์ช่องทาง (data-channel) = ch_<id> · ฟอร์มติดต่อเรียก tpEvent("lead_submit") เอง — ไม่มีคุกกี้ เหมือนตัวนับ */
window.tpEvent = function (name) {
  if (!window.TP_CMS || !navigator.sendBeacon) return;
  navigator.sendBeacon(window.TP_CMS + "/api/track", JSON.stringify({ type: "event", path: location.pathname, events: [{ name: name }] }));
};
document.addEventListener("click", function (e) {
  var a = e.target.closest && e.target.closest("a[data-channel]");
  if (a) window.tpEvent("ch_" + a.dataset.channel);
});
