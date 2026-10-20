// เติมมาสคอตครึ่งหน้า + ลิงก์กลับหน้ารวมให้ทุก .closing (ถ้าหน้าไหนใส่เองแล้วจะไม่ซ้ำ)
document.querySelectorAll('.closing').forEach(function (el) {
  if (!el.querySelector('.mascot-half')) {
    el.insertAdjacentHTML('afterbegin', '<div class="mascot-half"><img src="https://natpakans-stack.github.io/talk-to-figma-mcp/assets/aw-mascot.avif" alt="" width="180" height="180"></div>');
  }
  var hasBack = [].some.call(el.querySelectorAll('a'), function (a) { return /^(\/|https:\/\/projects\.tanplanet\.(work|info)\/?)$/.test(a.getAttribute('href')); });
  if (!hasBack) {
    var links = el.querySelector('.links') || el.appendChild(Object.assign(document.createElement('div'), { className: 'links' }));
    links.insertAdjacentHTML('beforeend', '<a href="https://projects.tanplanet.work/">&#8592; กลับหน้ารวมโปรเจกต์</a>');
  }
});
