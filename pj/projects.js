// หน้า "ผลงาน": ค้นหา · กรองหมวด · สลับมุมมอง · ป้าย NEW (30 วันจาก data-added เหมือน projects.tanplanet.work)
(function () {
  var grid = document.querySelector(".pj-grid"); if (!grid) return;
  var cards = [].slice.call(grid.querySelectorAll(".card")), q = document.getElementById("pj-q");
  var count = document.querySelector(".pj-count b"), empty = document.querySelector(".pj-empty"), cat = "all";
  var now = Date.now();
  cards.forEach(function (c) { var d = Date.parse(c.dataset.added || ""); if (d && now - d < 30 * 864e5) c.classList.add("is-new"); });
  // ไฮไลต์คำที่ตรง: หัวข้อ · ประเภท · คำอธิบาย · แท็ก · ถ้าตรงแค่ keyword ซ่อน ให้บอกใต้การ์ด
  var SEL = "h3, p, .card-type, .tag, .card-footer span";
  cards.forEach(function (c) { c.querySelectorAll(SEL).forEach(function (el) { el.dataset.raw = el.innerHTML; }); });
  function esc(w) { return w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
  function mark(c, words) {
    var re = words.length ? new RegExp("(" + words.map(esc).join("|") + ")", "gi") : null, hit = false;
    c.querySelectorAll(SEL).forEach(function (el) {
      el.innerHTML = el.dataset.raw;
      if (!re) return;
      var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT), nodes = [], n;
      while ((n = walker.nextNode())) nodes.push(n);
      nodes.forEach(function (t) {
        if (!re.test(t.nodeValue)) return; re.lastIndex = 0; hit = true;
        var span = document.createElement("span");
        span.innerHTML = t.nodeValue.replace(/[&<>]/g, function (ch) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;" }[ch]; }).replace(re, "<mark>$1</mark>");
        t.replaceWith.apply(t, [].slice.call(span.childNodes));
      });
    });
    var note = c.querySelector(".card-match"); if (note) note.remove();
    if (re && !hit) {
      var kw = (c.dataset.keywords || "").split(/\s+/).filter(function (k) { return words.some(function (w) { return k.toLowerCase().indexOf(w) > -1; }); }).slice(0, 3);
      if (kw.length) { note = document.createElement("div"); note.className = "card-match"; note.innerHTML = (document.documentElement.lang === "en" ? "Matches: " : "ตรงกับ: ") + kw.map(function (k) { return "<mark>" + k.replace(/[&<>]/g, "") + "</mark>"; }).join(", "); c.querySelector(".card-body").append(note); }
    }
  }
  function apply() {
    var words = q.value.trim().toLowerCase().split(/\s+/).filter(Boolean), n = 0;
    cards.forEach(function (c) {
      var hay = (c.textContent + " " + (c.dataset.keywords || "")).toLowerCase();
      var ok = (cat === "all" || c.dataset.category === cat) && words.every(function (w) { return hay.indexOf(w) > -1; });
      c.hidden = !ok; if (ok) { n++; mark(c, words); }
    });
    count.textContent = n; empty.hidden = n > 0;
    page = 1; paginate();
  }
  // แบ่งหน้า: 12 การ์ด/หน้า (3 คอลัมน์ × 4 แถว) · นับเฉพาะการ์ดที่ผ่านตัวกรอง
  var PER = 12, page = 1, pager = document.createElement("nav");
  pager.className = "pj-pager"; pager.setAttribute("aria-label", document.documentElement.lang === "en" ? "Pages" : "หน้า");
  grid.after(pager);
  function paginate() {
    var shown = cards.filter(function (c) { return !c.hidden; }), pages = Math.ceil(shown.length / PER) || 1;
    if (page > pages) page = pages;
    shown.forEach(function (c, i) { c.classList.toggle("pj-off", Math.floor(i / PER) + 1 !== page); });
    var en = document.documentElement.lang === "en", h = "";
    if (pages > 1) {
      h += '<button class="pj-pg pj-pg-nav" data-p="' + (page - 1) + '"' + (page === 1 ? " disabled" : "") + ' aria-label="' + (en ? "Previous" : "ก่อนหน้า") + '">‹</button>';
      for (var i = 1; i <= pages; i++) h += '<button class="pj-pg' + (i === page ? " on" : "") + '" data-p="' + i + '"' + (i === page ? ' aria-current="page"' : "") + ">" + i + "</button>";
      h += '<button class="pj-pg pj-pg-nav" data-p="' + (page + 1) + '"' + (page === pages ? " disabled" : "") + ' aria-label="' + (en ? "Next" : "ถัดไป") + '">›</button>';
    }
    pager.innerHTML = h;
  }
  pager.addEventListener("click", function (e) {
    var b = e.target.closest(".pj-pg"); if (!b || b.disabled) return;
    page = +b.dataset.p; paginate();
    document.querySelector(".pj-bar").scrollIntoView({ behavior: "smooth", block: "start" });
  });
  q.addEventListener("input", apply);
  paginate();
  document.querySelectorAll(".pj-chip").forEach(function (b) {
    b.addEventListener("click", function () {
      document.querySelectorAll(".pj-chip").forEach(function (x) { x.classList.toggle("on", x === b); });
      cat = b.dataset.f; apply();
    });
  });
  document.querySelectorAll(".pj-view").forEach(function (b) {
    b.addEventListener("click", function () {
      document.querySelectorAll(".pj-view").forEach(function (x) { x.classList.toggle("on", x === b); x.setAttribute("aria-pressed", x === b); });
      grid.classList.toggle("is-list", b.dataset.v === "list");
    });
  });
})();
