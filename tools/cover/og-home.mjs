// OG หน้าแรก myfolio → pj/covers/site-home-<lang>-og.jpg (1200×630) — รันมือ: node tools/cover/og-home.mjs
import { chromium } from '/Users/natpakansirirat/.claude/skills/playwright-skill/node_modules/playwright/index.mjs';
import fs from 'fs'; import path from 'path'; import { fileURLToPath, pathToFileURL } from 'url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const tpl = fs.readFileSync(path.join(ROOT, 'tools/cover/og-home.html'), 'utf8');
const url = p => pathToFileURL(path.join(ROOT, p)).href;
const T = {
  th: { NAME: 'ณัฐปคัลภ์ ศิริรัตน์ (แทน)', ROLE: 'Product Designer & AI Builder', TAG: 'พอร์ตโฟลิโอ · บล็อก' },
  en: { NAME: 'Natpakan Sirirat (Tan)', ROLE: 'Product Designer & AI Builder', TAG: 'Portfolio · Blog' },
};
const b = await chromium.launch({ channel: 'chrome' });
const p = await b.newPage({ viewport: { width: 1200, height: 630 } });
for (const [lang, t] of Object.entries(T)) {
  let html = tpl.replace('{{LANG}}', lang).replace('{{LOGO}}', url('tanplanet-sites/myfolio/logo-header.png'))
    .replace('{{MASCOT}}', url('talk-to-figma-mcp/assets/aw-mascot.avif'));
  for (const [k, v] of Object.entries(t)) html = html.replace(`{{${k}}}`, v);
  const tmp = path.join(ROOT, `tools/cover/.tmp-og-home-${lang}.html`); fs.writeFileSync(tmp, html);
  await p.goto(pathToFileURL(tmp).href, { waitUntil: 'networkidle' }); await p.evaluate(() => document.fonts.ready);
  await p.screenshot({ path: path.join(ROOT, `pj/covers/site-home-${lang}-og.jpg`), type: 'jpeg', quality: 88 });
  fs.unlinkSync(tmp); console.log('ok', lang);
}
await b.close();
