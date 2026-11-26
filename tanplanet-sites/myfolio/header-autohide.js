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
