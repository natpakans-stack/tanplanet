chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'OFFSCREEN_COPY_TEXT') {
    const ta = document.getElementById('c');
    ta.value = msg.text;
    ta.select();
    try {
      document.execCommand('copy');
      sendResponse({ success: true });
    } catch (e) {
      sendResponse({ success: false, error: e.message });
    }
  }
});
