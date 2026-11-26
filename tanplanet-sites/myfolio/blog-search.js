// ค้นหาบทความในหน้าบล็อก/หมวด: กรองการ์ด · ไฮไลต์คำในหัวข้อ/คำโปรย · หน้าว่างเมื่อไม่พบ
(function () {
  var q = document.getElementById("bs-q"); if (!q) return;
  var items = [].slice.call(document.querySelectorAll(".blog-right .blog-posts-grid > .w-dyn-item"));
  var empty = document.querySelector(".bs-empty");
  items.forEach(function (it) { it.querySelectorAll("h3, p").forEach(function (el) { el.dataset.raw = el.innerHTML; }); });
  function esc(w) { return w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
  q.addEventListener("input", function () {
    var words = q.value.trim().toLowerCase().split(/\s+/).filter(Boolean), n = 0;
    var re = words.length ? new RegExp("(" + words.map(esc).join("|") + ")", "gi") : null;
    items.forEach(function (it) {
      var ok = words.every(function (w) { return it.textContent.toLowerCase().indexOf(w) > -1; });
      it.hidden = !ok; if (ok) n++;
      it.querySelectorAll("h3, p").forEach(function (el) {
        el.innerHTML = el.dataset.raw;
        if (!re || !ok) return;
        var w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT), ns = [], t;
        while ((t = w.nextNode())) ns.push(t);
        ns.forEach(function (t) {
          re.lastIndex = 0; if (!re.test(t.nodeValue)) return; re.lastIndex = 0;
          var span = document.createElement("span");
          span.innerHTML = t.nodeValue.replace(/[&<>]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]; }).replace(re, "<mark>$1</mark>");
          t.replaceWith.apply(t, [].slice.call(span.childNodes));
        });
      });
    });
    if (empty) empty.hidden = n > 0 || !items.length;
  });
})();
