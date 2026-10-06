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
