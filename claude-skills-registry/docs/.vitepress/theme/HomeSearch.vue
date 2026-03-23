<script setup>
import { ref } from 'vue'

function openSearch() {
  // Trigger VitePress local search modal
  const btn = document.querySelector('.VPNavBarSearchButton') ||
              document.querySelector('[aria-label="Search"]') ||
              document.querySelector('.DocSearch-Button')
  if (btn) {
    btn.click()
  } else {
    // Fallback: dispatch keyboard shortcut Ctrl+K / Cmd+K
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))
  }
}
</script>

<template>
  <div class="home-search" @click="openSearch">
    <div class="search-box">
      <svg class="search-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="11" cy="11" r="8"/>
        <line x1="21" y1="21" x2="16.65" y2="16.65"/>
      </svg>
      <span class="search-placeholder">ค้นหา skill, plugin, MCP Server...</span>
      <span class="search-shortcut">
        <kbd>⌘</kbd><kbd>K</kbd>
      </span>
    </div>
  </div>
</template>

<style scoped>
.home-search {
  max-width: 560px;
  margin: 28px 0 8px;
  cursor: pointer;
}

.search-box {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 20px;
  background: var(--vp-c-bg);
  border: 2px solid var(--vp-c-divider);
  border-radius: 12px;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.search-box:hover {
  border-color: var(--vp-c-brand-1);
  box-shadow: 0 4px 16px rgba(217, 119, 87, 0.12);
}

.search-icon {
  flex-shrink: 0;
  color: var(--vp-c-text-3);
}

.search-placeholder {
  flex: 1;
  font-size: 1rem;
  color: var(--vp-c-text-3);
  user-select: none;
}

.search-shortcut {
  display: flex;
  gap: 4px;
}

.search-shortcut kbd {
  display: inline-block;
  padding: 2px 8px;
  font-size: 0.75rem;
  font-family: var(--vp-font-family-mono);
  color: var(--vp-c-text-3);
  background: var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-divider);
  border-radius: 4px;
  line-height: 1.4;
}

@media (max-width: 640px) {
  .home-search {
    margin: 20px 16px 4px;
  }
  .search-shortcut {
    display: none;
  }
  .search-box {
    padding: 12px 16px;
  }
}
</style>
