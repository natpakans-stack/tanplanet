// RF Design Inspector — Background Service Worker

// ─── Offscreen document for clipboard ────────────────
let offscreenCreating = null;

async function ensureOffscreen() {
  if (await chrome.offscreen.hasDocument()) return;
  if (offscreenCreating) { await offscreenCreating; return; }
  offscreenCreating = chrome.offscreen.createDocument({
    url: 'offscreen.html',
    reasons: ['CLIPBOARD'],
    justification: 'Copy element data to clipboard',
  });
  await offscreenCreating;
  offscreenCreating = null;
}

// ─── Inject content scripts on demand ────────────────
async function ensureContentScripts(tabId) {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => !!window.__designInspectorLoaded,
    });
    if (results && results[0] && results[0].result) return; // already injected
  } catch (e) {
    // Tab may not be scriptable — proceed anyway
  }

  await chrome.scripting.executeScript({
    target: { tabId },
    files: [
      'content/overlay.js',
      'content/panel.js',
      'content/markdown-generator.js',
      'content/inspector.js',
    ],
  });
}

// ─── Message handler ─────────────────────────────────
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

  if (message.type === 'COPY_TEXT') {
    (async () => {
      try {
        await ensureOffscreen();
        const result = await chrome.runtime.sendMessage({
          type: 'OFFSCREEN_COPY_TEXT',
          text: message.text,
        });
        sendResponse(result);
      } catch (e) {
        sendResponse({ success: false, error: e.message });
      }
    })();
    return true;
  }

  if (message.type === 'TOGGLE_FROM_POPUP') {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      if (!tabs[0]) return;
      try {
        await ensureContentScripts(tabs[0].id);
        chrome.tabs.sendMessage(tabs[0].id, { type: 'TOGGLE_INSPECTOR' }, (response) => {
          sendResponse(response);
        });
      } catch (e) {
        sendResponse({ active: false, error: e.message });
      }
    });
    return true;
  }
});
