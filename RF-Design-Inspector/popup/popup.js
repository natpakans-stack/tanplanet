const toggleBtn = document.getElementById('toggleBtn');
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const copyModeOptions = document.getElementById('copyModeOptions');

function updateUI(isActive) {
  statusDot.classList.toggle('active', isActive);
  statusText.textContent = isActive ? 'Active' : 'Inactive';
  toggleBtn.textContent = isActive ? 'Disable' : 'Enable';
  toggleBtn.classList.toggle('active', isActive);
}

toggleBtn.addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'TOGGLE_FROM_POPUP' }, (response) => {
    if (response && typeof response.active === 'boolean') {
      updateUI(response.active);
    }
  });
});

// ─── Copy Sections (multi-select checkboxes) ─────
function getSelectedSections() {
  const checked = copyModeOptions.querySelectorAll('input[name="copySections"]:checked');
  return Array.from(checked).map(cb => cb.value);
}

// Load saved sections on popup open
chrome.storage.local.get('copySections', (result) => {
  // Filter out 'html' from old saved values (option removed)
  const sections = (result.copySections || []).filter(s => s !== 'html');
  copyModeOptions.querySelectorAll('input[name="copySections"]').forEach(cb => {
    cb.checked = sections.includes(cb.value);
  });
});

// Save and broadcast on change
copyModeOptions.addEventListener('change', (e) => {
  const sections = getSelectedSections();
  chrome.storage.local.set({ copySections: sections });

  // Send to active tab's content script
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, { type: 'SET_COPY_SECTIONS', sections });
    }
  });
});

// Check current state on popup open
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  if (tabs[0]) {
    chrome.tabs.sendMessage(tabs[0].id, { type: 'GET_STATE' }, (response) => {
      if (chrome.runtime.lastError) return;
      if (response && typeof response.active === 'boolean') {
        updateUI(response.active);
      }
    });
  }
});
