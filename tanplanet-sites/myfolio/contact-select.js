// dropdown "หัวข้อ" แบบออกแบบเอง (แทน select ของระบบ) — select เดิมยังอยู่ (ซ่อน) เพื่อส่งฟอร์ม + required
(function () {
  document.querySelectorAll("select.w-select").forEach(function (sel) {
    var wrap = document.createElement("div"); wrap.className = "dd";
    var btn = document.createElement("button"); btn.type = "button"; btn.className = "dd-btn";
    btn.setAttribute("aria-haspopup", "listbox"); btn.setAttribute("aria-expanded", "false");
    var list = document.createElement("ul"); list.className = "dd-list"; list.setAttribute("role", "listbox"); list.hidden = true;
    var id = "dd-" + sel.id; list.id = id; btn.setAttribute("aria-controls", id);
    var lab = document.querySelector('label[for="' + sel.id + '"]'); if (lab) { lab.id = lab.id || id + "-lab"; list.setAttribute("aria-labelledby", lab.id); btn.setAttribute("aria-labelledby", lab.id + " " + id + "-val"); }
    var val = document.createElement("span"); val.id = id + "-val"; val.className = "dd-val"; btn.append(val);
    btn.insertAdjacentHTML("beforeend", '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>');
    var opts = [].slice.call(sel.options).filter(function (o) { return o.value; });
    opts.forEach(function (o, i) {
      var li = document.createElement("li"); li.setAttribute("role", "option"); li.id = id + "-o" + i; li.dataset.v = o.value;
      li.innerHTML = '<span>' + o.textContent + '</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="m5 12 5 5L20 7"/></svg>';
      li.addEventListener("click", function () { pick(i); close(); btn.focus(); });
      list.append(li);
    });
    var items = [].slice.call(list.children), act = -1;
    function render() {
      var o = sel.selectedOptions[0];
      val.textContent = o ? o.textContent : ""; btn.classList.toggle("is-empty", !sel.value);
      items.forEach(function (li) { li.setAttribute("aria-selected", li.dataset.v === sel.value); });
    }
    function pick(i) { sel.value = opts[i].value; sel.dispatchEvent(new Event("change", { bubbles: true })); render(); }
    function move(i) { act = (i + items.length) % items.length; items.forEach(function (li, k) { li.classList.toggle("is-active", k === act); }); list.setAttribute("aria-activedescendant", items[act].id); items[act].scrollIntoView({ block: "nearest" }); }
    function open() { list.hidden = false; btn.setAttribute("aria-expanded", "true"); wrap.classList.add("is-open"); move(Math.max(0, opts.findIndex(function (o) { return o.value === sel.value; }))); }
    function close() { list.hidden = true; btn.setAttribute("aria-expanded", "false"); wrap.classList.remove("is-open"); }
    btn.addEventListener("click", function () { list.hidden ? open() : close(); });
    btn.addEventListener("keydown", function (e) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].indexOf(e.key) > -1) {
        e.preventDefault();
        if (list.hidden) return open();
        if (e.key === "ArrowDown") move(act + 1); else if (e.key === "ArrowUp") move(act - 1); else { pick(act); close(); }
      } else if (e.key === "Escape" || e.key === "Tab") close();
    });
    document.addEventListener("click", function (e) { if (!wrap.contains(e.target)) close(); });
    sel.classList.add("dd-native"); sel.tabIndex = -1; sel.setAttribute("aria-hidden", "true");
    sel.addEventListener("invalid", function () { wrap.classList.add("is-invalid"); btn.focus(); });
    sel.addEventListener("change", function () { wrap.classList.remove("is-invalid"); });
    sel.before(wrap); wrap.append(btn, list, sel); render();
  });
})();
