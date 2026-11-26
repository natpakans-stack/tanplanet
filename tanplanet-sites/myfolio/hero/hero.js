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
  drop();

  // เปิดหน้า: การ์ดหล่นลงมาทีละใบ (ใช้ property `translate` แยกจาก transform ของ scroll) แล้วมีควันตอนกระแทก
  function drop() {
    var stage = hero.firstElementChild;
    cards.filter(function (c) { return c.offsetParent; }).forEach(function (c, i) {
      var delay = 120 + i * 90, dur = 760;
      c.animate([
        { translate: "0 -115vh", opacity: 0.4, easing: "cubic-bezier(.55,0,1,.45)" },  // ตกเร่งความเร็ว
        { translate: "0 8px", opacity: 1, offset: 0.72, easing: "ease-out" },           // กระแทกยุบนิด
        { translate: "0 -6px", offset: 0.86, easing: "ease-in-out" },                   // เด้งกลับ
        { translate: "0 0" }
      ], { duration: dur, delay: delay, fill: "backwards" });
      setTimeout(function () { puff(stage, c); }, delay + dur * 0.72);
    });
  }
  function puff(stage, c) {
    // ตำแหน่งปลายทางจาก offset* (ไม่ขึ้นกับ animation ที่ยังเล่นอยู่) · stage sticky = offsetParent
    var p = document.createElement("span");
    p.className = "fh-smoke";
    p.style.left = (c.offsetLeft + c.offsetWidth / 2) + "px";
    p.style.top = (c.offsetTop + c.offsetHeight - 4) + "px";
    p.style.width = c.offsetWidth * 1.3 + "px";
    p.innerHTML = "<i></i><i></i><i></i><i></i><i></i>";
    stage.appendChild(p);
    setTimeout(function () { p.remove(); }, 1300);
  }
})();
