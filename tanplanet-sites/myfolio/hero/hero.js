// การ์ดใน hero กระจายออกจากกลางจอตามระยะเลื่อน (ตัวเลขจาก .reanimate/hero/spec.md):
//   x: ±0.75px ต่อ px ที่เลื่อน (ซ้ายไปซ้าย ขวาไปขวา) · y: (ระยะจากกลางจอ) × 0.001 ต่อ px · linear
(function () {
  var hero = document.querySelector(".fh");
  if (!hero || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  var cards = [].slice.call(hero.querySelectorAll(".fh-card"));
  var base = [], ticking = false;

  function measure() {
    var hdr = document.querySelector(".header.w-nav");
    if (hdr) hero.style.setProperty("--hdr", hdr.offsetHeight + "px");
    var vw = innerWidth, vh = innerHeight;
    base = cards.map(function (c) {
      c.style.transform = "";
      var r = c.getBoundingClientRect(), stage = hero.firstElementChild.getBoundingClientRect();
      var cx = r.left + r.width / 2, cy = r.top - stage.top + r.height / 2;
      return { side: cx < vw / 2 ? -1 : 1, dy: (cy - vh / 2) * 0.001 };
    });
    update();
  }
  function update() {
    ticking = false;
    var p = Math.min(Math.max(-hero.getBoundingClientRect().top, 0), innerHeight);
    cards.forEach(function (c, i) {
      var b = base[i];
      c.style.transform = "translate3d(" + (b.side * 0.75 * p).toFixed(1) + "px," + (b.dy * p).toFixed(1) + "px,0)";
    });
  }
  addEventListener("scroll", function () { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
  addEventListener("resize", measure);
  measure();
})();
