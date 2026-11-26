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

// เลื่อนลง > 60px → navbar หดเป็นแคปซูล 2 ก้อน (ซ้าย: โลโก้+เมนู · ขวา: Resume) แบบ fastwork · กลับบนสุด = แถบเต็มเดิม
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
    ".header.is-pill .container-header{padding-top:12px;padding-bottom:12px}" +
    ".header.is-pill :is(.header-left,.header-right){background:var(--tp-overlay,rgba(255,255,255,.9));-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);" +
    "border:1px solid var(--tp-border,#ececec);border-radius:999px;box-shadow:var(--tp-shadow-md,0 12px 32px rgba(0,0,0,.1));padding:8px 22px}" +
    ".header.is-pill :is(.header-left,.header-right){height:48px;display:flex;align-items:center;box-sizing:border-box}" +
    ".header.is-pill .header-left{padding-left:16px}" +
    ".header.is-pill .header-left img{height:30px;width:auto}" +
    "@media (prefers-reduced-motion:reduce){.header.w-nav,.header *{transition:none!important}}";
  document.head.appendChild(css);
  function update() { h.classList.toggle("is-pill", scrollY > 60); }
  addEventListener("scroll", update, { passive: true });
  update();
})();
