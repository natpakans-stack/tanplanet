<script setup>
</script>

<template>
  <div class="mascot-footer">
    <div class="mascot-avatar">
      <img
        src="https://natpakans-stack.github.io/talk-to-figma-mcp/assets/aw-mascot.avif"
        alt="Aw mascot"
        width="160"
        height="160"
      />
    </div>
    <h3>🧠 ทุกสกิลอยู่ที่นี่</h3>
    <p class="mascot-desc">
      Claude Code Skills Registry — รวมทุกเครื่องมือที่ติดตั้งไว้ให้ดูได้ในที่เดียว อัปเดตได้ตลอด
    </p>
    <div class="mascot-links">
      <a href="/plugin/design-frontend">Plugins</a>
      <a href="/mcp/chat">MCP Servers</a>
      <a href="/bmad/team">BMAD</a>
      <a href="/custom/design-qa">Custom Skills</a>
      <a href="/lsp/">LSP</a>
      <a href="/tool/">Tools</a>
    </div>
    <div class="mascot-external">
      <a href="https://projects.tanplanet.info/" target="_blank">All Projects</a>
    </div>
    <p class="mascot-version">v1.2.0 — มี.ค. 2569</p>
  </div>
</template>

<style scoped>
.mascot-footer {
  text-align: center;
  padding: 48px 24px 32px;
  border-top: 1px solid var(--vp-c-divider);
  margin-top: 48px;
}

.mascot-avatar {
  display: flex;
  justify-content: center;
  margin-bottom: 16px;
}

.mascot-avatar img {
  width: 160px;
  height: auto;
  border-radius: 50%;
}

.mascot-footer h3 {
  font-size: 1.4rem;
  font-weight: 700;
  margin-bottom: 8px;
  color: var(--vp-c-text-1);
}

.mascot-desc {
  color: var(--vp-c-text-2);
  font-size: 0.95rem;
  max-width: 480px;
  margin: 0 auto 20px;
  line-height: 1.6;
}

.mascot-links {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 10px;
  margin-bottom: 16px;
}

.mascot-links a {
  padding: 8px 20px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 20px;
  color: var(--vp-c-text-1);
  text-decoration: none;
  font-size: 0.9rem;
  font-weight: 500;
  transition: border-color 0.2s, color 0.2s;
}

.mascot-links a:hover {
  border-color: var(--vp-c-brand-1);
  color: var(--vp-c-brand-1);
}

.mascot-external {
  margin-bottom: 12px;
}

.mascot-external a {
  color: var(--vp-c-brand-1);
  text-decoration: none;
  font-size: 0.9rem;
  font-weight: 500;
}

.mascot-external a:hover {
  text-decoration: underline;
}

.mascot-version {
  color: var(--vp-c-text-3);
  font-size: 0.82rem;
}
</style>
