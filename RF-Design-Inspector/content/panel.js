// Design Inspector for Claude — Detail Panel
const PanelManager = (() => {
  let shadowRoot = null;
  let panelEl = null;

  function init(root) {
    shadowRoot = root;

    // Panel container
    panelEl = document.createElement('div');
    panelEl.className = 'di-panel';
    shadowRoot.appendChild(panelEl);

  }

  function show(data) {
    if (!data) return;
    panelEl.innerHTML = buildPanelHTML(data);
    panelEl.classList.add('visible');
    attachPanelEvents(data);
  }

  function hide() {
    panelEl.classList.remove('visible');
    setTimeout(() => {
      panelEl.innerHTML = '';
    }, 200);
  }

  // Toast is now handled by inspector.js showToast (global pill)
  function showToast(message) {
    // Delegate to inspector's global toast if available
    if (window.__designInspector && window.__designInspector._showToast) {
      window.__designInspector._showToast(message);
    }
  }

  // ─── Build Panel HTML ─────────────────────────────────
  function buildPanelHTML(data) {
    const tagStr = buildTagString(data);
    const boxModel = buildBoxModel(data);
    const stylesHTML = buildStylesTable(data);
    const codeHTML = buildCodeBlock(data.html);
    const parentHTML = buildParentChain(data);

    return `
      <div class="di-panel-header">
        <div class="di-panel-header-tag">${tagStr}</div>
        <button class="di-panel-close" data-action="close">✕</button>
      </div>

      <div class="di-panel-section">
        <div class="di-panel-section-title">Box Model</div>
        ${boxModel}
      </div>

      <div class="di-panel-section">
        <div class="di-panel-section-title">Layout</div>
        ${buildCategoryTable(data, 'layout')}
      </div>

      <div class="di-panel-section">
        <div class="di-panel-section-title">Spacing</div>
        ${buildCategoryTable(data, 'spacing')}
      </div>

      <div class="di-panel-section">
        <div class="di-panel-section-title">Typography</div>
        ${buildCategoryTable(data, 'typography')}
      </div>

      <div class="di-panel-section">
        <div class="di-panel-section-title">Visual</div>
        ${buildCategoryTable(data, 'visual')}
      </div>

      <div class="di-panel-section">
        <div class="di-panel-section-title">Parent Structure</div>
        ${parentHTML}
      </div>

      <div class="di-panel-section">
        <div class="di-panel-section-title">HTML</div>
        <div class="di-code-block">${codeHTML}</div>
      </div>

      <div class="di-panel-actions">
        <button class="di-btn di-btn-primary" data-action="copy-markdown">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
          Copy for Claude
        </button>
      </div>
    `;
  }

  // ─── Tag String ───────────────────────────────────────
  function buildTagString(data) {
    let str = `&lt;${data.tag}`;
    if (data.id) str += `<span class="id">#${data.id}</span>`;
    if (data.classes.length) str += `<span class="cls">.${data.classes.join('.')}</span>`;
    str += '&gt;';
    return str;
  }

  // ─── Box Model Diagram ────────────────────────────────
  function buildBoxModel(data) {
    const s = data.styles;
    const mt = shortPx(s.marginTop);
    const mr = shortPx(s.marginRight);
    const mb = shortPx(s.marginBottom);
    const ml = shortPx(s.marginLeft);
    const pt = shortPx(s.paddingTop);
    const pr = shortPx(s.paddingRight);
    const pb = shortPx(s.paddingBottom);
    const pl = shortPx(s.paddingLeft);
    const w = data.rect.width;
    const h = data.rect.height;

    return `
      <div class="di-box-model">
        <div class="di-box-margin">
          <span class="di-box-label">margin</span>
          <div class="di-box-values-v" style="margin-bottom:4px">${mt}</div>
          <div style="display:flex; align-items:center; width:100%; gap:4px;">
            <div style="text-align:center; min-width:28px">${ml}</div>
            <div class="di-box-border" style="flex:1">
              <span class="di-box-label">border</span>
              <div class="di-box-padding">
                <span class="di-box-label">padding</span>
                <div class="di-box-values-v" style="margin-bottom:2px">${pt}</div>
                <div style="display:flex; align-items:center; width:100%; gap:4px;">
                  <div style="min-width:24px; text-align:center">${pl}</div>
                  <div class="di-box-content" style="flex:1">${w} × ${h}</div>
                  <div style="min-width:24px; text-align:center">${pr}</div>
                </div>
                <div class="di-box-values-v" style="margin-top:2px">${pb}</div>
              </div>
            </div>
            <div style="text-align:center; min-width:28px">${mr}</div>
          </div>
          <div class="di-box-values-v" style="margin-top:4px">${mb}</div>
        </div>
      </div>
    `;
  }

  function shortPx(val) {
    const n = parseFloat(val);
    if (isNaN(n) || n === 0) return '0';
    return Math.round(n) + '';
  }

  // ─── Styles Table by Category ─────────────────────────
  const categories = {
    layout: ['display', 'position', 'width', 'height', 'minWidth', 'maxWidth', 'flexDirection', 'alignItems', 'justifyContent', 'gap', 'overflow'],
    spacing: ['padding', 'margin'],
    typography: ['fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'textAlign', 'color'],
    visual: ['backgroundColor', 'border', 'borderRadius', 'boxShadow', 'opacity', 'zIndex'],
  };

  function buildCategoryTable(data, category) {
    const props = categories[category];
    let rows = '';

    for (const prop of props) {
      const val = data.styles[prop];
      if (!val || val === 'none' || val === 'normal' || val === 'auto' || val === '0px' || val === 'static' || val === 'visible') {
        // Skip default/uninteresting values
        if (category !== 'layout' || (prop !== 'display' && prop !== 'position')) continue;
      }

      const displayProp = camelToDash(prop);
      const displayVal = formatValue(prop, val);
      const tokenName = data.cssVariables[displayProp] || '';
      const tokenCell = tokenName ? `<td class="token">${tokenName}</td>` : '<td></td>';

      rows += `<tr><td class="prop">${displayProp}</td><td class="val">${displayVal}</td>${tokenCell}</tr>`;
    }

    if (!rows) rows = '<tr><td class="prop" colspan="3" style="color:#585b70">—</td></tr>';
    return `<table class="di-styles-table">${rows}</table>`;
  }

  function camelToDash(str) {
    return str.replace(/([A-Z])/g, '-$1').toLowerCase();
  }

  function formatValue(prop, val) {
    // Add color swatch for color properties
    if (prop === 'color' || prop === 'backgroundColor') {
      const hex = rgbToHex(val);
      if (hex) {
        return `<span class="di-color-swatch" style="background:${val}"></span>${hex}`;
      }
    }
    // Clean up font-family
    if (prop === 'fontFamily') {
      return val.replace(/"/g, '').split(',').slice(0, 2).join(', ');
    }
    return escapeHtml(val);
  }

  // ─── Code Block ───────────────────────────────────────
  function buildCodeBlock(html) {
    let escaped = escapeHtml(html);
    // Basic syntax highlighting
    escaped = escaped
      .replace(/(&lt;\/?)([\w-]+)/g, '$1<span class="tag">$2</span>')
      .replace(/\s([\w-]+)=/g, ' <span class="attr">$1</span>=')
      .replace(/="([^"]*)"/g, '="<span class="val">$1</span>"')
      .replace(/(&lt;!--.*?--&gt;)/g, '<span class="comment">$1</span>');
    return escaped;
  }

  // ─── Parent Chain ─────────────────────────────────────
  function buildParentChain(data) {
    const parts = [];
    // Reverse to show from root to current
    const chain = [...data.parentChain].reverse();
    for (const p of chain) {
      let sel = p.tag;
      if (p.id) sel += `#${p.id}`;
      else if (p.classes.length) sel += `.${p.classes[0]}`;
      parts.push(sel);
    }
    // Current element
    let current = data.tag;
    if (data.id) current += `#${data.id}`;
    else if (data.classes.length) current += `.${data.classes[0]}`;

    const arrows = parts.map(p => `<span>${p}</span>`).join('<span class="arrow"> › </span>');
    return `<div class="di-parent-chain">${arrows}<span class="arrow"> › </span><span class="current">${current}</span></div>`;
  }

  // ─── Panel Events ─────────────────────────────────────
  function attachPanelEvents(data) {
    panelEl.querySelector('[data-action="close"]').addEventListener('click', () => {
      window.__designInspector.deselect();
    });

    panelEl.querySelector('[data-action="copy-markdown"]').addEventListener('click', async () => {
      const inspector = window.__designInspector;
      const sections = inspector ? inspector.getState().copySections : ['element', 'styles', 'html'];
      const md = MarkdownGenerator.generate(data, sections);
      try {
        const result = await chrome.runtime.sendMessage({ type: 'COPY_TEXT', text: md });
        showToast(result?.success ? '✓ Copied to clipboard' : '⚠ Copy failed');
      } catch (e) {
        showToast('⚠ Copy failed');
      }
    });

  }

  // ─── Utilities ────────────────────────────────────────
  function rgbToHex(rgb) {
    const match = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (!match) return null;
    const r = parseInt(match[1]);
    const g = parseInt(match[2]);
    const b = parseInt(match[3]);
    return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase();
  }

  function escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  return { init, show, hide, showToast };
})();
