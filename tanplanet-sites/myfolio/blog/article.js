// บทความ: วงความคืบหน้าการอ่าน (มุมขวาบน) + ปุ่มคัดลอกลิงก์
(function () {
  var ring = document.querySelector(".ap-progress"), body = document.querySelector(".ap-body");
  if (ring && body) {
    var bar = ring.querySelector(".ap-progress-bar"), label = ring.querySelector("span"), ticking = false;
    function update() {
      ticking = false;
      var r = body.getBoundingClientRect(), total = r.height - innerHeight * 0.6;
      var pct = Math.round(Math.min(Math.max(-r.top / total, 0), 1) * 100);
      bar.style.strokeDashoffset = 100 - pct;
      label.textContent = pct + "%"; ring.setAttribute("aria-valuenow", pct);
      var cover = document.querySelector(".ap-cover"); ring.classList.toggle("on", !cover || cover.getBoundingClientRect().bottom < 0);  // โผล่เมื่อเลื่อนผ่านปก (แบบต้นทาง)
    }
    addEventListener("scroll", function () { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
    update();
  }
  document.querySelectorAll("[data-copy]").forEach(function (b) {
    b.addEventListener("click", function () {
      navigator.clipboard.writeText(b.dataset.copy).then(function () {
        b.classList.add("ok"); setTimeout(function () { b.classList.remove("ok"); }, 1500);
      });
    });
  });
})();
