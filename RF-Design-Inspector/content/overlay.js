// Design Inspector for Claude — Overlay Manager
const OverlayManager = (() => {
  let shadowRoot = null;
  let overlayEl = null;
  let marginBox = null;
  let paddingBox = null;
  let contentBox = null;
  let tooltipEl = null;
  let locked = false;

  function init(root) {
    shadowRoot = root;

    // Overlay container
    overlayEl = document.createElement('div');
    overlayEl.className = 'di-overlay';
    shadowRoot.appendChild(overlayEl);

    // Margin box
    marginBox = document.createElement('div');
    marginBox.className = 'di-margin-box';
    overlayEl.appendChild(marginBox);

    // Padding box
    paddingBox = document.createElement('div');
    paddingBox.className = 'di-padding-box';
    overlayEl.appendChild(paddingBox);

    // Content box
    contentBox = document.createElement('div');
    contentBox.className = 'di-content-box';
    overlayEl.appendChild(contentBox);

    // Tooltip
    tooltipEl = document.createElement('div');
    tooltipEl.className = 'di-tooltip';
    tooltipEl.style.display = 'none';
    shadowRoot.appendChild(tooltipEl);
  }

  function show(el, mouseX, mouseY) {
    if (locked) return;
    renderOverlay(el);
    renderTooltip(el, mouseX, mouseY);
  }

  function hide() {
    if (locked) return;
    overlayEl.style.display = 'none';
    tooltipEl.style.display = 'none';
  }

  function lock(el) {
    locked = true;
    renderOverlay(el);
    tooltipEl.style.display = 'none';
  }

  function unlock() {
    locked = false;
    overlayEl.style.display = 'none';
    tooltipEl.style.display = 'none';
  }

  function renderOverlay(el) {
    const rect = el.getBoundingClientRect();
    const cs = getComputedStyle(el);

    const mt = parseFloat(cs.marginTop) || 0;
    const mr = parseFloat(cs.marginRight) || 0;
    const mb = parseFloat(cs.marginBottom) || 0;
    const ml = parseFloat(cs.marginLeft) || 0;

    const pt = parseFloat(cs.paddingTop) || 0;
    const pr = parseFloat(cs.paddingRight) || 0;
    const pb = parseFloat(cs.paddingBottom) || 0;
    const pl = parseFloat(cs.paddingLeft) || 0;

    const bt = parseFloat(cs.borderTopWidth) || 0;
    const br_ = parseFloat(cs.borderRightWidth) || 0;
    const bb = parseFloat(cs.borderBottomWidth) || 0;
    const bl = parseFloat(cs.borderLeftWidth) || 0;

    // Margin box = element rect + margins
    overlayEl.style.display = 'block';

    // Position margin box
    marginBox.style.cssText = `
      position: fixed;
      top: ${rect.top - mt}px;
      left: ${rect.left - ml}px;
      width: ${rect.width + ml + mr}px;
      height: ${rect.height + mt + mb}px;
      background: rgba(246, 178, 107, 0.25);
      pointer-events: none;
    `;

    // Padding box (inside border)
    paddingBox.style.cssText = `
      position: fixed;
      top: ${rect.top + bt}px;
      left: ${rect.left + bl}px;
      width: ${rect.width - bl - br_}px;
      height: ${rect.height - bt - bb}px;
      background: rgba(147, 196, 125, 0.25);
      pointer-events: none;
    `;

    // Content box (inside padding)
    contentBox.style.cssText = `
      position: fixed;
      top: ${rect.top + bt + pt}px;
      left: ${rect.left + bl + pl}px;
      width: ${rect.width - bl - br_ - pl - pr}px;
      height: ${rect.height - bt - bb - pt - pb}px;
      background: rgba(111, 168, 220, 0.3);
      border: 1px solid rgba(111, 168, 220, 0.7);
      pointer-events: none;
    `;
  }

  function renderTooltip(el, mouseX, mouseY) {
    const rect = el.getBoundingClientRect();
    const cs = getComputedStyle(el);

    // Build tooltip content
    const tag = el.tagName.toLowerCase();
    const id = el.id ? `<span class="di-tooltip-id">#${el.id}</span>` : '';
    const cls = el.classList.length
      ? `<span class="di-tooltip-class">.${Array.from(el.classList).join('.')}</span>`
      : '';

    const w = Math.round(rect.width);
    const h = Math.round(rect.height);

    const fontFamily = cs.fontFamily.split(',')[0].replace(/['"]/g, '').trim();
    const fontSize = cs.fontSize;

    tooltipEl.innerHTML = `
      <div><span class="di-tooltip-tag">&lt;${tag}&gt;</span>${id}${cls}</div>
      <div class="di-tooltip-size">${w} × ${h}</div>
      <div class="di-tooltip-font">${fontSize} / ${fontFamily}</div>
    `;

    // Position tooltip: below cursor, offset right
    let tx = mouseX + 12;
    let ty = mouseY + 16;

    tooltipEl.style.display = 'block';
    tooltipEl.style.left = tx + 'px';
    tooltipEl.style.top = ty + 'px';

    // Keep within viewport
    const tRect = tooltipEl.getBoundingClientRect();
    if (tRect.right > window.innerWidth - 8) {
      tx = mouseX - tRect.width - 12;
      tooltipEl.style.left = tx + 'px';
    }
    if (tRect.bottom > window.innerHeight - 8) {
      ty = mouseY - tRect.height - 16;
      tooltipEl.style.top = ty + 'px';
    }
  }

  return { init, show, hide, lock, unlock };
})();
