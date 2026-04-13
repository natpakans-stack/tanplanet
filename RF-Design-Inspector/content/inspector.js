// Design Inspector for Claude — Core Controller
(() => {
  // Prevent double-injection
  if (window.__designInspectorLoaded) return;
  window.__designInspectorLoaded = true;

  // ─── State ──────────────────────────────────────────────
  const state = {
    active: false,
    hoveredElement: null,
    selectedElement: null,
    copySections: [],
  };

  // ─── Shadow DOM Host ────────────────────────────────────
  let shadowHost = null;
  let shadowRoot = null;

  function createShadowHost() {
    if (shadowHost) return;
    shadowHost = document.createElement('div');
    shadowHost.id = 'design-inspector-root';
    shadowHost.style.cssText = 'all:initial; position:fixed; top:0; left:0; width:0; height:0; z-index:2147483647; pointer-events:none;';
    document.documentElement.appendChild(shadowHost);
    shadowRoot = shadowHost.attachShadow({ mode: 'open' });

    // Inject styles into shadow DOM
    const style = document.createElement('style');
    style.textContent = getInspectorStyles();
    shadowRoot.appendChild(style);

    // Init overlay & panel containers
    window.__diShadowRoot = shadowRoot;
    OverlayManager.init(shadowRoot);
    PanelManager.init(shadowRoot);
  }

  function destroyShadowHost() {
    if (shadowHost) {
      shadowHost.remove();
      shadowHost = null;
      shadowRoot = null;
      window.__diShadowRoot = null;
    }
  }

  // ─── Extract Element Data ───────────────────────────────
  function extractElementData(el) {
    if (!el) return null;

    const cs = getComputedStyle(el);
    const rect = el.getBoundingClientRect();

    // Detect CSS variables used on this element
    const cssVariables = detectCSSVariables(el);

    // Build parent chain (up to 4 levels)
    const parentChain = [];
    let parent = el.parentElement;
    let depth = 0;
    while (parent && depth < 4 && parent !== document.documentElement) {
      parentChain.push({
        tag: parent.tagName.toLowerCase(),
        id: parent.id || '',
        classes: Array.from(parent.classList),
      });
      parent = parent.parentElement;
      depth++;
    }

    // Get outer HTML (truncated)
    let html = el.outerHTML;
    if (html.length > 2000) {
      const inner = el.innerHTML;
      if (inner.length > 1500) {
        html = el.outerHTML.replace(inner, inner.substring(0, 1500) + '\n  <!-- ... truncated -->\n');
      }
    }

    return {
      tag: el.tagName.toLowerCase(),
      id: el.id || '',
      classes: Array.from(el.classList),
      rect: {
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      },
      styles: {
        // Layout
        display: cs.display,
        position: cs.position,
        width: cs.width,
        height: cs.height,
        minWidth: cs.minWidth,
        maxWidth: cs.maxWidth,
        flexDirection: cs.flexDirection,
        alignItems: cs.alignItems,
        justifyContent: cs.justifyContent,
        gap: cs.gap,
        overflow: cs.overflow,
        // Spacing
        padding: cs.padding,
        paddingTop: cs.paddingTop,
        paddingRight: cs.paddingRight,
        paddingBottom: cs.paddingBottom,
        paddingLeft: cs.paddingLeft,
        margin: cs.margin,
        marginTop: cs.marginTop,
        marginRight: cs.marginRight,
        marginBottom: cs.marginBottom,
        marginLeft: cs.marginLeft,
        // Typography
        fontFamily: cs.fontFamily,
        fontSize: cs.fontSize,
        fontWeight: cs.fontWeight,
        lineHeight: cs.lineHeight,
        letterSpacing: cs.letterSpacing,
        textAlign: cs.textAlign,
        color: cs.color,
        // Visual
        backgroundColor: cs.backgroundColor,
        border: cs.border,
        borderRadius: cs.borderRadius,
        boxShadow: cs.boxShadow,
        opacity: cs.opacity,
        // Z
        zIndex: cs.zIndex,
      },
      html,
      parentChain,
      cssVariables,
      pageUrl: window.location.href,
      pageTitle: document.title,
    };
  }

  // ─── CSS Variable Detection ─────────────────────────────
  function detectCSSVariables(el) {
    const variables = {};
    try {
      const sheets = Array.from(document.styleSheets).slice(0, 30);
      for (const sheet of sheets) {
        let rules;
        try {
          rules = sheet.cssRules || sheet.rules;
        } catch (e) {
          continue; // Cross-origin stylesheet
        }
        if (!rules) continue;
        for (const rule of rules) {
          if (rule.type !== 1) continue; // CSSStyleRule only
          try {
            if (!el.matches(rule.selectorText)) continue;
          } catch (e) {
            continue;
          }
          for (let i = 0; i < rule.style.length; i++) {
            const prop = rule.style[i];
            const val = rule.style.getPropertyValue(prop);
            if (val.includes('var(')) {
              const match = val.match(/var\((--[^,)]+)/);
              if (match) {
                variables[prop] = match[1];
              }
            }
          }
        }
      }
    } catch (e) {
      // Silently fail
    }
    return variables;
  }

  // ─── Event Handlers ─────────────────────────────────────
  let rafId = null;

  function onMouseMove(e) {
    if (state.selectedElement) return; // Panel is open, don't change hover

    const target = getInspectableTarget(e);
    if (target === state.hoveredElement) return;

    state.hoveredElement = target;

    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(() => {
      if (target) {
        OverlayManager.show(target, e.clientX, e.clientY);
      } else {
        OverlayManager.hide();
      }
    });
  }

  function onClick(e) {
    if (!state.active) return;

    const target = getInspectableTarget(e);
    if (!target) return;

    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    state.selectedElement = target;
    state.hoveredElement = null;

    OverlayManager.lock(target);
    const data = extractElementData(target);  // extract BEFORE flash
    flashElement(target);
    PanelManager.show(data);

    // Auto copy: Markdown + Screenshot to clipboard on click
    autoCopyToClipboard(data);
  }

  async function autoCopyToClipboard(data) {
    const markdown = MarkdownGenerator.generate(data, state.copySections);

    showToast('◌ Copying...');
    try {
      const result = await chrome.runtime.sendMessage({
        type: 'COPY_TEXT',
        text: markdown,
      });
      if (!result?.success) throw new Error(result?.error || 'copy failed');
      showToast('✓ Copied to clipboard');
    } catch (e) {
      console.error('[Design Inspector] Copy failed:', e);
      showToast('⚠ Copy failed');
    }
  }

  // ─── Flash feedback on element ────────────────────────
  function flashElement(el) {
    const prev = el.style.outline;
    const prevTransition = el.style.transition;
    el.style.transition = 'outline 0.15s ease-out';
    el.style.outline = '3px solid #7aa2f7';
    setTimeout(() => {
      el.style.outline = '3px solid transparent';
      setTimeout(() => {
        el.style.outline = prev;
        el.style.transition = prevTransition;
      }, 150);
    }, 300);
  }

  // ─── Toast pill (works with or without panel) ──────────
  let toastTimer = null;
  function showToast(message) {
    if (!shadowRoot) return;

    let toast = shadowRoot.querySelector('.di-toast-global');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'di-toast di-toast-global';
      shadowRoot.appendChild(toast);
    }

    // Determine icon type from message
    let iconClass = 'success';
    let iconSymbol = '✓';
    if (message.includes('⚠')) {
      iconClass = 'warning';
      iconSymbol = '!';
    } else if (message.includes('capturing') || message.includes('...')) {
      iconClass = 'loading';
      iconSymbol = '◌';
    }

    // Strip emoji from message text (we use icon instead)
    const cleanMsg = message.replace(/^[✓⚠]\s*/, '');

    toast.innerHTML = `<span class="di-toast-icon ${iconClass}">${iconSymbol}</span><span>${cleanMsg}</span>`;

    // Reset animation
    toast.classList.remove('show');
    void toast.offsetWidth; // force reflow
    toast.classList.add('show');

    // Auto hide
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2200);
  }

  function onKeyDown(e) {
    if (e.key === 'Escape') {
      if (state.selectedElement) {
        deselect();
      } else if (state.active) {
        deactivate();
      }
    }

    // ⌘+C or Ctrl+C — copy hovered/selected element
    if ((e.metaKey || e.ctrlKey) && e.key === 'c') {
      const target = state.selectedElement || state.hoveredElement;
      if (target) {
        e.preventDefault();
        e.stopPropagation();
        const data = extractElementData(target);  // extract BEFORE flash
        flashElement(target);
        autoCopyToClipboard(data);
      }
    }
  }

  function getInspectableTarget(e) {
    const target = e.composedPath ? e.composedPath()[0] : e.target;
    // Don't inspect our own UI
    if (shadowHost && shadowHost.contains(target)) return null;
    if (target === document.documentElement || target === document.body) return null;
    return target;
  }

  // ─── Activate / Deactivate ──────────────────────────────
  function activate() {
    if (state.active) return;
    state.active = true;
    // Sync copy sections from storage
    chrome.storage.local.get('copySections', (result) => {
      state.copySections = result.copySections || [];
    });
    createShadowHost();
    document.addEventListener('mousemove', onMouseMove, true);
    document.addEventListener('click', onClick, true);
    document.addEventListener('keydown', onKeyDown, true);
    document.body.style.cursor = 'crosshair';
  }

  function deactivate() {
    state.active = false;
    state.hoveredElement = null;
    state.selectedElement = null;
    document.removeEventListener('mousemove', onMouseMove, true);
    document.removeEventListener('click', onClick, true);
    document.removeEventListener('keydown', onKeyDown, true);
    document.body.style.cursor = '';
    OverlayManager.hide();
    PanelManager.hide();
    destroyShadowHost();
  }

  function deselect() {
    state.selectedElement = null;
    OverlayManager.unlock();
    PanelManager.hide();
  }

  function toggle() {
    if (state.active) {
      deactivate();
    } else {
      activate();
    }
    return state.active;
  }

  // ─── Message Listener ───────────────────────────────────
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'TOGGLE_INSPECTOR') {
      const isActive = toggle();
      sendResponse({ active: isActive });
    }
    if (message.type === 'GET_STATE') {
      sendResponse({ active: state.active });
    }
    if (message.type === 'SET_COPY_SECTIONS') {
      state.copySections = message.sections;
    }
  });

  // ─── Expose for Panel actions ───────────────────────────
  window.__designInspector = {
    getSelectedData: () => state.selectedElement ? extractElementData(state.selectedElement) : null,
    deselect,
    getState: () => state,
    _showToast: showToast,
  };

  // ─── Inline Styles (Shadow DOM) ─────────────────────────
  function getInspectorStyles() {
    return `
      /* ─── Overlay ─────────────────────────── */
      .di-overlay {
        position: fixed;
        pointer-events: none;
        z-index: 999999;
        transition: all 0.05s ease-out;
      }

      .di-margin-box {
        position: absolute;
        background: rgba(246, 178, 107, 0.35);
      }

      .di-padding-box {
        position: absolute;
        background: rgba(147, 196, 125, 0.4);
      }

      .di-content-box {
        position: absolute;
        background: rgba(111, 168, 220, 0.35);
        border: 1px solid rgba(111, 168, 220, 0.8);
      }

      /* ─── Tooltip ─────────────────────────── */
      .di-tooltip {
        position: fixed;
        pointer-events: none;
        background: #1e1e2e;
        border: 1px solid #313244;
        border-radius: 6px;
        padding: 6px 10px;
        font-family: ui-monospace, 'SF Mono', Monaco, 'Cascadia Code', monospace;
        font-size: 11px;
        line-height: 1.5;
        color: #cdd6f4;
        white-space: nowrap;
        z-index: 999999;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      }

      .di-tooltip-tag {
        color: #89b4fa;
        font-weight: 600;
      }

      .di-tooltip-id {
        color: #f9e2af;
      }

      .di-tooltip-class {
        color: #a6e3a1;
      }

      .di-tooltip-size {
        color: #cdd6f4;
        margin-top: 2px;
      }

      .di-tooltip-font {
        color: #a6adc8;
      }

      /* ─── Panel ───────────────────────────── */
      .di-panel {
        position: fixed;
        top: 0;
        right: 0;
        width: 380px;
        height: 100vh;
        background: #1e1e2e;
        border-left: 1px solid #313244;
        overflow-y: auto;
        pointer-events: auto;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
        font-size: 12px;
        color: #cdd6f4;
        z-index: 999999;
        transform: translateX(100%);
        transition: transform 0.2s ease-out;
        box-shadow: -4px 0 20px rgba(0,0,0,0.3);
      }

      .di-panel.visible {
        transform: translateX(0);
      }

      @media (prefers-reduced-motion: reduce) {
        .di-panel {
          transition: none;
        }
      }

      .di-panel-header {
        position: sticky;
        top: 0;
        background: #181825;
        padding: 12px 16px;
        border-bottom: 1px solid #313244;
        display: flex;
        align-items: center;
        justify-content: space-between;
        z-index: 1;
      }

      .di-panel-header-tag {
        font-family: ui-monospace, 'SF Mono', Monaco, monospace;
        font-size: 13px;
        font-weight: 600;
        color: #89b4fa;
      }

      .di-panel-header-tag .id { color: #f9e2af; }
      .di-panel-header-tag .cls { color: #a6e3a1; font-weight: 400; }

      .di-panel-close {
        width: 28px;
        height: 28px;
        border: none;
        background: transparent;
        color: #6c7086;
        font-size: 18px;
        cursor: pointer;
        border-radius: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
        pointer-events: auto;
      }

      .di-panel-close:hover {
        background: #313244;
        color: #cdd6f4;
      }

      .di-panel-section {
        padding: 12px 16px;
        border-bottom: 1px solid #313244;
      }

      .di-panel-section-title {
        font-size: 10px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        color: #6c7086;
        margin-bottom: 8px;
      }

      /* ─── Box Model Diagram ───────────────── */
      .di-box-model {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0;
        font-family: ui-monospace, 'SF Mono', Monaco, monospace;
        font-size: 10px;
      }

      .di-box-margin {
        background: rgba(246, 178, 107, 0.15);
        border: 1px dashed rgba(246, 178, 107, 0.5);
        padding: 8px;
        display: flex;
        flex-direction: column;
        align-items: center;
        width: 100%;
        position: relative;
      }

      .di-box-margin .di-box-label {
        position: absolute;
        top: 2px;
        left: 4px;
        color: rgba(246, 178, 107, 0.7);
        font-size: 9px;
      }

      .di-box-border {
        background: rgba(255, 229, 153, 0.1);
        border: 1px solid rgba(255, 229, 153, 0.5);
        padding: 8px;
        display: flex;
        flex-direction: column;
        align-items: center;
        width: 100%;
        position: relative;
      }

      .di-box-border .di-box-label {
        position: absolute;
        top: 2px;
        left: 4px;
        color: rgba(255, 229, 153, 0.7);
        font-size: 9px;
      }

      .di-box-padding {
        background: rgba(147, 196, 125, 0.15);
        border: 1px dashed rgba(147, 196, 125, 0.5);
        padding: 8px;
        display: flex;
        flex-direction: column;
        align-items: center;
        width: 100%;
        position: relative;
      }

      .di-box-padding .di-box-label {
        position: absolute;
        top: 2px;
        left: 4px;
        color: rgba(147, 196, 125, 0.7);
        font-size: 9px;
      }

      .di-box-content {
        background: rgba(111, 168, 220, 0.2);
        border: 1px solid rgba(111, 168, 220, 0.6);
        padding: 8px 16px;
        text-align: center;
        color: #89b4fa;
        font-weight: 600;
        font-size: 11px;
      }

      .di-box-values {
        display: flex;
        justify-content: space-between;
        width: 100%;
        color: #a6adc8;
      }

      .di-box-values-v {
        display: flex;
        flex-direction: column;
        align-items: center;
        width: 100%;
        color: #a6adc8;
      }

      /* ─── Styles Table ────────────────────── */
      .di-styles-table {
        width: 100%;
        border-collapse: collapse;
      }

      .di-styles-table tr:hover {
        background: rgba(255,255,255,0.03);
      }

      .di-styles-table td {
        padding: 3px 0;
        vertical-align: top;
      }

      .di-styles-table .prop {
        color: #cba6f7;
        font-family: ui-monospace, 'SF Mono', Monaco, monospace;
        font-size: 11px;
        width: 120px;
        white-space: nowrap;
      }

      .di-styles-table .val {
        color: #cdd6f4;
        font-family: ui-monospace, 'SF Mono', Monaco, monospace;
        font-size: 11px;
        word-break: break-all;
      }

      .di-styles-table .token {
        color: #f9e2af;
        font-family: ui-monospace, 'SF Mono', Monaco, monospace;
        font-size: 10px;
        opacity: 0.7;
      }

      /* Color swatch */
      .di-color-swatch {
        display: inline-block;
        width: 10px;
        height: 10px;
        border-radius: 2px;
        border: 1px solid rgba(255,255,255,0.2);
        margin-right: 4px;
        vertical-align: middle;
      }

      /* ─── Code Block ──────────────────────── */
      .di-code-block {
        background: #11111b;
        border-radius: 6px;
        padding: 10px 12px;
        font-family: ui-monospace, 'SF Mono', Monaco, monospace;
        font-size: 11px;
        line-height: 1.6;
        color: #cdd6f4;
        overflow-x: auto;
        white-space: pre;
        max-height: 200px;
        overflow-y: auto;
      }

      .di-code-block .tag { color: #89b4fa; }
      .di-code-block .attr { color: #a6e3a1; }
      .di-code-block .val { color: #f9e2af; }
      .di-code-block .comment { color: #585b70; font-style: italic; }

      /* ─── Parent Chain ────────────────────── */
      .di-parent-chain {
        font-family: ui-monospace, 'SF Mono', Monaco, monospace;
        font-size: 11px;
        line-height: 1.8;
        color: #a6adc8;
      }

      .di-parent-chain .current {
        color: #89b4fa;
        font-weight: 600;
      }

      .di-parent-chain .arrow {
        color: #585b70;
        margin: 0 4px;
      }

      /* ─── Action Buttons ──────────────────── */
      .di-panel-actions {
        position: sticky;
        bottom: 0;
        background: #181825;
        padding: 12px 16px;
        border-top: 1px solid #313244;
        display: flex;
        gap: 8px;
        z-index: 1;
      }

      .di-btn {
        flex: 1;
        padding: 8px 12px;
        border: none;
        border-radius: 6px;
        font-size: 11px;
        font-weight: 600;
        cursor: pointer;
        pointer-events: auto;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 4px;
        transition: background 0.15s, transform 0.1s;
      }

      .di-btn:active {
        transform: scale(0.97);
      }

      .di-btn-primary {
        background: #7aa2f7;
        color: #1e1e2e;
      }

      .di-btn-primary:hover {
        background: #89b4fa;
      }

      .di-btn-secondary {
        background: #313244;
        color: #cdd6f4;
      }

      .di-btn-secondary:hover {
        background: #45475a;
      }

      /* ─── Toast Pill ─────────────────────── */
      .di-toast {
        position: fixed;
        bottom: 32px;
        left: 50%;
        transform: translateX(-50%) translateY(12px) scale(0.95);
        background: #1e1e2e;
        border: 1px solid #313244;
        color: #cdd6f4;
        padding: 10px 20px;
        border-radius: 999px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
        font-size: 13px;
        font-weight: 600;
        letter-spacing: -0.01em;
        pointer-events: none;
        opacity: 0;
        transition: opacity 0.2s ease-out, transform 0.2s ease-out;
        box-shadow: 0 8px 32px rgba(0,0,0,0.35), 0 2px 8px rgba(0,0,0,0.2);
        z-index: 999999;
        display: flex;
        align-items: center;
        gap: 8px;
        white-space: nowrap;
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
      }

      .di-toast .di-toast-icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 20px;
        height: 20px;
        border-radius: 50%;
        font-size: 11px;
        flex-shrink: 0;
      }

      .di-toast .di-toast-icon.success {
        background: rgba(166, 227, 161, 0.15);
        color: #a6e3a1;
      }

      .di-toast .di-toast-icon.warning {
        background: rgba(249, 226, 175, 0.15);
        color: #f9e2af;
      }

      .di-toast .di-toast-icon.loading {
        background: rgba(122, 162, 247, 0.15);
        color: #7aa2f7;
        animation: di-spin 0.8s linear infinite;
      }

      @keyframes di-spin {
        to { transform: rotate(360deg); }
      }

      .di-toast.show {
        opacity: 1;
        transform: translateX(-50%) translateY(0) scale(1);
      }

      @media (prefers-reduced-motion: reduce) {
        .di-toast {
          transition: opacity 0.1s;
        }
      }

      /* ─── Scrollbar ───────────────────────── */
      .di-panel::-webkit-scrollbar {
        width: 6px;
      }
      .di-panel::-webkit-scrollbar-track {
        background: transparent;
      }
      .di-panel::-webkit-scrollbar-thumb {
        background: #313244;
        border-radius: 3px;
      }
      .di-panel::-webkit-scrollbar-thumb:hover {
        background: #45475a;
      }
    `;
  }
})();
